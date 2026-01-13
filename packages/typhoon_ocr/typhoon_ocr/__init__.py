"""
Typhoon OCR is a model for extracting structured markdown from images or PDFs.

This package provides utilities for document analysis, layout extraction, and OCR processing.
It focuses on structured text extraction with proper formatting and layout preservation.

Main Functions:
    - prepare_ocr_messages: Generate OCR-ready messages from PDFs or images
    - get_prompt: Access built-in prompt templates for different OCR tasks (default, structure, v1.5)
    - image_to_pdf: Convert image files to PDF format
    - ocr_document: End-to-end OCR processing with Typhoon API

OCR v1.5 Features:
    - Clean Markdown output without anchor text requirement
    - HTML table formatting
    - Thai language figure descriptions
    - LaTeX equation support
    - Checkbox rendering

Requirements:
    - Poppler utilities (pdfinfo, pdftoppm) for PDF processing (checked at runtime)
    - Dependencies: ftfy, pypdf, pillow for text/image processing

Example Usage:
    >>> from typhoon_ocr import prepare_ocr_messages
    >>> # OCR v1.5 with clean Markdown output
    >>> messages = prepare_ocr_messages("document.pdf", task_type="v1.5", page_num=1)
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

__version__ = "0.4.1"

__all__ = [
    "pdf_utils_available",
    "prepare_ocr_messages",
    "get_prompt",
    "get_anchor_text", 
    "image_to_pdf",
    "ocr_document",
] 