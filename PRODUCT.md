# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers, researchers, and productivity power-users who need fast, structured document extraction and OCR capabilities using Typhoon LLM models.

## Product Purpose

Typhoon OCR is a web application interface designed for high-precision document extraction, batch PDF processing, page rendering, and markdown/structured output conversion using Typhoon AI models.

## Positioning

Tailored specifically for Typhoon LLM vision/OCR models with local batch processing, real-time page rendering, side-by-side PDF preview, dynamic prompt templates, and instant git auto-updating directly within the workspace UI.

## Operating Context

Modern desktop & mobile web browser environment, working with complex multi-page PDFs, technical documents, Thai/English mixed text, and custom OCR extraction templates.

## Capabilities and Constraints

- Web-based Next.js app router frontend with custom Tailwind dark glassmorphism design system.
- Concurrent sliding-window batch queue for multi-page OCR execution (`CONCURRENCY = 3`).
- Smart OCR Resume and Auto-Retry logic for seamless recovery from rate limits (e.g. HTTP 429) or errors.
- Automatic Git update check and pull route via workspace API routes (`/api/update/check`, `/api/update/pull`).
- High accessibility, clear micro-interactions, responsive side-by-side preview panels.

## Brand Commitments

- Visual style matching `playground.opentyphoon.ai` dark aesthetic: deep obsidian dark mode (`#09090b`), vibrant purple accents (`#8b5cf6`), glassmorphism cards (`backdrop-filter: blur(16px)`), crisp typography (Rubik/Inter).

## Evidence on Hand

- `frontend/app/globals.css` defining dark theme CSS variables and glassmorphism styling.
- `frontend/lib/processBatch.ts` handling concurrent file/page batching.
- `frontend/components/UpdateBadge.tsx` and navbar header.
