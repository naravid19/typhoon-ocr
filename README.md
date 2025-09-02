## Typhoon OCR

[![README TH](https://img.shields.io/badge/README-TH-blue?style=flat)](README.th.md) [![README EN](https://img.shields.io/badge/README-EN-lightgrey?style=flat)](README.md)


Typhoon OCR is a model for extracting structured markdown from images or PDFs. It supports document layout analysis and table extraction, returning results in markdown or HTML. This package is a simple Gradio website to demonstrate the performance of Typhoon OCR.

> **This fork focuses on Windows 10/11 usage.** For macOS/Linux setup, please refer to the official Typhoon OCR repository.

### Features

- Upload a PDF or image (single page)
- Extracts and reconstructs document content as markdown
- Supports different prompt modes for layout or structure
- Language: English, Thai
- Uses a local or remote OpenAI-compatible API (e.g., vllm, opentyphoon.ai)
- See blog for more detail https://opentyphoon.ai/blog/en/typhoon-ocr-release

### Requirements

- Windows 10/11 with Python 3.10+ (Windows-focused fork)

### Install

```bash
pip install typhoon-ocr
```

or to run the gradio app.

```bash
pip install -r requirements.txt
# edit .env
# pip install vllm # optional for hosting a local server
```

### Windows Setup

Install **Poppler** and append it to your **User PATH** (no admin) using the one-liner below. This provides the required `pdfinfo` and `pdftoppm` tools.

```powershell
iwr -useb https://github.com/oschwartz10612/poppler-windows/releases/download/v25.07.0-0/Release-25.07.0-0.zip -OutFile $env:TEMP\poppler.zip; rm C:\poppler -Recurse -Force -ErrorAction SilentlyContinue; Expand-Archive $env:TEMP\poppler.zip C:\poppler -Force; $bin=(Get-ChildItem C:\poppler -Recurse -Filter pdfinfo.exe | Select-Object -First 1).DirectoryName; if(-not $bin){throw "pdfinfo.exe not found under C:\poppler"}; $u=[Environment]::GetEnvironmentVariable('Path','User'); if([string]::IsNullOrEmpty($u)){$u=''}; if($u -notlike "*$bin*"){[Environment]::SetEnvironmentVariable('Path', ($u.TrimEnd(';')+';'+$bin).Trim(';'), 'User')}; $env:Path+=';'+$bin; pdfinfo -v
```

Verify:
```powershell
pdfinfo -v
pdftoppm -v
```

### Run Gradio demo

```bash
python app.py
```

> Local inference with **vLLM** is not supported natively on Windows. Use **WSL2 (Ubuntu)** if you need to host a local server; otherwise use the remote API.
### Start vllm (Optional: via WSL2)

> On Windows, run this inside **WSL2 (Ubuntu)**. Native Windows is not supported.

```bash
vllm serve scb10x/typhoon-ocr-7b --served-model-name typhoon-ocr --dtype bfloat16 --port 8101
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

- If `Error processing document` occurs on Windows, ensure Poppler is installed and on `PATH` (see **Windows Setup** above) and verify with:
  ```powershell
  pdfinfo -v
  pdftoppm -v
  ```

### License

This project is licensed under the Apache 2.0 License. See individual datasets and checkpoints for their respective licenses.