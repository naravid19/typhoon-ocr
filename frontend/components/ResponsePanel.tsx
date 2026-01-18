import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check, Eye, Clock, Zap, Columns, LayoutList, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { OcrResult, OcrOptions } from "@/types/ocr";
import { CodeGenerator } from "./CodeGenerator";

import "highlight.js/styles/github-dark.css";

interface ResponsePanelProps {
  result: OcrResult | null;
  options: OcrOptions;
  file: File | null;
  isLoading: boolean;
  currentPage?: number;
  totalPages?: number;
}

// Separate component for the timer to reset state cleanly on mount/unmount
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
    <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800">
      <Clock size={14} className="text-zinc-500" />
      <span className="text-xs text-zinc-400 font-mono">
        {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
      </span>
    </div>
  );
}

// Get progress message based on real page being processed
const getProgressMessage = (currentPage: number, totalPages: number): string => {
  if (totalPages > 0 && currentPage > 0) {
    return `Processing page ${currentPage} of ${totalPages}`;
  }
  return "Starting OCR process...";
};

export function ResponsePanel({ result, options, file, isLoading, currentPage = 0, totalPages = 0 }: ResponsePanelProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"combined" | "compare">("combined");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const handleCopy = () => {
    if (!result) return;
    
    // Combine text from all pages
    const fullText = result.results.map(r => r.text).join("\n\n");
    
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentResultPage = result?.results[currentPageIndex];
  const totalResultPages = result?.results.length || 0;

  const nextIcon = <ChevronRight size={16} />;
  const prevIcon = <ChevronLeft size={16} />;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] relative overflow-hidden">
      {/* Header Toolbar */}
      <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#09090b]/50 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
             <button 
                onClick={() => setViewMode("combined")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all",
                  viewMode === "combined" ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
             >
               <LayoutList size={14} />
               Combined
             </button>
             <button 
                onClick={() => setViewMode("compare")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all",
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
                  className="hover:text-white disabled:opacity-30"
                >
                  {prevIcon}
                </button>
                <span>Page {currentPageIndex + 1} / {totalResultPages}</span>
                <button 
                  onClick={() => setCurrentPageIndex(p => Math.min(totalResultPages - 1, p + 1))}
                  disabled={currentPageIndex === totalResultPages - 1}
                  className="hover:text-white disabled:opacity-30"
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

          <button 
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            disabled={!result}
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            Copy
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {isLoading ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090b] z-20">
             {/* Outer glow ring */}
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
             
             {/* Title */}
             <h3 className="mt-8 text-xl font-semibold text-white">Processing Document</h3>
             
             {/* Real progress message */}
             <p className="text-violet-400 mt-3 text-sm font-medium">
               {getProgressMessage(currentPage, totalPages)}
             </p>
             
             {/* Model info */}
             <p className="text-zinc-600 mt-1 text-xs">
               Using {options.model}
             </p>
             
             {/* Timer */}
             <ProcessingTimer />
             
             {/* Real progress bar */}
             <div className="mt-6 w-64">
               <div className="flex justify-between text-xs text-zinc-500 mb-1">
                 <span>Progress</span>
                 <span>{totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0}%</span>
               </div>
               <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-linear-to-r from-violet-600 to-violet-400 rounded-full transition-all duration-500 ease-out"
                   style={{ width: totalPages > 0 ? `${(currentPage / totalPages) * 100}%` : '0%' }}
                 />
               </div>
             </div>
             
             {/* Page indicator */}
             {totalPages > 1 && (
               <p className="text-zinc-600 mt-3 text-xs">
                 {currentPage} / {totalPages} pages completed
               </p>
             )}
           </div>
        ) : !result ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 p-8 text-center bg-[url('/grid.svg')] opacity-50">
             <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-700">
               <Eye size={32} />
             </div>
             <p className="font-medium text-zinc-500">No output generated yet</p>
             <p className="text-sm mt-2 max-w-sm">Upload a document and run the model to see the OCR results here.</p>
           </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scroll-smooth rounded-xl m-2 border border-zinc-800/50 bg-zinc-900/30">
             {viewMode === "combined" ? (
               <div className="p-8 max-w-4xl mx-auto">
                 {result.results.map((pageResult, idx) => (
                    <div key={idx} className="mb-8">
                       {result.results.length > 1 && (
                         <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5">
                            <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Page {pageResult.page}</span>
                         </div>
                       )}
                       <div className="markdown-output prose prose-invert max-w-none text-zinc-300">
                          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                            {pageResult.text}
                          </ReactMarkdown>
                       </div>
                    </div>
                 ))}
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
                     <div className="markdown-output prose prose-invert max-w-none text-zinc-300">
                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                          {currentResultPage?.text || ""}
                        </ReactMarkdown>
                     </div>
                  </div>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Code Generator Footer */}
      <CodeGenerator options={options} file={file} />
    </div>
  );
}
