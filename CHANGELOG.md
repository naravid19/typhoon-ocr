# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

## [v1.0.0] - 2026-01-13

### Added

- **Modern Frontend**: Initial release of the Next.js web application with a modern, dark-themed UI.
- **FastAPI Integration**: Added Python FastAPI backend to bridge the frontend with Typhoon OCR.
- **Improved OCR Capabilities**: Added support for OCR v1.5 with enhanced prompts and runtime checks.
- **Multi-page Support**: Implemented document layout analysis for handling multiple pages.

### Changed

- **Project Structure**: Organized codebase into clear `frontend` and `backend` directories.
- **Configuration**: Added `.env` support for easy API key and model management.
