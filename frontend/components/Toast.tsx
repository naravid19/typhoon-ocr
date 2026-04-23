"use client";

import { useState, useEffect, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toast variant types
 */
export type ToastVariant = "success" | "error" | "warning" | "info";

/**
 * Toast message interface
 */
export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

/**
 * Icons for each toast variant
 */
const variantIcons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-green-400" />,
  error: <AlertCircle size={18} className="text-red-400" />,
  warning: <AlertTriangle size={18} className="text-yellow-400" />,
  info: <Info size={18} className="text-blue-400" />,
};

/**
 * Background styles for each variant
 */
const variantStyles: Record<ToastVariant, string> = {
  success: "bg-gradient-to-r from-emerald-500/10 to-green-500/5 border-emerald-500/20 shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]",
  error: "bg-gradient-to-r from-red-500/10 to-rose-500/5 border-red-500/20 shadow-[0_0_30px_-5px_rgba(239,68,68,0.2)]",
  warning: "bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border-amber-500/20 shadow-[0_0_30px_-5px_rgba(245,158,11,0.2)]",
  info: "bg-gradient-to-r from-blue-500/10 to-cyan-500/5 border-blue-500/20 shadow-[0_0_30px_-5px_rgba(59,130,246,0.2)]",
};

/**
 * Individual Toast component
 */
function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      className={cn(
        "relative flex items-start gap-4 px-5 py-4 rounded-xl border backdrop-blur-xl max-w-sm w-full overflow-hidden transition-all",
        variantStyles[toast.variant],
        isExiting
          ? "animate-out fade-out-0 slide-out-to-right-full duration-500 ease-in-out"
          : "animate-in fade-in-0 slide-in-from-bottom-8 duration-500 ease-out fill-mode-backwards"
      )}
    >
      {/* Icon with glow */}
      <div className="shrink-0 mt-0.5 relative">
        <div className={cn(
          "absolute inset-0 blur-lg opacity-50",
          toast.variant === "success" && "bg-emerald-500",
          toast.variant === "error" && "bg-red-500",
          toast.variant === "warning" && "bg-amber-500",
          toast.variant === "info" && "bg-blue-500",
        )} />
        <div className="relative">{variantIcons[toast.variant]}</div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 z-10">
        <p className="text-sm font-semibold text-white tracking-wide">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{toast.description}</p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="shrink-0 p-1.5 hover:bg-white/10 rounded-md transition-colors -mr-2 -mt-2 group"
      >
        <X size={14} className="text-zinc-500 group-hover:text-white transition-colors" />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
        <div
          className={cn(
            "h-full shadow-[0_0_10px_rgba(255,255,255,0.5)]",
            toast.variant === "success" && "bg-gradient-to-r from-emerald-500 to-green-400",
            toast.variant === "error" && "bg-gradient-to-r from-red-500 to-rose-400",
            toast.variant === "warning" && "bg-gradient-to-r from-amber-500 to-yellow-400",
            toast.variant === "info" && "bg-gradient-to-r from-blue-500 to-cyan-400"
          )}
          style={{
            animation: `shrink ${toast.duration || 5000}ms linear forwards`,
          }}
        />
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

/**
 * Toast Container Component
 * Displays toast notifications in the bottom-right corner
 */
export function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div suppressHydrationWarning className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

/**
 * Custom hook for managing toasts
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * Convenience methods for different variants
   */
  const toast = {
    success: (title: string, description?: string, duration?: number) =>
      addToast({ variant: "success", title, description, duration }),
    error: (title: string, description?: string, duration?: number) =>
      addToast({ variant: "error", title, description, duration }),
    warning: (title: string, description?: string, duration?: number) =>
      addToast({ variant: "warning", title, description, duration }),
    info: (title: string, description?: string, duration?: number) =>
      addToast({ variant: "info", title, description, duration }),
  };

  return {
    toasts,
    addToast,
    removeToast,
    toast,
  };
}
