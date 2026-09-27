import dynamic from "next/dynamic";
import { useState, useEffect, useRef, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { 
  Copy, 
  Check, 
  Clock, 
  Zap, 
  Columns, 
  LayoutList, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Download, 
  FileText, 
  Image as ImageIcon,
  ZoomIn,
  Maximize2,
  FileCode,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OcrOptions, FileSlot } from "@/types/ocr";
import { markdownToPlainText } from "@/utils/markdownText";
import {
  slotToMarkdown,
  mergeSlotsMarkdown,
  mergeSlotsText,
  downloadMd,
  downloadZip,
  downloadMerged,
} from "@/utils/export";
import "highlight.js/styles/github-dark.css";

const MarkdownContent = memo(function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="markdown-output max-w-none text-zinc-300">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          table: ({ children }) => (
            <div className="my-4 w-full overflow-x-auto rounded-lg border border-white/[0.08] bg-zinc-950/60 shadow-xs">
              <table className="w-full text-left text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-900/90 text-[11px] font-mono font-medium text-zinc-300 uppercase tracking-wider border-b border-white/[0.08]">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 border-r border-zinc-800/60 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 text-zinc-300 border-t border-zinc-800/60 border-r border-zinc-800/60 last:border-r-0 hover:bg-zinc-900/30 transition-colors">
              {children}
            </td>
          ),
          figure: ({ children }) => (
            <figure className="my-3.5 p-3.5 rounded-lg border border-violet-500/25 bg-violet-500/[0.04] text-zinc-200">
              <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-mono font-medium text-violet-400 uppercase tracking-wider">
                <ImageIcon size={13} className="text-violet-400" />
                <span>Figure Analysis</span>
              </div>
              <div className="text-xs leading-relaxed text-zinc-300 italic [&>*]:not-italic">{children}</div>
            </figure>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

const CodeGenerator = dynamic(() => import("./CodeGenerator").then(mod => mod.CodeGenerator), { 
  ssr: false,
  loading: () => <div className="h-10 bg-[#0d0d10] animate-pulse" />
});

function ProcessingTimer() {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 border border-white/[0.08] text-zinc-400 font-mono text-[11px] tabular-nums mt-3">
      <Clock size={12} className="text-zinc-500" />
      <span>{Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
    </div>
  );
}

interface ResponsePanelProps {
  slots: FileSlot[];
  activeSlotId: string | null;
  setActiveSlotId: (id: string) => void;
  options: OcrOptions;
  isLoading: boolean;
}

export function ResponsePanel({
  slots,
  activeSlotId,
  setActiveSlotId,
  options,
  isLoading
}: ResponsePanelProps) {
  const [copiedMode, setCopiedMode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"combined" | "compare">("compare");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [visiblePageCount, setVisiblePageCount] = useState(15);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  
  // Resizable Split Pane state
  const [splitRatio, setSplitRatio] = useState(48); // 48% original document, 52% markdown
  const [isDragging, setIsDragging] = useState(false);
  const [zoomMode, setZoomMode] = useState<"fit" | "actual">("fit");
  const workbenchContainerRef = useRef<HTMLDivElement>(null);

  const copyMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const activeSlot = slots.find((s) => s.id === activeSlotId) ?? null;
  const result = activeSlot?.result ?? null;
  const doneSlots = slots.filter((s) => s.result && !s.error);
  const hasAnyResult = doneSlots.length > 0;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) setCopyMenuOpen(false);
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) setDownloadMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset page index and visible count when slot changes
  useEffect(() => {
    setCurrentPageIndex(0);
    setVisiblePageCount(15);
  }, [activeSlotId]);

  // Draggable Split Divider logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!workbenchContainerRef.current) return;
      const rect = workbenchContainerRef.current.getBoundingClientRect();
      const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
      if (newRatio >= 22 && newRatio <= 78) {
        setSplitRatio(newRatio);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleCopy = async (mode: "text" | "markdown" | "all-text" | "all-markdown") => {
    let content = "";
    if (mode === "text" && activeSlot) {
      content = markdownToPlainText(slotToMarkdown(activeSlot));
    } else if (mode === "markdown" && activeSlot) {
      content = slotToMarkdown(activeSlot);
    } else if (mode === "all-text") {
      content = mergeSlotsText(doneSlots);
    } else if (mode === "all-markdown") {
      content = mergeSlotsMarkdown(doneSlots);
    }
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopiedMode(mode);
    setCopyMenuOpen(false);
    setTimeout(() => setCopiedMode((p) => (p === mode ? null : p)), 2000);
  };

  const currentResultPage = result?.results[currentPageIndex];
  const totalResultPages = result?.results.length || 0;

  const MAX_VISIBLE_TABS = 5;
  const visibleTabs = slots.slice(0, MAX_VISIBLE_TABS);
  const overflowTabs = slots.slice(MAX_VISIBLE_TABS);

  return (
    <div 
      suppressHydrationWarning 
      className={cn("flex-1 flex flex-col h-full bg-[#09090b] relative overflow-hidden", isDragging && "select-none")}
    >
      
      {/* File Slots Tab Bar */}
      {slots.length > 0 && (
        <div className="flex items-center gap-1 px-3 pt-1.5 border-b border-white/[0.08] overflow-x-auto scrollbar-none shrink-0 bg-[#0d0d10]">
          {visibleTabs.map((slot) => (
            <button
              key={slot.id}
              role="tab"
              aria-selected={slot.id === activeSlotId}
              onClick={() => setActiveSlotId(slot.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-all whitespace-nowrap cursor-pointer",
                slot.id === activeSlotId
                  ? "border-violet-500 text-white bg-zinc-900"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
              )}
            >
              {slot.isLoading && (
                <Loader2 size={12} className="text-violet-400 animate-spin inline-block" />
              )}
              {slot.error && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
              {slot.result && !slot.error && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              {!slot.isLoading && !slot.error && !slot.result && <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />}
              <span className="max-w-[130px] truncate">{slot.file.name.replace(/\.[^.]+$/, "")}</span>
            </button>
          ))}
          
          {overflowTabs.length > 0 && (
            <div className="relative group">
              <button className={cn(
                "px-2.5 py-1.5 text-xs transition-colors cursor-pointer flex items-center gap-1",
                overflowTabs.some((s) => s.id === activeSlotId)
                  ? "text-violet-400 font-medium border-b-2 border-violet-500"
                  : "text-zinc-400 hover:text-zinc-200"
              )}>
                +{overflowTabs.length} more <ChevronDown size={12} />
              </button>
              <div className="absolute left-0 top-full mt-1 w-52 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl hidden group-hover:block group-focus-within:block z-50">
                {overflowTabs.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setActiveSlotId(slot.id)}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 truncate cursor-pointer flex items-center gap-2"
                  >
                    {slot.isLoading && <Loader2 size={12} className="text-violet-400 animate-spin" />}
                    {slot.result && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    <span className="truncate">{slot.file.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Control Strip & Telemetry Toolbar */}
      <div className="h-12 border-b border-white/[0.08] flex items-center justify-between px-4 bg-[#09090b] z-10 shrink-0">
        
        {/* View Mode & Page Navigator */}
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-900 rounded-md p-0.5 border border-white/[0.06]">
            <button 
              onClick={() => setViewMode("compare")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer",
                viewMode === "compare" ? "bg-zinc-800 text-white shadow-xs" : "text-zinc-400 hover:text-zinc-200"
              )}
              title="Side-by-side comparison"
            >
              <Columns size={13} />
              <span>Compare</span>
            </button>
            <button 
              onClick={() => setViewMode("combined")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer",
                viewMode === "combined" ? "bg-zinc-800 text-white shadow-xs" : "text-zinc-400 hover:text-zinc-200"
              )}
              title="All pages continuous view"
            >
              <LayoutList size={13} />
              <span>Continuous</span>
            </button>
          </div>

          {/* Quick Page Navigator in Compare View */}
          {totalResultPages > 1 && viewMode === "compare" && (
            <div className="flex items-center gap-1.5 bg-zinc-900/80 px-2 py-1 rounded-md border border-white/[0.06]">
              <button 
                onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                disabled={currentPageIndex === 0}
                className="text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer p-0.5"
                title="Previous page"
              >
                <ChevronLeft size={13} />
              </button>
              
              <span className="text-[11px] font-mono text-zinc-300 px-1 tabular-nums">
                Page {currentPageIndex + 1} of {totalResultPages}
              </span>

              <button 
                onClick={() => setCurrentPageIndex(p => Math.min(totalResultPages - 1, p + 1))}
                disabled={currentPageIndex === totalResultPages - 1}
                className="text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer p-0.5"
                title="Next page"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Telemetry and Export Actions */}
        <div className="flex items-center gap-3">
          {result && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 border border-white/[0.06] text-zinc-300 text-[11px] font-mono tabular-nums">
                <Zap size={11} className="text-violet-400" />
                <span>{result.total_tokens.toLocaleString()} tokens</span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 border border-white/[0.06] text-zinc-400 text-[11px] font-mono tabular-nums">
                <Clock size={11} />
                <span>{result.processing_time.toFixed(2)}s</span>
              </div>
            </div>
          )}
          
          <div className="h-3.5 w-px bg-white/[0.08]" />

          {/* Copy Dropdown */}
          <div className="relative" ref={copyMenuRef}>
            <button
              onClick={() => setCopyMenuOpen((o) => !o)}
              disabled={!hasAnyResult}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors disabled:opacity-35 cursor-pointer px-2 py-1 rounded hover:bg-zinc-800"
              aria-haspopup="menu"
              aria-expanded={copyMenuOpen}
            >
              {copiedMode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>Copy</span>
              <ChevronDown size={11} className="text-zinc-500" />
            </button>
            {copyMenuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1.5 w-52 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl z-50 overflow-hidden">
                <div className="py-1 text-xs">
                  <button
                    role="menuitem"
                    onClick={() => void handleCopy("text")}
                    disabled={!activeSlot?.result}
                    className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <Copy size={12} className="text-zinc-500" />
                    <span>Copy Text</span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => void handleCopy("markdown")}
                    disabled={!activeSlot?.result}
                    className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <FileText size={12} className="text-zinc-500" />
                    <span>Copy Markdown</span>
                  </button>
                  {doneSlots.length > 1 && (
                    <>
                      <div className="h-px bg-zinc-800 mx-2 my-1" />
                      <button
                        role="menuitem"
                        onClick={() => void handleCopy("all-text")}
                        className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Copy size={12} className="text-zinc-500" />
                        <span>Copy All as Text</span>
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => void handleCopy("all-markdown")}
                        className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                      >
                        <FileText size={12} className="text-zinc-500" />
                        <span>Copy All as Markdown</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Download Dropdown */}
          <div className="relative" ref={downloadMenuRef}>
            <button
              onClick={() => setDownloadMenuOpen((o) => !o)}
              disabled={!hasAnyResult}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors disabled:opacity-35 cursor-pointer px-2 py-1 rounded hover:bg-zinc-800"
              aria-haspopup="menu"
              aria-expanded={downloadMenuOpen}
            >
              <Download size={13} />
              <span>Export</span>
              <ChevronDown size={11} className="text-zinc-500" />
            </button>
            {downloadMenuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1.5 w-52 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl z-50 overflow-hidden">
                <div className="py-1 text-xs">
                  <button
                    role="menuitem"
                    onClick={() => {
                      if (activeSlot?.result) {
                        downloadMd(activeSlot.file.name, slotToMarkdown(activeSlot));
                        setDownloadMenuOpen(false);
                      }
                    }}
                    disabled={!activeSlot?.result}
                    className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <FileText size={12} className="text-zinc-500" />
                    <span>Download .md</span>
                  </button>
                  {doneSlots.length > 1 && (
                    <>
                      <div className="h-px bg-zinc-800 mx-2 my-1" />
                      <button
                        role="menuitem"
                        onClick={() => {
                          void downloadZip(doneSlots);
                          setDownloadMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Download size={12} className="text-zinc-500" />
                        <span>All files (.zip)</span>
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          downloadMerged(doneSlots);
                          setDownloadMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                      >
                        <FileCode size={12} className="text-zinc-500" />
                        <span>All merged (.md)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Workbench Display Area */}
      <div 
        ref={workbenchContainerRef}
        className="flex-1 overflow-hidden relative flex flex-col"
      >
        {activeSlot?.isLoading && !result ? (
          /* Technical Linear Progress View */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090b] z-20 p-6">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5 text-violet-400">
              <Loader2 size={20} className="animate-spin" />
            </div>

            <h3 className="text-sm font-semibold text-zinc-100">
              {activeSlot.totalPages > 0 
                ? `Processing Page ${activeSlot.currentPage || 1} of ${activeSlot.totalPages}` 
                : 'Extracting Document Structure'}
            </h3>

            <p className="text-xs text-zinc-400 mt-1 font-mono">
              {activeSlot.statusMessage || `Executing inference with ${options.model}...`}
            </p>

            <ProcessingTimer />

            <div className="mt-5 w-80 max-w-full space-y-2">
              <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                <span>
                  {activeSlot.totalPages > 0 ? `${activeSlot.currentPage} / ${activeSlot.totalPages} pages` : 'In progress'}
                </span>
                <span className="text-violet-400 font-semibold tabular-nums">
                  {activeSlot.totalPages > 0 ? Math.round((activeSlot.currentPage / activeSlot.totalPages) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-white/[0.08]">
                <div 
                  className="h-full bg-violet-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: activeSlot.totalPages > 0 ? `${Math.max(3, (activeSlot.currentPage / activeSlot.totalPages) * 100)}%` : '20%' }}
                />
              </div>
            </div>
          </div>
        ) : !result ? (
          /* Clean Empty Studio State */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center mb-3 text-zinc-600">
              <FileText size={22} />
            </div>
            <p className="text-sm font-medium text-zinc-300">
              {slots.length === 0 ? "Workspace Empty" : "Ready for OCR Execution"}
            </p>
            <p className="text-xs text-zinc-500 mt-1.5 max-w-sm leading-relaxed">
              {slots.length === 0 
                ? "Upload PDF or image files on the left sidebar and configure pipeline parameters to begin." 
                : "Select Run OCR on the left sidebar to execute document extraction."}
            </p>
          </div>
        ) : (
          /* Rendered Results */
          <div className="flex-1 flex overflow-hidden">
            {viewMode === "combined" ? (
              /* Continuous Multi-page View */
              <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
                <div className="max-w-4xl mx-auto space-y-8 select-text">
                  {result.results.slice(0, visiblePageCount).map((pageResult, idx) => (
                    <div key={idx} className="pb-8 border-b border-white/[0.06] last:border-b-0">
                      {result.results.length > 1 && (
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/[0.04]">
                          <span className="text-[11px] font-mono font-medium text-violet-400 uppercase tracking-wider">
                            Page {pageResult.page}
                          </span>
                        </div>
                      )}
                      <MarkdownContent text={pageResult.text} />
                    </div>
                  ))}

                  {result.results.length > visiblePageCount && (
                    <div className="pt-4 text-center">
                      <button
                        onClick={() => setVisiblePageCount((prev) => prev + 15)}
                        className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 rounded-md border border-white/[0.08] transition-colors"
                      >
                        Load More Pages ({visiblePageCount} of {result.results.length} shown)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Resizable Compare Workbench (Split View) */
              <div className={cn("flex-1 flex w-full h-full overflow-hidden", isDragging && "select-none cursor-col-resize")}>
                
                {/* Left Pane: Original Input Document */}
                <div 
                  className="flex flex-col bg-[#0d0d10] border-r border-white/[0.08] overflow-hidden"
                  style={{ width: `${splitRatio}%` }}
                >
                  {/* Pane Header with Zoom Controls and Quick Page Pills */}
                  <div className="h-9 px-3 border-b border-white/[0.06] flex items-center justify-between bg-zinc-950/80 shrink-0">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Original Input
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setZoomMode(z => z === "fit" ? "actual" : "fit")}
                        className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 transition-colors",
                          zoomMode === "actual" 
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" 
                            : "text-zinc-400 hover:text-zinc-200"
                        )}
                        title={zoomMode === "fit" ? "Switch to 100% natural resolution" : "Fit to screen width"}
                      >
                        {zoomMode === "fit" ? <Maximize2 size={11} /> : <ZoomIn size={11} />}
                        <span>{zoomMode === "fit" ? "Fit" : "100%"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Document Page Image Viewer */}
                  <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative scrollbar-thin">
                    {currentResultPage?.image_base64 ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={`data:image/jpeg;base64,${currentResultPage.image_base64}`} 
                        alt={`Page ${currentResultPage.page}`}
                        className={cn(
                          "rounded shadow-md transition-all select-none",
                          zoomMode === "fit" 
                            ? "max-w-full max-h-full object-contain" 
                            : "max-w-none cursor-default"
                        )}
                      />
                    ) : (
                      <div className="text-zinc-500 text-xs font-mono">Image raster unavailable</div>
                    )}
                  </div>

                  {/* Bottom Page Strip for Quick Page Hopping */}
                  {totalResultPages > 1 && (
                    <div className="h-9 px-3 border-t border-white/[0.06] flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-zinc-950/80 shrink-0">
                      {result.results.map((p, idx) => (
                        <button
                          key={p.page}
                          onClick={() => setCurrentPageIndex(idx)}
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-mono rounded transition-colors shrink-0",
                            currentPageIndex === idx
                              ? "bg-violet-600 text-white font-medium"
                              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                          )}
                        >
                          P.{p.page}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Draggable Divider */}
                <div 
                  onMouseDown={handleMouseDown}
                  className={cn("split-divider", isDragging && "dragging")}
                  title="Drag to resize panels"
                />

                {/* Right Pane: Extracted Structured Markdown */}
                <div className="flex-1 flex flex-col bg-[#09090b] overflow-hidden min-w-0">
                  <div className="h-9 px-4 border-b border-white/[0.06] flex items-center justify-between bg-zinc-950/80 shrink-0">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Extracted Markdown
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      Page {currentResultPage?.page || 1}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 scrollbar-thin select-text">
                    <MarkdownContent text={currentResultPage?.text || ""} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Code Generator Drawer Footer */}
      <CodeGenerator options={options} file={activeSlot?.file ?? null} />
    </div>
  );
}
