"""
OCR Routes Module
=================

FastAPI routes for OCR processing endpoints.
"""

import os
import tempfile
import shutil
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from services.ocr_service import get_ocr_service, OcrResult, OcrPageResult


router = APIRouter(tags=["OCR"])


class OcrPageResponse(BaseModel):
    """Response model for a single page result."""
    page: int
    success: bool
    text: str = ""
    image_base64: str = ""
    error: Optional[str] = None


class OcrResponse(BaseModel):
    """Response model for OCR processing."""
    success: bool
    results: List[OcrPageResponse]
    total_tokens: int
    processing_time: float
    error: Optional[str] = None


class ModelInfo(BaseModel):
    """Model information."""
    id: str
    name: str
    description: str


@router.post("/api/ocr", response_model=OcrResponse)
async def process_ocr(
    file: UploadFile = File(..., description="Image or PDF file to process"),
    model: str = Form(default="typhoon-ocr", description="Model to use"),
    task_type: str = Form(default="default", description="Task type: default or structure"),
    max_tokens: int = Form(default=16384, description="Maximum tokens"),
    temperature: float = Form(default=0.1, description="Temperature (0.0-1.0)"),
    top_p: float = Form(default=0.6, description="Top P (0.0-1.0)"),
    repetition_penalty: float = Form(default=1.2, description="Repetition penalty"),
    pages: Optional[str] = Form(default=None, description="Comma-separated page numbers (e.g., '1,2,3')")
):
    """
    Process a document with Typhoon OCR.
    
    - **file**: PDF or image file (JPEG, PNG)
    - **model**: Model name (default: typhoon-ocr)
    - **task_type**: 'default' or 'structure'
    - **max_tokens**: Maximum tokens for response
    - **temperature**: Sampling temperature
    - **top_p**: Top-p sampling
    - **repetition_penalty**: Repetition penalty
    - **pages**: Specific pages to process (comma-separated)
    """
    # Validate file type
    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Parse pages parameter
    page_list: Optional[List[int]] = None
    if pages:
        try:
            page_list = []
            for part in pages.split(","):
                part = part.strip()
                if not part:
                    continue
                if "-" in part:
                    start, end = map(int, part.split("-"))
                    if start > end:
                         start, end = end, start
                    page_list.extend(range(start, end + 1))
                else:
                    page_list.append(int(part))
            # Sort and unique
            page_list = sorted(list(set(page_list)))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid pages format. Use comma-separated numbers or ranges (e.g., '1-3,5').")
    
    # Save uploaded file to temp location
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename or "uploaded_file")
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process with OCR service
        service = get_ocr_service()
        result: OcrResult = service.process_document(
            file_path=temp_path,
            task_type=task_type,
            pages=page_list,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=repetition_penalty
        )
        
        # Convert to response model
        return OcrResponse(
            success=result.success,
            results=[
                OcrPageResponse(
                    page=r.page,
                    success=r.success,
                    text=r.text,
                    image_base64=r.image_base64,
                    error=r.error
                )
                for r in result.results
            ],
            total_tokens=result.total_tokens,
            processing_time=result.processing_time,
            error=result.error
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Cleanup temp files
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.get("/api/models", response_model=List[ModelInfo])
async def list_models():
    """List available OCR models."""
    return [
        ModelInfo(
            id="typhoon-ocr",
            name="Typhoon OCR",
            description="Default OCR model for document processing"
        )
    ]


@router.get("/api/page-count")
async def get_page_count(
    file: UploadFile = File(..., description="PDF file to get page count")
):
    """Get the page count of a PDF file."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return {"page_count": 1, "is_pdf": False}
    
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename)
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        service = get_ocr_service()
        page_count = service.get_page_count(temp_path)
        
        return {"page_count": page_count, "is_pdf": True}
        
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
