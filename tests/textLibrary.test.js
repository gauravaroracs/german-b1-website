import test from "node:test";
import assert from "node:assert/strict";
import { orderAndFilterTexts } from "../src/textLibrary.js";

test("orders newest first, keeping undated older records available", () => {
  const texts = [{ original: "old", createdAt: "2024-01-01" }, { original: "unknown" }, { original: "new", createdAt: "2026-01-01" }];
  assert.deepEqual(orderAndFilterTexts(texts).map((item) => item.original), ["new", "old", "unknown"]);
  assert.equal(texts[0].original, "old");
});

test("searches original text and cached translation without case sensitivity", () => {
  const texts = [{ original: "Guten Morgen", analysis: { translation: "Good morning" } }, { original: "Hallo" }];
  assert.deepEqual(orderAndFilterTexts(texts, " MORNING "), [texts[0]]);
  assert.deepEqual(orderAndFilterTexts(texts, "not found"), []);
});
