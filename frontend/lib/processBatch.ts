import { FileSlot, OcrOptions, OcrResult } from "@/types/ocr";
import { processOcrWithProgress, OcrProgress } from "@/lib/api";

// Typhoon's quota is shared (20 req/min), so extra parallel files only delay every file's finish.
// ponytail: sliding window worker queue
const CONCURRENCY = { sequential: 1, parallel: 3 };

export async function processBatch(
  slots: FileSlot[],
  options: OcrOptions,
  onProgress: (id: string, progress: OcrProgress) => void,
  onSlotDone: (id: string, result: OcrResult | null, error: string | null) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < slots.length) {
      if (abortSignal?.aborted) {
        return;
      }
      const slot = slots[index++];
      if (!slot) break;
      try {
        const result = await processOcrWithProgress(
          slot.file,
          options,
          (progress) => onProgress(slot.id, progress),
          abortSignal
        );
        // Keep the result when any page worked: failed pages are flagged in the UI and can be retried
        const usable = result.results?.some((r) => r.success) ?? false;
        onSlotDone(slot.id, usable ? result : null, usable ? null : (result.error ?? "Processing failed"));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          onSlotDone(slot.id, null, "Canceled by user");
        } else {
          onSlotDone(slot.id, null, err instanceof Error ? err.message : "Unknown error");
        }
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY[options.file_mode ?? "sequential"], slots.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
}
