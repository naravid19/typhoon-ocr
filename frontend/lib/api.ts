import { OcrOptions, OcrResult } from "@/types/ocr";

export interface OcrProgress {
  type: "start" | "progress" | "page_complete" | "complete" | "error";
  total_pages?: number;
  total?: number;
  current?: number;
  page?: number;
  message?: string;
  success?: boolean;
  text?: string;
  error?: string;
}

export async function processOcrWithProgress(
  file: File,
  options: OcrOptions,
  onProgress: (progress: OcrProgress) => void
): Promise<OcrResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", options.model);
  formData.append("task_type", options.task_type);
  formData.append("max_tokens", options.max_tokens.toString());
  formData.append("temperature", options.temperature.toString());
  formData.append("top_p", options.top_p.toString());
  formData.append("repetition_penalty", options.repetition_penalty.toString());
  if (options.pages) {
    formData.append("pages", options.pages);
  }

  // Use relative path for production or full path for dev
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8345";
  const response = await fetch(`${apiUrl}/api/ocr/stream`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR request failed: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body received");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Split by SSE double newline
    const lines = buffer.split("\n\n");
    // Keep the last partial line in the buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim() === "" || line.startsWith(":")) continue;

      if (line.startsWith("data: ")) {
        const jsonStr = line.replace("data: ", "").trim();
        try {
          const progress = JSON.parse(jsonStr) as OcrProgress;
          onProgress(progress);

          if (progress.type === "complete") {
            // Re-cast as OcrResult which matches the 'complete' event payload
            return progress as unknown as OcrResult;
          }

          if (progress.type === "error") {
            throw new Error(progress.message || "Unknown error during OCR streaming");
          }
        } catch (e) {
          console.error("Failed to parse SSE data", e);
        }
      }
    }
  }

  throw new Error("OCR stream ended prematurely");
}

export function generateCode(language: string, file: File | null, options: OcrOptions): string {
  const filename = file?.name || "document.pdf";
  const { model, task_type, max_tokens, temperature, top_p, repetition_penalty, pages } = options;

  if (language === "python") {
    return `import requests

url = "http://localhost:8345/api/ocr"
files = {"file": open("${filename}", "rb")}
data = {
    "model": "${model}",
    "task_type": "${task_type}",
    "max_tokens": ${max_tokens},
    "temperature": ${temperature},
    "top_p": ${top_p},
    "repetition_penalty": ${repetition_penalty}${pages ? `,
    "pages": "${pages}"` : ""}
}

response = requests.post(url, files=files, data=data)
print(response.json())`;
  }

  if (language === "curl") {
    return `curl -X POST http://localhost:8345/api/ocr \\
  -F "file=@${filename}" \\
  -F "model=${model}" \\
  -F "task_type=${task_type}" \\
  -F "max_tokens=${max_tokens}" \\
  -F "temperature=${temperature}" \\
  -F "top_p=${top_p}" \\
  -F "repetition_penalty=${repetition_penalty}"${pages ? ` \\
  -F "pages=${pages}"` : ""}`;
  }

  if (language === "javascript") {
    return `const formData = new FormData();
formData.append("file", file); // File object from input
formData.append("model", "${model}");
formData.append("task_type", "${task_type}");
formData.append("max_tokens", "${max_tokens}");
formData.append("temperature", "${temperature}");
formData.append("top_p", "${top_p}");
formData.append("repetition_penalty", "${repetition_penalty}")${pages ? `;
formData.append("pages", "${pages}")` : ""};

fetch("http://localhost:8345/api/ocr", {
  method: "POST",
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));`;
  }

  return "";
}
