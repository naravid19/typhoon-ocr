import dynamic from "next/dynamic";
import { useState, useEffect, useRef, memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check, Eye, Clock, Zap, Columns, LayoutList, ChevronLeft, ChevronRight, ChevronDown, Download, FileText } from "lucide-react";
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
    <div className="markdown-output prose prose-invert max-w-none text-zinc-300">
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

const CodeGenerator = dynamic(() => import("./CodeGenerator").then(mod => mod.CodeGenerator), { 
  ssr: false,
  loading: () => <div className="h-20 bg-[#0c0c0e] animate-pulse" />
});

interface ResponsePanelProps {
  slots: FileSlot[];
  activeSlotId: string | null;
  setActiveSlotId: (id: string) => void;
  options: OcrOptions;
  isLoading: boolean;
}

// Separate component for the timer to reset state cleanly on mount/unmount
function ProcessingTimer() {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800">
      <Clock size={14} className="text-zinc-500" />
      <span className="text-xs text-zinc-400 font-mono">
        {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
      </span>
    </div>
  );
}

export function ResponsePanel({
  slots,
  activeSlotId,
  setActiveSlotId,
  options,
  isLoading
}: ResponsePanelProps) {
  const [copiedMode, setCopiedMode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"combined" | "compare">("combined");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [visiblePageCount, setVisiblePageCount] = useState(15);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
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

  const nextIcon = <ChevronRight size={16} />;
  const prevIcon = <ChevronLeft size={16} />;

  const MAX_VISIBLE_TABS = 4;
  const visibleTabs = slots.slice(0, MAX_VISIBLE_TABS);
  const overflowTabs = slots.slice(MAX_VISIBLE_TABS);

  return (
    <div suppressHydrationWarning className="flex-1 flex flex-col h-full bg-[#09090b] relative overflow-hidden">
      
      {/* Tab Strip */}
      {slots.length > 0 && (
        <div className="flex items-center gap-1 px-3 pt-2 border-b border-white/10 overflow-x-auto scrollbar-none shrink-0 bg-[#09090b]">
          {visibleTabs.map((slot) => (
            <button
              key={slot.id}
              role="tab"
              aria-selected={slot.id === activeSlotId}
              onClick={() => setActiveSlotId(slot.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-all whitespace-nowrap cursor-pointer",
                slot.id === activeSlotId
                  ? "border-violet-500 text-white bg-violet-500/10"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              {slot.isLoading && (
                <span className="w-3 h-3 border-[1.5px] border-violet-500/30 border-t-violet-500 rounded-full animate-spin inline-block" />
              )}
              {slot.error && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
              {slot.result && !slot.error && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
              <span className="max-w-[120px] truncate">{slot.file.name.replace(/\.[^.]+$/, "")}</span>
            </button>
          ))}
          {overflowTabs.length > 0 && (
            <div className="relative group">
              <button className={cn(
                "px-2 py-1.5 text-xs transition-colors cursor-pointer flex items-center gap-1",
                overflowTabs.some((s) => s.id === activeSlotId)
                  ? "text-violet-400 font-semibold border-b-2 border-violet-500"
                  : "text-zinc-500 hover:text-zinc-300"
              )}>
                +{overflowTabs.length} more <ChevronDown size={12} />
              </button>
              <div className="absolute left-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl hidden group-hover:block group-focus-within:block z-50">
                {overflowTabs.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setActiveSlotId(slot.id)}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 truncate cursor-pointer flex items-center gap-1.5"
                  >
                    {slot.isLoading && <span className="w-2 h-2 border border-t-violet-500 rounded-full animate-spin" />}
                    {slot.result && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                    <span className="truncate">{slot.file.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header Toolbar */}
      <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#09090b]/50 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
             <button 
                onClick={() => setViewMode("combined")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all cursor-pointer",
                  viewMode === "combined" ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
             >
               <LayoutList size={14} />
               Combined
             </button>
             <button 
                onClick={() => setViewMode("compare")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all cursor-pointer",
                  viewMode === "compare" ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
             >
               <Columns size={14} />
               Compare
             </button>
          </div>
          
          {totalResultPages > 1 && viewMode === "compare" && (
             <div className="flex items-center gap-2 ml-4 text-xs font-medium text-zinc-400 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
                <button 
                  onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                  disabled={currentPageIndex === 0}
                  className="hover:text-white disabled:opacity-30 cursor-pointer"
                >
                  {prevIcon}
                </button>
                <span>Page {currentPageIndex + 1} / {totalResultPages}</span>
                <button 
                  onClick={() => setCurrentPageIndex(p => Math.min(totalResultPages - 1, p + 1))}
                  disabled={currentPageIndex === totalResultPages - 1}
                  className="hover:text-white disabled:opacity-30 cursor-pointer"
                >
                  {nextIcon}
                </button>
             </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {result && (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium">
                <Zap size={12} />
                {result.total_tokens} tokens
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-medium">
                <Clock size={12} />
                {result.processing_time.toFixed(2)}s
              </div>
            </>
          )}
          
          <div className="h-4 w-px bg-zinc-800 mx-1"></div>

          {/* Copy Dropdown */}
          <div className="relative" ref={copyMenuRef}>
            <button
              onClick={() => setCopyMenuOpen((o) => !o)}
              disabled={!hasAnyResult}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-haspopup="menu"
              aria-expanded={copyMenuOpen}
            >
              {copiedMode ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              Copy
              <ChevronDown size={12} />
            </button>
            {copyMenuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1.5 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="py-1">
                  <button
                    role="menuitem"
                    onClick={() => void handleCopy("text")}
                    disabled={!activeSlot?.result}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <Copy size={12} />
                    <span>Copy Text</span>
                    <span className="ml-auto text-zinc-600 text-[10px] truncate max-w-[80px]">
                      {activeSlot?.file.name.replace(/\.[^.]+$/, "")}
                    </span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => void handleCopy("markdown")}
                    disabled={!activeSlot?.result}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <FileText size={12} />
                    <span>Copy Markdown</span>
                    <span className="ml-auto text-zinc-600 text-[10px] truncate max-w-[80px]">
                      {activeSlot?.file.name.replace(/\.[^.]+$/, "")}
                    </span>
                  </button>
                  {doneSlots.length > 1 && (
                    <>
                      <div className="h-px bg-zinc-800 mx-2 my-1" />
                      <button
                        role="menuitem"
                        onClick={() => void handleCopy("all-text")}
                        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Copy size={12} />
                        <span>Copy All as Text</span>
                        <span className="ml-auto text-zinc-600 text-[10px]">{doneSlots.length} files</span>
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => void handleCopy("all-markdown")}
                        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                      >
                        <FileText size={12} />
                        <span>Copy All as Markdown</span>
                        <span className="ml-auto text-zinc-600 text-[10px]">{doneSlots.length} files</span>
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
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-haspopup="menu"
              aria-expanded={downloadMenuOpen}
            >
              <Download size={14} />
              Download
              <ChevronDown size={12} />
            </button>
            {downloadMenuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1.5 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="py-1">
                  <button
                    role="menuitem"
                    onClick={() => {
                      if (activeSlot?.result) {
                        downloadMd(activeSlot.file.name, slotToMarkdown(activeSlot));
                        setDownloadMenuOpen(false);
                      }
                    }}
                    disabled={!activeSlot?.result}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <Download size={12} />
                    <span className="truncate">
                      {activeSlot ? activeSlot.file.name.replace(/\.[^.]+$/, "") + ".md" : "This file"}
                    </span>
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
                        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Download size={12} />
                        <span>All files (.zip)</span>
                        <span className="ml-auto text-zinc-600 text-[10px]">{doneSlots.length} files</span>
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          downloadMerged(doneSlots);
                          setDownloadMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                      >
                        <FileText size={12} />
                        <span>All merged (.md)</span>
                        <span className="ml-auto text-zinc-600 text-[10px]">{doneSlots.length} files</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeSlot?.isLoading && !result ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090b] z-20">
             <div className="relative">
               <div className="absolute inset-0 w-28 h-28 -m-2 rounded-full bg-violet-500/10 blur-xl animate-pulse" />
               <div className="relative w-24 h-24">
                 <div className="absolute inset-0 border-4 border-violet-500/20 rounded-full" />
                 <div className="absolute inset-0 border-4 border-transparent border-t-violet-500 rounded-full animate-spin" />
                 <div className="absolute inset-0 flex items-center justify-center">
                   <Zap className="text-violet-500 animate-pulse" size={28} />
                 </div>
               </div>
             </div>
             
             <h3 className="mt-8 text-xl font-semibold text-white">
               {activeSlot.totalPages > 0 
                 ? `Processing Page ${activeSlot.currentPage || 1} of ${activeSlot.totalPages}` 
                 : 'Processing Document'}
             </h3>
             
             <p className="text-violet-400 mt-2 text-sm font-medium">
               {activeSlot.statusMessage || (activeSlot.totalPages > 0 
                 ? `Working on page ${activeSlot.currentPage || 1}...` 
                 : "Analyzing document structure...")}
             </p>
             
             <p className="text-zinc-600 mt-1 text-xs">
               Using {options.model}
             </p>
             
             <ProcessingTimer />
             
             <div className="mt-8 w-72">
               <div className="flex justify-between text-xs text-zinc-500 mb-2">
                 <span className="font-medium text-zinc-400">
                   {activeSlot.totalPages > 0 ? `${activeSlot.currentPage} / ${activeSlot.totalPages} pages` : 'Initializing...'}
                 </span>
                 <span className="text-violet-400 font-bold">
                   {activeSlot.totalPages > 0 ? Math.round((activeSlot.currentPage / activeSlot.totalPages) * 100) : 0}%
                 </span>
               </div>
               <div className="h-2.5 bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
                 <div 
                   className="h-full bg-linear-to-r from-violet-600 via-violet-500 to-violet-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                   style={{ width: activeSlot.totalPages > 0 ? `${Math.max(2, (activeSlot.currentPage / activeSlot.totalPages) * 100)}%` : '0%' }}
                 />
               </div>
             </div>
           </div>
        ) : !result ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 p-8 text-center bg-[url('/grid.svg')] opacity-50">
             <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-700">
               <Eye size={32} />
             </div>
             <p className="font-medium text-zinc-500">
               {slots.length === 0 ? "No output generated yet" : "Select a file tab to view results"}
             </p>
             <p className="text-sm mt-2 max-w-sm">
               {slots.length === 0 
                 ? "Upload a document and run the model to see the OCR results here." 
                 : "Results will appear here after processing completes."}
             </p>
           </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scroll-smooth rounded-xl m-2 border border-zinc-800/50 bg-zinc-900/30">
              {viewMode === "combined" ? (
                <div className="p-8 max-w-4xl mx-auto space-y-8">
                  {result.results.slice(0, visiblePageCount).map((pageResult, idx) => (
                     <div key={idx} className="mb-8">
                        {result.results.length > 1 && (
                          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5">
                             <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Page {pageResult.page}</span>
                          </div>
                        )}
                        <MarkdownContent text={pageResult.text} />
                     </div>
                  ))}

                  {result.results.length > visiblePageCount && (
                    <div className="pt-4 text-center">
                      <button
                        onClick={() => setVisiblePageCount((prev) => prev + 15)}
                        className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-violet-400 hover:text-violet-300 rounded-lg text-xs font-medium border border-zinc-700 transition-all cursor-pointer shadow-md"
                      >
                        Show More Pages ({visiblePageCount} of {result.results.length} rendered)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
               <div className="flex h-full">
                  {/* Image Side */}
                  <div className="w-1/2 border-r border-white/10 bg-[#0c0c0e] p-4 flex items-center justify-center relative">
                     {currentResultPage?.image_base64 ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={`data:image/jpeg;base64,${currentResultPage.image_base64}`} 
                          alt={`Page ${currentResultPage.page}`}
                          className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                        />
                     ) : (
                        <div className="text-zinc-500 text-sm">Image preview unavailable</div>
                     )}
                     <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-2 py-1 rounded text-xs text-white">
                        Original Input
                     </div>
                  </div>
                  
                  {/* Text Side */}
                  <div className="w-1/2 p-6 overflow-y-auto bg-[#09090b]">
                     <MarkdownContent text={currentResultPage?.text || ""} />
                  </div>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Code Generator Footer */}
      <CodeGenerator options={options} file={activeSlot?.file ?? null} />
    </div>
  );
}
