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
  success: <CheckCircle size={15} className="text-emerald-400" />,
  error: <AlertCircle size={15} className="text-red-400" />,
  warning: <AlertTriangle size={15} className="text-amber-400" />,
  info: <Info size={15} className="text-blue-400" />,
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
    const duration = toast.duration || 4500;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 250);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 250);
  };

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 px-4 py-3 rounded-lg border border-white/[0.08] bg-[#121215] shadow-lg max-w-sm w-full overflow-hidden transition-all",
        isExiting
          ? "opacity-0 translate-y-2 duration-200 ease-in"
          : "animate-in fade-in slide-in-from-bottom-3 duration-200 ease-out"
      )}
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        {variantIcons[toast.variant]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-100">{toast.title}</p>
        {toast.description && (
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{toast.description}</p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="shrink-0 p-1 hover:bg-white/[0.06] rounded transition-colors text-zinc-500 hover:text-zinc-300"
        title="Dismiss"
      >
        <X size={12} />
      </button>

      {/* Bottom accent indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04]">
        <div
          className={cn(
            "h-full",
            toast.variant === "success" && "bg-emerald-500",
            toast.variant === "error" && "bg-red-500",
            toast.variant === "warning" && "bg-amber-500",
            toast.variant === "info" && "bg-blue-500"
          )}
          style={{
            animation: `shrink ${toast.duration || 4500}ms linear forwards`,
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
    <div suppressHydrationWarning className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
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
