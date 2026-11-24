import test from 'node:test';
import assert from 'node:assert/strict';
import { createVersionedAppStorage } from '../src/versionedAppStorage.js';

test('committed account edits schedule sync, but API keys remain local', async () => {
  let pending = []; let syncs = 0;
  const adapter = { async getSyncState() { return { pendingKeys: pending, unfinished: false }; }, async sync(keys) { syncs += 1; assert.deepEqual(keys, ['practice-draft']); pending = []; return { status: 'synced' }; }, async set(key) { pending = [key]; }, async setWithLocalAck(key) { pending = [key]; }, async remove(key) { pending = [key]; }, async get() { return ''; } };
  const data = new Map();
  const local = { async get(key) { return data.get(key); }, async set(key, value) { data.set(key, value); }, async remove(key) { data.delete(key); } };
  const app = createVersionedAppStorage({ adapter, local, owner: 'a', isCurrentSession: (owner) => owner === 'a', keys: ['practice-draft'] });
  await app.set('openai-api-key', 'secret');
  assert.equal(syncs, 0);
  await app.set('practice-draft', 'draft');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(syncs, 1);
  assert.equal(data.get('openai-api-key'), '"secret"');
  app.stopSync();
});

test('failed local edits do not trigger sync', async () => {
  let reads = 0;
  const adapter = { async getSyncState() { reads += 1; return { pendingKeys: [], unfinished: false }; }, async sync() {}, async set() { throw new Error('storage failed'); }, async get() {}, async setWithLocalAck() {}, async remove() {} };
  const app = createVersionedAppStorage({ adapter, local: {}, owner: 'a', isCurrentSession: () => true, keys: ['practice-draft'] });
  await assert.rejects(app.set('practice-draft', 'draft'), /storage failed/);
  assert.equal(reads, 0);
  await assert.rejects(app.freezeWrites(), /local write failed/);
});

test('conflict barrier waits for earlier writes and rejects new writes until resumed', async () => {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const adapter = { async getSyncState() { return { pendingKeys: [], unfinished: false }; }, async sync() {}, async set() { await held; }, async get() {}, async setWithLocalAck() {}, async remove() {} };
  const app = createVersionedAppStorage({ adapter, local: {}, owner: 'a', isCurrentSession: () => true, keys: ['practice-draft'] });
  const write = app.set('practice-draft', 'draft');
  let frozen = false;
  const barrier = app.freezeWrites().then(() => { frozen = true; });
  assert.equal(frozen, false);
  release();
  await Promise.all([write, barrier]);
  assert.equal(frozen, true);
  await assert.rejects(app.set('practice-draft', 'later'), /paused/);
  assert.throws(() => app.assertWritesFrozen(), /could not be saved/);
  app.resumeWrites();
  await app.set('practice-draft', 'after');
});
