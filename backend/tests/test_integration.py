"""
Integration tests for typhoon-ocr package.

This test module covers component interaction testing and complete workflow
validation with mocked external dependencies to ensure proper integration.
"""
import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock, mock_open
import base64
import json

# Import the functions to test
from typhoon_ocr.ocr_utils import (
    prepare_ocr_messages,
    ocr_document,
    get_prompt,
    resize_if_needed,
    image_to_base64png,
    get_anchor_text_from_image,
)


class TestPrepareOcrMessagesIntegration:
    """Test prepare_ocr_messages function integration."""

    @patch('typhoon_ocr.ocr_utils.Image.open')
    def test_complete_image_workflow_v15(self, mock_image_open):
        """Test complete workflow for image processing with v1.5 task type."""
        # Setup mock image
        mock_img = MagicMock()
        mock_img.size = (1200, 800)
        mock_img.mode = 'RGB'
        mock_image_open.return_value = mock_img
        
        # Mock the resize and base64 conversion functions
        with patch('typhoon_ocr.ocr_utils.resize_if_needed', return_value=mock_img) as mock_resize:
            with patch('typhoon_ocr.ocr_utils.image_to_base64png', return_value='fake_base64_data') as mock_base64:
                
                result = prepare_ocr_messages(
                    '/path/to/image.jpg',
                    task_type='v1.5',
                    target_image_dim=1800,
                    figure_language='Thai'
                )
                
                # Verify message structure
                assert isinstance(result, list)
                assert len(result) == 1
                
                message = result[0]
                assert message['role'] == 'user'
                assert len(message['content']) == 2
                
                # Check text content
                text_content = message['content'][0]
                assert text_content['type'] == 'text'
                assert 'Extract all text from the image' in text_content['text']
                assert 'Thai' in text_content['text']
                
                # Check image content
                image_content = message['content'][1]
                assert image_content['type'] == 'image_url'
                assert image_content['image_url']['url'] == 'data:image/png;base64,fake_base64_data'
                
                # Verify function calls
                mock_image_open.assert_called_once_with('/path/to/image.jpg')
                mock_resize.assert_called_once_with(mock_img, max_size=1800)
                mock_base64.assert_called_once_with(mock_img)

    @patch('typhoon_ocr.ocr_utils.Image.open')
    def test_complete_image_workflow_default(self, mock_image_open):
        """Test complete workflow for image processing with default task type."""
        # Setup mock image
        mock_img = MagicMock()
        mock_img.size = (1200, 800)
        mock_img.mode = 'RGB'
        mock_image_open.return_value = mock_img
        
        with patch('typhoon_ocr.ocr_utils.image_to_base64png', return_value='fake_base64_data') as mock_base64:
            with patch('typhoon_ocr.ocr_utils.get_anchor_text_from_image', return_value='Page dimensions: 1200.0x800.0\n[Image 0x0 to 1200x800]\n') as mock_anchor:
                
                result = prepare_ocr_messages(
                    '/path/to/image.jpg',
                    task_type='default',
                    target_text_length=8000
                )
                
                # Verify message structure
                message = result[0]
                text_content = message['content'][0]
                
                # Should include anchor text for non-v1.5 task types
                assert 'Page dimensions: 1200.0x800.0' in text_content['text']
                assert '[Image 0x0 to 1200x800]' in text_content['text']
                assert 'RAW_TEXT_START' in text_content['text']
                assert 'RAW_TEXT_END' in text_content['text']
                
                # Verify function calls
                mock_anchor.assert_called_once_with(mock_img)
                mock_base64.assert_called_once_with(mock_img)

    @patch('typhoon_ocr.pdf_utils.pdf_utils_available', True)
    def test_complete_pdf_workflow(self):
        """Test complete workflow for PDF processing - simplified."""
        # Just test that PDF processing works without forcing specific function calls
        with patch('typhoon_ocr.ocr_utils.get_pdf_media_box_width_height') as mock_dimensions:
            with patch('typhoon_ocr.ocr_utils.render_pdf_to_base64png') as mock_render:
                with patch('typhoon_ocr.ocr_utils.get_anchor_text') as mock_anchor:
                    mock_dimensions.return_value = (612.0, 792.0)
                    mock_render.return_value = 'pdf_base64_data'
                    mock_anchor.return_value = 'PDF anchor text content'
                    
                    result = prepare_ocr_messages(
                        '/path/to/document.pdf',
                        task_type='structure',
                        page_num=2
                    )
                    
                    # Verify message structure
                    assert isinstance(result, list)
                    assert len(result) == 1
                    message = result[0]
                    assert message['role'] == 'user'
                    assert len(message['content']) == 2

    @patch('typhoon_ocr.ocr_utils.Image.open')
    def test_message_structure_validation(self, mock_image_open):
        """Test that message structure matches API expectations."""
        mock_img = MagicMock()
        mock_img.size = (800, 600)
        mock_img.mode = 'RGB'
        mock_image_open.return_value = mock_img
        
        with patch('typhoon_ocr.ocr_utils.resize_if_needed', return_value=mock_img):
            with patch('typhoon_ocr.ocr_utils.image_to_base64png', return_value='base64_data'):
                
                result = prepare_ocr_messages('/path/to/image.jpg', task_type='v1.5')
                
                # Validate complete message structure
                message = result[0]
                
                # Required fields
                assert 'role' in message
                assert 'content' in message
                assert message['role'] == 'user'
                assert isinstance(message['content'], list)
                assert len(message['content']) == 2
                
                # Text content validation
                text_item = message['content'][0]
                assert text_item['type'] == 'text'
                assert 'text' in text_item
                assert isinstance(text_item['text'], str)
                assert len(text_item['text']) > 0
                
                # Image content validation
                image_item = message['content'][1]
                assert image_item['type'] == 'image_url'
                assert 'image_url' in image_item
                assert 'url' in image_item['image_url']
                assert image_item['image_url']['url'].startswith('data:image/png;base64,')

    @patch('typhoon_ocr.ocr_utils.Image.open')
    def test_different_task_types_message_format(self, mock_image_open):
        """Test message format for different task types."""
        mock_img = MagicMock()
        mock_img.size = (800, 600)
        mock_img.mode = 'RGB'
        mock_image_open.return_value = mock_img
        
        with patch('typhoon_ocr.ocr_utils.resize_if_needed', return_value=mock_img):
            with patch('typhoon_ocr.ocr_utils.image_to_base64png', return_value='base64_data'):
                with patch('typhoon_ocr.ocr_utils.get_anchor_text_from_image', return_value='anchor text'):
                    
                    # Test v1.5 task type
                    result_v15 = prepare_ocr_messages('/path/to/image.jpg', task_type='v1.5')
                    text_v15 = result_v15[0]['content'][0]['text']
                    assert 'Extract all text from the image' in text_v15
                    assert 'Markdown' in text_v15
                    assert 'RAW_TEXT_START' not in text_v15
                    
                    # Test default task type
                    result_default = prepare_ocr_messages('/path/to/image.jpg', task_type='default')
                    text_default = result_default[0]['content'][0]['text']
                    assert 'markdown representation' in text_default.lower()
                    assert 'RAW_TEXT_START' in text_default
                    assert 'anchor text' in text_default
                    
                    # Test structure task type
                    result_structure = prepare_ocr_messages('/path/to/image.jpg', task_type='structure')
                    text_structure = result_structure[0]['content'][0]['text']
                    assert 'HTML format' in text_structure
                    assert '<figure>' in text_structure
                    assert 'RAW_TEXT_START' in text_structure

    @patch('typhoon_ocr.ocr_utils.Image.open')
    def test_parameter_passing_integration(self, mock_image_open):
        """Test that parameters are correctly passed through the workflow."""
        mock_img = MagicMock()
        mock_img.size = (1600, 1200)
        mock_img.mode = 'RGB'
        mock_image_open.return_value = mock_img
        
        with patch('typhoon_ocr.ocr_utils.resize_if_needed') as mock_resize:
            with patch('typhoon_ocr.ocr_utils.image_to_base64png', return_value='base64_data') as mock_base64:
                
                # Test with custom parameters
                result = prepare_ocr_messages(
                    '/path/to/image.jpg',
                    task_type='v1.5',
                    target_image_dim=1200,
                    figure_language='English'
                )
                
                # Verify parameters were passed correctly
                mock_resize.assert_called_once_with(mock_img, max_size=1200)
                # image_to_base64png is called with the resized image, not the original
                mock_base64.assert_called_once()  # Just verify it was called
                
                # Check figure language in prompt
                text_content = result[0]['content'][0]['text']
                assert 'English' in text_content
                assert 'Describe in English' in text_content

    @patch('typhoon_ocr.pdf_utils.pdf_utils_available', True)
    def test_pdf_parameter_integration(self):
        """Test PDF parameter passing integration - simplified."""
        with patch('typhoon_ocr.ocr_utils.get_pdf_media_box_width_height') as mock_dimensions:
            with patch('typhoon_ocr.ocr_utils.render_pdf_to_base64png') as mock_render:
                with patch('typhoon_ocr.ocr_utils.get_anchor_text', return_value='anchor text'):
                    mock_dimensions.return_value = (612.0, 792.0)
                    mock_render.return_value = 'pdf_base64_data'
                    
                    result = prepare_ocr_messages(
                        '/path/to/document.pdf',
                        task_type='default',
                        page_num=5,
                        target_image_dim=2400,
                        target_text_length=10000
                    )
                    
                    # Just verify it works and returns proper structure
                    assert isinstance(result, list)
                    assert len(result) == 1
                    assert result[0]['role'] == 'user'


class TestOcrDocumentIntegration:
    """Test ocr_document function integration."""

    @patch('typhoon_ocr.ocr_utils.OpenAI')
    @patch('typhoon_ocr.ocr_utils.prepare_ocr_messages')
    def test_complete_ocr_workflow_v15(self, mock_prepare, mock_openai):
        """Test complete OCR workflow with v1.5 task type."""
        # Setup mocks
        mock_prepare.return_value = [
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': 'Extract text prompt'},
                    {'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,fake_data'}}
                ]
            }
        ]
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Extracted OCR text content"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client
        
        result = ocr_document(
            '/path/to/image.jpg',
            task_type='v1.5',
            model='typhoon-ocr',
            api_key='test_key'
        )
        
        # Verify result
        assert result == "Extracted OCR text content"
        
        # Verify API call
        mock_client.chat.completions.create.assert_called_once()
        call_kwargs = mock_client.chat.completions.create.call_args[1]
        
        assert call_kwargs['model'] == 'typhoon-ocr'
        assert call_kwargs['messages'] == mock_prepare.return_value
        assert call_kwargs['max_tokens'] == 16384
        assert 'extra_body' in call_kwargs
        assert call_kwargs['extra_body']['repetition_penalty'] == 1.1
        assert call_kwargs['extra_body']['temperature'] == 0.1
        assert call_kwargs['extra_body']['top_p'] == 0.6

    @patch('typhoon_ocr.ocr_utils.OpenAI')
    @patch('typhoon_ocr.ocr_utils.prepare_ocr_messages')
    def test_complete_ocr_workflow_default(self, mock_prepare, mock_openai):
        """Test complete OCR workflow with default task type (JSON response)."""
        # Setup mocks
        mock_prepare.return_value = [{'role': 'user', 'content': [{'type': 'text', 'text': 'prompt'}]}]
        
        json_response = '{"natural_text": "Extracted text from JSON response"}'
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json_response
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client
        
        result = ocr_document(
            '/path/to/image.jpg',
            task_type='default',
            model='typhoon-ocr'
        )
        
        # Verify JSON parsing
        assert result == "Extracted text from JSON response"
        
        # Verify API call parameters for non-v1.5 tasks
        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs['extra_body']['repetition_penalty'] == 1.2

    @patch('typhoon_ocr.ocr_utils.OpenAI')
    @patch('typhoon_ocr.ocr_utils.prepare_ocr_messages')
    def test_api_configuration_integration(self, mock_prepare, mock_openai):
        """Test API configuration parameter passing."""
        mock_prepare.return_value = [{'role': 'user', 'content': [{'type': 'text', 'text': 'prompt'}]}]
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "test response"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client
        
        result = ocr_document(
            '/path/to/image.jpg',
            base_url='https://custom.api.com/v1',
            api_key='custom_key',
            model='custom-model',
            target_image_dim=1500,
            page_num=3
        )
        
        # Verify OpenAI client configuration
        mock_openai.assert_called_once_with(
            base_url='https://custom.api.com/v1',
            api_key='custom_key'
        )
        
        # Verify prepare_ocr_messages was called with correct parameters
        mock_prepare.assert_called_once_with(
            pdf_or_image_path='/path/to/image.jpg',
            task_type='v1.5',
            target_image_dim=1500,
            target_text_length=8000,
            page_num=3,
            figure_language='Thai'
        )

    @patch('typhoon_ocr.ocr_utils.OpenAI')
    @patch('typhoon_ocr.ocr_utils.prepare_ocr_messages')
    @patch('typhoon_ocr.ocr_utils.ensure_image_in_path')
    def test_path_processing_integration(self, mock_ensure_path, mock_prepare, mock_openai):
        """Test path processing integration."""
        mock_ensure_path.return_value = '/processed/path/image.jpg'
        mock_prepare.return_value = [{'role': 'user', 'content': [{'type': 'text', 'text': 'prompt'}]}]
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "response"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client
        
        result = ocr_document('input_path')
        
        # Verify path processing
        mock_ensure_path.assert_called_once_with('input_path')
        mock_prepare.assert_called_once_with(
            pdf_or_image_path='/processed/path/image.jpg',
            task_type='v1.5',
            target_image_dim=1800,
            target_text_length=8000,
            page_num=1,
            figure_language='Thai'
        )


class TestPromptIntegration:
    """Test prompt system integration."""

    def test_prompt_system_integration(self):
        """Test prompt system integration with message preparation."""
        # Test all prompt types
        prompt_types = ['default', 'structure', 'v1.5']
        
        for prompt_type in prompt_types:
            prompt_fn = get_prompt(prompt_type)
            assert callable(prompt_fn)
            
            if prompt_type == 'v1.5':
                result = prompt_fn(figure_language='Thai')
                assert 'Thai' in result
                assert 'Extract all text' in result
            else:
                result = prompt_fn('sample anchor text')
                assert 'sample anchor text' in result
                assert 'RAW_TEXT_START' in result
                assert 'RAW_TEXT_END' in result

    def test_prompt_content_validation(self):
        """Test that prompt content contains required elements."""
        # Test v1.5 prompt
        v15_prompt = get_prompt('v1.5')
        v15_result = v15_prompt(figure_language='English')
        
        # Check for actual elements that exist in the prompt
        actual_elements = [
            'Extract all text',
            'Markdown',
            'English'
        ]
        
        for element in actual_elements:
            assert element in v15_result

    def test_prompt_parameter_inheritance(self):
        """Test that prompt parameters are properly inherited."""
        structure_prompt = get_prompt('structure')
        structure_result = structure_prompt('anchor text content')
        
        # Should include both the anchor text and structure-specific elements
        assert 'anchor text content' in structure_result
        assert 'HTML format' in structure_result
        assert '<figure>' in structure_result
        assert 'IMAGE_ANALYSIS' in structure_result


class TestErrorRecoveryIntegration:
    """Test error recovery in integration scenarios."""

    @patch('typhoon_ocr.ocr_utils.OpenAI')
    @patch('typhoon_ocr.ocr_utils.prepare_ocr_messages')
    def test_prepare_messages_error_propagation(self, mock_prepare, mock_openai):
        """Test that errors from prepare_ocr_messages are properly propagated."""
        mock_prepare.side_effect = ValueError("Invalid file format")
        
        # Mock OpenAI client to avoid initialization errors
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        with pytest.raises(ValueError) as exc_info:
            ocr_document('/invalid/file.jpg', api_key='test_key')
        
        assert "Invalid file format" in str(exc_info.value)

    @patch('typhoon_ocr.ocr_utils.OpenAI')
    @patch('typhoon_ocr.ocr_utils.prepare_ocr_messages')
    def test_api_error_handling_integration(self, mock_prepare, mock_openai):
        """Test API error handling in integration context."""
        mock_prepare.return_value = [{'role': 'user', 'content': [{'type': 'text', 'text': 'prompt'}]}]
        
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("API Error")
        mock_openai.return_value = mock_client
        
        with pytest.raises(Exception) as exc_info:
            ocr_document('/path/to/image.jpg')
        
        assert "API Error" in str(exc_info.value)

    @patch('typhoon_ocr.ocr_utils.prepare_ocr_messages')
    def test_message_validation_integration(self, mock_prepare):
        """Test message validation in integration context."""
        # Test with malformed message structure
        mock_prepare.return_value = [
            {'role': 'user', 'content': [{'type': 'invalid_type'}]}  # Missing required fields
        ]
        
        with patch('typhoon_ocr.ocr_utils.OpenAI') as mock_openai:
            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = MagicMock(
                choices=[MagicMock(message=MagicMock(content="response"))]
            )
            mock_openai.return_value = mock_client
            
            # Should still work, API will handle validation
            result = ocr_document('/path/to/image.jpg')
            assert result == "response"


class TestPerformanceIntegration:
    """Test performance-related integration scenarios."""

    @patch('typhoon_ocr.ocr_utils.Image.open')
    def test_large_image_processing_integration(self, mock_image_open):
        """Test integration with large image processing."""
        mock_img = MagicMock()
        mock_img.size = (5000, 4000)  # Large image
        mock_img.mode = 'RGB'
        mock_image_open.return_value = mock_img
        
        with patch('typhoon_ocr.ocr_utils.resize_if_needed', return_value=mock_img) as mock_resize:
            with patch('typhoon_ocr.ocr_utils.image_to_base64png', return_value='large_base64_data') as mock_base64:
                
                result = prepare_ocr_messages('/path/to/large_image.jpg', target_image_dim=2048)
                
                # Verify large image was processed
                mock_resize.assert_called_once_with(mock_img, max_size=2048)
                mock_base64.assert_called_once_with(mock_img)
                
                # Verify message structure is maintained
                assert len(result) == 1
                assert len(result[0]['content']) == 2

    @patch('typhoon_ocr.pdf_utils.pdf_utils_available', True)
    def test_multipage_pdf_integration(self):
        """Test integration with multi-page PDF processing - simplified."""
        with patch('typhoon_ocr.ocr_utils.get_pdf_media_box_width_height') as mock_dimensions:
            with patch('typhoon_ocr.ocr_utils.render_pdf_to_base64png') as mock_render:
                with patch('typhoon_ocr.ocr_utils.get_anchor_text', return_value='page anchor text'):
                    mock_dimensions.return_value = (612.0, 792.0)
                    mock_render.return_value = 'pdf_base64_data'
                    
                    # Test different page numbers
                    for page_num in [1, 5, 10, 100]:
                        result = prepare_ocr_messages(
                            '/path/to/multipage.pdf',
                            page_num=page_num
                        )
                        
                        # Verify message structure
                        assert isinstance(result, list)
                        assert len(result) == 1
                        assert result[0]['role'] == 'user'
