# Typhoon OCR

Typhoon OCR is a model for extracting structured markdown from images or PDFs. It supports document layout analysis and table extraction, returning results in markdown or HTML. This package provides utilities to convert images and PDFs to the format supported by the Typhoon OCR model.

## Languages Supported

The Typhoon OCR model supports:
- English
- Thai

## Features

- Convert images to PDFs for unified processing
- Extract text and layout information from PDFs and images
- Generate OCR-ready messages for API processing with Typhoon OCR model
- Built-in prompt templates for different document processing tasks
- Process specific pages from multi-page PDF documents

## Installation

```bash
pip install typhoon-ocr
```

### System Requirements

The package requires the Poppler utilities to be installed on your system:

#### For macOS:
```bash
brew install poppler
```

#### For Linux:
```bash
sudo apt-get update
sudo apt-get install poppler-utils
```

The following binaries are required:
- `pdfinfo`
- `pdftoppm`

## Usage

### Core functionality

The package provides 2 main functions:

```python
from typhoon_ocr import ocr_document, prepare_ocr_messages
```
* `ocr_document`: Full OCR pipeline for Typhoon OCR model via opentyphoon.ai or OpenAI compatible api (such as vllm)
* `prepare_ocr_messages`: Generate complete OCR-ready messages for the Typhoon OCR model


### Complete OCR workflow

Use the simplified API to ocr the document or prepare messages for OpenAI compatible api at opentyphoon.ai:

```python
from typhoon_ocr import ocr_document

markdown = ocr_document(
    pdf_or_image_path="document.pdf",  # Works with PDFs or images
    task_type="default",    # Choose between "default" or "structure"
    page_num=2              # Process page 2 of a PDF (default is 1, always 1 for images)
)

# Or with image
markdown = ocr_document(
    pdf_or_image_path="scan.jpg",  # Works with PDFs or images
    task_type="default",    # Choose between "default" or "structure"
)
```

Prepare the messages manually.

```python
from typhoon_ocr import prepare_ocr_messages
from openai import OpenAI

# Prepare messages for OCR processing
messages = prepare_ocr_messages(
    pdf_or_image_path="document.pdf",  # Works with PDFs or images
    task_type="default",    # Choose between "default" or "structure"
    page_num=2              # Process page 2 of a PDF (default is 1, always 1 for images)
)

# Use with https://opentyphoon.ai/ api or self-host model via vllm
# See model list at https://huggingface.co/collections/scb10x/typhoon-ocr-682713483cb934ab0cf069bd
client = OpenAI(base_url='https://api.opentyphoon.ai/v1')
response = client.chat.completions.create(
    model="typhoon-ocr-preview",
    messages=messages,
    max_tokens=16000,
    extra_body={
        "repetition_penalty": 1.2,
        "temperature": 0.1,
        "top_p": 0.6,
    },

)

# Parse the JSON response
text_output = response.choices[0].message.content
markdown = json.loads(text_output)['natural_text']
print(markdown)
```

### Available task types

The package comes with built-in prompt templates for different OCR tasks:

- `default`: Extracts markdown representation of the document with tables in markdown format
- `structure`: Provides more structured output with HTML tables and image analysis placeholders

## Document Extraction Capabilities

The Typhoon OCR model, when used with this package, can extract:

- Structured text with proper layout preservation
- Tables (in markdown or HTML format)
- Document hierarchy (headings, paragraphs, lists)
- Text with positional information
- Basic image analysis and placement

## License

This project code is licensed under the Apache 2.0 License.

## Acknowledgments

The code is based on work from [OlmoCR](https://github.com/allenai/olmocr) under the Apache 2.0 license.