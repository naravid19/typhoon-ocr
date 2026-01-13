"use client";

import { useState, useCallback } from "react";
import dynamic from 'next/dynamic';
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Settings, ChevronRight, Link as LinkIcon, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OcrOptions } from "@/types/ocr";

const PdfPreview = dynamic(() => import('./PdfPreview'), { 
  ssr: false,
  loading: () => <div className="h-40 flex items-center justify-center text-xs text-zinc-500">Loading PDF Preview...</div>
});

interface ConfigPanelProps {
  options: OcrOptions;
  setOptions: (options: OcrOptions) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function ConfigPanel({
  options,
  setOptions,
  file,
  setFile,
  onSubmit,
  isLoading
}: ConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<"files" | "params">("files");
  const [urlInput, setUrlInput] = useState("");
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setNumPages(null); // Reset pages on new file
      // Reset page selection
      setOptions({ ...options, pages: "" });
      setUrlError(null);
    }
  }, [setFile, setOptions, options]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    multiple: false
  });

  const handleChange = (key: keyof OcrOptions, value: string | number) => {
    setOptions({ ...options, [key]: value });
  };

  const handleLoadUrl = async () => {
    if (!urlInput.trim()) return;
    
    setIsLoadingUrl(true);
    setUrlError(null);
    
    try {
      // Fetch the file using our proxy API to avoid CORS issues
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlInput }),
      });
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `Failed to fetch: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch { /* ignore parsing error */ }
        
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      
      // Get filename from header or fallback to URL
      const filenameHeader = response.headers.get('X-Filename');
      const filename = filenameHeader || new URL(urlInput).pathname.split('/').pop() || 'document.pdf';
      
      // Determine MIME type
      let mimeType = blob.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        // Infer from extension
        if (filename.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (filename.endsWith('.png')) mimeType = 'image/png';
        else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (filename.endsWith('.webp')) mimeType = 'image/webp';
      }
      
      
      // Create a File object from the blob
      const file = new File([blob], filename, { type: mimeType });
      
      setFile(file);
      setNumPages(null);
      setOptions({ ...options, pages: "" });
      setUrlInput("");
      
    } catch (error) {
      console.error('Error loading URL:', error);
      setUrlError(error instanceof Error ? error.message : 'Failed to load file from URL');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] border-r border-white/10 w-full lg:w-[400px] xl:w-[450px] shrink-0">
      {/* Model Selector Header */}
      <div className="p-4 border-b border-white/10">
        <label className="text-xs text-zinc-500 font-medium mb-1.5 block">MODEL</label>
        <div className="relative">
          <select 
            className="w-full appearance-none bg-zinc-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
            value={options.model}
            onChange={(e) => handleChange("model", e.target.value)}
          >
            <option value="typhoon-ocr">Typhoon OCR (Default)</option>
            {/* <option value="typhoon-ocr-v2">Typhoon OCR v2 (Beta)</option> */}
          </select>
          <ChevronRight className="absolute right-3 top-3 text-zinc-500 rotate-90 pointer-events-none" size={16} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-4 border-b border-white/10">
        <button
          onClick={() => setActiveTab("files")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "files" 
              ? "text-white border-violet-500" 
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          )}
        >
          <FileText size={16} />
          Files
        </button>
        <button
          onClick={() => setActiveTab("params")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "params" 
              ? "text-white border-violet-500" 
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          )}
        >
          <Settings size={16} />
          Parameters
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800">
        
        {activeTab === "files" ? (
          <div className="space-y-6">
            <div 
              {...getRootProps()} 
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
                isDragActive ? "border-violet-500 bg-violet-500/10" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50",
                !file && "min-h-[150px] flex flex-col items-center justify-center" // Taller if empty
              )}
            >
              <input {...getInputProps()} />
              {!file ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                    <Upload className="text-zinc-400" size={18} />
                  </div>
                  <p className="text-sm text-zinc-300 font-medium">Click to upload</p>
                  <p className="text-xs text-zinc-500 mt-1">PDF, JPG, PNG</p>
                </>
              ) : (
                <div className="flex items-center justify-between bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded bg-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                           {file.name.endsWith('.pdf') ? <FileText size={16} /> : <ImageIcon size={16} />}
                        </div>
                        <div className="text-left overflow-hidden">
                           <p className="text-xs font-medium text-white truncate">{file.name}</p>
                           <p className="text-[10px] text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setFile(null); setNumPages(null); }}
                        className="p-1.5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-md transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
              )}
            </div>

            {/* PREVIEW GRID */}
            {file && (
               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Preview</label>
                     {numPages && (
                        <span className="text-xs text-zinc-500">
                          {numPages} {numPages === 1 ? 'page' : 'pages'}
                        </span>
                     )}
                  </div>
                  
                  {file.type === 'application/pdf' ? (
                     <PdfPreview 
                        file={file} 
                        options={options} 
                        setOptions={setOptions} 
                        onNumPagesChange={setNumPages} 
                     />
                  ) : (
                     // Image Preview (Single Item Grid)
                     <div className="grid grid-cols-2 gap-3">
                        <div className="relative group rounded-lg overflow-hidden border border-zinc-800">
                           {/* eslint-disable-next-line @next/next/no-img-element */}
                           <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-auto object-cover" />
                           <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-[1px] p-1.5">
                              <p className="text-[10px] text-center text-white/90 font-medium">Original</p>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {!file && (
               <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#09090b] px-2 text-zinc-500">Or import from URL</span>
                    </div>
                  </div>

                  {/* URL Input */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                        <input 
                          type="text" 
                          placeholder="https://example.com/document.pdf" 
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                          value={urlInput}
                          onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleLoadUrl(); }}
                          disabled={isLoadingUrl}
                        />
                      </div>
                      <button 
                        onClick={handleLoadUrl}
                        disabled={!urlInput.trim() || isLoadingUrl}
                        className="px-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                      >
                        {isLoadingUrl ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Loading...
                          </>
                        ) : (
                          'Load'
                        )}
                      </button>
                    </div>
                    {urlError && (
                      <p className="text-xs text-red-400 px-1">{urlError}</p>
                    )}
                  </div>
               </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300">Task Type</label>
              </div>
              <div className="flex p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                <button 
                  onClick={() => handleChange("task_type", "default")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded transition-all",
                    options.task_type === "default" ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Default
                </button>
                <button 
                  onClick={() => handleChange("task_type", "structure")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded transition-all",
                    options.task_type === "structure" ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Structure
                </button>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                <b>Default:</b> Best for general documents.<br/>
                <b>Structure:</b> Optimized for tables and complex layouts (returns HTML).
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400">Temperature</label>
                <input 
                  type="number" 
                  value={options.temperature}
                  onChange={(e) => handleChange("temperature", parseFloat(e.target.value))}
                  className="w-16 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-right text-white focus:outline-none focus:border-violet-500"
                  step={0.1}
                  min={0}
                  max={1}
                />
              </div>
              <input 
                type="range" 
                min={0} 
                max={1} 
                step={0.1}
                value={options.temperature}
                onChange={(e) => handleChange("temperature", parseFloat(e.target.value))}
                className="w-full accent-violet-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400">Top P</label>
                <input 
                  type="number" 
                  value={options.top_p}
                  onChange={(e) => handleChange("top_p", parseFloat(e.target.value))}
                  className="w-16 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-right text-white focus:outline-none focus:border-violet-500"
                  step={0.1}
                  min={0}
                  max={1}
                />
              </div>
              <input 
                type="range" 
                min={0} 
                max={1} 
                step={0.1}
                value={options.top_p}
                onChange={(e) => handleChange("top_p", parseFloat(e.target.value))}
                className="w-full accent-violet-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400">Repetition Penalty</label>
                <input 
                  type="number" 
                  value={options.repetition_penalty}
                  onChange={(e) => handleChange("repetition_penalty", parseFloat(e.target.value))}
                  className="w-16 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-right text-white focus:outline-none focus:border-violet-500"
                  step={0.05}
                  min={1}
                  max={2}
                />
              </div>
              <input 
                type="range" 
                min={1} 
                max={2} 
                step={0.05}
                value={options.repetition_penalty}
                onChange={(e) => handleChange("repetition_penalty", parseFloat(e.target.value))}
                className="w-full accent-violet-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400">Max Tokens</label>
                <input 
                  type="number" 
                  value={options.max_tokens}
                  onChange={(e) => handleChange("max_tokens", parseInt(e.target.value))}
                  className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-right text-white focus:outline-none focus:border-violet-500"
                  step={128}
                  min={1}
                />
              </div>
            </div>

            <div className="space-y-3">
               <label className="text-sm text-zinc-400 block">Pages (Optional)</label>
               <input 
                  type="text"
                  placeholder="e.g. 1,3,5-7 (Leave empty for all)"
                  value={options.pages || ""}
                  onChange={(e) => handleChange("pages", e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
                <p className="text-xs text-zinc-600">Comma separated page numbers.</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Submit Action */}
      <div className="p-6 border-t border-white/10 bg-[#09090b]">
        <button 
          onClick={onSubmit}
          disabled={!file || isLoading}
          className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-violet-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {isLoading ? (
             <>
               <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
               Processing...
             </>
          ) : (
             <>Run OCR 🚀</>
           )}
        </button>
      </div>
    </div>
  );
}
