import { test } from "node:test";
import assert from "node:assert/strict";
import { articleNouns, articleNounText, advanceArticleQueue } from "../src/articleDrill.js";

test("only words with an explicit valid article enter the filtered drill", () => {
  const words = [{ id: 1, word: "der Tag", artikel: "der", cefrLevel: "A1" }, { id: 2, word: "Haus", artikel: "das", cefrLevel: "A2" }, { id: 3, word: "gehen", artikel: null }, { id: 4, word: "Sache", artikel: "unknown" }];
  assert.deepEqual(articleNouns(words, "A1").map((word) => word.id), [1]);
  assert.deepEqual(articleNouns(words, "All").map((word) => word.id), [1, 2]);
  assert.equal(articleNounText(words[0]), "Tag");
});

test("a miss returns later while a reveal and correct answer advance without repetition", () => {
  const queue = ["a", "b", "c"];
  assert.deepEqual(advanceArticleQueue(queue, "wrong"), ["b", "c", "a"]);
  assert.deepEqual(advanceArticleQueue(queue, "revealed"), ["b", "c"]);
  assert.deepEqual(advanceArticleQueue(queue, "correct"), ["b", "c"]);
  assert.deepEqual(queue, ["a", "b", "c"]);
});
