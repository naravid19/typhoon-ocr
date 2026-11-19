import type { OcrTaskType } from "../types/ocr.ts";

export interface ModelDefaults {
  task_type: OcrTaskType;
  repetition_penalty: number;
  temperature?: number;
}

export function modelDefaults(modelId: string, prevTask?: OcrTaskType): ModelDefaults {
  const lower = modelId.toLowerCase();
  if (lower.includes("ocr-v2") || lower.includes("ocr2")) {
    return { task_type: "v2", repetition_penalty: 1.0, temperature: 0 };
  }
  if (lower.includes("preview")) {
    const task_type: OcrTaskType = prevTask === "default" || prevTask === "structure" ? prevTask : "structure";
    return { task_type, repetition_penalty: 1.2 };
  }
  return { task_type: "v1.5", repetition_penalty: 1.1 };
}
