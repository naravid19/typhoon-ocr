"use client";

import { useEffect, useState, useRef } from "react";
import { RefreshCw, Download, CheckCircle2, AlertCircle, Sparkles, X } from "lucide-react";

interface UpdateInfo {
  hasUpdate: boolean;
  localSHA?: string;
  remoteSHA?: string;
  commitMessage?: string;
  branch?: string;
  error?: string;
}

export function UpdateBadge() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "updating" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const checkUpdates = async () => {
    setStatus("checking");
    try {
      const res = await fetch("/api/update/check");
      if (!res.ok) throw new Error("Failed to check update");
      const data: UpdateInfo = await res.json();
      setInfo(data);
      if (data.hasUpdate) {
        setStatus("available");
      } else {
        setStatus("idle");
      }
    } catch (err) {
      console.warn("Update check failed:", err);
      setStatus("idle");
    }
  };

  useEffect(() => {
    checkUpdates();
  }, []);

  // Handle outside click and Escape key for dropdown popover
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handlePull = async () => {
    setStatus("updating");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/update/pull", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Git pull failed");
      }
      setLogs(data.output);
      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Update failed");
      setStatus("error");
    }
  };

  if (status === "idle" && !info?.hasUpdate) {
    return null;
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Badge Button */}
      {status === "available" && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Software update available"
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 transition-all shadow-sm hover:shadow-violet-500/20 cursor-pointer animate-pulse"
          title="New update available from GitHub"
        >
          <Sparkles size={13} className="text-violet-400" />
          <span>Update Available</span>
          <span className="w-2 h-2 rounded-full bg-violet-400"></span>
        </button>
      )}

      {/* Modal / Popover Dropdown */}
      {isOpen && (
        <div 
          role="dialog"
          aria-label="Software update options"
          className="absolute right-0 mt-2 w-80 p-4 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
            <div className="flex items-center gap-2 font-semibold text-zinc-100">
              <Download size={15} className="text-violet-400" />
              <span>Software Update</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close modal"
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-1 rounded-md hover:bg-zinc-800"
            >
              <X size={14} />
            </button>
          </div>

          {status === "available" && info && (
            <div className="space-y-3">
              <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60 space-y-1">
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Local: <code className="text-zinc-200">{info.localSHA}</code></span>
                  <span>Latest: <code className="text-violet-400">{info.remoteSHA}</code></span>
                </div>
                {info.commitMessage && (
                  <p className="text-zinc-300 font-mono text-[11px] truncate pt-1 border-t border-zinc-800/40" title={info.commitMessage}>
                    "{info.commitMessage}"
                  </p>
                )}
              </div>

              <button
                onClick={handlePull}
                className="w-full py-2 px-3 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-violet-600/20 active:scale-[0.98]"
              >
                <Download size={14} />
                <span>Pull & Update Now</span>
              </button>
            </div>
          )}

          {status === "updating" && (
            <div className="py-4 flex flex-col items-center justify-center gap-2 text-zinc-300">
              <RefreshCw size={20} className="animate-spin text-violet-400" />
              <span>Running `git pull origin ${info?.branch || 'main'}`...</span>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <CheckCircle2 size={16} />
                <span>Update Completed!</span>
              </div>
              <p className="text-zinc-400 text-[11px]">
                Latest changes pulled successfully. If dependencies were modified, restart your dev server.
              </p>
              {logs && (
                <pre className="bg-zinc-900 p-2 rounded text-[10px] text-zinc-400 font-mono overflow-x-auto max-h-24">
                  {logs}
                </pre>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-medium">
                <AlertCircle size={16} />
                <span>Update Failed</span>
              </div>
              <p className="text-rose-300/90 text-[11px] bg-rose-950/30 border border-rose-800/40 p-2 rounded">
                {errorMessage}
              </p>
              <button
                onClick={handlePull}
                className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
