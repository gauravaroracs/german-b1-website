import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLegacyDestination, LEGACY_LEARNING_FIELDS, previewLegacyRecords, readLegacyPreview } from '../src/legacyPreview.js';

test('previews valid learning data and excludes secrets and unknown records', () => {
  const raw = {
    'vocab-words': JSON.stringify([{ word: 'Haus' }, { word: 'Baum' }]),
    'saved-sentences': JSON.stringify([{ german: 'Ich gehe.' }]),
    'practice-scenario': 'null',
    'openai-api-key': '"secret"',
    'unrecognized-learning-key': '"something"',
  };
  const original = structuredClone(raw);
  const result = previewLegacyRecords(raw);
  assert.deepEqual(result.snapshot.vocabWords, [{ word: 'Haus' }, { word: 'Baum' }]);
  assert.deepEqual(result.entries.map(({ field, count }) => [field, count]), [['vocabWords', 2], ['practiceScenario', 0], ['savedSentences', 1]]);
  assert.deepEqual(result.unknownKeys, ['unrecognized-learning-key']);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.deepEqual(raw, original);
});

test('invalid JSON and semantically malformed records are reported without an importable value', () => {
  const result = previewLegacyRecords({ 'vocab-words': '[', 'saved-sentences': '[{}]', 'practice-draft': '"draft"' });
  assert.deepEqual(result.errors.map(({ key }) => key), ['vocab-words', 'saved-sentences']);
  assert.deepEqual(result.snapshot, { practiceDraft: 'draft' });
});

test('reads only the allowlisted keys and does not mutate storage', async () => {
  const calls = [];
  const raw = new Map([['vocab-words', '[{"word":"Haus"}]'], ['openai-api-key', '"secret"']]);
  const result = await readLegacyPreview({ async get(key) { calls.push(key); return raw.get(key); } });
  assert.deepEqual(calls, Object.keys(LEGACY_LEARNING_FIELDS));
  assert.equal(calls.includes('openai-api-key'), false);
  assert.equal(result.snapshot.vocabWords[0].word, 'Haus');
  assert.equal(raw.get('openai-api-key'), '"secret"');
});

test('read failures propagate rather than being reported as an empty preview', async () => {
  await assert.rejects(readLegacyPreview({ async get() { throw new Error('database unavailable'); } }), /database unavailable/);
});

test('destination comparison distinguishes empty, equal, different and unresolved changes without exposing account values', async () => {
  const preview = previewLegacyRecords({
    'practice-draft': '"draft"', 'vocab-words': '[{"word":"Haus"}]',
    'saved-sentences': '[{"german":"Hallo"}]', 'anki-log': '{"2026-01-01":1}',
  });
  const destinations = {
    'practice-draft': { remoteFound: false },
    'vocab-words': { remoteFound: true, remote: [{ word: 'Haus' }] },
    'saved-sentences': { remoteFound: true, remote: [{ german: 'private account text' }] },
    'anki-log': { remoteFound: false, local: { pending: true, deleted: true } },
  };
  const result = await compareLegacyDestination(preview, async (key) => destinations[key]);
  assert.deepEqual(Object.fromEntries(result.entries.map((entry) => [entry.key, entry.destination])), {
    'anki-log': 'pending', 'vocab-words': 'same', 'practice-draft': 'empty', 'saved-sentences': 'different',
  });
  assert.equal(JSON.stringify(result).includes('private account text'), false);
  await assert.rejects(compareLegacyDestination(preview, async () => { throw new Error('network failed'); }), /network failed/);
});

test('a cloud tombstone differs from a saved null value', async () => {
  const preview = previewLegacyRecords({ 'practice-scenario': 'null' });
  const result = await compareLegacyDestination(preview, async () => ({ remoteFound: true, remoteDeleted: true, remote: null }));
  assert.equal(result.entries[0].destination, 'different');
});
