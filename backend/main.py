"""
Typhoon OCR - FastAPI Backend
=============================

REST API backend for the Typhoon OCR web application.
Provides OCR processing endpoints for the Next.js frontend.
"""

import sys
from pathlib import Path

# Add backend directory to path for module discovery
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.ocr import router as ocr_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    print("🚀 Typhoon OCR Backend starting...")
    yield
    print("👋 Typhoon OCR Backend shutting down...")


app = FastAPI(
    title="Typhoon OCR API",
    description="REST API for Typhoon OCR document processing",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ocr_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "typhoon-ocr-backend"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
