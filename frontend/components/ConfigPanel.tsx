import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, Dispatch, SetStateAction } from "react";
import { useDropzone } from "react-dropzone";
import { 
  Upload, 
  X, 
  Settings, 
  ChevronDown, 
  ChevronUp, 
  Link as LinkIcon, 
  Loader2, 
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Bell,
  Volume2,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OcrOptions, FileSlot } from "@/types/ocr";
import { SettingsModal } from "./SettingsModal";

const PdfPreviewDynamic = dynamic(() => import("./PdfPreview"), {
  ssr: false,
  loading: () => (
    <div className="h-24 bg-zinc-900/60 animate-pulse rounded-lg border border-zinc-800 flex items-center justify-center text-xs text-zinc-500 font-mono">
      Loading Page Selector...
    </div>
  ),
});

const LEGACY_DEFAULT_REPETITION_PENALTY = 1.2;
const V15_REPETITION_PENALTY = 1.1;

function getSlotStatusIcon(slot: FileSlot) {
  if (slot.isLoading) {
    return <Loader2 size={13} className="text-violet-400 animate-spin" />;
  }
  if (slot.error) {
    return <AlertCircle size={13} className="text-red-400" />;
  }
  if (slot.result) {
    return <CheckCircle2 size={13} className="text-emerald-400" />;
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
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
  notificationPermission?: boolean;
  onRequestNotificationPermission?: () => Promise<boolean>;
  isSoundEnabled?: boolean;
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
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showPageSelector, setShowPageSelector] = useState(true);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [maxFiles, setMaxFiles] = useState(10);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([
    {
      id: "typhoon-ocr",
      name: "Typhoon OCR 1.5 (2B)",
      description: "Recommended: Single-prompt Markdown with Thai/English figure descriptions",
    },
    {
      id: "typhoon-ocr-preview",
      name: "Typhoon OCR 1 (7B)",
      description: "Legacy model: Requires anchor text and supports default / structure modes",
    }
  ]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8345";

  const fetchEnvConfig = useCallback(async () => {
    try {
      const [envRes, modelsRes] = await Promise.allSettled([
        fetch(`${apiUrl}/api/env`),
        fetch(`${apiUrl}/api/models`)
      ]);

      if (envRes.status === "fulfilled" && envRes.value.ok) {
        const { data } = await envRes.value.json();
        if (data.TYPHOON_MAX_FILES) {
          setMaxFiles(data.TYPHOON_MAX_FILES);
        }
        if (data.TYPHOON_OCR_MODEL) {
          const envModel = data.TYPHOON_OCR_MODEL.trim();
          setOptions((prev) => {
            if (!prev.model || prev.model === "typhoon-ocr") {
              const isPreview = envModel.toLowerCase().includes("preview");
              return {
                ...prev,
                model: envModel,
                task_type: isPreview ? "structure" : "v1.5",
                repetition_penalty: isPreview ? 1.2 : 1.1,
              };
            }
            return prev;
          });
        }
      }

      if (modelsRes.status === "fulfilled" && modelsRes.value.ok) {
        const modelsData = await modelsRes.value.json();
        if (Array.isArray(modelsData) && modelsData.length > 0) {
          setAvailableModels(modelsData);
        }
      }
    } catch (error) {
      console.error("Failed to fetch env config or models", error);
    }
  }, [apiUrl, setOptions]);

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
      alert(`Maximum ${maxFiles} files allowed.`);
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

  const handleModelSelect = (selectedModelId: string) => {
    const isLegacy = selectedModelId.toLowerCase().includes("preview");
    setOptions((prev) => ({
      ...prev,
      model: selectedModelId,
      task_type: isLegacy ? (prev.task_type === "v1.5" ? "structure" : prev.task_type) : "v1.5",
      repetition_penalty: isLegacy ? 1.2 : 1.1,
    }));
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
      setUrlError(`Maximum limit of ${maxFiles} files reached.`);
      return;
    }

    setIsLoadingUrl(true);
    setUrlError(null);
    
    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      });
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch { /* ignore */ }
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
      setShowUrlInput(false);
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : 'Failed to load file from URL');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const isLegacy = options.model.toLowerCase().includes("preview");
  const pendingCount = slots.filter((s) => !s.result && !s.isLoading).length;
  const totalCount = slots.length;

  return (
    <aside className="flex flex-col h-full bg-[#0d0d10] border-r border-white/[0.08] w-full lg:w-[380px] xl:w-[410px] shrink-0">
      
      {/* Model Selector Header */}
      <div className="p-4 border-b border-white/[0.08] bg-[#09090b]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            Model Engine
          </span>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-zinc-800"
            title="Configure API and Environment"
          >
            <Settings size={14} />
          </button>
        </div>
        
        <div className="relative">
          <select 
            className="w-full appearance-none bg-zinc-900 border border-white/[0.08] rounded-md px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
            value={options.model}
            onChange={(e) => handleModelSelect(e.target.value)}
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-2.5 text-zinc-400 pointer-events-none" size={14} />
        </div>
        
        <p className="text-[11px] text-zinc-500 mt-1.5 leading-snug line-clamp-1">
          {availableModels.find((m) => m.id === options.model)?.description || "OCR model for document extraction"}
        </p>
      </div>

      {/* Unified Scrollable Workspace Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        
        {/* Section 1: Ingestion & Document Queue */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Documents ({slots.length}/{maxFiles})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUrlInput((v) => !v)}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
              >
                <LinkIcon size={12} />
                <span>URL</span>
              </button>
              {slots.length > 0 && !isLoading && (
                <button 
                  onClick={() => (onClearSlots ? onClearSlots() : setSlots([]))}
                  className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* URL Import Dropdown */}
          {showUrlInput && (
            <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-2">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="https://example.com/file.pdf" 
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLoadUrl(); }}
                  disabled={isLoadingUrl}
                />
                <button 
                  onClick={handleLoadUrl}
                  disabled={!urlInput.trim() || isLoadingUrl}
                  className="px-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs text-white rounded-md transition-colors flex items-center gap-1.5"
                >
                  {isLoadingUrl ? <Loader2 size={12} className="animate-spin" /> : "Load"}
                </button>
              </div>
              {urlError && <p className="text-[11px] text-red-400">{urlError}</p>}
            </div>
          )}

          {/* Dynamic Dropzone: Full size when empty, compact bar when queue has items */}
          {slots.length === 0 ? (
            <div 
              {...getRootProps()} 
              className={cn(
                "upload-zone flex flex-col items-center justify-center p-6 text-center transition-all",
                isDragActive ? "border-violet-500 bg-violet-500/[0.06]" : "hover:border-zinc-700"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-2.5 text-zinc-400">
                <Upload size={14} />
              </div>
              <p className="text-xs text-zinc-200 font-medium">Click or drag document here</p>
              <p className="text-[11px] text-zinc-500 mt-1 font-mono">PDF, PNG, JPG, WEBP (Max {maxFiles})</p>
            </div>
          ) : (
            <div 
              {...getRootProps()} 
              className={cn(
                "p-2.5 border border-dashed rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors bg-zinc-900/30",
                isDragActive ? "border-violet-500 bg-violet-500/[0.08]" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60"
              )}
            >
              <input {...getInputProps()} />
              <Plus size={13} className="text-violet-400" />
              <span className="text-xs text-zinc-300 font-medium">Add more files</span>
            </div>
          )}

          {/* File Queue List */}
          {slots.length > 0 && (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
              {slots.map((slot) => (
                <div 
                  key={slot.id} 
                  className="flex items-center gap-2.5 bg-zinc-900/60 border border-white/[0.06] rounded-md px-3 py-2 text-xs"
                >
                  <div className="shrink-0 flex items-center justify-center">
                    {getSlotStatusIcon(slot)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-200 truncate">{slot.file.name}</p>
                    {slot.error ? (
                      <p className="text-[10px] text-red-400 truncate">{slot.error}</p>
                    ) : (
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {(slot.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  {!isLoading && (
                    <button 
                      onClick={() => (onRemoveSlot ? onRemoveSlot(slot.id) : setSlots((prev) => prev.filter((s) => s.id !== slot.id)))}
                      className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition-colors"
                      title="Remove file"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Single PDF Page Selector Accordion */}
          {isSinglePdf && (
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <button
                type="button"
                onClick={() => setShowPageSelector((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-md text-xs font-medium text-zinc-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileCheck size={13} className="text-violet-400" />
                  <span>Page Range Filter</span>
                  {options.pages && (
                    <span className="text-[10px] font-mono bg-violet-500/10 text-violet-300 px-1.5 py-0.5 rounded border border-violet-500/20">
                      {options.pages}
                    </span>
                  )}
                </div>
                {showPageSelector ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showPageSelector && (
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3">
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

        {/* Section 2: Pipeline Configuration */}
        <div className="space-y-3 pt-3 border-t border-white/[0.08]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            Pipeline Configuration
          </span>

          {isLegacy ? (
            <div className="space-y-2">
              <label className="text-xs text-zinc-300">Task Type (v1 Legacy)</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-md">
                <button 
                  onClick={() => handleTaskTypeChange("default")}
                  className={cn(
                    "py-1.5 text-xs font-medium rounded transition-all",
                    options.task_type === "default" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Default
                </button>
                <button 
                  onClick={() => handleTaskTypeChange("structure")}
                  className={cn(
                    "py-1.5 text-xs font-medium rounded transition-all",
                    options.task_type === "structure" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Structure
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-300 font-medium">Figure Description Language</label>
                <span className="text-[10px] font-mono text-zinc-500">&lt;figure&gt;</span>
              </div>
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-md">
                <button
                  type="button"
                  onClick={() => handleChange("figure_language", "Thai")}
                  className={cn(
                    "py-1.5 text-xs font-medium rounded transition-all",
                    (options.figure_language || "Thai") === "Thai"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  ภาษาไทย (Thai)
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("figure_language", "English")}
                  className={cn(
                    "py-1.5 text-xs font-medium rounded transition-all",
                    options.figure_language === "English"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  English
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2b: Multi-file run mode */}
        {slots.length > 1 && (
          <div className="space-y-2.5 pt-3 border-t border-white/[0.08]">
            <label className="text-xs text-zinc-300 font-medium">Multi-file Run Mode</label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-md">
              {([
                ["sequential", "ทีละไฟล์ (แนะนำ)"],
                ["parallel", "พร้อมกัน"],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleChange("file_mode", mode)}
                  className={cn(
                    "py-1.5 text-xs font-medium rounded transition-all",
                    (options.file_mode ?? "sequential") === mode
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-500">
              Typhoon จำกัด 20 หน้า/นาทีทุกไฟล์รวมกัน ทีละไฟล์ = ไฟล์แรกเสร็จเร็วสุด, พร้อมกัน = ทุกไฟล์เสร็จพร้อมกันตอนท้าย เวลารวมเท่ากัน
            </p>
          </div>
        )}

        {/* Section 3: Advanced Inference Controls Accordion */}
        <div className="space-y-3 pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => setShowAdvancedParams((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Sliders size={13} className="text-zinc-400" />
              <span>Inference Parameters</span>
            </div>
            {showAdvancedParams ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showAdvancedParams && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Temperature</label>
                  <span className="font-mono text-xs text-zinc-300 tabular-nums">{options.temperature}</span>
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Top P</label>
                  <span className="font-mono text-xs text-zinc-300 tabular-nums">{options.top_p}</span>
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Repetition Penalty</label>
                  <span className="font-mono text-xs text-zinc-300 tabular-nums">{options.repetition_penalty}</span>
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Max Tokens</label>
                  <input 
                    type="number" 
                    value={options.max_tokens}
                    onChange={(e) => handleChange("max_tokens", parseInt(e.target.value))}
                    className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-right font-mono text-white focus:outline-none focus:border-violet-500"
                    step={256}
                    min={1}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400 block">Page Filter</label>
                  {slots.length > 1 && (
                    <span className="text-[10px] text-zinc-500 font-mono">Single file only</span>
                  )}
                </div>
                <input 
                  type="text"
                  placeholder={slots.length > 1 ? "Disabled for multi-file batch" : "e.g. 1, 3, 5-8"}
                  value={options.pages || ""}
                  disabled={slots.length > 1}
                  onChange={(e) => handleChange("pages", e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Telemetry & Notification Controls */}
        <div className="space-y-3 pt-3 border-t border-white/[0.08]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            Notifications
          </span>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <Bell size={13} />
              <span>Browser Alert</span>
            </div>
            {notificationPermission ? (
              <span className="text-[10px] font-mono text-emerald-400">Enabled</span>
            ) : (
              <button 
                onClick={onRequestNotificationPermission}
                className="text-[11px] text-violet-400 hover:text-violet-300 font-medium"
              >
                Enable
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <Volume2 size={13} />
              <span>Completion Audio</span>
            </div>
            <button
              onClick={() => onToggleSound?.(!isSoundEnabled)}
              className={cn(
                "relative w-8 h-4 rounded-full transition-colors focus:outline-none",
                isSoundEnabled ? "bg-violet-600" : "bg-zinc-800"
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                  isSoundEnabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Footer Submit Action - Flat Tactile Studio Button */}
      <div className="p-4 border-t border-white/[0.08] bg-[#09090b]">
        <button 
          onClick={onSubmit}
          disabled={pendingCount === 0 || isLoading}
          className="w-full btn-primary py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Processing Queue...</span>
            </>
          ) : (() => {
            if (totalCount === 0) return <span>Upload documents to begin</span>;
            if (pendingCount === 0) return <span>All documents completed</span>;
            if (pendingCount < totalCount) return <span>Retry {pendingCount} remaining {pendingCount === 1 ? "document" : "documents"}</span>;
            return <span>Execute OCR ({totalCount} {totalCount === 1 ? "file" : "files"})</span>;
          })()}
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={fetchEnvConfig}
      />
    </aside>
  );
}
