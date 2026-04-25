"""
OCR Service Module
==================

Core OCR processing logic extracted from the original Gradio app.
Handles document processing, API calls, and result formatting using asynchronous operations.
"""

import asyncio
import base64
import json
import os
import re
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, List, Optional, Tuple

from dotenv import load_dotenv
from openai import APIConnectionError, APITimeoutError, AsyncOpenAI
from pypdf import PdfReader

import typhoon_ocr.ocr_utils
from typhoon_ocr import prepare_ocr_messages

load_dotenv()


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
    MAX_RETRIES: int = 5
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
            api_key=self.config.API_KEY
        )

    def get_page_count(self, file_path: str) -> int:
        """Safely retrieves page count for PDFs; returns 1 for images."""
        try:
            if file_path and file_path.lower().endswith(".pdf"):
                return len(PdfReader(file_path).pages)
        except Exception:
            pass
        return 1

    async def _call_api_with_retry(self, func: Callable, *args, **kwargs) -> Any:
        """
        Executes an async function with exponential backoff retry logic.
        """
        for attempt in range(self.config.MAX_RETRIES):
            try:
                return await func(*args, **kwargs)
            except (APIConnectionError, APITimeoutError) as e:
                if attempt == self.config.MAX_RETRIES - 1:
                    raise e
                await asyncio.sleep(2 ** attempt)
            except Exception as e:
                raise e

    def _resolve_model_name(self, model: Optional[str]) -> str:
        """Resolve model name from request value or environment fallback."""
        candidate = (model or "").strip()
        if candidate:
            return candidate
        return self.config.MODEL_NAME

    @staticmethod
    def _extract_image_base64(messages: List[dict]) -> str:
        """Extract preview image (base64) from prepared OCR messages."""
        try:
            img_url = messages[0]["content"][1]["image_url"]["url"]
            return img_url.split(",")[-1] if "," in img_url else ""
        except Exception:
            return ""

    @staticmethod
    def _parse_response_text(content: Any) -> str:
        """
        Parse model output into final text.
        """
        if content is None:
            return ""

        raw_content = str(content).strip()
        if not raw_content:
            return ""

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

        return parsed_text.replace("<figure>", "").replace("</figure>", "").strip()

    async def process_single_page(
        self,
        file_path: str,
        page_num: int,
        task_type: str = "default",
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        repetition_penalty: Optional[float] = None,
    ) -> Tuple[OcrPageResult, int]:
        """
        Process a single page asynchronously and return page result with token usage.
        """
        _max_tokens = max_tokens or self.config.MAX_TOKENS
        _temperature = temperature if temperature is not None else self.config.TEMPERATURE
        _top_p = top_p if top_p is not None else self.config.TOP_P
        _repetition_penalty = repetition_penalty if repetition_penalty is not None else self.config.REPETITION_PENALTY
        resolved_model = self._resolve_model_name(model)

        try:
            # File reading and image processing is CPU bound, offload to thread pool
            messages = await asyncio.to_thread(
                prepare_ocr_messages,
                file_path,
                task_type,
                self.config.IMAGE_DIM,
                self.config.TEXT_LENGTH,
                page_num
            )

            image_base64 = self._extract_image_base64(messages)

            response = await self._call_api_with_retry(
                self.client.chat.completions.create,
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
            text = self._parse_response_text(content)

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
        task_type: str = "default",
        model: Optional[str] = None,
        pages: Optional[List[int]] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        repetition_penalty: Optional[float] = None,
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
                    repetition_penalty=repetition_penalty
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
