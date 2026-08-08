"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { ConfigPanel } from "@/components/ConfigPanel";
import { ResponsePanel } from "@/components/ResponsePanel";
import { NotificationProvider, useNotificationContext } from "@/providers/NotificationProvider";
import { OcrOptions, FileSlot } from "@/types/ocr";
import { processBatch } from "@/lib/processBatch";
import { AlertCircle } from "lucide-react";

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

  const [options, setOptions] = useState<OcrOptions>({
    model: "typhoon-ocr",
    task_type: "v1.5",
    max_tokens: 16384,
    temperature: 0.1,
    top_p: 0.6,
    repetition_penalty: 1.1,
    pages: "",
  });

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

    let succeededCount = 0;
    let failedCount = 0;

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
          "✅ OCR สำเร็จ!",
          `ประมวลผลสำเร็จ ${succeededCount} ไฟล์${failedCount > 0 ? ` (${failedCount} ไฟล์ไม่สำเร็จ)` : ""}`
        );
        notify("✅ OCR สำเร็จ!", { body: `ประมวลผลเสร็จสิ้น ${succeededCount} ไฟล์` });
      } else {
        toast.error("❌ ประมวลผลไม่สำเร็จ", "ไม่สามารถประมวลผลไฟล์ใดได้เลย");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error("❌ เกิดข้อผิดพลาด", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return <div suppressHydrationWarning className="h-screen bg-[#09090b]" />;
  }

  return (
    <div suppressHydrationWarning className="h-screen bg-[#09090b] flex flex-col font-sans overflow-hidden">
      <Navbar />

      <main className="flex-1 flex pt-16 overflow-hidden">
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

        <div className="flex-1 flex flex-col h-full relative">
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
