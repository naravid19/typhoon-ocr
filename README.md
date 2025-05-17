## Typhoon OCR

Typhoon OCR is a model for extracting structured markdown from images or PDFs. It supports document layout analysis and table extraction, returning results in markdown or HTML. This package is a simple Gradio website to demonstrate the performance of Typhoon OCR.


### Features
- Upload a PDF or image (single page)
- Extracts and reconstructs document content as markdown
- Supports different prompt modes for layout or structure
- Language: English, Thai
- Uses a local or remote OpenAI-compatible API (e.g., vllm, opentyphoon.ai)
- See blog for more detail https://opentyphoon.ai/blog/en/typhoon-ocr-release

### Requirements

- Linux / Mac with python (window not supported at the moment)


### Install
```bash
pip install -r requirements.txt 
# or pip install typhoon-ocr for minimal installation
# edit .env
# pip install vllm # optional for hosting a local server
```

### Mac specific
```
brew install poppler
# The following binaries are required and provided by poppler:
# - pdfinfo
# - pdftoppm
```
### Linux specific
```
sudo apt-get update
sudo apt-get install poppler-utils
# The following binaries are required and provided by poppler-utils:
# - pdfinfo
# - pdftoppm
```


### Start vllm
```bash
vllm serve scb10x/typhoon-ocr-7b --served-model-name typhoon-ocr --dtype bfloat16 --port 8101
```

### Run Gradio demo
```bash
python app.py
```

### Dependencies
- openai
- python-dotenv
- ftfy
- pypdf
- gradio
- vllm (for hosting an inference server)
- pillow

### Debug
- If `Error processing document` occur. Make sure you have install `brew install poppler` or `apt-get install poppler-utils`.

### License
This project is licensed under the Apache 2.0 License. See individual datasets and checkpoints for their respective licenses.