import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createVersionedStorage } from '../src/versionedStorage.js';
import { createVersionedOutbox } from '../src/versionedOutbox.js';

function fixture() {
  const local = new Map();
  const remote = new Map();
  const requests = new Map();
  let online = true;
  let active = 'user-a';
  let tokenOwner = 'user-a';
  let gate;
  let count = 0;
  const newId = () => `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}`;
  const storage = {
    async get(key) { return local.get(key); },
    async compareAndSetBatch({ checks, writes }) {
      for (const check of checks) if (local.get(check.key) !== check.expected) throw new Error('stale local snapshot');
      for (const write of writes) if (write.value === undefined) local.delete(write.key); else local.set(write.key, write.value);
    },
  };
  const client = {
    from() { const where = {}; return { select() { return this; }, eq(key, value) { where[key] = value; return this; }, async maybeSingle() {
      if (!online) throw new Error('offline');
      return { data: remote.get(`${where.user_id}:${where.state_key}`) || null, error: null };
    } }; },
    async rpc(name, { p_expected_user, p_key, p_request_id, p_changes }) {
      if (!online) throw new Error('offline');
      if (p_expected_user !== tokenOwner) return { error: { message: 'Account changed' } };
      if (name === 'read_deutsch_meister_state') {
        const row = remote.get(`${active}:${p_key}`);
        return { data: row ? { found: true, ...row } : { found: false } };
      }
      if (gate) await gate.promise;
      if (requests.has(p_request_id)) return requests.get(p_request_id);
      for (const change of p_changes) {
        const current = remote.get(`${active}:${change.key}`);
        const actualRevision = current?.revision || 0;
        if (actualRevision !== change.expectedRevision) return { data: { ok: false, key: change.key, expectedRevision: change.expectedRevision, actualRevision } };
      }
      const revisions = p_changes.map((change) => {
        const revision = change.expectedRevision + 1;
        remote.set(`${active}:${change.key}`, { state_value: change.deleted ? null : change.value, deleted: change.deleted, revision });
        return { key: change.key, revision };
      });
      const response = { data: { ok: true, revisions } };
      requests.set(p_request_id, response);
      return response;
    },
  };
  const create = () => createVersionedStorage({ storage, client, owner: 'user-a', isCurrentSession: (owner) => owner === active, newId });
  return { local, remote, storage, client, create, setOnline(value) { online = value; }, switchUser(value) { active = value; tokenOwner = value; }, switchToken(value) { tokenOwner = value; }, hold() { let resolve; gate = { promise: new Promise((done) => { resolve = done; }) }; return () => { gate = null; resolve(); }; } };
}

test('loads a revision, saves locally, sends and reconciles, including tombstones', async () => {
  const f = fixture(); const adapter = f.create();
  assert.equal(await adapter.get('practice-draft', ''), '');
  await adapter.set('practice-draft', 'Hallo');
  assert.equal(await adapter.get('practice-draft', ''), 'Hallo');
  assert.equal((await adapter.sync(['practice-draft'])).status, 'synced');
  assert.equal(f.remote.get('user-a:practice-draft').state_value, 'Hallo');
  await adapter.remove('practice-draft');
  assert.equal((await adapter.sync(['practice-draft'])).status, 'synced');
  assert.equal(f.remote.get('user-a:practice-draft').deleted, true);
  assert.equal(await f.create().get('practice-draft', 'empty'), 'empty');
});

test('offline unknown reads fail and pending local edits survive restart and retry', async () => {
  const f = fixture(); const adapter = f.create();
  f.setOnline(false);
  await assert.rejects(adapter.get('practice-draft', 'default'), /Cannot load account data/);
  f.setOnline(true); await adapter.get('practice-draft', 'default');
  f.setOnline(false); await adapter.set('practice-draft', 'offline draft');
  await assert.rejects(adapter.sync(['practice-draft']), /outcome may be unknown/);
  const restarted = f.create();
  assert.equal(await restarted.get('practice-draft', ''), 'offline draft');
  f.setOnline(true);
  assert.equal((await restarted.sync(['practice-draft'])).status, 'synced');
  assert.equal(f.remote.get('user-a:practice-draft').state_value, 'offline draft');
});

test('sync state finds pending records and an unfinished outbox after restart', async () => {
  const f = fixture(); const adapter = f.create();
  assert.deepEqual(await adapter.getSyncState(['practice-draft', 'saved-sentences']), { pendingKeys: [], conflictedKeys: [], unfinished: false });
  await adapter.set('practice-draft', 'draft');
  assert.deepEqual(await adapter.getSyncState(['practice-draft', 'saved-sentences']), { pendingKeys: ['practice-draft'], conflictedKeys: [], unfinished: false });
  f.setOnline(false);
  await assert.rejects(adapter.sync(['practice-draft']), /outcome may be unknown/);
  assert.deepEqual(await f.create().getSyncState(['practice-draft', 'saved-sentences']), { pendingKeys: ['practice-draft'], conflictedKeys: [], unfinished: true });
  await assert.rejects(adapter.getSyncState(['openai-api-key']), /Invalid state change/);
});

test('edits during an in-flight send are kept pending against the new revision', async () => {
  const f = fixture(); const adapter = f.create();
  await adapter.set('practice-draft', 'first');
  const release = f.hold();
  const syncing = adapter.sync(['practice-draft']);
  await nextTurn();
  await adapter.set('practice-draft', 'second');
  release();
  assert.equal((await syncing).pending, 1);
  assert.equal(await adapter.get('practice-draft', ''), 'second');
  assert.equal((await adapter.sync(['practice-draft'])).status, 'synced');
  assert.equal(f.remote.get('user-a:practice-draft').state_value, 'second');
});

test('remote conflict and account changes fail closed', async () => {
  const f = fixture(); const adapter = f.create();
  await adapter.set('practice-draft', 'local');
  f.remote.set('user-a:practice-draft', { revision: 1, deleted: false, state_value: 'other device' });
  assert.equal((await adapter.sync(['practice-draft'])).status, 'conflict');
  assert.equal(await adapter.get('practice-draft', ''), 'local');
  assert.deepEqual(await adapter.getSyncState(['practice-draft', 'saved-sentences']), { pendingKeys: [], conflictedKeys: ['practice-draft'], unfinished: false });
  await adapter.set('saved-sentences', [{ german: 'Hallo' }]);
  assert.equal((await adapter.sync(['saved-sentences'])).status, 'synced');
  assert.equal(await adapter.get('practice-draft', ''), 'local');
  f.switchUser('user-b');
  await assert.rejects(adapter.set('practice-draft', 'wrong account'), /session changed/);
  assert.equal(f.remote.has('user-b:practice-draft'), false);
});

test('a token switch before the session listener updates does not look like an empty account', async () => {
  const f = fixture(); const adapter = f.create();
  f.switchToken('user-b');
  await assert.rejects(adapter.get('practice-draft', 'default'), /Account changed/);
  assert.equal(f.local.has('__cloud_account__:user-a:practice-draft'), false);
});

test('restart reconciles a saved receipt without needing another pending batch', async () => {
  const f = fixture(); const adapter = f.create();
  await adapter.set('practice-draft', 'saved');
  const outbox = createVersionedOutbox({ storage: f.storage, client: f.client, owner: 'user-a', isCurrentSession: () => true });
  await outbox.stage('00000000-0000-4000-8000-000000000999', [{ key: 'practice-draft', expectedRevision: 0, deleted: false, value: 'saved' }]);
  await outbox.send();
  assert.equal((await f.create().sync()).status, 'reconciled');
  assert.equal(await f.create().get('practice-draft', ''), 'saved');
});

test('same-revision JSON objects remain equal when the server changes key order', async () => {
  const f = fixture();
  const adapter = f.create();
  f.remote.set('user-a:grammar-session', { revision: 1, deleted: false, state_value: { z: 1, a: { y: 2, x: 3 } } });
  await adapter.get('grammar-session', {});
  f.remote.set('user-a:grammar-session', { revision: 1, deleted: false, state_value: { a: { x: 3, y: 2 }, z: 1 } });
  assert.deepEqual(await adapter.get('grammar-session', {}), { a: { x: 3, y: 2 }, z: 1 });
});

test('does not accept a server regression or overwrite a legacy unversioned account record', async () => {
  const f = fixture(); const adapter = f.create();
  f.remote.set('user-a:practice-draft', { revision: 2, deleted: false, state_value: 'known' });
  assert.equal(await adapter.get('practice-draft', ''), 'known');
  f.remote.delete('user-a:practice-draft');
  await assert.rejects(adapter.get('practice-draft', ''), /does not match the saved revision/);
  f.local.set('__cloud_account__:user-a:grammar-session', JSON.stringify({ pending: true, deleted: false, value: 'old' }));
  await assert.rejects(adapter.get('grammar-session', {}), /lacks a verified server revision/);
  assert.equal(JSON.parse(f.local.get('__cloud_account__:user-a:grammar-session')).value, 'old');
});
