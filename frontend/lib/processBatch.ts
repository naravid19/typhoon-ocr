import { FileSlot, OcrOptions, OcrResult } from "@/types/ocr";
import { processOcrWithProgress, OcrProgress } from "@/lib/api";

const CONCURRENCY = 3; // ponytail: sliding window worker queue

export async function processBatch(
  slots: FileSlot[],
  options: OcrOptions,
  onProgress: (id: string, progress: OcrProgress) => void,
  onSlotDone: (id: string, result: OcrResult | null, error: string | null) => void
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < slots.length) {
      const slot = slots[index++];
      try {
        const result = await processOcrWithProgress(
          slot.file,
          options,
          (progress) => onProgress(slot.id, progress)
        );
        const errMessage = !result.success ? (result.error ?? "Processing failed") : null;
        onSlotDone(slot.id, result.success ? result : null, errMessage);
      } catch (err) {
        onSlotDone(slot.id, null, err instanceof Error ? err.message : "Unknown error");
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY, slots.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
}

