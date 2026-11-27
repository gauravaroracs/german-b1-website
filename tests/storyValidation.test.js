import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGeneratedStory, validStoryCorrection } from "../src/storyValidation.js";

const story = { title: "Ein Tag", category: "Alltag", text: "Es regnet.", words: [{ word: "regnet", meaning: "rains", lemma: 42 }], questions: [{ q: "Was?", options: ["Regen", "Sonne"], answer: "Regen" }], nextPrompt: "Was passiert?", modelContinuation: "Es hört auf." };

test("generated stories require complete, renderable questions and vocabulary", () => {
  assert.equal(validateGeneratedStory({ ...story, questions: [] }), null);
  assert.equal(validateGeneratedStory({ ...story, questions: [{ ...story.questions[0], answer: "Wind" }] }), null);
  assert.equal(validateGeneratedStory({ ...story, words: [{ word: null, meaning: "rains" }] }), null);
  assert.deepEqual(validateGeneratedStory(story).words, [{ word: "regnet", meaning: "rains" }]);
  assert.equal(validateGeneratedStory({ ...story, translation: "It is raining." }).translation, "It is raining.");
  assert.equal(validateGeneratedStory({ ...story, questions: Array(5).fill(story.questions[0]) }), null);
  assert.deepEqual(validateGeneratedStory({ ...story, words: [{ word: "schlief", meaning: "slept", lemma: "schlafen", forms: { Past: "schlief", empty: "" }, unsafe: true }] }).words, [{ word: "schlief", meaning: "slept", lemma: "schlafen", forms: { Past: "schlief" } }]);
  assert.deepEqual(validateGeneratedStory({ ...story, words: [{ word: "Termin", meaning: "appointment", artikel: "der", plural: "Termine", wordType: "noun", cefrLevel: "B1", unsafe: true }] }).words, [{ word: "Termin", meaning: "appointment", artikel: "der", plural: "Termine", wordType: "noun", cefrLevel: "B1" }]);
  assert.equal(validateGeneratedStory({ ...story, words: [{ word: "Termin", meaning: "appointment", cefrLevel: "wrong" }] }).words[0].cefrLevel, undefined);
});

test("continuation corrections require complete markers and correction fields", () => {
  assert.equal(validStoryCorrection("---CORRECTIONS--- NONE ---END---", []), true);
  assert.equal(validStoryCorrection("Sorry, try again", []), false);
  assert.equal(validStoryCorrection("---CORRECTIONS--- incomplete ---END---", []), false);
  assert.equal(validStoryCorrection("---CORRECTIONS--- text ---END---", [{ MISTAKE: "x", CORRECT: "y", WHY: "" }]), false);
  assert.equal(validStoryCorrection("---CORRECTIONS--- text ---END---", [{ MISTAKE: "x", CORRECT: "y", WHY: "z" }]), true);
});
