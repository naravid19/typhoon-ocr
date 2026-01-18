# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2026-01-18]

### Added

- **Real-time Progress Tracking**: Implemented Server-Sent Events (SSE) to stream OCR progress updates to the frontend.
- **Processing Timer**: Added a dedicated timer component to track elapsed time accurately.
- **Page Counter**: Added "Processing page X of Y" indicator for multi-page documents.

### Changed

- **Backend Performance**: Refactored OCR service to use `run_in_threadpool` for non-blocking execution.
- **UI Improvements**: Fixed layout scrolling issues in PDF preview and results panel.
- **Code Refactoring**: Cleaned up `ResponsePanel` and improved state management.
