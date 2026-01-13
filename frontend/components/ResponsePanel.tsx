"use client";

import { useState } from "react";
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
}

export function ResponsePanel({ result, options, file, isLoading }: ResponsePanelProps) {
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

  const currentPage = result?.results[currentPageIndex];
  const totalPages = result?.results.length || 0;

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
          
          {totalPages > 1 && viewMode === "compare" && (
             <div className="flex items-center gap-2 ml-4 text-xs font-medium text-zinc-400 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
                <button 
                  onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                  disabled={currentPageIndex === 0}
                  className="hover:text-white disabled:opacity-30"
                >
                  {prevIcon}
                </button>
                <span>Page {currentPageIndex + 1} / {totalPages}</span>
                <button 
                  onClick={() => setCurrentPageIndex(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPageIndex === totalPages - 1}
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
             <div className="relative">
               <div className="w-24 h-24 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <Zap className="text-violet-500 animate-pulse" size={32} />
               </div>
             </div>
             <h3 className="mt-8 text-xl font-medium text-white">Processing Document</h3>
             <p className="text-zinc-500 mt-2 text-sm animate-pulse">Running {options.model}...</p>
             
             <div className="mt-8 flex gap-2">
               <div className="w-2 h-2 rounded-full bg-violet-500 animate-[bounce_1s_infinite_0ms]"></div>
               <div className="w-2 h-2 rounded-full bg-violet-500 animate-[bounce_1s_infinite_200ms]"></div>
               <div className="w-2 h-2 rounded-full bg-violet-500 animate-[bounce_1s_infinite_400ms]"></div>
             </div>
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
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
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
                     {currentPage?.image_base64 ? (
                        <img 
                          src={`data:image/jpeg;base64,${currentPage.image_base64}`} 
                          alt={`Page ${currentPage.page}`}
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
                          {currentPage?.text || ""}
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
