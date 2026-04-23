export type OcrTaskType = "default" | "structure" | "v1.5";

export interface OcrPageResult {
  page: number;
  success: boolean;
  text: string;
  image_base64?: string;
  error?: string;
}

export interface OcrResult {
  success: boolean;
  results: OcrPageResult[];
  total_tokens: number;
  processing_time: number;
  error?: string;
}

export interface OcrOptions {
  model: string;
  task_type: OcrTaskType;
  max_tokens: number;
  temperature: number;
  top_p: number;
  repetition_penalty: number;
  pages?: string; 
}
