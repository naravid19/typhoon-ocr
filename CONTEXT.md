# Domain Context & Glossary: Typhoon OCR

This document establishes the canonical terminology for the Typhoon OCR project. All issues, PRDs, specifications, and discussions must use these terms consistently.

## Glossary

### Task Type
The mode of OCR processing and document structuring requested by the user:
- **`default`**: Extracts standard Markdown representation with tables rendered in Markdown syntax.
- **`structure`**: Extracts enhanced layout analysis with tables rendered in clean HTML syntax and image placeholders.
- **`v1.5`**: State-of-the-art Typhoon OCR prompt template returning direct Markdown without JSON wrapping, HTML tables, and contextual image/chart descriptions.
- **`v2`**: Typhoon OCR V2 layout JSON (bbox/category/text) converted to Markdown; chosen automatically for V2 model ids; no figure descriptions.

### Figure Language
The target natural language used when the model describes images, charts, and diagrams enclosed within `<figure>` tags in `v1.5` mode. Permitted values are `Thai` (default) and `English`.

### File Slot
A client-side state container representing a single uploaded file within the batch queue. Tracks the document's upload status, page count, real-time SSE progress, error state, and finished OCR output.

### Streaming Progress
The real-time Server-Sent Events (SSE) protocol established between the FastAPI backend and Next.js frontend during multi-page OCR operations. Emits structured payloads for `start`, `progress`, `page_complete`, and `complete` states alongside 5-second `: keep-alive` pings.

### Anchor Text
Bounding-box positional text information extracted from PDF pages via Poppler. Required only for legacy prompt generation in `default` and `structure` tasks; bypassed in `v1.5`.

### Unified Sidebar
The persistent control column integrating document ingestion, file slot queue management, and model parameters into a single view with collapsible sections, eliminating tab-switching friction.

### Compare Workbench
The interactive resizable inspection interface providing synchronized side-by-side comparison between the original document page raster and the rendered Markdown output.

