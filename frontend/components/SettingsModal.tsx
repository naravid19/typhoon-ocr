import { useState, useEffect, useId } from "react";
import { X, Server, Key, Brain, Loader2, FileText, Gauge, Layers, Scissors, ScrollText, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationContext } from "@/providers/NotificationProvider";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

// Number fields are kept as strings while editing so the box can be cleared and retyped;
// they are parsed (and validated by the backend) on save.
interface EnvData {
  base_url: string;
  api_key: string;
  model: string;
  max_files: string;
  rate_limit_rpm: string;
  rate_limit_rps: string;
  max_concurrency: string;
  first_pass_max_tokens: string;
  log_level: string;
}

const EMPTY_FORM: EnvData = {
  base_url: "",
  api_key: "",
  model: "",
  max_files: "10",
  rate_limit_rpm: "",
  rate_limit_rps: "",
  max_concurrency: "",
  first_pass_max_tokens: "",
  log_level: "INFO",
};

const LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR"];

// Backend field name -> the label the user sees, for validation errors
const FIELD_LABELS: Record<string, string> = {
  max_files: "Max Files Upload",
  rate_limit_rpm: "Requests per minute",
  rate_limit_rps: "Requests per second",
  max_concurrency: "Max simultaneous requests",
  first_pass_max_tokens: "First-attempt max tokens",
  log_level: "Log level",
};
const CLOSE_TIMEOUT_MS = 1500;

function FormField({
  icon: Icon,
  label,
  hint,
  type = "text",
  value,
  onChange,
  placeholder,
  min,
  step,
}: {
  icon: React.ElementType;
  label: string;
  hint?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  min?: number;
  step?: number;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        <Icon size={16} className="text-violet-400" />
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={min}
        step={step}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all placeholder:text-zinc-600"
      />
      {hint && (
        <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-zinc-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const { toast } = useNotificationContext();
  const titleId = useId();
  const [formData, setFormData] = useState<EnvData>(EMPTY_FORM);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8345";
  const set = (key: keyof EnvData) => (val: string) => setFormData((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    if (isOpen) {
      fetchEnv();
      setIsSuccess(false);
      setFormData(EMPTY_FORM);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const fetchEnv = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/env`);
      if (response.ok) {
        const { data } = await response.json();
        setFormData((prev) => ({
          ...prev,
          base_url: data.TYPHOON_BASE_URL || "",
          model: data.TYPHOON_OCR_MODEL || "",
          max_files: String(data.TYPHOON_MAX_FILES || 10),
          rate_limit_rpm: String(data.TYPHOON_RATE_LIMIT_RPM ?? ""),
          rate_limit_rps: String(data.TYPHOON_RATE_LIMIT_RPS ?? ""),
          max_concurrency: String(data.TYPHOON_MAX_CONCURRENCY ?? ""),
          first_pass_max_tokens: String(data.TYPHOON_FIRST_PASS_MAX_TOKENS ?? ""),
          log_level: data.LOG_LEVEL || "INFO",
        }));
        setHasApiKey(data.TYPHOON_API_KEY_SET);
      } else {
        toast.error("Error", "Failed to load current settings.");
      }
    } catch (error) {
      console.error("Failed to fetch env", error);
      toast.error("Error", "Failed to load current settings.");
    } finally {
      setIsLoading(false);
    }
  };

  // "" -> undefined so the backend leaves that setting alone; anything else must be a number
  const num = (v: string): number | undefined => (v.trim() === "" ? undefined : Number(v));

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const payload = {
        base_url: formData.base_url,
        api_key: formData.api_key,
        model: formData.model,
        max_files: num(formData.max_files),
        rate_limit_rpm: num(formData.rate_limit_rpm),
        rate_limit_rps: num(formData.rate_limit_rps),
        max_concurrency: num(formData.max_concurrency),
        first_pass_max_tokens: num(formData.first_pass_max_tokens),
        log_level: formData.log_level,
      };
      const response = await fetch(`${apiUrl}/api/env`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // 422: the backend names the field that is out of range
        const detail = response.status === 422 ? await response.json().catch(() => null) : null;
        const first = detail?.detail?.[0];
        const field = first?.loc?.slice(-1)[0] as string | undefined;
        throw new Error(first ? `${(field && FIELD_LABELS[field]) || field}: ${first.msg}` : "Failed to update settings");
      }

      toast.success("Success", "Settings saved successfully.");
      setIsSuccess(true);
      setTimeout(() => {
        onSave?.();
        onClose();
      }, CLOSE_TIMEOUT_MS);
    } catch (error) {
      toast.error("Error", error instanceof Error ? error.message : "Unknown error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-xl bg-[#121215] border border-white/[0.08] shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-zinc-950/60 shrink-0">
          <div>
            <h2 id={titleId} className="text-sm font-semibold text-zinc-100">Environment Settings</h2>
            <p className="text-[11px] text-zinc-400">Configure API credentials, inference model and throughput</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 -mr-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              <p className="text-sm text-zinc-400">Loading settings...</p>
            </div>
          ) : (
            <>
              <FormField
                icon={Server}
                label="API Base URL"
                value={formData.base_url}
                onChange={set("base_url")}
                placeholder="https://api.opentyphoon.ai/v1"
              />

              <FormField
                icon={Key}
                label="API Key"
                type="password"
                value={formData.api_key}
                onChange={set("api_key")}
                placeholder={hasApiKey ? "******** (Set)" : "sk-..."}
                hint={hasApiKey ? "Leave empty to keep the saved key." : undefined}
              />

              <FormField
                icon={Brain}
                label="Model Name"
                value={formData.model}
                onChange={set("model")}
                placeholder="typhoon-ocr"
              />

              <FormField
                icon={FileText}
                label="Max Files Upload"
                type="number"
                min={1}
                value={formData.max_files}
                onChange={set("max_files")}
                placeholder="10"
              />

              <div className="pt-4 border-t border-white/[0.08] space-y-5">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  aria-expanded={showAdvanced}
                  className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <span>Advanced: speed and diagnostics</span>
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showAdvanced && (
                  <>
                    <FormField
                      icon={Gauge}
                      label="Requests per minute"
                      type="number"
                      min={0}
                      value={formData.rate_limit_rpm}
                      onChange={set("rate_limit_rpm")}
                      placeholder="20"
                      hint="Typhoon allows 20 per minute for typhoon-ocr. 0 = no limit (self-hosted). Raise it only if the log shows no 429 errors."
                    />

                    <FormField
                      icon={Gauge}
                      label="Requests per second"
                      type="number"
                      min={0}
                      step={0.5}
                      value={formData.rate_limit_rps}
                      onChange={set("rate_limit_rps")}
                      placeholder="2"
                      hint="Typhoon allows 2 per second. 0 = no limit."
                    />

                    <FormField
                      icon={Layers}
                      label="Max simultaneous requests"
                      type="number"
                      min={1}
                      value={formData.max_concurrency}
                      onChange={set("max_concurrency")}
                      placeholder="8"
                      hint="Across all files. The rate limits set the pace; this only keeps a few stuck pages from blocking the rest."
                    />

                    <FormField
                      icon={Scissors}
                      label="First-attempt max tokens"
                      type="number"
                      min={256}
                      value={formData.first_pass_max_tokens}
                      onChange={set("first_pass_max_tokens")}
                      placeholder="4096"
                      hint="Caps the first try for each page so a page the model loops on fails fast. Pages that need more are retried with the full budget."
                    />

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                        <ScrollText size={16} className="text-violet-400" />
                        Log level
                      </label>
                      <div role="radiogroup" aria-label="Log level" className="grid grid-cols-4 gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                        {LOG_LEVELS.map((level) => (
                          <button
                            key={level}
                            type="button"
                            role="radio"
                            aria-checked={formData.log_level === level}
                            onClick={() => set("log_level")(level)}
                            className={cn(
                              "py-2 text-xs font-medium rounded-lg transition-all",
                              formData.log_level === level ? "bg-zinc-800 text-white shadow-xs" : "text-zinc-500 hover:text-zinc-300"
                            )}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] leading-relaxed text-zinc-500">
                        Shown in the backend terminal. DEBUG adds per-page render times and full error traces.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/[0.08] bg-zinc-950/60 flex justify-end gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || isSaving || isSuccess}
            className="btn-primary py-1.5 px-4 text-xs font-medium flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
