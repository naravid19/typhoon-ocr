"use client";

import { Document, Page, pdfjs } from 'react-pdf';
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

const PDF_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  wasmUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/wasm/`,
};

interface PdfPageViewerProps {
  file: File;
  pageNumber: number;
  zoomMode: "fit" | "actual";
}

export default function PdfPageViewer({ file, pageNumber, zoomMode }: PdfPageViewerProps) {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[300px]">
      <Document
        file={file}
        options={PDF_OPTIONS}
        loading={
          <div className="flex flex-col items-center gap-2 text-zinc-500 text-xs font-mono">
            <Loader2 size={16} className="animate-spin text-violet-400" />
            <span>Loading PDF Page {pageNumber}...</span>
          </div>
        }
        error={
          <div className="text-zinc-500 text-xs font-mono">
            Failed to render PDF page {pageNumber}
          </div>
        }
      >
        <Page
          pageNumber={pageNumber}
          scale={zoomMode === "actual" ? 1.5 : 0.85}
          className={cn(
            "rounded shadow-md transition-all select-none overflow-hidden",
            zoomMode === "fit" ? "max-w-full" : "max-w-none"
          )}
          renderAnnotationLayer={false}
          renderTextLayer={false}
        />
      </Document>
    </div>
  );
}
