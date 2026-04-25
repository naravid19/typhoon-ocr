"""
OCR Routes Module
=================

FastAPI routes for OCR processing endpoints.
"""

import json
import os
import tempfile
import shutil
import time
from typing import List, Optional, AsyncGenerator

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
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
    task_type: str = Form(default="default", description="Task type: default, structure, or v1.5"),
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
    - **task_type**: 'default', 'structure', or 'v1.5'
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
        result: OcrResult = await service.process_document(
            file_path=temp_path,
            task_type=task_type,
            model=model,
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


@router.post("/api/ocr/stream")
async def process_ocr_stream(
    file: UploadFile = File(..., description="Image or PDF file to process"),
    model: str = Form(default="typhoon-ocr", description="Model to use"),
    task_type: str = Form(default="default", description="Task type: default, structure, or v1.5"),
    max_tokens: int = Form(default=16384, description="Maximum tokens"),
    temperature: float = Form(default=0.1, description="Temperature (0.0-1.0)"),
    top_p: float = Form(default=0.6, description="Top P (0.0-1.0)"),
    repetition_penalty: float = Form(default=1.2, description="Repetition penalty"),
    pages: Optional[str] = Form(default=None, description="Comma-separated page numbers")
):
    """
    Process a document with Typhoon OCR and stream progress via SSE.
    
    Events:
    - {"type": "start", "total_pages": N, "total": N}
    - {"type": "progress", "current": X, "total": N, "page": P}
    - {"type": "page_complete", "page": P, "success": bool, "text": "...", "error": null}
    - {"type": "complete", "success": bool, "total_tokens": N, "processing_time": T}
    """
    # Validate file type
    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    
    if file_ext not in allowed_extensions:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': f'Unsupported file type: {file_ext}'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")
    
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
            page_list = sorted(list(set(page_list)))
        except ValueError:
            async def error_stream():
                yield f"data: {json.dumps({'type': 'error', 'message': 'Invalid pages format'})}\n\n"
            return StreamingResponse(error_stream(), media_type="text/event-stream")
    
    # Save uploaded file to temp location
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename or "uploaded_file")
    
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    async def generate_stream() -> AsyncGenerator[str, None]:
        start_time = time.time()
        service = get_ocr_service()
        total_tokens = 0
        results = []
        
        # 1. Send massive padding and a "connecting" signal IMMEDIATELY
        # Increase padding to 4KB for even better buffer flushing
        padding = ":" + " " * 4096 + "\n\n"
        yield padding
        yield f"data: {json.dumps({'type': 'progress', 'current': 0, 'total': 0, 'message': 'Establishing connection...'})}\n\n"
        
        try:
            # 2. Get page count (This might take a moment)
            import asyncio
            is_pdf = temp_path.lower().endswith(".pdf")
            total_pages_in_doc = await asyncio.to_thread(service.get_page_count, temp_path)
            
            # Determine target pages
            if page_list:
                target_pages = [p for p in page_list if 1 <= p <= total_pages_in_doc]
            elif is_pdf:
                target_pages = list(range(1, total_pages_in_doc + 1))
            else:
                target_pages = [1]
            
            total_targets = len(target_pages)
            
            # 3. Send the official START event
            yield f"data: {json.dumps({'type': 'start', 'total_pages': total_targets, 'total': total_targets})}\n\n"
            
            semaphore = asyncio.Semaphore(5)
            
            async def process_page_with_semaphore(p_num):
                async with semaphore:
                    return await service.process_single_page(
                        file_path=temp_path,
                        page_num=p_num,
                        task_type=task_type,
                        model=model,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        top_p=top_p,
                        repetition_penalty=repetition_penalty
                    )

            # Queue all tasks for concurrent processing
            tasks = [asyncio.create_task(process_page_with_semaphore(p)) for p in target_pages]
            
            # Process results in order
            for idx, task in enumerate(tasks, 1):
                # Send progress event for UI update (even though it's processing in parallel)
                yield f"data: {json.dumps({'type': 'progress', 'current': idx, 'total': total_targets, 'page': target_pages[idx-1]})}\n\n"
                
                page_result, page_tokens = await task
                results.append(page_result)
                total_tokens += page_tokens

                # Send page complete event
                yield f"data: {json.dumps({'type': 'page_complete', 'page': page_result.page, 'success': page_result.success, 'text': page_result.text[:200] + '...' if len(page_result.text) > 200 else page_result.text, 'image_base64': page_result.image_base64[:100] if page_result.image_base64 else '', 'error': page_result.error})}\n\n"
            
            processing_time = round(time.time() - start_time, 2)
            
            # Send complete event with full results
            final_results = [
                {
                    'page': r.page,
                    'success': r.success,
                    'text': r.text,
                    'image_base64': r.image_base64,
                    'error': r.error
                }
                for r in results
            ]
            
            yield f"data: {json.dumps({'type': 'complete', 'success': all(r.success for r in results), 'results': final_results, 'total_tokens': total_tokens, 'processing_time': processing_time})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        
        finally:
            # Cleanup temp files
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

