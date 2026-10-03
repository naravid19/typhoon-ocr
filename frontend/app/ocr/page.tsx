"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { ConfigPanel } from "@/components/ConfigPanel";
import { ResponsePanel } from "@/components/ResponsePanel";
import { NotificationProvider, useNotificationContext } from "@/providers/NotificationProvider";
import { OcrOptions, FileSlot, FileMode } from "@/types/ocr";
import { processBatch } from "@/lib/processBatch";
import { processOcrWithProgress } from "@/lib/api";
import { AlertCircle } from "lucide-react";

function savedFileMode(): FileMode {
  if (typeof window === "undefined") return "sequential";
  try {
    if (window.localStorage.getItem("ocr.file_mode") === "parallel") return "parallel";
  } catch { /* storage unavailable: use the default */ }
  return "sequential";
}

function OcrPageContent() {
  const [mounted, setMounted] = useState(false);
  const [slots, setSlots] = useState<FileSlot[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Notification Context
  const { 
    notify, 
    toast, 
    hasPermission, 
    requestPermission,
    isSoundEnabled,
    setSoundEnabled
  } = useNotificationContext();

  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);

  // (page renders a placeholder until mounted, so reading storage here cannot cause a hydration mismatch)
  const [options, setOptions] = useState<OcrOptions>({
    model: "typhoon-ocr",
    task_type: "v1.5",
    max_tokens: 16384,
    temperature: 0.1,
    top_p: 0.6,
    repetition_penalty: 1.1,
    pages: "",
    figure_language: "Thai",
    file_mode: savedFileMode(),
  });

  // Remember the run-mode choice across reloads
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && options.file_mode) {
        window.localStorage.setItem("ocr.file_mode", options.file_mode);
      }
    } catch { /* ignore */ }
  }, [options.file_mode]);

  const updateSlot = useCallback(
    (id: string, patch: Partial<FileSlot>) =>
      setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    []
  );

  const handleRemoveSlot = useCallback((id: string) => {
    setSlots((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setActiveSlotId((curr) => {
        if (curr !== id) return curr;
        return next.length > 0 ? next[0].id : null;
      });
      return next;
    });
  }, []);

  const handleClearSlots = useCallback(() => {
    setSlots([]);
    setActiveSlotId(null);
  }, []);

  const handleSubmit = async () => {
    const pendingSlots = slots.filter((s) => !s.result && !s.isLoading);
    if (pendingSlots.length === 0) return;

    setIsLoading(true);
    setError(null);

    // Mark all pending slots as loading
    pendingSlots.forEach((s) => updateSlot(s.id, { isLoading: true, error: null }));

    // Auto-select first slot if none selected
    if (!activeSlotId && pendingSlots.length > 0) {
      setActiveSlotId(pendingSlots[0].id);
    }

    // Stacked (narrow) layout: bring the results into view so progress is visible
    if (window.matchMedia("(max-width: 1023px)").matches) {
      document.getElementById("results-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    let succeededCount = 0;
    let failedCount = 0;
    let partialCount = 0;

    try {
      await processBatch(
        pendingSlots,
        options,
        (id, progress) => {
          updateSlot(id, {
            currentPage: progress.current ?? 0,
            totalPages: progress.total_pages ?? progress.total ?? 0,
            statusMessage: progress.message ?? null,
          });
        },
        (id, result, err) => {
          if (result && !err) {
            succeededCount++;
            if (result.results.some((r) => !r.success || r.truncated)) partialCount++;
          } else {
            failedCount++;
          }
          updateSlot(id, {
            isLoading: false,
            result,
            error: err,
            statusMessage: null,
          });
        }
      );

      if (succeededCount > 0) {
        toast.success(
          "ประมวลผลสำเร็จ",
          `ประมวลผลสำเร็จ ${succeededCount} ไฟล์${failedCount > 0 ? ` (${failedCount} ไฟล์ไม่สำเร็จ)` : ""}` +
            (partialCount > 0 ? ` — ${partialCount} ไฟล์มีบางหน้าล้มเหลวหรือถูกตัด (กด Retry ได้)` : "")
        );
        notify("ประมวลผลสำเร็จ", { body: `ประมวลผลเสร็จสิ้น ${succeededCount} ไฟล์` });
      } else {
        toast.error("ประมวลผลไม่สำเร็จ", "ไม่สามารถประมวลผลไฟล์ใดได้เลย");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error("เกิดข้อผิดพลาด", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-send only the failed/truncated pages of one file (or a single requested page) and merge them into its existing result.
  // Pages that already succeeded are neither re-sent nor changed.
  const handleRetryFailed = async (id: string, specificPage?: number) => {
    const slot = slots.find((s) => s.id === id);
    const previous = slot?.result;
    if (!slot || !previous) return;
    const pages = specificPage !== undefined
      ? [specificPage]
      : previous.results.filter((r) => !r.success || r.truncated).map((r) => r.page);
    if (pages.length === 0) return;

    updateSlot(id, { isLoading: true });
    try {
      const retry = await processOcrWithProgress(
        slot.file,
        { ...options, pages: pages.join(",") },
        (p) => updateSlot(id, { currentPage: p.current ?? 0, totalPages: p.total ?? 0 })
      );
      const byPage = new Map(retry.results.map((r) => [r.page, r]));
      const merged = previous.results.map((r) => byPage.get(r.page) ?? r);
      updateSlot(id, {
        isLoading: false,
        result: {
          ...previous,
          results: merged,
          success: merged.every((r) => r.success && !r.truncated),
          total_tokens: previous.total_tokens + retry.total_tokens,
          processing_time: previous.processing_time + retry.processing_time,
        },
      });
      const remaining = merged.filter((r) => !r.success || r.truncated).length;
      if (remaining === 0) toast.success("Retry สำเร็จ", `แก้ไข ${pages.length} หน้าเรียบร้อย`);
      else toast.error("ยังมีหน้าที่ไม่สำเร็จ", `เหลือ ${remaining} หน้า`);
    } catch (err) {
      updateSlot(id, { isLoading: false }); // keep the existing result
      toast.error("Retry ไม่สำเร็จ", err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  };

  if (!mounted) {
    return <div suppressHydrationWarning className="h-screen bg-[#09090b]" />;
  }

  return (
    <div suppressHydrationWarning className="h-screen bg-[#09090b] flex flex-col font-sans overflow-hidden">
      <Navbar />

      {/* Below lg the sidebar and results stack and the page scrolls; from lg up they sit side by side */}
      <main className="flex-1 flex flex-col lg:flex-row pt-13 overflow-y-auto lg:overflow-hidden">
        <ConfigPanel
          options={options}
          setOptions={setOptions}
          slots={slots}
          setSlots={setSlots}
          onRemoveSlot={handleRemoveSlot}
          onClearSlots={handleClearSlots}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          notificationPermission={hasPermission}
          onRequestNotificationPermission={requestPermission}
          isSoundEnabled={isSoundEnabled}
          onToggleSound={setSoundEnabled}
        />

        <div id="results-panel" className="flex-1 flex flex-col relative min-w-0 min-h-[85vh] lg:min-h-0 lg:h-full">
          {error && (
            <div className="absolute top-4 left-4 right-4 z-50 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          <ResponsePanel
            slots={slots}
            activeSlotId={activeSlotId}
            setActiveSlotId={setActiveSlotId}
            options={options}
            isLoading={isLoading}
            onRetryFailed={handleRetryFailed}
          />
        </div>
      </main>
    </div>
  );
}

export default function OcrPage() {
  return (
    <NotificationProvider>
      <OcrPageContent />
    </NotificationProvider>
  );
}
