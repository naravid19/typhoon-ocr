"""
End-to-end OCR tests for typhoon-ocr package.

This test module validates the OCR functionality by processing real images
and verifying that expected text content is correctly extracted.

Note: These tests require API credentials to be set in environment variables:
- TYPHOON_API_KEY or TYPHOON_OCR_API_KEY or OPENAI_API_KEY
- TYPHOON_BASE_URL (optional, defaults to https://api.opentyphoon.ai/v1)

To run tests: 
1. Set up your .env file with API credentials
2. Run: python -m pytest tests/test_e2e_ocr.py -v

IMPORTANT: These tests require valid API credentials to run. They will fail if
TYPHOON_API_KEY, TYPHOON_OCR_API_KEY, or OPENAI_API_KEY are not set.
"""
import os
import pytest
from typhoon_ocr import ocr_document


class TestE2EOCR:
    """End-to-end OCR test cases."""

    def test_ocr_extract_expected_text_from_test_image(self):
        """
        Test OCR extraction on examples/test.png.
        
        Validates that the OCR correctly extracts and returns the expected
        text content "SCBX", "AI", and "ปี" from the test image.
        """
        # Verify API credentials are available
        api_key = os.getenv("TYPHOON_API_KEY") or os.getenv("TYPHOON_OCR_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("API credentials required. Set TYPHOON_API_KEY, TYPHOON_OCR_API_KEY, or OPENAI_API_KEY environment variable.")
        
        # Get the path to the test image
        test_image_path = os.path.join(
            os.path.dirname(__file__), 
            "..", "examples", "test.png"
        )
        
        # Verify the test image exists
        assert os.path.exists(test_image_path), f"Test image not found at {test_image_path}"
        
        # Perform OCR on the test image
        # Use default task_type "v1.5" for clean markdown output
        result = ocr_document(
            test_image_path,
            task_type="v1.5",
            model="typhoon-ocr"
        )
        
        # Verify the result is not empty and is a string
        assert isinstance(result, str), "OCR result should be a string"
        assert len(result.strip()) > 0, "OCR result should not be empty"
        
        # Convert to uppercase for case-insensitive matching where appropriate
        result_upper = result.upper()
        
        # Validate that expected text content is present
        expected_texts = ["SCBX", "AI", "ปี"]
        
        for expected_text in expected_texts:
            if expected_text.isascii():  # For English text, check case-insensitive
                assert expected_text.upper() in result_upper, \
                    f"Expected text '{expected_text}' not found in OCR result. Result: {result}"
            else:  # For non-ASCII text (Thai), check exact match
                assert expected_text in result, \
                    f"Expected text '{expected_text}' not found in OCR result. Result: {result}"
        
        # Additional sanity checks
        assert len(result) > 50, "OCR result seems too short, may indicate extraction failure"
        assert len(result) < 50000, "OCR result seems unusually long, may indicate extraction error"

    def test_ocr_with_different_task_types(self):
        """
        Test OCR with different task types to ensure API compatibility.
        
        This is a lighter test that just verifies the API works with different
        task types without detailed content validation.
        """
        # Verify API credentials are available
        api_key = os.getenv("TYPHOON_API_KEY") or os.getenv("TYPHOON_OCR_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("API credentials required. Set TYPHOON_API_KEY, TYPHOON_OCR_API_KEY, or OPENAI_API_KEY environment variable.")
        
        test_image_path = os.path.join(
            os.path.dirname(__file__), 
            "..", "examples", "test.png"
        )
        
        # Test with "default" task type
        result_default = ocr_document(
            test_image_path,
            task_type="default",
            model="typhoon-ocr"
        )
        assert isinstance(result_default, str)
        assert len(result_default.strip()) > 0
        
        # Test with "structure" task type  
        result_structure = ocr_document(
            test_image_path,
            task_type="structure", 
            model="typhoon-ocr"
        )
        assert isinstance(result_structure, str)
        assert len(result_structure.strip()) > 0

    @pytest.mark.parametrize("task_type", ["v1.5", "default", "structure"])
    def test_ocr_task_types_parametrized(self, task_type):
        """
        Parametrized test for different OCR task types.
        """
        # Verify API credentials are available
        api_key = os.getenv("TYPHOON_API_KEY") or os.getenv("TYPHOON_OCR_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("API credentials required. Set TYPHOON_API_KEY, TYPHOON_OCR_API_KEY, or OPENAI_API_KEY environment variable.")
        
        test_image_path = os.path.join(
            os.path.dirname(__file__), 
            "..", "examples", "test.png"
        )
        
        result = ocr_document(
            test_image_path,
            task_type=task_type,
            model="typhoon-ocr"
        )
        
        assert isinstance(result, str)
        assert len(result.strip()) > 0
        
        # For the main test case, validate expected content
        if task_type == "v1.5":
            result_upper = result.upper()
            assert "SCBX" in result_upper
            assert "AI" in result_upper
            assert "ปี" in result
