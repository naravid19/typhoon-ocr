"use client";

import { useState, useRef } from "react";
import { Document, Page, pdfjs } from 'react-pdf';
import { cn } from "@/lib/utils";
import { CheckCircle2, CheckSquare, Square, Minus, ArrowRight } from "lucide-react";
import { OcrOptions } from "@/types/ocr";

// Configure PDF worker
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface PdfPreviewProps {
  file: File;
  options: OcrOptions;
  setOptions: (options: OcrOptions) => void;
  onNumPagesChange: (numPages: number) => void;
}

export default function PdfPreview({ file, options, setOptions, onNumPagesChange }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  const lastClickedPage = useRef<number | null>(null);

  const onDocumentLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    onNumPagesChange(pages);
  };

  const handleChange = (key: keyof OcrOptions, value: string) => {
    setOptions({ ...options, [key]: value });
  };

  // Parse selected pages from the pages string
  const getSelectedPages = (): Set<number> => {
    if (!options.pages || options.pages.trim() === "") return new Set();
    
    const pages = new Set<number>();
    const parts = options.pages.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(s => parseInt(s.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            pages.add(i);
          }
        }
      } else {
        const num = parseInt(trimmed);
        if (!isNaN(num)) {
          pages.add(num);
        }
      }
    }
    return pages;
  };

  // Convert set of pages to optimized range string (e.g., "1-3,5,7-10")
  const setToRangeString = (pages: Set<number>): string => {
    if (pages.size === 0) return "";
    
    const sorted = Array.from(pages).sort((a, b) => a - b);
    const ranges: string[] = [];
    let rangeStart = sorted[0];
    let rangeEnd = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === rangeEnd + 1) {
        rangeEnd = sorted[i];
      } else {
        ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
        rangeStart = sorted[i];
        rangeEnd = sorted[i];
      }
    }
    ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
    
    return ranges.join(",");
  };

  const selectedPages = getSelectedPages();
  const hasSelection = selectedPages.size > 0;
  
  const isAllSelected = numPages !== null && selectedPages.size === numPages;
  const isPartiallySelected = hasSelection && !isAllSelected;

  // Check if odd/even pages are currently selected
  const getOddPages = (): Set<number> => {
    if (!numPages) return new Set();
    return new Set(Array.from({ length: numPages }, (_, i) => i + 1).filter(p => p % 2 === 1));
  };
  
  const getEvenPages = (): Set<number> => {
    if (!numPages) return new Set();
    return new Set(Array.from({ length: numPages }, (_, i) => i + 1).filter(p => p % 2 === 0));
  };

  const setsAreEqual = (a: Set<number>, b: Set<number>): boolean => {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  };

  const isOddSelected = setsAreEqual(selectedPages, getOddPages());
  const isEvenSelected = setsAreEqual(selectedPages, getEvenPages());

  // Handle page click with shift-click support for range selection
  const handlePageClick = (pageNumber: number, event: React.MouseEvent) => {
    const newSelected = new Set(selectedPages);
    
    if (event.shiftKey && lastClickedPage.current !== null) {
      // Shift-click: select range from last clicked to current
      const start = Math.min(lastClickedPage.current, pageNumber);
      const end = Math.max(lastClickedPage.current, pageNumber);
      
      for (let i = start; i <= end; i++) {
        newSelected.add(i);
      }
    } else {
      // Normal click: toggle single page
      if (newSelected.has(pageNumber)) {
        newSelected.delete(pageNumber);
      } else {
        newSelected.add(pageNumber);
      }
      lastClickedPage.current = pageNumber;
    }
    
    handleChange("pages", setToRangeString(newSelected));
  };

  const handleSelectAll = () => {
    if (!numPages) return;
    
    if (isAllSelected) {
      handleChange("pages", "");
    } else {
      const allPages = new Set(Array.from({ length: numPages }, (_, i) => i + 1));
      handleChange("pages", setToRangeString(allPages));
    }
  };

  const handleClearSelection = () => {
    handleChange("pages", "");
    lastClickedPage.current = null;
  };

  // Apply custom range selection
  const applyRange = () => {
    if (!numPages) return;
    
    const from = parseInt(rangeFrom) || 1;
    const to = parseInt(rangeTo) || numPages;
    
    const validFrom = Math.max(1, Math.min(from, numPages));
    const validTo = Math.max(validFrom, Math.min(to, numPages));
    
    const pages = new Set(Array.from({ length: validTo - validFrom + 1 }, (_, i) => validFrom + i));
    handleChange("pages", setToRangeString(pages));
    
    // Reset inputs
    setRangeFrom("");
    setRangeTo("");
  };

  // Toggle Odd/Even selection
  const toggleOddPages = () => {
    if (isOddSelected) {
      handleChange("pages", "");
    } else {
      handleChange("pages", setToRangeString(getOddPages()));
    }
  };

  const toggleEvenPages = () => {
    if (isEvenSelected) {
      handleChange("pages", "");
    } else {
      handleChange("pages", setToRangeString(getEvenPages()));
    }
  };

  const isPageSelected = (pageNumber: number): boolean => {
    return selectedPages.has(pageNumber);
  };

  return (
    <div className="space-y-4">
      {/* Selection Controls */}
      <div className="space-y-3">
        {/* Main controls row */}
        <div className="flex items-center justify-between gap-2 py-2 px-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1.5 rounded hover:bg-zinc-800"
          >
            {isAllSelected ? (
              <CheckSquare size={14} className="text-violet-400" />
            ) : isPartiallySelected ? (
              <Minus size={14} className="text-violet-400" />
            ) : (
              <Square size={14} />
            )}
            <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
          </button>
          
          {hasSelection && (
            <button
              onClick={handleClearSelection}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Range input */}
        <div className="flex items-center gap-2 p-2 bg-zinc-900/30 rounded-lg border border-zinc-800">
          <span className="text-[10px] text-zinc-500 shrink-0">Range:</span>
          <input
            type="number"
            min={1}
            max={numPages || 1}
            placeholder="From"
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-violet-500"
          />
          <ArrowRight size={12} className="text-zinc-600" />
          <input
            type="number"
            min={1}
            max={numPages || 1}
            placeholder="To"
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={applyRange}
            disabled={!rangeFrom && !rangeTo}
            className="px-2 py-1 text-[10px] bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors"
          >
            Apply
          </button>
        </div>
        
        {/* Odd/Even toggle buttons */}
        {numPages && numPages > 2 && (
          <div className="flex gap-2">
            <button
              onClick={toggleOddPages}
              className={cn(
                "text-[10px] px-3 py-1.5 rounded transition-colors border",
                isOddSelected 
                  ? "bg-violet-600 border-violet-500 text-white" 
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700"
              )}
            >
              Odd Pages
            </button>
            <button
              onClick={toggleEvenPages}
              className={cn(
                "text-[10px] px-3 py-1.5 rounded transition-colors border",
                isEvenSelected 
                  ? "bg-violet-600 border-violet-500 text-white" 
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700"
              )}
            >
              Even Pages
            </button>
          </div>
        )}
      </div>
      
      {/* Info Text */}
      <div className="text-[10px] text-zinc-600 px-1 space-y-1">
        <p>{hasSelection 
          ? `${selectedPages.size} of ${numPages || '?'} pages selected`
          : "No selection = All pages will be processed"
        }</p>
        <p className="text-zinc-700">💡 Tip: Hold <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Shift</kbd> + click to select a range</p>
      </div>
      
      {/* PDF Document Grid */}
      <Document 
        file={file} 
        onLoadSuccess={onDocumentLoadSuccess} 
        className="w-full" 
        error={<div className="text-xs text-red-400 p-2">Failed to load PDF preview</div>}
      >
        <div className="grid grid-cols-2 gap-3 w-full">
          {numPages && Array.from(new Array(numPages), (_, index) => {
            const pageNum = index + 1;
            const selected = isPageSelected(pageNum);
            const dimmed = hasSelection && !selected;
            
            return (
              <div 
                key={pageNum} 
                onClick={(e) => handlePageClick(pageNum, e)}
                className={cn(
                  "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all select-none",
                  selected 
                    ? "border-violet-500 ring-2 ring-violet-500/30" 
                    : dimmed
                      ? "border-zinc-800 opacity-50 hover:opacity-80 hover:border-zinc-600"
                      : "border-zinc-800 hover:border-zinc-600"
                )}
              >
                <Page 
                  pageNumber={pageNum} 
                  width={160} 
                  renderAnnotationLayer={false} 
                  renderTextLayer={false} 
                />
                
                {/* Selection Indicator */}
                <div className={cn(
                  "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-md",
                  selected 
                    ? "bg-violet-500 text-white" 
                    : "bg-black/60 text-white/60 group-hover:bg-black/80 group-hover:text-white/80"
                )}>
                  {selected ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <span className="text-[10px] font-bold">{pageNum}</span>
                  )}
                </div>
                
                {/* Page Label */}
                <div className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/80 to-transparent p-2 pt-4">
                  <p className="text-[11px] text-center text-white font-medium">
                    Page {pageNum}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Document>
    </div>
  );
}
