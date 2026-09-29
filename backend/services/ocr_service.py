"""
OCR Service Module
==================

Core OCR processing logic extracted from the original Gradio app.
Handles document processing, API calls, and result formatting using asynchronous operations.
"""

import asyncio
import base64
import json
import logging
import os
import random
import re
import subprocess
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, List, Optional, Tuple

from dotenv import load_dotenv
from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI
from pypdf import PdfReader

import typhoon_ocr.ocr_utils
from typhoon_ocr import prepare_ocr_messages

load_dotenv()

logger = logging.getLogger("typhoon.ocr")


@dataclass
class Config:
    """Application configuration and model parameters."""
    BASE_URL: str = field(default_factory=lambda: os.getenv("TYPHOON_BASE_URL", "https://api.opentyphoon.ai/v1"))
    API_KEY: str = field(default_factory=lambda: os.getenv("TYPHOON_API_KEY", ""))
    MODEL_NAME: str = field(default_factory=lambda: os.getenv("TYPHOON_OCR_MODEL", "typhoon-ocr"))
    MAX_TOKENS: int = 16384
    REPETITION_PENALTY: float = 1.2
    TEMPERATURE: float = 0.1
    TOP_P: float = 0.6
    # Docs (docs.opentyphoon.ai/en/rate-limits): typhoon-ocr = 2 req/s, 20 req/min. 0 = unlimited (self-hosted).
    RATE_LIMIT_RPS: float = field(default_factory=lambda: float(os.getenv(
        "TYPHOON_RATE_LIMIT_RPS", "2" if "opentyphoon.ai" in os.getenv("TYPHOON_BASE_URL", "https://api.opentyphoon.ai/v1") else "0")))
    RATE_LIMIT_RPM: int = field(default_factory=lambda: int(os.getenv(
        "TYPHOON_RATE_LIMIT_RPM", "20" if "opentyphoon.ai" in os.getenv("TYPHOON_BASE_URL", "https://api.opentyphoon.ai/v1") else "0")))
    MAX_RETRIES: int = 5
    MAX_TIMEOUT_RETRIES: int = 2  # attempts allowed to time out (408 / client timeout) before failing the page
    IMAGE_DIM: int = 1800
    TEXT_LENGTH: int = 8000


@dataclass
class OcrPageResult:
    """Result for a single page."""
    page: int
    success: bool
    text: str = ""
    image_base64: str = ""
    error: Optional[str] = None


@dataclass
class OcrResult:
    """Complete OCR result."""
    success: bool
    results: List[OcrPageResult] = field(default_factory=list)
    total_tokens: int = 0
    processing_time: float = 0.0
    error: Optional[str] = None


def _apply_windows_patches() -> None:
    """
    Applies a monkey patch to fix Windows encoding issues with pdfinfo.
    """
    def patched_get_pdf_media_box_width_height(local_pdf_path: str, page_num: int) -> Tuple[float, float]:
        from typhoon_ocr.pdf_utils import pdf_utils_available
        if not pdf_utils_available:
            raise ImportError(
                "PDF utilities are not available. "
                "Installation instructions for Poppler utilities:\n"
                "- macOS: Run 'brew install poppler'\n"
                "- Ubuntu/Debian: Run 'apt-get install poppler-utils'\n"
                "- Windows: Install from https://github.com/oschwartz10612/poppler-windows/releases/ and add to PATH"
            )

        command = [
            "pdfinfo", "-f", str(page_num), "-l", str(page_num), "-box",
            "-enc", "UTF-8", local_pdf_path
        ]
        try:
            result = subprocess.run(
                command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, encoding='utf-8', errors='replace',
                timeout=30  # Add timeout to prevent hanging
            )
        except subprocess.TimeoutExpired:
            raise ValueError(f"pdfinfo timed out after 30 seconds for {local_pdf_path}")
        except FileNotFoundError:
            raise ValueError("pdfinfo utility not found. Please ensure Poppler is installed and in PATH.")

        if result.returncode != 0:
            raise ValueError(f"Error running pdfinfo: {result.stderr}")

        for line in result.stdout.splitlines():
            if "MediaBox" in line:
                try:
                    parts = line.split(":")[1].split()
                    return (
                        abs(float(parts[0]) - float(parts[2])),
                        abs(float(parts[3]) - float(parts[1]))
                    )
                except (IndexError, ValueError):
                    continue
        raise ValueError("MediaBox not found")

    typhoon_ocr.ocr_utils.get_pdf_media_box_width_height = patched_get_pdf_media_box_width_height


# Apply patches on module load
_apply_windows_patches()


class TyphoonOCRService:
    """Core OCR service for processing documents asynchronously."""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.client = AsyncOpenAI(
            base_url=self.config.BASE_URL,
            api_key=self.config.API_KEY,
            timeout=300.0,
            max_retries=0  # retries handled in _call_api_with_retry; SDK retries multiplied the storm
        )
        # One gate for ALL requests/files: per-request semaphores stacked (5 pages x 3 files = 15 upstream calls)
        self._api_gate = asyncio.Semaphore(int(os.getenv("TYPHOON_MAX_CONCURRENCY", "3")))
        self._rate_lock = asyncio.Lock()  # FIFO queue for request starts
        self._request_starts: deque = deque()  # monotonic start times within the last 60s

    async def _wait_for_rate_slot(self) -> None:
        """Block until one more request start fits the RPS and RPM limits (shared by every file)."""
        window = 61  # 60s + 1s margin: server counts arrival time, we count send time
        rps, rpm = self.config.RATE_LIMIT_RPS, self.config.RATE_LIMIT_RPM
        async with self._rate_lock:
            while True:
                now = time.monotonic()
                while self._request_starts and now - self._request_starts[0] >= window:
                    self._request_starts.popleft()
                wait = 0.0
                if rpm and len(self._request_starts) >= rpm:
                    wait = window - (now - self._request_starts[0])
                if rps and self._request_starts:
                    wait = max(wait, 1 / rps - (now - self._request_starts[-1]))
                if wait <= 0:
                    self._request_starts.append(now)
                    return
                logger.debug("rate limiter: waiting %.1fs", wait)
                await asyncio.sleep(wait)

    def get_page_count(self, file_path: str) -> int:
        """Safely retrieves page count for PDFs; returns 1 for images."""
        try:
            if file_path and file_path.lower().endswith(".pdf"):
                return len(PdfReader(file_path).pages)
        except Exception:
            pass
        return 1

    async def _call_api_with_retry(self, func: Callable, *args, log_ctx: str = "", **kwargs) -> Any:
        """
        Executes an async function with exponential backoff retry logic.
        """
        timeouts = 0  # 408/timeout = page stuck upstream; the same input stalls again, so don't retry 5x
        for attempt in range(self.config.MAX_RETRIES):
            waited_since = time.monotonic()
            # Sleep while holding the gate so a 429 backs off every in-flight page, not just this one
            async with self._api_gate:
                started = time.monotonic()
                logger.debug("%s waited %.1fs for API gate", log_ctx, started - waited_since)
                logger.info("%s API call attempt %d/%d", log_ctx, attempt + 1, self.config.MAX_RETRIES)
                try:
                    await self._wait_for_rate_slot()
                    started = time.monotonic()  # exclude time spent queued for the rate limit
                    response = await func(*args, **kwargs)
                    logger.info("%s API ok in %.1fs", log_ctx, time.monotonic() - started)
                    return response
                except (APIConnectionError, APITimeoutError) as e:
                    logger.warning("%s API %s after %.1fs (attempt %d/%d)", log_ctx, type(e).__name__,
                                   time.monotonic() - started, attempt + 1, self.config.MAX_RETRIES)
                    if isinstance(e, APITimeoutError):
                        timeouts += 1
                    if attempt == self.config.MAX_RETRIES - 1 or timeouts >= self.config.MAX_TIMEOUT_RETRIES:
                        raise e
                    await asyncio.sleep(2 ** attempt)
                except APIStatusError as e:
                    if e.status_code in [408, 429, 500, 502, 503, 504]:
                        if e.status_code == 408:
                            timeouts += 1
                        if attempt == self.config.MAX_RETRIES - 1 or timeouts >= self.config.MAX_TIMEOUT_RETRIES:
                            logger.error("%s API HTTP %s, giving up (attempt %d, timeouts %d)", log_ctx,
                                         e.status_code, attempt + 1, timeouts)
                            raise e
                        try:
                            delay = float(e.response.headers.get("retry-after", ""))
                        except ValueError:
                            delay = 2 ** attempt + random.random()  # jitter, per Typhoon rate-limit docs
                        logger.warning("%s API HTTP %s after %.1fs, retry in %.0fs (attempt %d/%d)", log_ctx,
                                       e.status_code, time.monotonic() - started, min(delay, 60),
                                       attempt + 1, self.config.MAX_RETRIES)
                        await asyncio.sleep(min(delay, 60))
                    else:
                        logger.error("%s API HTTP %s (not retryable): %s", log_ctx, e.status_code, e)
                        raise e
                except Exception as e:
                    raise e

    def _resolve_model_name(self, model: Optional[str]) -> str:
        """Resolve model name from request value or environment fallback."""
        candidate = (model or "").strip()
        if candidate:
            return candidate
        return self.config.MODEL_NAME

    def _resolve_model_and_task_type(self, model: Optional[str], task_type: Optional[str]) -> Tuple[str, str]:
        """Resolve model name and ensure compatible task_type."""
        resolved_model = self._resolve_model_name(model)
        normalized_task = (task_type or "v1.5").strip()

        # If model is explicitly a legacy preview model, enforce default or structure
        if "typhoon-ocr-preview" in resolved_model.lower():
            if normalized_task not in ["default", "structure"]:
                normalized_task = "structure"
        elif "typhoon-ocr" in resolved_model.lower() or normalized_task not in ["default", "structure"]:
            # Typhoon OCR 1.5 is a single-prompt model; force v1.5 to prevent legacy anchor text prompting
            normalized_task = "v1.5"

        return resolved_model, normalized_task

    @staticmethod
    def _extract_image_base64(messages: List[dict]) -> str:
        """Extract preview image (base64) from prepared OCR messages."""
        try:
            img_url = messages[0]["content"][1]["image_url"]["url"]
            return img_url.split(",")[-1] if "," in img_url else ""
        except Exception:
            return ""

    @staticmethod
    def _parse_response_text(content: Any, task_type: str = "v1.5") -> str:
        """
        Parse model output into final text.
        For v1.5, Typhoon OCR outputs clean Markdown directly (preserving <table> and <figure>).
        For legacy v1 models, natural_text is extracted from JSON or code fences.
        """
        if content is None:
            return ""

        raw_content = str(content).strip()
        if not raw_content:
            return ""

        # For v1.5, return clean markdown directly without stripping figure tags
        if task_type == "v1.5":
            return raw_content

        def _extract_from_json(candidate: str) -> Optional[str]:
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict):
                    natural_text = parsed.get("natural_text")
                    if natural_text is not None:
                        return str(natural_text)
            except (json.JSONDecodeError, TypeError):
                return None
            return None

        parsed_text = _extract_from_json(raw_content)
        if parsed_text is None:
            fenced_matches = re.findall(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw_content, re.IGNORECASE)
            for candidate in fenced_matches:
                parsed_text = _extract_from_json(candidate)
                if parsed_text is not None:
                    break

        if parsed_text is None:
            parsed_text = raw_content

        return parsed_text.strip()

    async def process_single_page(
        self,
        file_path: str,
        page_num: int,
        task_type: str = "v1.5",
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        repetition_penalty: Optional[float] = None,
        figure_language: str = "Thai",
    ) -> Tuple[OcrPageResult, int]:
        """
        Process a single page asynchronously and return page result with token usage.
        """
        resolved_model, task_type = self._resolve_model_and_task_type(model, task_type)
        _max_tokens = max_tokens or self.config.MAX_TOKENS
        _temperature = temperature if temperature is not None else self.config.TEMPERATURE
        _top_p = top_p if top_p is not None else self.config.TOP_P
        if repetition_penalty is not None:
            _repetition_penalty = repetition_penalty
        elif task_type == "v1.5":
            _repetition_penalty = 1.1
        else:
            _repetition_penalty = self.config.REPETITION_PENALTY

        ctx = f"[{os.path.basename(file_path)} p{page_num}]"
        try:
            # File reading and image processing is CPU bound, offload to thread pool
            render_started = time.monotonic()
            messages = await asyncio.to_thread(
                prepare_ocr_messages,
                file_path,
                task_type,
                self.config.IMAGE_DIM,
                self.config.TEXT_LENGTH,
                page_num,
                figure_language,
            )

            image_base64 = self._extract_image_base64(messages)
            logger.debug("%s rendered in %.1fs (%d KB base64)", ctx, time.monotonic() - render_started,
                         len(image_base64) // 1024)

            response = await self._call_api_with_retry(
                self.client.chat.completions.create,
                log_ctx=ctx,
                model=resolved_model,
                messages=messages,
                max_tokens=_max_tokens,
                extra_body={
                    "repetition_penalty": _repetition_penalty,
                    "temperature": _temperature,
                    "top_p": _top_p
                }
            )

            token_count = 0
            if hasattr(response, "usage") and response.usage and getattr(response.usage, "total_tokens", None):
                token_count = int(response.usage.total_tokens)

            content = response.choices[0].message.content
            finish_reason = response.choices[0].finish_reason
            logger.info("%s done: %d tokens, %d chars, finish_reason=%s", ctx, token_count, len(content or ""),
                        finish_reason)
            if finish_reason == "length":
                logger.warning("%s output hit max_tokens (%d): likely repetition loop, text truncated", ctx,
                               _max_tokens)
            text = self._parse_response_text(content, task_type=task_type)

            return (
                OcrPageResult(
                    page=page_num,
                    success=True,
                    text=text,
                    image_base64=image_base64
                ),
                token_count
            )

        except Exception as e:
            logger.error("%s FAILED: %s: %s", ctx, type(e).__name__, e, exc_info=logger.isEnabledFor(logging.DEBUG))
            return (
                OcrPageResult(
                    page=page_num,
                    success=False,
                    error=str(e)
                ),
                0
            )

    async def process_document(
        self,
        file_path: str,
        task_type: str = "v1.5",
        model: Optional[str] = None,
        pages: Optional[List[int]] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        repetition_penalty: Optional[float] = None,
        figure_language: str = "Thai",
    ) -> OcrResult:
        """
        Main processing function for OCR, running page tasks concurrently.
        """
        start_time = time.time()

        if not file_path or not os.path.exists(file_path):
            return OcrResult(success=False, error="File not found")

        is_pdf = file_path.lower().endswith(".pdf")
        # get_page_count is fast enough to keep sync, but could be offloaded
        total_pages = await asyncio.to_thread(self.get_page_count, file_path)

        if pages:
            target_pages = [p for p in pages if 1 <= p <= total_pages]
        elif is_pdf:
            target_pages = list(range(1, total_pages + 1))
        else:
            target_pages = [1]

        results: List[OcrPageResult] = []
        total_tokens = 0

        semaphore = asyncio.Semaphore(5)

        async def _process_page(page_num):
            async with semaphore:
                return await self.process_single_page(
                    file_path=file_path,
                    page_num=page_num,
                    task_type=task_type,
                    model=model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    repetition_penalty=repetition_penalty,
                    figure_language=figure_language,
                )

        tasks = [asyncio.create_task(_process_page(p)) for p in target_pages]
        completed_tasks = await asyncio.gather(*tasks)

        for page_result, token_count in completed_tasks:
            results.append(page_result)
            total_tokens += token_count

        processing_time = time.time() - start_time

        return OcrResult(
            success=all(r.success for r in results),
            results=results,
            total_tokens=total_tokens,
            processing_time=round(processing_time, 2)
        )


# Singleton instance
_service_instance: Optional[TyphoonOCRService] = None


def get_ocr_service() -> TyphoonOCRService:
    """Get or create the OCR service singleton."""
    global _service_instance
    if _service_instance is None:
        _service_instance = TyphoonOCRService()
    return _service_instance


def reset_service() -> None:
    """Reset the OCR service singleton so it reloads config on next access."""
    global _service_instance
    _service_instance = None
