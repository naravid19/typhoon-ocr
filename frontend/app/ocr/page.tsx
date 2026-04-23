"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { ConfigPanel } from "@/components/ConfigPanel";
import { ResponsePanel } from "@/components/ResponsePanel";
import { NotificationProvider, useNotificationContext } from "@/providers/NotificationProvider";
import { OcrOptions, OcrResult } from "@/types/ocr";
import { processOcrWithProgress, OcrProgress } from "@/lib/api";
import { AlertCircle } from "lucide-react";

function OcrPageContent() {
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setNumPages] = useState<number | null>(null);
  
  // Real-time progress tracking
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

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
    setMounted(true);
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

  const handleProgress = (progress: OcrProgress) => {
    const total = progress.total_pages ?? progress.total ?? 0;
    if (progress.type === "start") {
      setTotalPages(total);
      setCurrentPage(0);
    } else if (progress.type === "progress") {
      setCurrentPage(progress.current ?? 0);
      setTotalPages(total);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setCurrentPage(0);
    setTotalPages(0);

    try {
      const data = await processOcrWithProgress(file, options, handleProgress);
      if (data.success) {
        setResult(data);
        
        // Show success notifications
        toast.success(
          "✅ OCR สำเร็จ!",
          `ประมวลผลเสร็จสิ้น ${data.results.length} หน้า ใช้เวลา ${data.processing_time.toFixed(2)} วินาที`
        );
        
        // Browser notification (if permitted)
        notify("✅ OCR สำเร็จ!", {
          body: `ประมวลผลเสร็จสิ้น ${data.results.length} หน้า`,
        });
      } else {
        setError(data.error || "Failed to process document");
        toast.error("❌ เกิดข้อผิดพลาด", data.error || "ไม่สามารถประมวลผลเอกสารได้");
      }
    } catch (err: unknown) {
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
          file={file}
          setFile={setFile}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onNumPagesChange={setNumPages}
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
            result={result}
            options={options}
            file={file}
            isLoading={isLoading}
            currentPage={currentPage}
            totalPages={totalPages}
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
