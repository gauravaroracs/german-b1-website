import { test } from "node:test";
import assert from "node:assert/strict";
import { grammarPractisedToday, updateGrammarTopicSession } from "../src/grammarSession.js";

test("mounting an untouched topic does not write a synthetic empty session", () => {
  const stored = { __articleDrill: { done: 2 } };
  assert.equal(updateGrammarTopicSession(stored, 3, {}, {}, {}), stored);
});

test("daily grammar progress recognizes the durable completed-round date", () => {
  assert.equal(grammarPractisedToday({}, { __gapRound: { completedOn: '2026-11-24' } }, '2026-11-24'), true);
  assert.equal(grammarPractisedToday({}, { __gapRound: { completedOn: '2026-11-23' } }, '2026-11-24'), false);
  assert.equal(grammarPractisedToday({ '2026-11-24': { grammar: true } }, {}, '2026-11-24'), true);
});

test("unchanged topic state does not write and edits preserve other session data", () => {
  const stored = { 1: { answers: { 0: "der" }, feedback: {}, hints: {}, note: "keep" }, __articleDrill: { done: 2 } };
  assert.equal(updateGrammarTopicSession(stored, 1, { 0: "der" }, {}, {}), stored);
  const updated = updateGrammarTopicSession(stored, 1, { 0: "die" }, {}, {});
  assert.equal(updated[1].note, "keep");
  assert.deepEqual(updated.__articleDrill, { done: 2 });
  assert.equal(updated[1].answers[0], "die");
});
