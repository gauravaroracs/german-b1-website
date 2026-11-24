import { test } from "node:test";
import assert from "node:assert/strict";
import { filterStoryWords, selectStoryWords } from "../src/storyGeneration.js";

test("recent selection uses at most five valid saved words in date order", () => {
  const words = Array.from({ length: 6 }, (_, index) => ({ id: index, word: `word-${index}`, cefrLevel: 'A1', addedAt: `2026-11-0${index + 1}` }));
  assert.deepEqual(selectStoryWords([...words, { id: "bad", word: "" }], "recent", []).map((word) => word.id), [5, 4, 3, 2, 1]);
});

test("level and learning filters exclude unknown levels and learned words respectively", () => {
  const words = [{ id: 1, word: 'eins', cefrLevel: 'A1' }, { id: 2, word: 'zwei', cefrLevel: 'B2', srsReps: 5, srsInterval: 21 }, { id: 3, word: 'drei' }];
  assert.deepEqual(filterStoryWords(words, 'level', 'A2').map((word) => word.id), [1]);
  assert.deepEqual(filterStoryWords(words, 'learning', 'A2').map((word) => word.id), [1, 3]);
  assert.deepEqual(selectStoryWords(words, 'recent', [], 'A2').map((word) => word.id), [1]);
  assert.deepEqual(selectStoryWords(words, 'manual', [2, 3], 'A2').map((word) => word.id), [2, 3]);
  assert.deepEqual(filterStoryWords(words, 'all', 'A2', 'ZWEI').map((word) => word.id), [2]);
});

test("manual selection ignores deleted or invalid entries and preserves saved words", () => {
  const words = [{ id: "a", word: "eins" }, { id: "b", word: "zwei" }, { id: "c", word: "drei" }];
  assert.deepEqual(selectStoryWords(words, "manual", ["c", "missing", "a"]).map((word) => word.id), ["a", "c"]);
});
