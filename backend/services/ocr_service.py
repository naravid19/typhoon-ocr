"""
OCR Service Module
==================

Core OCR processing logic extracted from the original Gradio app.
Handles document processing, API calls, and result formatting.
"""

import base64
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any, Callable, List, Optional, Tuple

from dotenv import load_dotenv
from openai import APIConnectionError, APITimeoutError, OpenAI
from PIL import Image
from pypdf import PdfReader

# Add packages to path for typhoon_ocr import
packages_path = Path(__file__).parent.parent.parent / "packages"
sys.path.insert(0, str(packages_path))

import typhoon_ocr.ocr_utils
from typhoon_ocr import prepare_ocr_messages

load_dotenv()


@dataclass
class Config:
    """Application configuration and model parameters."""
    BASE_URL: str = field(default_factory=lambda: os.getenv("TYPHOON_BASE_URL", ""))
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
        result = subprocess.run(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding='utf-8', errors='replace'
        )
        
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
    """Core OCR service for processing documents."""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.client = OpenAI(
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

    def _call_api_with_retry(self, func: Callable, *args, **kwargs) -> Any:
        """
        Executes a function with exponential backoff retry logic.
        """
        for attempt in range(self.config.MAX_RETRIES):
            try:
                return func(*args, **kwargs)
            except (APIConnectionError, APITimeoutError) as e:
                if attempt == self.config.MAX_RETRIES - 1:
                    raise e
                time.sleep(2 ** attempt)
            except Exception as e:
                raise e

    def process_document(
        self,
        file_path: str,
        task_type: str = "default",
        pages: Optional[List[int]] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        repetition_penalty: Optional[float] = None,
    ) -> OcrResult:
        """
        Main processing function for OCR.
        
        Args:
            file_path: Path to the file to process
            task_type: "default" or "structure"
            pages: List of page numbers to process (1-indexed)
            max_tokens: Override default max tokens
            temperature: Override default temperature
            top_p: Override default top_p
            repetition_penalty: Override default repetition penalty
            
        Returns:
            OcrResult with processing results
        """
        start_time = time.time()
        
        if not file_path or not os.path.exists(file_path):
            return OcrResult(success=False, error="File not found")

        is_pdf = file_path.lower().endswith(".pdf")
        total_pages = self.get_page_count(file_path)

        # Determine target pages
        if pages:
            target_pages = [p for p in pages if 1 <= p <= total_pages]
        elif is_pdf:
            target_pages = list(range(1, total_pages + 1))
        else:
            target_pages = [1]

        # Use provided params or defaults
        _max_tokens = max_tokens or self.config.MAX_TOKENS
        _temperature = temperature if temperature is not None else self.config.TEMPERATURE
        _top_p = top_p if top_p is not None else self.config.TOP_P
        _repetition_penalty = repetition_penalty if repetition_penalty is not None else self.config.REPETITION_PENALTY

        results: List[OcrPageResult] = []
        total_tokens = 0

        for page_num in target_pages:
            try:
                # Prepare OCR messages
                messages = prepare_ocr_messages(
                    file_path, 
                    task_type, 
                    self.config.IMAGE_DIM, 
                    self.config.TEXT_LENGTH, 
                    page_num
                )
                
                # Extract image preview (Base64)
                image_base64 = ""
                try:
                    img_url = messages[0]["content"][1]["image_url"]["url"]
                    image_base64 = img_url.split(",")[-1] if "," in img_url else ""
                except Exception:
                    pass
                
                # API Call with Retry
                response = self._call_api_with_retry(
                    self.client.chat.completions.create,
                    model=self.config.MODEL_NAME,
                    messages=messages,
                    max_tokens=_max_tokens,
                    extra_body={
                        "repetition_penalty": _repetition_penalty,
                        "temperature": _temperature,
                        "top_p": _top_p
                    }
                )
                
                # Parse response
                content = response.choices[0].message.content
                
                # Track tokens
                if hasattr(response, 'usage') and response.usage:
                    total_tokens += response.usage.total_tokens
                
                # Try to parse JSON output
                try:
                    parsed = json.loads(content)
                    text = parsed.get("natural_text", content)
                except json.JSONDecodeError:
                    text = content
                
                # Clean tags
                text = text.replace("<figure>", "").replace("</figure>", "").strip()
                
                results.append(OcrPageResult(
                    page=page_num,
                    success=True,
                    text=text,
                    image_base64=image_base64
                ))

            except Exception as e:
                results.append(OcrPageResult(
                    page=page_num,
                    success=False,
                    error=str(e)
                ))

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
