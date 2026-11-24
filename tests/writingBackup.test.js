import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Vite's ?url import is replaced only for Node's SQL.js loader; serialization stays unchanged.
async function storageModule() {
  const require = createRequire(import.meta.url);
  const sqlPath = require.resolve('sql.js');
  const wasmPath = path.join(path.dirname(sqlPath), 'sql-wasm.wasm');
  const source = (await readFile(new URL('../src/sqliteStorage.js', import.meta.url), 'utf8'))
    .replace('import initSqlJs from "sql.js";', `import initSqlJs from ${JSON.stringify(pathToFileURL(sqlPath).href)};`)
    .replace('import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";', `const wasmUrl = ${JSON.stringify(wasmPath)};`);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('SQLite backup preserves writing drafts and existing daily thoughts', async () => {
  const { exportToSqlite, importFromSqlite } = await storageModule();
  const thinkState = {
    '2026-11-24': { thought: 'Heute lerne ich Deutsch.' },
    __writing: { 'repair-request': { text: 'Die Heizung ist kaputt.', checked: [true, false, false, false], quizAnswers: ['The heating has not worked since yesterday.'], purposeAnswers: ['Seit gestern funktioniert die Heizung nicht mehr.'], feedbackFor: 'Die Heizung ist kaputt.', feedback: { corrected: 'Die Heizung ist kaputt.', changes: [], coverage: ['a', 'b', 'c', 'd'] } } },
  };
  const restored = await importFromSqlite(await exportToSqlite({ thinkState }));
  assert.deepEqual(restored.thinkState, thinkState);
});

test('SQLite backup preserves a paragraph selector alongside its explanations', async () => {
  const { exportToSqlite, importFromSqlite } = await storageModule();
  const sentenceExplanations = [
    { id: 'text-1', kind: 'sentence-list', original: 'Es regnet. Ich bleibe zu Hause.' },
    { id: 'sentence-1', original: 'Es regnet.', analysis: { offlinePreview: true, translation: 'Translation unavailable in offline mode.' } },
  ];
  const savedSentences = [{ id: 'saved-1', german: 'Es regnet.', translation: '', writingPattern: true, srsDue: '2026-11-24' }];
  const restored = await importFromSqlite(await exportToSqlite({ sentenceExplanations, savedSentences }));
  assert.deepEqual(restored.sentenceExplanations, sentenceExplanations);
  assert.deepEqual(restored.savedSentences, savedSentences);
});

test('SQLite backup preserves archived and active practice conversations', async () => {
  const { exportToSqlite, importFromSqlite } = await storageModule();
  const practiceMessages = [{ role: 'assistant', scenario: 'cafe', turn: { reply: 'Guten Tag' } }, { role: '__practice_history__', conversations: [{ id: 'old', scenario: 'interview', messages: [{ role: 'user', text: 'Ich arbeite gern im Team.' }] }] }];
  const restored = await importFromSqlite(await exportToSqlite({ practiceMessages }));
  assert.deepEqual(restored.practiceMessages, practiceMessages);
});

test('SQLite backup preserves story generation choices and a continuation', async () => {
  const { exportToSqlite, importFromSqlite } = await storageModule();
  const storySession = { activeId: 'one', continuation: 'Es regnet.', generation: { level: 'A2', wordMode: 'manual', selectedIds: ['one', 'two', 'three'] } };
  const restored = await importFromSqlite(await exportToSqlite({ storySession }));
  assert.deepEqual(restored.storySession, storySession);
});

test('SQLite backup preserves generated-story metadata and accepts older story tables', async () => {
  const { exportToSqlite, importFromSqlite } = await storageModule();
  const story = { id: 'generated', title: 'Ein Tag', category: 'Alltag', cover: '', text: 'Es regnet.', words: [], questions: [], nextPrompt: 'Was passiert?', modelContinuation: 'Es wird sonnig.', requestedLevel: 'A2', requestedWords: ['Regen'] };
  const bytes = await exportToSqlite({ storedStories: [story] });
  const restored = await importFromSqlite(bytes);
  assert.equal(restored.storedStories[0].requestedLevel, 'A2');
  assert.deepEqual(restored.storedStories[0].requestedWords, ['Regen']);
  const init = createRequire(import.meta.url)('sql.js');
  const SQL = await init();
  const db = new SQL.Database(bytes);
  db.run('ALTER TABLE stories DROP COLUMN details');
  const old = await importFromSqlite(db.export());
  db.close();
  assert.equal(old.storedStories[0].title, 'Ein Tag');
});

test('SQLite backup preserves alternate answers and legacy vocabulary fields', async () => {
  const { exportToSqlite, importFromSqlite } = await storageModule();
  const vocab = { id: 'a', word: 'Haus', artikel: 'das', plural: 'Häuser', wordType: 'noun', translation: 'house', sourceContext: '', addedAt: '2026-11-24', srsDue: '2026-11-24', acceptedTranslations: ['home'], acceptedGermanAnswers: ['das Haus'], level: 'A2', customNote: 'keep me' };
  const restored = await importFromSqlite(await exportToSqlite({ vocabWords: [vocab] }));
  assert.deepEqual(restored.vocabWords[0].acceptedTranslations, ['home']);
  assert.deepEqual(restored.vocabWords[0].acceptedGermanAnswers, ['das Haus']);
  assert.equal(restored.vocabWords[0].level, 'A2');
  assert.equal(restored.vocabWords[0].customNote, 'keep me');
});

test('SQLite import rejects unrelated databases with a vocab table', async () => {
  const { importFromSqlite } = await storageModule();
  const init = createRequire(import.meta.url)('sql.js');
  const SQL = await init();
  const db = new SQL.Database();
  db.run('CREATE TABLE vocab (id TEXT, word TEXT)');
  await assert.rejects(importFromSqlite(db.export()), /not a recognized Deutsch Meister backup/);
  db.close();
});

test('SQLite backup preserves an in-progress article round with grammar sessions', async () => {
  const { exportToSqlite, importFromSqlite } = await storageModule();
  const grammarSession = { '0': { answers: { '1': 'der' } }, __articleDrill: { filter: 'All', queue: [{ id: 'a', word: 'Tag', artikel: 'der' }], feedback: 'wrong', total: 2, done: 1, misses: 1 }, __gapRound: { queue: [{ id: 'city', prompt: 'Ich wohne ___ Berlin.', answer: 'in' }], result: { choice: 'nach', correct: false }, done: 0, total: 10, misses: 1 } };
  const restored = await importFromSqlite(await exportToSqlite({ grammarSession }));
  assert.deepEqual(restored.grammarSession, grammarSession);
});

test('SQLite backup represents empty tables so a restore can clear old data', async () => {
  const { exportToSqlite, importFromSqlite } = await storageModule();
  const restored = await importFromSqlite(await exportToSqlite({}));
  assert.deepEqual(restored.vocabWords, []);
  assert.deepEqual(restored.storedStories, []);
  assert.deepEqual(restored.chatHistory, []);
  assert.deepEqual(restored.thinkState, {});
  assert.deepEqual(restored.storyProgress, {});
});

test('SQLite backup rejects corrupt nested JSON instead of silently dropping it', async () => {
  const { exportToSqlite, importFromSqlite } = await storageModule();
  const init = createRequire(import.meta.url)('sql.js');
  const SQL = await init();
  const bytes = await exportToSqlite({ vocabWords: [{ id: 'word-1', word: 'Haus', artikel: 'das', plural: 'Häuser', wordType: 'noun', translation: 'house', sourceContext: '', addedAt: '2026-11-24', srsDue: '2026-11-24' }], thinkState: { today: { thought: 'Hallo' } } });
  for (const [sql, expected] of [
    ["UPDATE vocab SET contexts = '{bad' WHERE id = 'word-1'", 'vocab.contexts'],
    ["UPDATE vocab SET contexts = '{}' WHERE id = 'word-1'", 'vocab.contexts'],
    ["UPDATE meta SET value = '{bad' WHERE key = 'grammarSession'", 'meta.grammarSession'],
    ["UPDATE think_state SET state = '{bad' WHERE dayKey = 'today'", 'think_state.state'],
  ]) {
    const db = new SQL.Database(bytes);
    db.run(sql);
    const corrupt = db.export();
    db.close();
    await assert.rejects(importFromSqlite(corrupt), (error) => error.message.includes(expected));
  }
});
