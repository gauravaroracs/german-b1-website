import test from "node:test";
import assert from "node:assert/strict";
import { mergeVocabEnrichment } from "../src/vocabEnrichment.js";

test("enrichment preserves learner data and existing forms", () => {
  const word = { id: "1", word: "gehen", note: "my note", srsReps: 4, forms: { Past: "ging" }, memoryTip: "Picture this example: example" };
  const result = mergeVocabEnrichment(word, { wordType: "verb", memoryTip: "Picture walking home.", forms: { Past: "ging", Perfect: "ist gegangen" } });
  assert.equal(result.note, "my note");
  assert.equal(result.srsReps, 4);
  assert.deepEqual(result.forms, { Past: "ging", Perfect: "ist gegangen" });
  assert.equal(result.memoryTip, "Picture walking home.");
});

test("retains existing tip and rejects incomplete grammar", () => {
  assert.equal(mergeVocabEnrichment({ memoryTip: "My own tip" }, { wordType: "adverb", memoryTip: "New cue" }).memoryTip, "My own tip");
  assert.throws(() => mergeVocabEnrichment({}, { wordType: "verb", memoryTip: "cue", forms: {} }), /Incomplete/);
  assert.throws(() => mergeVocabEnrichment({}, { wordType: "noun", memoryTip: "cue" }), /Incomplete/);
});
