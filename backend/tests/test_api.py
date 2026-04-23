import sys
import shutil
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from uuid import uuid4

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from main import app

client = TestClient(app)


def _make_workspace_tmp_dir() -> str:
    temp_root = backend_path / "tests" / "_tmp"
    temp_root.mkdir(parents=True, exist_ok=True)
    temp_dir = temp_root / f"api-{uuid4().hex}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    return str(temp_dir)

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

    temp_dir = _make_workspace_tmp_dir()
    try:
        with patch("routes.ocr.tempfile.mkdtemp", return_value=temp_dir):
            response = client.post("/api/ocr", files=files, data=data)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
    
    assert response.status_code == 200, f"Response: {response.text}"
    result = response.json()
    assert result["success"] is True
    assert len(result["results"]) == 1
    assert result["results"][0]["text"] == "Test OCR result"

    mock_service_instance.process_document.assert_called_once()
    called_kwargs = mock_service_instance.process_document.call_args.kwargs
    assert called_kwargs["model"] == "typhoon-ocr"
    assert called_kwargs["task_type"] == "default"


@patch("routes.ocr.get_ocr_service")
def test_ocr_endpoint_accepts_v15_task_type(mock_get_service):
    """Test OCR endpoint accepts v1.5 and forwards it to service."""
    from services.ocr_service import OcrResult, OcrPageResult

    mock_service_instance = MagicMock()
    mock_service_instance.process_document.return_value = OcrResult(
        success=True,
        results=[
            OcrPageResult(page=1, success=True, text="v1.5 output", image_base64="", error=None)
        ],
        total_tokens=42,
        processing_time=0.8,
        error=None
    )
    mock_get_service.return_value = mock_service_instance

    files = {'file': ('test.pdf', b'dummy content', 'application/pdf')}
    data = {
        'model': 'typhoon-ocr',
        'task_type': 'v1.5'
    }

    temp_dir = _make_workspace_tmp_dir()
    try:
        with patch("routes.ocr.tempfile.mkdtemp", return_value=temp_dir):
            response = client.post("/api/ocr", files=files, data=data)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    assert response.status_code == 200, f"Response: {response.text}"
    payload = response.json()
    assert payload["success"] is True
    assert payload["results"][0]["text"] == "v1.5 output"

    called_kwargs = mock_service_instance.process_document.call_args.kwargs
    assert called_kwargs["task_type"] == "v1.5"
    assert called_kwargs["model"] == "typhoon-ocr"
