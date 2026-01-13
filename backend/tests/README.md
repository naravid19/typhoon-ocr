# Typhoon OCR Tests

This directory contains comprehensive tests for the `typhoon-ocr` package.

## Test Coverage

### End-to-End Tests
- **`test_e2e_ocr.py`**: Real API tests for OCR extraction and compatibility
  - Tests actual OCR functionality with real API calls
  - Validates Thai and English text extraction
  - Tests API compatibility across different endpoints

### Unit Tests
- **`test_unit_ocr_utils.py`**: Core utility function tests
  - String manipulation and text processing
  - Image resizing and format conversion
  - Base64 encoding/decoding validation
  - Path handling and file operations

### PDF Processing Tests
- **`test_pdf_processing.py`**: PDF-specific functionality tests (31 tests)
  - PDF utility availability checking (`check_pdf_utilities`)
  - Image-to-PDF conversion (`image_to_pdf`)
  - PDF MediaBox dimension extraction (`get_pdf_media_box_width_height`)
  - PDF to PNG rendering (`render_pdf_to_base64png`)
  - PDF report generation (`_pdf_report`)
  - PDF report linearization (`_linearize_pdf_report`)
  - Data structure validation (BoundingBox, TextElement, ImageElement, PageReport)

### Error Handling Tests
- **`test_error_handling_simple.py`**: Critical error scenario tests (18 tests)
  - File handling errors (non-existent files, corrupted images)
  - PDF processing errors (missing utilities, subprocess failures)
  - API and network errors (missing keys, timeouts, connection failures)
  - Image processing errors (zero/negative dimensions, conversion failures)
  - Input validation errors (invalid base64, malformed inputs)
  - Resource errors (memory exhaustion, temp file failures)

### Integration Tests
- **`test_integration.py`**: Component integration tests (19 tests)
  - Complete workflow testing for images and PDFs
  - Message structure validation
  - Parameter passing integration
  - API configuration testing
  - Prompt system integration
  - Error recovery scenarios
  - Performance testing (large images, multi-page PDFs)

## Requirements

- Python 3.8+
- pytest
- All package dependencies from `requirements.txt`

## Running Tests

### Run All Tests
```bash
cd /Users/kunato/typhoon-applications/typhoon-ocr
python -m pytest tests/ -v
```

### Run Specific Test Files
```bash
# Unit tests only
python -m pytest tests/test_unit_ocr_utils.py -v

# PDF processing tests only
python -m pytest tests/test_pdf_processing.py -v

# Error handling tests only
python -m pytest tests/test_error_handling_simple.py -v
## Notes

- Tests enforce API key requirements and will fail without credentials
- Uses `examples/test.png` as test image (must exist)
- Validates both English and Thai text extraction
- Tests take ~20-30 seconds to complete due to API calls
