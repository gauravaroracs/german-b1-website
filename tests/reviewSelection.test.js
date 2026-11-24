import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewLevelOf, selectDailyReviewWords } from '../src/reviewSelection.js';

test('only verified CEFR levels are assigned to level filters', () => {
  assert.equal(reviewLevelOf({ tags: ['pack:work'] }), 'Unknown');
  assert.equal(reviewLevelOf({ cefrLevel: 'A2–B1' }), 'Unknown');
  assert.equal(reviewLevelOf({ tags: ['B1'] }), 'B1');
});

test('filters by level before limiting new words and preserves due established words', () => {
  const cards = [{ id: 'a', cefrLevel: 'A1' }, { id: 'b', cefrLevel: 'B1' }, { id: 'c', cefrLevel: 'B1' }, { id: 'd', cefrLevel: 'B1', srsReps: 1 }, { id: 'e' }];
  assert.deepEqual(selectDailyReviewWords(cards, 'B1', 1).map((item) => item.id), ['d', 'b']);
  assert.deepEqual(selectDailyReviewWords(cards, 'Unknown', 5).map((item) => item.id), ['e']);
  assert.deepEqual(selectDailyReviewWords(cards, 'B1', 0).map((item) => item.id), ['d']);
});
