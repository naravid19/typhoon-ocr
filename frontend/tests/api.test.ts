// Run with: npm test   (node's built-in runner; no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { generateCode } from "../lib/api.ts";
import type { OcrOptions } from "../types/ocr.ts";

const mockOptions: OcrOptions = {
  model: "typhoon-ocr-v1.5",
  task_type: "v1.5",
  max_tokens: 16384,
  temperature: 0.1,
  top_p: 0.6,
  repetition_penalty: 1.1,
  pages: "1-3",
  figure_language: "Thai",
};

test("generateCode generates valid Python snippet with parameters", () => {
  const result = generateCode("python", null, mockOptions);
  assert.ok(result.includes('url = "http://localhost:8345/api/ocr"'));
  assert.ok(result.includes('"model": "typhoon-ocr-v1.5"'));
  assert.ok(result.includes('"task_type": "v1.5"'));
  assert.ok(result.includes('"figure_language": "Thai"'));
  assert.ok(result.includes('"pages": "1-3"'));
});

test("generateCode generates valid cURL command", () => {
  const result = generateCode("curl", null, mockOptions);
  assert.ok(result.includes("curl -X POST http://localhost:8345/api/ocr"));
  assert.ok(result.includes('-F "model=typhoon-ocr-v1.5"'));
  assert.ok(result.includes('-F "task_type=v1.5"'));
});

test("generateCode generates valid JavaScript snippet", () => {
  const result = generateCode("javascript", null, mockOptions);
  assert.ok(result.includes('fetch("http://localhost:8345/api/ocr"'));
  assert.ok(result.includes('formData.append("model", "typhoon-ocr-v1.5")'));
});
