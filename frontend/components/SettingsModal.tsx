import { useState, useEffect } from "react";
import { X, Server, Key, Brain, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationContext } from "@/providers/NotificationProvider";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface EnvData {
  base_url: string;
  api_key: string;
  model: string;
  max_files: number;
}

const CLOSE_TIMEOUT_MS = 1500;

function FormField({ 
  icon: Icon, 
  label, 
  type = "text", 
  value, 
  onChange, 
  placeholder 
}: { 
  icon: React.ElementType, 
  label: string, 
  type?: string, 
  value: string, 
  onChange: (value: string) => void,
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        <Icon size={16} className="text-violet-400" />
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all placeholder:text-zinc-600"
      />
    </div>
  );
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const { toast } = useNotificationContext();
  const [formData, setFormData] = useState<EnvData>({
    base_url: "",
    api_key: "",
    model: "",
    max_files: 10,
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8345";

  useEffect(() => {
    if (isOpen) {
      fetchEnv();
      setIsSuccess(false);
      setFormData({ base_url: "", api_key: "", model: "", max_files: 10 });
    }
  }, [isOpen]);

  const fetchEnv = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/env`);
      if (response.ok) {
        const { data } = await response.json();
        setFormData(prev => ({
          ...prev,
          base_url: data.TYPHOON_BASE_URL || "",
          model: data.TYPHOON_OCR_MODEL || "",
          max_files: data.TYPHOON_MAX_FILES || 10,
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

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const response = await fetch(`${apiUrl}/api/env`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#09090b] border border-white/10 shadow-2xl shadow-violet-900/10 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900/50">
          <div>
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <p className="text-xs text-zinc-400">Configure your API credentials and model</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
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
                onChange={(val) => setFormData(prev => ({ ...prev, base_url: val }))}
                placeholder="https://api.opentyphoon.ai/v1"
              />

              <FormField 
                icon={Key}
                label="API Key"
                type="password"
                value={formData.api_key}
                onChange={(val) => setFormData(prev => ({ ...prev, api_key: val }))}
                placeholder={hasApiKey ? "******** (Set)" : "sk-..."}
              />

              <FormField 
                icon={Brain}
                label="Model Name"
                value={formData.model}
                onChange={(val) => setFormData(prev => ({ ...prev, model: val }))}
                placeholder="typhoon-ocr"
              />
              
              <FormField 
                icon={FileText}
                label="Max Files Upload"
                type="number"
                value={formData.max_files.toString()}
                onChange={(val) => setFormData(prev => ({ ...prev, max_files: parseInt(val) || 10 }))}
                placeholder="10"
              />
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 bg-zinc-900/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || isSaving || isSuccess}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
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
