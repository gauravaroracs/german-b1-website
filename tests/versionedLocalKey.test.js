import test from 'node:test';
import assert from 'node:assert/strict';
import { withLocalApiKey } from '../src/versionedLocalKey.js';

test('personal key stays in browser storage while other values use the versioned adapter', async () => {
  const values = new Map(); const calls = [];
  const local = { async get(key) { return values.get(key); }, async set(key, value) { values.set(key, value); }, async remove(key) { values.delete(key); } };
  const versioned = Object.fromEntries(['get', 'set', 'setWithLocalAck', 'remove'].map((name) => [name, async (...args) => { calls.push([name, ...args]); return 'cloud'; }]));
  const storage = withLocalApiKey(versioned, local, () => true);
  await storage.set('openai-api-key', 'secret');
  assert.equal(await storage.get('openai-api-key', null), 'secret');
  await storage.setWithLocalAck('openai-api-key', 'other');
  await storage.remove('openai-api-key');
  assert.equal(await storage.get('openai-api-key', null), null);
  assert.deepEqual(calls, []);
  assert.equal(await storage.get('practice-draft', ''), 'cloud');
  assert.deepEqual(calls, [['get', 'practice-draft', '']]);
});

test('a session switch during local access rejects the result', async () => {
  let active = true;
  const local = { async get() { active = false; return '"secret"'; } };
  const storage = withLocalApiKey({}, local, () => active);
  await assert.rejects(storage.get('openai-api-key', null), /session changed/);
});
