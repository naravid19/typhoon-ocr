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

The package provides three main functions:

```python
from typhoon_ocr import prepare_ocr_messages, get_prompt, image_to_pdf
```

* `prepare_ocr_messages`: Main function to generate complete OCR-ready messages for the Typhoon OCR model
* `get_prompt`: Access built-in prompt templates for different tasks
* `image_to_pdf`: Convert image files to PDF format

### Basic image/PDF processing

Convert an image to PDF format:

```python
from typhoon_ocr import image_to_pdf

# Convert an image to PDF
pdf_path = image_to_pdf('document.jpg')
```

### Complete OCR workflow

Use the simplified API to prepare messages for OCR processing in a single function call:

```python
from typhoon_ocr import prepare_ocr_messages
from openai import OpenAI

# Prepare messages for OCR processing with just one function call
messages = prepare_ocr_messages(
    pdf_or_image_path="document.pdf",  # Works with PDFs or images
    task_type="default",    # Choose between "default" or "structure"
    page_num=2              # Process page 2 of a PDF (default is 1, always 1 for images)
)

# Or with image
messages = prepare_ocr_messages(
    pdf_or_image_path="scan.jpg",  # Works with PDFs or images
    task_type="default",    # Choose between "default" or "structure"
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

### Custom prompt templates

Access and use the built-in prompt templates:

```python
from typhoon_ocr import get_prompt

# Get the default prompt template function
default_prompt_fn = get_prompt("default")

# Apply it to some text
prompt_text = default_prompt_fn("Your extracted text here")
print(prompt_text)
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

This project is licensed under the Apache 2.0 License. See individual datasets and checkpoints for their respective licenses.

## Acknowledgments

The code is based on work from [OlmoCR](https://github.com/allenai/olmocr) under the Apache 2.0 license.