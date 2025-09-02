## Typhoon OCR

[![README TH](https://img.shields.io/badge/README-TH-lightgrey?style=flat)](README.th.md) [![README EN](https://img.shields.io/badge/README-EN-blue?style=flat)](README.md)

Typhoon OCR is a model for extracting structured markdown from images or PDFs. It supports document layout analysis and table extraction, returning results in markdown or HTML. This repo provides a simple Gradio website to demonstrate Typhoon OCR.

> **This fork focuses on Windows 10/11.** For macOS/Linux setup, please refer to the official Typhoon OCR repository.

### Features

- Upload a PDF or image
- **Multi-page selection for PDFs**: all pages, a page range, or a single page
- **Preview gallery** for selected pages
- **Progress bar** during OCR
- Reconstructs content as Markdown (tables as Markdown in `default`, as HTML in `structure`)
- Two prompt modes: `default`, `structure`
- Languages: English, Thai
- Uses a remote OpenAI-compatible API (e.g., opentyphoon.ai) or a local endpoint (e.g., vLLM on WSL2)

### Requirements

- Windows 10/11 with Python 3.10+

### Install

```bash
pip install typhoon-ocr
# or to run the demo app:
pip install -r requirements.txt
```

### Configure `.env`

Create a `.env` file in the project root:

```ini
# OpenAI-compatible endpoint (remote provider or local vLLM on WSL2)
TYPHOON_BASE_URL=https://api.opentyphoon.ai/v1
# API key for that endpoint
TYPHOON_API_KEY=YOUR_KEY
# Model name exposed by that endpoint
TYPHOON_OCR_MODEL=typhoon-ocr
```

> Running vLLM in WSL2: set `TYPHOON_BASE_URL=http://127.0.0.1:8101/v1` and `TYPHOON_API_KEY=dummy`.

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

### What's changed in this fork

- **Multi-page** OCR for PDFs (all / range / single) with a **gallery preview** and **progress bar**
- Robust output parsing (falls back to raw text when JSON parsing fails)
- Uses `TYPHOON_BASE_URL`, `TYPHOON_API_KEY`, `TYPHOON_OCR_MODEL` env vars
- Adds `pypdf` for page counting

### Changelog

#### 2025-09-02
- Add **multi-page** PDF workflow (all / range / single) with **gallery preview** and **progress bar**
- More robust output parsing: fall back to raw text if JSON parsing fails
- Documented and standardized env vars: `TYPHOON_BASE_URL`, `TYPHOON_API_KEY`, `TYPHOON_OCR_MODEL`
  - **Breaking:** replace `MODEL` with `TYPHOON_OCR_MODEL`
- Add `pypdf` for page counting
- UI/UX: tabs (File/Parameters), Thai-first copy, scrollable output, small CSS tweaks
- Docs: Windows-only focus, TH/EN badges, Poppler one-liner (without `setx` truncation), clarified vLLM via WSL2

### Dependencies

- openai
- python-dotenv
- ftfy
- pypdf
- gradio
- pillow
- vllm (for hosting an inference server on WSL2; not native on Windows)

### Debug

- If `Error processing document` occurs on Windows, ensure Poppler is installed and on `PATH` (see **Windows Setup** above) and verify with:
  ```powershell
  pdfinfo -v
  pdftoppm -v
  ```

### License

This project is licensed under the Apache 2.0 License. See individual datasets and checkpoints for their respective licenses.