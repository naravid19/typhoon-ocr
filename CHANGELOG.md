# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v1.0.3] - 2026-04-25

### Added
- **Asynchronous Processing**: Refactored the entire backend OCR service to use `AsyncOpenAI` and `asyncio`, drastically improving performance and resource utilization.
- **Parallel Page Execution**: Multi-page PDF documents are now processed concurrently using `asyncio.Semaphore`, vastly reducing total processing time.
- **Smart Startup Validation**: `start_app.bat` now verifies `.env` configuration and detects Windows "Excluded Port Ranges" (Hyper-V) before launching.

### Changed
- **Port Migration (8345)**: Moved backend default port to **8345** to avoid frequent conflicts with Windows/Hyper-V reserved ranges (8123 was often blocked).
- **Frontend Refactoring**: Improved React component structure, removing unused code and optimizing state management functional updates in the configuration panel.
- **Stream API Optimization**: The SSE `/api/ocr/stream` endpoint now natively yields events from fully asynchronous background tasks.
- **Enhanced Security**: Optimized `.gitignore` for public repository safety, ensuring secrets and large binaries are properly excluded.

### Fixed
- **WinError 10013**: Resolved "Access Forbidden" errors by migrating to a port outside of system-reserved ranges.
- **Startup Script Crashes**: Fixed a parser bug in the `.bat` file caused by unescaped parentheses in output messages.

## [v1.0.2] - 2026-01-19

### Added

- **Professional Startup Script**: Completely redesigned `start_app.bat` with modern UI featuring Unicode box-drawing characters.
- **Enhanced Dependency Checks**: Added version display for Python, Node.js, npm, and optional pdfinfo (Poppler) detection.
- **Auto-Install Dependencies**: Script now automatically installs missing pip packages before starting the backend.
- **API Documentation Link**: Added quick access to Swagger docs at `http://localhost:8000/docs`.
- **Tips Section**: Helpful tips for users on how to manage servers.

### Changed

- **UTF-8 Encoding**: Startup script now uses `chcp 65001` for proper Unicode/emoji support.
- **Improved Virtual Environment Detection**: Enhanced auto-detection logic for `venv`, `.venv`, `env`, and any custom-named virtual environments.
- **Better Error Handling**: Centralized error handling with styled error messages and download links.
- **Visual Design**: Progress indicators (`[1/3]`, `[2/3]`, `[3/3]`) and Unicode separators for better readability.

### Fixed

- **Dependency Conflicts**: Resolved Gradio compatibility issues by pinning `pillow<12.0` and `pydantic<2.12`.

---

## [v1.0.1] - 2026-01-18

### Added

- **One-Click Startup**: Introduced `start_app.bat` for seamless launching of both backend and frontend services.
- **Robustness**: Enhanced startup script with automatic environment detection (`venv`, `.venv`, `env`) and dependency checks.
- **Documentation**: Updated READMEs (English & Thai) with simplified startup instructions.
- **Real-time Progress Tracking**: Implemented Server-Sent Events (SSE) to stream OCR progress updates to the frontend.
- **Processing Timer**: Added a dedicated timer component to track elapsed time accurately.
- **Page Counter**: Added "Processing page X of Y" indicator for multi-page documents.

### Changed

- **Backend Performance**: Refactored OCR service to use `run_in_threadpool` for non-blocking execution.
- **UI Improvements**: Fixed layout scrolling issues in PDF preview and results panel.
- **Code Refactoring**: Cleaned up `ResponsePanel` and improved state management.

---

## [v1.0.0] - 2026-01-13

### Added

- **Modern Frontend**: Initial release of the Next.js web application with a modern, dark-themed UI.
- **FastAPI Integration**: Added Python FastAPI backend to bridge the frontend with Typhoon OCR.
- **Improved OCR Capabilities**: Added support for OCR v1.5 with enhanced prompts and runtime checks.
- **Multi-page Support**: Implemented document layout analysis for handling multiple pages.

### Changed

- **Project Structure**: Organized codebase into clear `frontend` and `backend` directories.
- **Configuration**: Added `.env` support for easy API key and model management.
