import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAMMAR_GAPS, advanceGrammarGap } from "../src/grammarGap.js";

test("the gap round has ten distinct questions with one listed answer and a rule", () => {
  assert.equal(GRAMMAR_GAPS.length, 10);
  assert.equal(new Set(GRAMMAR_GAPS.map((gap) => gap.id)).size, 10);
  for (const gap of GRAMMAR_GAPS) {
    assert.ok(gap.prompt.includes("___"));
    assert.ok(gap.rule.trim());
    assert.equal(gap.options.length, 3);
    assert.equal(gap.options.filter((option) => option === gap.answer).length, 1);
  }
});

test("missed gaps return after other questions while correct answers advance", () => {
  const queue = ["a", "b", "c"];
  assert.deepEqual(advanceGrammarGap(queue, false), ["b", "c", "a"]);
  assert.deepEqual(advanceGrammarGap(queue, true), ["b", "c"]);
  assert.deepEqual(queue, ["a", "b", "c"]);
});
