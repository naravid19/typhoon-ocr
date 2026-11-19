import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from services.ocr_service import Config, OcrService

svc = OcrService(Config(API_KEY="x", CACHE_DIR=None))
F = '```json\n[{"bbox":[0,0,1,1],"category":"header","text":"H"},' \
    '{"bbox":[0,0,1,1],"category":"title","text":"# T"},' \
    '{"bbox":[0,0,1,1],"category":"figure","text":""},' \
    '{"bbox":[0,0,1,1],"category":"table","text":"<table></table>"}]\n```'

@pytest.mark.parametrize("model,task,expected", [
    ("typhoon-ocr-v2", "v1.5", "v2"), ("typhoon-ocr2", None, "v2"), ("Typhoon-OCR2-0.8b", "structure", "v2"),
    ("typhoon-ocr", "v2", "v1.5"), ("typhoon-ocr-preview", "default", "default"), ("typhoon-ocr-preview", "v2", "structure"),
])
def test_resolve(model, task, expected): assert svc._resolve_model_and_task_type(model, task)[1] == expected

def test_parse_v2_fenced(): assert OcrService._parse_response_text(F, "v2") == "# T\n\n<table></table>"
def test_parse_v2_unfenced(): assert OcrService._parse_response_text("Here:\n" + F.strip("`json\n"), "v2") == "# T\n\n<table></table>"
def test_parse_v2_truncated():
    cut = '```json\n[{"category":"text","text":"a"},{"category":"text","text":"b"},{"category":"text","te'
    assert OcrService._parse_response_text(cut, "v2") == "a\n\nb"
def test_parse_v2_bad_elements():
    assert OcrService._parse_response_text('[1, {"category":"text","text":null}, {"category":"text","text":"ok"}]', "v2") == "ok"
def test_parse_v2_garbage_returns_raw(): assert OcrService._parse_response_text("plain words", "v2") == "plain words"
def test_extract_image_any_order():
    msgs = [{"content": [{"type": "image_url", "image_url": {"url": "data:image/png;base64,QUJD"}}, {"type": "text", "text": "p"}]}]
    assert OcrService._extract_image_base64(msgs) == "QUJD"

@pytest.mark.asyncio
async def test_process_single_page_v2(tmp_path):
    test_svc = OcrService(Config(API_KEY="x", CACHE_DIR=None))
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = F
    mock_choice.finish_reason = "stop"
    mock_response.choices = [mock_choice]
    mock_response.usage = None

    fake_messages = [{"role": "user", "content": [
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,QUJD"}},
        {"type": "text", "text": "prompt"}
    ]}]

    with patch.object(test_svc, "_call_api_with_retry", new_callable=AsyncMock) as mock_call, \
         patch("services.ocr_service.prepare_ocr_messages", return_value=fake_messages):
        mock_call.return_value = mock_response
        page_res, _ = await test_svc.process_single_page(
            str(tmp_path / "dummy.png"),
            1,
            task_type="v2",
            model="typhoon-ocr-v2",
            temperature=None,
            repetition_penalty=None,
        )

        assert mock_call.call_count == 1
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["extra_body"] == {
            "repetition_penalty": 1.0,
            "temperature": 0,
            "top_p": test_svc.config.TOP_P,
            "chat_template_kwargs": {"enable_thinking": False},
        }
        assert page_res.text == "# T\n\n<table></table>"

    with patch.object(test_svc, "_call_api_with_retry", new_callable=AsyncMock) as mock_call, \
         patch("services.ocr_service.prepare_ocr_messages", return_value=fake_messages):
        mock_call.return_value = mock_response
        await test_svc.process_single_page(
            str(tmp_path / "dummy.png"),
            1,
            task_type="v1.5",
            model="typhoon-ocr",
            temperature=None,
            repetition_penalty=None,
        )

        assert mock_call.call_count == 1
        call_kwargs = mock_call.call_args.kwargs
        assert "chat_template_kwargs" not in call_kwargs["extra_body"]
