import sys
from pathlib import Path
from fastapi.testclient import TestClient
import pytest
from unittest.mock import MagicMock, patch

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from main import app

client = TestClient(app)

def test_health_check():
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "typhoon-ocr-backend"}

def test_list_models():
    """Test listing models."""
    response = client.get("/api/models")
    assert response.status_code == 200
    models = response.json()
    assert isinstance(models, list)
    assert len(models) > 0
    assert models[0]["id"] == "typhoon-ocr"

@patch("routes.ocr.get_ocr_service")
def test_ocr_endpoint_mock(mock_get_service):
    """Test OCR endpoint with mocked service."""
    from services.ocr_service import OcrResult, OcrPageResult
    
    # Setup mock
    mock_service_instance = MagicMock()
    mock_service_instance.process_document.return_value = OcrResult(
        success=True,
        results=[
            OcrPageResult(page=1, success=True, text="Test OCR result", image_base64="base64data", error=None)
        ],
        total_tokens=100,
        processing_time=1.5,
        error=None
    )
    mock_get_service.return_value = mock_service_instance

    # Create dummy file
    files = {'file': ('test.pdf', b'dummy content', 'application/pdf')}
    data = {
        'model': 'typhoon-ocr',
        'task_type': 'default'
    }

    response = client.post("/api/ocr", files=files, data=data)
    
    assert response.status_code == 200, f"Response: {response.text}"
    result = response.json()
    assert result["success"] is True
    assert len(result["results"]) == 1
    assert result["results"][0]["text"] == "Test OCR result"
