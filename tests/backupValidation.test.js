import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBackupData } from "../src/backupValidation.js";

test("rejects unrecognized and incorrectly typed backup data before import", () => {
  for (const input of [null, [], {}, { exportedAt: 'today' }, { vocabWords: 'not an array' }, { vocabWords: [null] }, { thinkState: [] }, { practiceDraft: {} }, { practiceScenario: [] }]) {
    assert.throws(() => validateBackupData(input));
  }
});

test("accepts partial legacy and empty data, and rejects any malformed field", () => {
  const valid = { vocabWords: [], thinkState: {}, practiceScenario: null, practiceDraft: '', frequencyAdventureSession: null };
  assert.equal(validateBackupData(valid), valid);
  assert.throws(() => validateBackupData({ vocabWords: [{ word: 'Haus' }], savedSentences: 'broken' }));
});

test("rejects records that would discard words or break story and practice views", () => {
  for (const input of [{ vocabWords: [{}] }, { savedSentences: [{}] }, { storedStories: [{}] }, { practiceMessages: [{}] }, { practiceMessages: [{ role: 'assistant', turn: { reply: 'Hallo', corrections: [{}] } }] }]) assert.throws(() => validateBackupData(input));
  assert.doesNotThrow(() => validateBackupData({ vocabWords: [{ lemma: 'Haus' }], practiceMessages: [{ role: 'assistant', turn: { reply: 'Hallo' } }] }));
});
