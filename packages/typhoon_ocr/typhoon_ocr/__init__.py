"""
Typhoon OCR is a model for extracting structured markdown from images or PDFs.

This package provides utilities for document analysis, layout extraction, and OCR processing.
It focuses on structured text extraction with proper formatting and layout preservation.

Main Functions:
    - prepare_ocr_messages: Generate OCR-ready messages from PDFs or images
    - get_prompt: Access built-in prompt templates for different OCR tasks
    - image_to_pdf: Convert image files to PDF format

Requirements:
    - Poppler utilities (pdfinfo, pdftoppm) must be installed on the system
    - Appropriate dependencies (ftfy, pypdf, pillow) for text processing

Example Usage:
    >>> from typhoon_ocr import prepare_ocr_messages
    >>> messages = prepare_ocr_messages("document.pdf", task_type="default", page_num=1)
    >>> # Use messages with LLM API for OCR processing
"""
from .pdf_utils import pdf_utils_available
from .ocr_utils import (
    prepare_ocr_messages,
    get_prompt,
    get_anchor_text,
    image_to_pdf,
    ocr_document,
)

__version__ = "0.3.8"

__all__ = [
    "pdf_utils_available",
    "prepare_ocr_messages",
    "get_prompt",
    "get_anchor_text", 
    "image_to_pdf",
    "ocr_document",
] 