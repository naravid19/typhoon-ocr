import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, Dispatch, SetStateAction } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Settings, ChevronRight, ChevronDown, ChevronUp, Link as LinkIcon, Loader2, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { OcrOptions, FileSlot } from "@/types/ocr";
import { SettingsModal } from "./SettingsModal";

const PdfPreviewDynamic = dynamic(() => import("./PdfPreview"), {
  ssr: false,
  loading: () => <div className="h-28 bg-zinc-900 animate-pulse rounded-lg border border-zinc-800 flex items-center justify-center text-xs text-zinc-500">Loading PDF Page Selector...</div>,
});

const LEGACY_DEFAULT_REPETITION_PENALTY = 1.2;
const V15_REPETITION_PENALTY = 1.1;

function getSlotStatusIcon(slot: FileSlot) {
  if (slot.isLoading) {
    return <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />;
  }
  if (slot.error) {
    return <span className="text-red-400 text-sm font-bold">✕</span>;
  }
  if (slot.result) {
    return <span className="text-green-400 text-sm font-bold">✓</span>;
  }
  return <span className="text-zinc-600 text-sm">○</span>;
}

function getSlotStatusText(slot: FileSlot): string {
  if (slot.isLoading) return "processing";
  if (slot.error) return "error";
  if (slot.result) return "done";
  return "pending";
}

interface ConfigPanelProps {
  options: OcrOptions;
  setOptions: Dispatch<SetStateAction<OcrOptions>>;
  slots: FileSlot[];
  setSlots: Dispatch<SetStateAction<FileSlot[]>>;
  onRemoveSlot?: (id: string) => void;
  onClearSlots?: () => void;
  onSubmit: () => void;
  isLoading: boolean;
  /** Whether browser notification permission is granted */
  notificationPermission?: boolean;
  /** Callback to request notification permission */
  onRequestNotificationPermission?: () => Promise<boolean>;
  /** Whether sound is enabled */
  isSoundEnabled?: boolean;
  /** Callback to toggle sound */
  onToggleSound?: (enabled: boolean) => void;
}

export function ConfigPanel({
  options,
  setOptions,
  slots,
  setSlots,
  onRemoveSlot,
  onClearSlots,
  onSubmit,
  isLoading,
  notificationPermission,
  onRequestNotificationPermission,
  isSoundEnabled = true,
  onToggleSound
}: ConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<"files" | "params">("files");
  const [urlInput, setUrlInput] = useState("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showPageSelector, setShowPageSelector] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [maxFiles, setMaxFiles] = useState(10);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8345";

  const fetchEnvConfig = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/env`);
      if (response.ok) {
        const { data } = await response.json();
        if (data.TYPHOON_MAX_FILES) {
          setMaxFiles(data.TYPHOON_MAX_FILES);
        }
      }
    } catch (error) {
      console.error("Failed to fetch env config", error);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchEnvConfig();
  }, [fetchEnvConfig]);

  const isSinglePdf = slots.length === 1 && (
    slots[0].file.type === "application/pdf" || 
    slots[0].file.name.toLowerCase().endsWith(".pdf")
  );

  // Auto-expand page selector when exactly 1 PDF is present
  useEffect(() => {
    if (isSinglePdf) {
      setShowPageSelector(true);
    } else {
      setShowPageSelector(false);
    }
  }, [isSinglePdf, slots.length]);

  // Clear global pages selection when switching to multi-file mode
  useEffect(() => {
    if (slots.length > 1) {
      setOptions((prev) => (prev.pages ? { ...prev, pages: "" } : prev));
    }
  }, [slots.length, setOptions]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUrlError(null);
    const remaining = maxFiles - slots.length;
    if (remaining <= 0) return;
    const toAdd = acceptedFiles.slice(0, remaining);
    if (acceptedFiles.length > remaining) {
      alert(`รับสูงสุด ${maxFiles} ไฟล์ — เพิ่ม ${toAdd.length} ไฟล์แรกเท่านั้น`);
    }
    const newSlots: FileSlot[] = toAdd.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      result: null,
      isLoading: false,
      error: null,
      currentPage: 0,
      totalPages: 0,
      statusMessage: null,
    }));
    setSlots((prev) => [...prev, ...newSlots]);
    setOptions((prev) => ({ ...prev, pages: "" }));
  }, [slots.length, setSlots, setOptions, maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxFiles: maxFiles,
    multiple: true
  });

  const handleChange = (key: keyof OcrOptions, value: string | number) => {
    setOptions({ ...options, [key]: value });
  };

  const handleTaskTypeChange = (taskType: OcrOptions["task_type"]) => {
    const nextOptions: OcrOptions = { ...options, task_type: taskType };

    if (taskType === "v1.5" && options.repetition_penalty === LEGACY_DEFAULT_REPETITION_PENALTY) {
      nextOptions.repetition_penalty = V15_REPETITION_PENALTY;
    }

    setOptions(nextOptions);
  };

  const handleLoadUrl = async () => {
    if (!urlInput.trim()) return;

    if (slots.length >= maxFiles) {
      setUrlError(`รับสูงสุด ${maxFiles} ไฟล์ — กรุณาลบไฟล์เก่าออกก่อน`);
      return;
    }

    setIsLoadingUrl(true);
    setUrlError(null);
    
    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlInput }),
      });
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch { /* ignore parsing error */ }
        
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const filenameHeader = response.headers.get('X-Filename');
      const filename = filenameHeader || new URL(urlInput).pathname.split('/').pop() || 'document.pdf';
      
      let mimeType = blob.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        if (filename.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (filename.endsWith('.png')) mimeType = 'image/png';
        else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (filename.endsWith('.webp')) mimeType = 'image/webp';
      }
      
      const loadedFile = new File([blob], filename, { type: mimeType });
      
      setSlots((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          file: loadedFile,
          result: null,
          isLoading: false,
          error: null,
          currentPage: 0,
          totalPages: 0,
          statusMessage: null,
        },
      ]);
      setOptions((prev) => ({ ...prev, pages: "" }));
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
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-zinc-500 font-medium block">MODEL</label>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
            title="Environment Settings"
          >
            <Settings size={14} />
          </button>
        </div>
        <div className="relative">
          <select 
            className="w-full appearance-none bg-zinc-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
            value={options.model}
            onChange={(e) => handleChange("model", e.target.value)}
          >
            <option value="typhoon-ocr">Typhoon OCR (Default)</option>
          </select>
          <ChevronRight className="absolute right-3 top-3 text-zinc-500 rotate-90 pointer-events-none" size={16} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-4 border-b border-white/10">
        <button
          onClick={() => setActiveTab("files")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer",
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
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer",
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
          <div className="space-y-4">
            {/* Dropzone */}
            <div 
              {...getRootProps()} 
              className={cn(
                "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all",
                isDragActive ? "border-violet-500 bg-violet-500/10" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50",
                slots.length === 0 && "min-h-[130px] flex flex-col items-center justify-center"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-2 mx-auto">
                <Upload className="text-zinc-400" size={16} />
              </div>
              <p className="text-sm text-zinc-300 font-medium">
                {slots.length === 0 ? "Click to upload or drag & drop" : "Drop more files here"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">PDF, JPG, PNG · Max {maxFiles} files</p>
            </div>

            {/* File Queue */}
            {slots.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Queue
                  </label>
                  <span className="text-xs text-zinc-500">{slots.length} file{slots.length !== 1 ? "s" : ""}</span>
                </div>

                <div 
                  aria-label="Processing queue"
                  className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 pr-1"
                >
                  {slots.map((slot) => (
                    <div 
                      key={slot.id} 
                      className="flex items-center gap-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2"
                      aria-label={`${slot.file.name}: ${getSlotStatusText(slot)}`}
                    >
                      {/* Status Icon */}
                      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                        {getSlotStatusIcon(slot)}
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{slot.file.name}</p>
                        {slot.error ? (
                          <p className="text-[10px] text-red-400 truncate">{slot.error}</p>
                        ) : (
                          <p className="text-[10px] text-zinc-500">
                            {(slot.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </div>

                      {/* Remove button */}
                      {!isLoading && (
                        <button 
                          onClick={() => (onRemoveSlot ? onRemoveSlot(slot.id) : setSlots((prev) => prev.filter((s) => s.id !== slot.id)))}
                          className="p-1 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                          aria-label={`Remove ${slot.file.name}`}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Clear all */}
                {!isLoading && slots.length > 1 && (
                  <button 
                    onClick={() => (onClearSlots ? onClearSlots() : setSlots([]))}
                    className="text-xs text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Clear all
                  </button>
                )}

                {/* PDF Page Selector for Single PDF */}
                {isSinglePdf && (
                  <div className="pt-3 border-t border-zinc-800/80 space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowPageSelector((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <FileCheck size={14} className="text-violet-400" />
                        <span>Page Selection & Visual Preview</span>
                        {options.pages && (
                          <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded border border-violet-500/30">
                            {options.pages}
                          </span>
                        )}
                      </div>
                      {showPageSelector ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showPageSelector && (
                      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <PdfPreviewDynamic
                          file={slots[0].file}
                          options={options}
                          setOptions={setOptions}
                          onNumPagesChange={() => {}}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* URL Import — show when queue empty */}
            {slots.length === 0 && (
               <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#09090b] px-2 text-zinc-500">Or import from URL</span>
                    </div>
                  </div>

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
                        className="px-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2 cursor-pointer"
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
                  onClick={() => handleTaskTypeChange("v1.5")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded transition-all cursor-pointer",
                    options.task_type === "v1.5" ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  v1.5
                </button>
                <button 
                  onClick={() => handleTaskTypeChange("default")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded transition-all cursor-pointer",
                    options.task_type === "default" ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Default
                </button>
                <button 
                  onClick={() => handleTaskTypeChange("structure")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded transition-all cursor-pointer",
                    options.task_type === "structure" ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Structure
                </button>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                <b>v1.5:</b> Recommended for higher OCR text quality and stable extraction.<br/>
                <b>Default:</b> JSON output with markdown-friendly extraction.<br/>
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

            {/* Notification Settings */}
            <div className="space-y-3 pt-4 mt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔔</span>
                  <label className="text-sm text-zinc-400">แจ้งเตือนเมื่อเสร็จ</label>
                </div>
                {notificationPermission ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    ✓ เปิดใช้งานแล้ว
                  </span>
                ) : (
                  <button 
                    onClick={onRequestNotificationPermission}
                    className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors cursor-pointer"
                  >
                    ขอสิทธิ์การแจ้งเตือน
                  </button>
                )}
              </div>
              
              {/* Sound Toggle */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔊</span>
                  <label className="text-sm text-zinc-400">เสียงแจ้งเตือน</label>
                </div>
                <button
                  onClick={() => onToggleSound?.(!isSoundEnabled)}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer",
                    isSoundEnabled ? "bg-violet-600" : "bg-zinc-700"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out",
                      isSoundEnabled ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              <p className="text-xs text-zinc-600 mt-2">
                รับการแจ้งเตือนจาก Browser และเสียงเมื่อประมวลผลเอกสารเสร็จสิ้น
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Submit Action */}
      <div className="p-6 border-t border-white/10 bg-[#09090b]">
        <button 
          onClick={onSubmit}
          disabled={slots.filter((s) => !s.result && !s.isLoading).length === 0 || isLoading}
          className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-violet-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? (
             <>
               <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
               Processing...
             </>
          ) : (() => {
             const pendingCount = slots.filter((s) => !s.result && !s.isLoading).length;
             const totalCount = slots.length;
             const hasCompleted = totalCount > 0 && pendingCount < totalCount;
             
             if (totalCount === 0) return <>Select files to begin</>;
             if (pendingCount === 0) return <>All files completed 🎉</>;
             if (hasCompleted) return <>Retry OCR on {pendingCount} remaining file{pendingCount !== 1 ? "s" : ""} 🚀</>;
             return <>Run OCR on {totalCount} file{totalCount !== 1 ? "s" : ""} 🚀</>;
          })()}
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={fetchEnvConfig}
      />
    </div>
  );
}
