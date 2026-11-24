import test from 'node:test';
import assert from 'node:assert/strict';
import { FREQUENCY_WORDS } from '../src/frequencyWords.js';
import { VOCAB_PACKS } from '../src/vocabPacks.js';

test('starter packs have distinct identifiers, titles, and items', () => {
  assert.equal(VOCAB_PACKS.length, 4);
  assert.equal(new Set(VOCAB_PACKS.map((pack) => pack.id)).size, VOCAB_PACKS.length);
  assert.equal(new Set(VOCAB_PACKS.map((pack) => pack.title)).size, VOCAB_PACKS.length);
  for (const pack of VOCAB_PACKS) {
    assert.ok(pack.id && pack.title && pack.description);
    assert.ok(pack.words.length > 0);
    assert.equal(new Set(pack.words).size, pack.words.length, pack.id);
  }
});

test('each exact pack lemma resolves to one complete corpus record', () => {
  for (const pack of VOCAB_PACKS) {
    for (const lemma of pack.words) {
      const matches = FREQUENCY_WORDS.filter((item) => item.w === lemma);
      assert.equal(matches.length, 1, `${pack.id}: ${lemma}`);
      for (const field of ['p', 't', 's', 'e']) assert.ok(matches[0][field], `${lemma}: ${field}`);
    }
  }
});
