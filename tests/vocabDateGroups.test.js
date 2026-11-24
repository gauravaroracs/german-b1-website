import test from 'node:test';
import assert from 'node:assert/strict';
import { groupWordsByAddedDate } from '../src/vocabDateGroups.js';

test('groups additions by calendar day, newest first, and retains unknown dates', () => {
  const words = [
    { word: 'older', addedAt: '2026-11-01' }, { word: 'today', addedAt: '2026-11-24T11:30:00Z' },
    { word: 'unknown' }, { word: 'yesterday', addedAt: '2026-11-23' }, { word: 'invalid', addedAt: '2026-02-30' },
    { word: 'today2', addedAt: '2026-11-24' },
  ];
  const groups = groupWordsByAddedDate(words, '2026-11-24');
  assert.deepEqual(groups.map((group) => group.key), ['2026-11-24', '2026-11-23', '2026-11-01', 'unknown']);
  assert.match(groups[0].label, /^Today/);
  assert.match(groups[1].label, /^Yesterday/);
  assert.deepEqual(groups[0].items.map((item) => item.word), ['today', 'today2']);
  assert.deepEqual(groups.at(-1).items.map((item) => item.word), ['unknown', 'invalid']);
});
