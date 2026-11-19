import assert from "node:assert/strict";
import { test } from "node:test";
import { modelDefaults } from "../lib/modelDefaults.ts";

test("v2 ids", () => {
  for (const id of ["typhoon-ocr-v2", "typhoon-ocr2", "Typhoon-OCR2-0.8b"])
    assert.deepEqual(modelDefaults(id), { task_type: "v2", repetition_penalty: 1.0, temperature: 0 });
});
test("1.5", () => assert.deepEqual(modelDefaults("typhoon-ocr"), { task_type: "v1.5", repetition_penalty: 1.1 }));
test("legacy keeps default/structure", () => {
  assert.deepEqual(modelDefaults("typhoon-ocr-preview", "default"), { task_type: "default", repetition_penalty: 1.2 });
  assert.deepEqual(modelDefaults("typhoon-ocr-preview", "v1.5"), { task_type: "structure", repetition_penalty: 1.2 });
});
