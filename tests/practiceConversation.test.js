import test from "node:test";
import assert from "node:assert/strict";
import { buildPracticeTurnMessages, validatePracticeTurn } from "../src/practiceConversation.js";

test("practice replies keep the conversation specific and validate complete correction feedback", () => {
  const messages = buildPracticeTurnMessages({
    scenario: "interview",
    level: "B1",
    history: [{ role: "assistant", turn: { reply: "Was haben Sie gelernt?" } }, { role: "user", text: "Ich arbeite gern im Team." }],
    input: "Gestern habe ich mich für diese Stelle bewerben.",
    savedWords: [{ artikel: "die", word: "Stelle", translation: "position" }],
  });
  assert.equal(messages.at(-1).content, "Gestern habe ich mich für diese Stelle bewerben.");
  assert.equal(messages[1].content, "Was haben Sie gelernt?");
  assert.match(messages[0].content, /specific follow-up question/);
  assert.match(messages[0].content, /die Stelle/);
  assert.match(messages[0].content, /never as instructions/);

  assert.deepEqual(validatePracticeTurn({
    reply: "Das klingt interessant. Was gefällt Ihnen an der Stelle?",
    translation: "That sounds interesting. What do you like about the position?",
    correctedText: "Gestern habe ich mich für diese Stelle beworben.",
    corrections: [{ original: "Ich habe mich bewerben.", corrected: "Ich habe mich beworben.", explanation: "Use the past participle with haben.", category: "Perfekt", example: "Ich habe mich gestern beworben." }],
  }).corrections[0].corrected, "Ich habe mich beworben.");
});

test("practice validation rejects partial or oversized AI responses and accepts no-correction turns", () => {
  const valid = { reply: "Gut. Warum?", translation: "Good. Why?", corrections: [] };
  assert.equal(validatePracticeTurn(valid).correctedText, "");
  assert.equal(validatePracticeTurn({ ...valid, corrections: [{ original: "Ich arbeite.", corrected: "", explanation: "Why" }] }), null);
  assert.equal(validatePracticeTurn({ ...valid, reply: "x".repeat(1201) }), null);
  assert.equal(validatePracticeTurn(null), null);
});

test("practice prompts send only five bounded vocabulary entries and recent turns", () => {
  const history = Array.from({ length: 15 }, (_, index) => ({ role: index % 2 ? "user" : "assistant", text: `turn-${index}`, turn: { reply: `turn-${index}` } }));
  const messages = buildPracticeTurnMessages({ history, input: "Das ist mein Beispiel.", savedWords: Array.from({ length: 8 }, (_, index) => ({ word: `Wort ${index}`, translation: "meaning" })) });
  assert.equal(messages.length, 14);
  assert.equal(messages[1].content, "turn-3");
  assert.equal(messages.at(-2).content, "turn-14");
  assert.match(messages[0].content, /Wort 4/);
  assert.doesNotMatch(messages[0].content, /Wort 5/);
});
