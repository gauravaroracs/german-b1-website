import { test } from "node:test";
import assert from "node:assert/strict";
import { keepWritingPattern, isWritingPatternKept } from "../src/writingToolbox.js";

test("keeping a new line makes one due review item and repeated keeps do not duplicate it", () => {
  const pattern = { german: "Guten Tag.", english: "Good day." };
  const exercise = { title: "An email" };
  const saved = keepWritingPattern([], pattern, exercise, "2026-11-24", "new-1");
  assert.equal(saved[0].srsDue, "2026-11-24");
  assert.equal(saved[0].translation, pattern.english);
  assert.ok(isWritingPatternKept(saved, pattern));
  assert.equal(keepWritingPattern(saved, pattern, exercise, "2026-11-24", "new-2"), saved);
});

test("keeping an existing sentence retains review progress and notes", () => {
  const existing = [{ id: "old", german: " GUTEN  TAG. ", translation: "Hello.", srsReps: 8, srsDue: "2027-01-01", notes: "Keep me" }];
  const next = keepWritingPattern(existing, { german: "Guten Tag.", english: "Good day." }, { title: "An email" }, "2026-11-24", "new");
  assert.deepEqual(next, [{ ...existing[0], writingPattern: true }]);
});
