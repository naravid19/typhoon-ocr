## Typhoon OCR

Typhoon OCR is a simple Gradio web app for extracting structured markdown from PDFs or images using an OpenAI-compatible vision-language model. It supports document layout analysis and table extraction, returning results in markdown or HTML.

### Features
- Upload a PDF or image (single page)
- Extracts and reconstructs document content as markdown
- Supports different prompt modes for layout or structure
- Uses a local or remote OpenAI-compatible API (e.g., vllm)

### Install
```bash
pip install -r requirements.txt
# edit .env
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
- vllm
- pillow

### License
This project is licensed under the Apache 2.0 License. See individual datasets and checkpoints for their respective licenses.