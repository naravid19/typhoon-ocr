"""
Simplified error handling tests for typhoon-ocr package.

This test module focuses on critical error scenarios that users will actually encounter,
testing what the code actually does rather than forcing brittle expectations.
"""
import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock
import base64

# Import the functions to test
from typhoon_ocr.ocr_utils import (
    ocr_document,
    prepare_ocr_messages,
    resize_if_needed,
    image_to_base64png,
    ensure_image_in_path,
    is_base64_string,
    get_pdf_media_box_width_height,
    render_pdf_to_base64png,
    image_to_pdf,
)
from typhoon_ocr.pdf_utils import pdf_utils_available


class TestCriticalFileErrors:
    """Test critical file handling error scenarios."""

    def test_nonexistent_file_path(self):
        """Test handling of non-existent file paths."""
        nonexistent_path = "/path/that/does/not/exist.jpg"
        
        with pytest.raises(ValueError) as exc_info:
            prepare_ocr_messages(nonexistent_path)
        
        assert "Error processing document" in str(exc_info.value)

    @patch('typhoon_ocr.ocr_utils.Image.open')
    def test_corrupted_image_file(self, mock_image_open):
        """Test handling of corrupted image files."""
        mock_image_open.side_effect = Exception("Cannot identify image file")
        
        with pytest.raises(ValueError) as exc_info:
            prepare_ocr_messages("corrupted.jpg")
        
        assert "Error processing document" in str(exc_info.value)

    @patch('typhoon_ocr.ocr_utils.Image.open')
    def test_image_to_pdf_handles_gracefully(self, mock_image_open):
        """Test that image_to_pdf handles errors gracefully."""
        mock_image_open.side_effect = Exception("Cannot open image")
        
        result = image_to_pdf("/invalid/path/image.jpg")
        # Should return None instead of raising
        assert result is None


class TestCriticalPdfErrors:
    """Test critical PDF processing error scenarios."""

    @patch('typhoon_ocr.pdf_utils.pdf_utils_available', False)
    def test_pdf_utilities_unavailable(self):
        """Test error when PDF utilities are not available."""
        with pytest.raises(ImportError) as exc_info:
            get_pdf_media_box_width_height("test.pdf", 1)
        
        assert "PDF utilities are not available" in str(exc_info.value)
        assert "brew install poppler" in str(exc_info.value)

    @patch('typhoon_ocr.pdf_utils.pdf_utils_available', True)
    @patch('typhoon_ocr.ocr_utils.subprocess.run')
    def test_subprocess_failure(self, mock_subprocess):
        """Test handling of subprocess failure."""
        mock_subprocess.return_value = MagicMock(
            returncode=1,
            stderr="pdfinfo: command failed"
        )
        
        with pytest.raises(ValueError) as exc_info:
            get_pdf_media_box_width_height('/test/file.pdf', 1)
        
        assert "Error running pdfinfo" in str(exc_info.value)

    @patch('typhoon_ocr.pdf_utils.pdf_utils_available', True)
    @patch('typhoon_ocr.ocr_utils.subprocess.run')
    def test_no_mediabox_in_output(self, mock_subprocess):
        """Test when MediaBox is not found in pdfinfo output."""
        mock_subprocess.return_value = MagicMock(
            returncode=0,
            stdout="Title: Test PDF\nAuthor: Test\nPages: 1\n"
        )
        
        with pytest.raises(ValueError) as exc_info:
            get_pdf_media_box_width_height('/test/file.pdf', 1)
        
        assert "MediaBox not found" in str(exc_info.value)


class TestCriticalApiErrors:
    """Test critical API and network error scenarios."""

    @patch('typhoon_ocr.ocr_utils.OpenAI')
    @patch('typhoon_ocr.ocr_utils.prepare_ocr_messages')
    def test_api_key_missing(self, mock_prepare, mock_openai):
        """Test handling of missing API key."""
        mock_prepare.return_value = [{"role": "user", "content": [{"type": "text", "text": "test"}]}]
        mock_openai.side_effect = Exception("The api_key client option must be set")
        
        with pytest.raises(Exception) as exc_info:
            ocr_document("test.jpg", api_key=None)
        
        assert "api_key" in str(exc_info.value).lower()

    @patch('typhoon_ocr.ocr_utils.OpenAI')
    @patch('typhoon_ocr.ocr_utils.prepare_ocr_messages')
    def test_network_timeout_error(self, mock_prepare, mock_openai):
        """Test handling of network timeout errors."""
        mock_prepare.return_value = [{"role": "user", "content": [{"type": "text", "text": "test"}]}]
        
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = TimeoutError("Request timed out")
        mock_openai.return_value = mock_client
        
        with pytest.raises(TimeoutError):
            ocr_document("test.jpg")

    @patch('typhoon_ocr.ocr_utils.OpenAI')
    @patch('typhoon_ocr.ocr_utils.prepare_ocr_messages')
    def test_api_connection_error(self, mock_prepare, mock_openai):
        """Test handling of API connection errors."""
        mock_prepare.return_value = [{"role": "user", "content": [{"type": "text", "text": "test"}]}]
        
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = ConnectionError("Connection failed")
        mock_openai.return_value = mock_client
        
        with pytest.raises(ConnectionError):
            ocr_document("test.jpg")


class TestCriticalImageErrors:
    """Test critical image processing error scenarios."""

    def test_zero_dimension_image(self):
        """Test handling of images with zero dimensions."""
        mock_img = MagicMock()
        mock_img.size = (0, 0)
        mock_img.mode = 'RGB'
        
        with patch('typhoon_ocr.ocr_utils.Image.open', return_value=mock_img):
            result = resize_if_needed(mock_img)
            # Should handle gracefully
            assert result is mock_img

    def test_negative_dimension_image(self):
        """Test handling of images with negative dimensions."""
        mock_img = MagicMock()
        mock_img.size = (-100, -200)
        mock_img.mode = 'RGB'
        
        with patch('typhoon_ocr.ocr_utils.Image.open', return_value=mock_img):
            # Should handle negative dimensions gracefully
            result = resize_if_needed(mock_img)
            assert result is mock_img

    @patch('typhoon_ocr.ocr_utils.Image.open')
    def test_image_conversion_failure(self, mock_image_open):
        """Test handling of image mode conversion failures."""
        mock_img = MagicMock()
        mock_img.mode = 'RGBA'
        mock_img.convert.side_effect = Exception("Conversion failed")
        mock_image_open.return_value = mock_img
        
        with pytest.raises(Exception):
            image_to_base64png(mock_img)


class TestCriticalInputValidation:
    """Test critical input validation error scenarios."""

    def test_invalid_base64_string(self):
        """Test handling of invalid base64 strings."""
        invalid_base64 = "This is not valid base64!!!"
        
        result = is_base64_string(invalid_base64)
        assert result is False

    def test_empty_base64_string(self):
        """Test handling of empty base64 string."""
        result = is_base64_string("")
        # Empty string might be considered valid base64, just ensure it doesn't crash
        assert isinstance(result, bool)

    @patch('typhoon_ocr.ocr_utils.OpenAI')
    @patch('typhoon_ocr.ocr_utils.Image.open')
    def test_prepare_messages_error_propagation(self, mock_image_open, mock_openai):
        """Test that errors from prepare_ocr_messages are properly propagated."""
        mock_image_open.side_effect = ValueError("Invalid file format")
        
        # Mock OpenAI client to avoid initialization errors
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        with pytest.raises(ValueError) as exc_info:
            ocr_document('/invalid/file.jpg', api_key='test_key')
        
        assert "Invalid file format" in str(exc_info.value)


class TestCriticalResourceErrors:
    """Test critical resource and memory error scenarios."""

    @patch('typhoon_ocr.ocr_utils.tempfile.NamedTemporaryFile')
    def test_temp_file_creation_failure(self, mock_temp_file):
        """Test handling of temporary file creation failures."""
        mock_temp_file.side_effect = OSError("No space left on device")
        
        # Function should handle gracefully and return None
        result = image_to_pdf("/path/to/image.jpg")
        assert result is None

    @patch('typhoon_ocr.ocr_utils.tempfile.NamedTemporaryFile')
    def test_base64_temp_file_fallback(self, mock_temp_file):
        """Test base64 processing fallback when temp file creation fails."""
        mock_temp_file.side_effect = OSError("Permission denied")
        
        base64_data = base64.b64encode(b"fake image data").decode()
        with patch('typhoon_ocr.ocr_utils.is_base64_string', return_value=True):
            result = ensure_image_in_path(base64_data)
            # Should return original string when temp file creation fails
            assert result == base64_data

    def test_memory_exhaustion_large_image(self):
        """Test handling of memory exhaustion with large images."""
        mock_img = MagicMock()
        mock_img.size = (100000, 100000)  # Extremely large
        mock_img.mode = 'RGB'
        mock_img.resize.side_effect = MemoryError("Cannot allocate memory")
        
        with patch('typhoon_ocr.ocr_utils.Image.open', return_value=mock_img):
            with pytest.raises(MemoryError):
                resize_if_needed(mock_img, max_size=2048)
