import { FileSlot } from "@/types/ocr";
import { markdownToPlainText } from "@/utils/markdownText";

function basename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

export function slotToMarkdown(slot: FileSlot): string {
  if (!slot.result) return "";
  return slot.result.results.map((r) => r.text).join("\n\n");
}

export function mergeSlotsMarkdown(slots: FileSlot[]): string {
  return slots
    .filter((s) => s.result && !s.error)
    .map((s) => `# ${basename(s.file.name)}\n\n${slotToMarkdown(s)}`)
    .join("\n\n---\n\n");
}

export function mergeSlotsText(slots: FileSlot[]): string {
  return slots
    .filter((s) => s.result && !s.error)
    .map(
      (s) =>
        `=== ${basename(s.file.name)} ===\n\n${markdownToPlainText(slotToMarkdown(s))}`
    )
    .join("\n\n");
}

function triggerDownload(url: string, filename: string): void {
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function downloadMd(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  triggerDownload(url, basename(filename) + ".md");
}

export async function downloadZip(slots: FileSlot[]): Promise<void> {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  const nameCounts = new Map<string, number>();

  for (const slot of slots.filter((s) => s.result && !s.error)) {
    const base = basename(slot.file.name);
    const count = nameCounts.get(base) || 0;
    nameCounts.set(base, count + 1);
    const zipFilename = count === 0 ? `${base}.md` : `${base} (${count}).md`;
    files[zipFilename] = strToU8(slotToMarkdown(slot));
  }

  const url = URL.createObjectURL(
    new Blob([zipSync(files)], { type: "application/zip" })
  );
  triggerDownload(url, "ocr-results.zip");
}

export function downloadMerged(slots: FileSlot[]): void {
  downloadMd("ocr-results-merged.md", mergeSlotsMarkdown(slots));
}
