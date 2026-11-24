import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSentenceAnalysis } from '../src/sentenceAnalysis.js';

test('rejects incomplete analyses and non-string main text', () => {
  assert.equal(validateSentenceAnalysis(null), null);
  assert.equal(validateSentenceAnalysis({ meaning: { bad: true }, translation: 'hello', chunks: [], tokens: [], contexts: [] }), null);
  assert.equal(validateSentenceAnalysis({ meaning: 'hello', translation: 'hello', chunks: [], tokens: [], contexts: [] }), null);
});

test('normalizes optional fields and excludes malformed nested entries', () => {
  const result = validateSentenceAnalysis({ meaning: 'Meaning', translation: 'Translation', chunks: [null, { text: 'Ich', role: null }], tokens: [{ surface: 'Ich', lemma: 12 }], contexts: [{ german: 'Hallo', translation: 'Hello' }, { german: 'Bad', translation: {} }], wordOrder: { bad: true } });
  assert.deepEqual(result.chunks, [{ text: 'Ich', role: '', gloss: '' }]);
  assert.equal(result.tokens[0].lemma, '');
  assert.deepEqual(result.contexts, [{ german: 'Hallo', translation: 'Hello' }]);
  assert.equal(result.wordOrder, '');
});
