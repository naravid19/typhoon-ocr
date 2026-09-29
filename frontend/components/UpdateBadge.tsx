"use client";

import { useEffect, useState, useRef } from "react";
import { RefreshCw, Download, CheckCircle2, AlertCircle, Sparkles, X, ExternalLink, Info } from "lucide-react";

interface UpdateInfo {
  hasUpdate: boolean;
  current: string;
  latest: { tag: string; title: string; notes: string; url: string } | null;
  canSelfUpdate: boolean;
  blocker: { code: "not-git" | "wrong-branch" | "dirty"; error: string } | null;
}

export function UpdateBadge() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "available" | "updating" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dependenciesChanged, setDependenciesChanged] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // One check per page load; the server caches the GitHub answer, so this is cheap
  useEffect(() => {
    let cancelled = false;
    fetch("/api/update/check")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: UpdateInfo) => {
        if (cancelled) return;
        setInfo(data);
        if (data.hasUpdate) setStatus("available");
      })
      .catch((err) => console.warn("Update check failed:", err));
    return () => {
      cancelled = true;
    };
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

  const latest = info?.latest ?? null;

  const handleUpdate = async () => {
    if (!latest) return;
    setStatus("updating");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/update/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: latest.tag }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Update failed");
      }
      setDependenciesChanged(Boolean(data.dependenciesChanged));
      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Update failed");
      setStatus("error");
    }
  };

  if (!info?.hasUpdate || !latest) {
    return null;
  }

  const releaseLink = (
    <a
      href={latest.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 transition-colors"
    >
      <span>View release on GitHub</span>
      <ExternalLink size={11} />
    </a>
  );

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Badge Button */}
      {status !== "success" && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={`Software update available: ${latest.tag}`}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 transition-all cursor-pointer"
          title={`${latest.tag} is available on GitHub`}
        >
          <Sparkles size={12} className="text-violet-400" />
          <span>Update Available</span>
          <span className="font-mono text-[10px] text-violet-200/90">{latest.tag}</span>
        </button>
      )}
      {status === "success" && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 cursor-pointer"
        >
          <CheckCircle2 size={12} />
          <span>Updated to {latest.tag}: restart</span>
        </button>
      )}

      {/* Modal / Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Software update options"
          className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] p-4 rounded-xl border border-white/[0.08] bg-[#121215] shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
            <div className="flex items-center gap-2 font-semibold text-zinc-100">
              <Download size={14} className="text-violet-400" />
              <span>Software Update</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-1 rounded-md hover:bg-zinc-800"
            >
              <X size={14} />
            </button>
          </div>

          {status === "available" && (
            <div className="space-y-3">
              <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>
                    Installed <code className="text-zinc-200">v{info.current}</code>
                  </span>
                  <span>
                    Latest <code className="text-violet-400">{latest.tag}</code>
                  </span>
                </div>
                {latest.title && latest.title !== latest.tag && (
                  <p className="text-zinc-200 font-medium pt-1 border-t border-zinc-800/40">{latest.title}</p>
                )}
                {latest.notes && (
                  <div className="max-h-40 overflow-y-auto whitespace-pre-line text-[11px] leading-relaxed text-zinc-400 scrollbar-thin">
                    {latest.notes}
                  </div>
                )}
              </div>

              {releaseLink}

              {info.blocker && (
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-200/90 bg-amber-950/20 border border-amber-800/40 p-2 rounded">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  <span>{info.blocker.error}</span>
                </p>
              )}

              {info.canSelfUpdate && (
                <button
                  onClick={handleUpdate}
                  className="w-full btn-primary py-2 px-3 text-xs font-medium flex items-center justify-center gap-2"
                >
                  <Download size={13} />
                  <span>Update to {latest.tag}</span>
                </button>
              )}
              {info.blocker?.code === "not-git" && (
                <a
                  href={latest.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full btn-primary py-2 px-3 text-xs font-medium flex items-center justify-center gap-2"
                >
                  <Download size={13} />
                  <span>Download {latest.tag}</span>
                </a>
              )}
            </div>
          )}

          {status === "updating" && (
            <div className="py-4 flex flex-col items-center justify-center gap-2 text-zinc-300" role="status">
              <RefreshCw size={20} className="animate-spin text-violet-400" />
              <span>Updating to {latest.tag}...</span>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <CheckCircle2 size={16} />
                <span>Updated to {latest.tag}</span>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Restart the app to run the new version.
                {dependenciesChanged &&
                  " Dependencies changed in this release: run start_app.bat again (or npm install and pip install -r requirements.txt) before restarting."}
              </p>
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
                <span>Update failed</span>
              </div>
              <p className="text-rose-300/90 text-[11px] leading-relaxed bg-rose-950/30 border border-rose-800/40 p-2 rounded">
                {errorMessage}
              </p>
              <div className="flex items-center justify-between">
                {releaseLink}
                <button
                  onClick={handleUpdate}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
