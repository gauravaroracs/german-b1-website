import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createVersionedStorage } from '../src/versionedStorage.js';
import { createVersionedScheduler } from '../src/versionedScheduler.js';

function fixture() {
  const local = new Map();
  const remote = new Map();
  const receipts = new Map();
  const sent = [];
  let token = 'user-a';
  let session = 'user-a';
  let lostResponse = false;
  let gate;
  let counter = 0;
  const storage = {
    async get(key) { return local.get(key); },
    async compareAndSetBatch({ checks, writes }) {
      for (const { key, expected } of checks) if (local.get(key) !== expected) throw new Error('stale snapshot');
      for (const { key, value } of writes) value === undefined ? local.delete(key) : local.set(key, value);
    },
  };
  const client = {
    async rpc(name, args) {
      if (args.p_expected_user !== token) return { error: { message: 'Account changed' } };
      if (name === 'read_deutsch_meister_state') {
        const row = remote.get(`${token}:${args.p_key}`);
        return { data: row ? { found: true, ...row } : { found: false } };
      }
      sent.push(structuredClone(args));
      if (gate) await gate.promise;
      if (receipts.has(args.p_request_id)) return receipts.get(args.p_request_id);
      for (const change of args.p_changes) {
        const revision = remote.get(`${token}:${change.key}`)?.revision || 0;
        if (revision !== change.expectedRevision) return { data: { ok: false, key: change.key, expectedRevision: change.expectedRevision, actualRevision: revision } };
      }
      const revisions = args.p_changes.map((change) => {
        const revision = change.expectedRevision + 1;
        remote.set(`${token}:${change.key}`, { revision, deleted: change.deleted, state_value: change.deleted ? null : change.value });
        return { key: change.key, revision };
      });
      const result = { data: { ok: true, revisions } };
      receipts.set(args.p_request_id, result);
      if (lostResponse) { lostResponse = false; throw new Error('response lost'); }
      return result;
    },
  };
  const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
  const active = (owner) => session === owner;
  const create = () => {
    const adapter = createVersionedStorage({ storage, client, owner: 'user-a', isCurrentSession: active, newId });
    const scheduler = createVersionedScheduler({ adapter, getSyncState: () => adapter.getSyncState(['practice-draft']), owner: 'user-a', isCurrentSession: active });
    return { adapter, scheduler };
  };
  return { local, remote, sent, create, loseResponse() { lostResponse = true; }, switchToken() { token = 'user-b'; }, hold() { let release; gate = { promise: new Promise((resolve) => { release = resolve; }) }; return () => { gate = null; release(); }; } };
}

test('local edit is scheduled, committed remotely and acknowledged locally', async () => {
  const f = fixture(); const { adapter, scheduler } = f.create();
  await adapter.set('practice-draft', 'Hallo');
  assert.equal((await scheduler.requestSync()).state, 'idle');
  assert.equal(f.remote.get('user-a:practice-draft').state_value, 'Hallo');
  assert.deepEqual(await adapter.getSyncState(['practice-draft']), { pendingKeys: [], conflictedKeys: [], unfinished: false });
});

test('a lost response survives restart and retries exactly the same request', async () => {
  const f = fixture(); const first = f.create();
  await first.adapter.set('practice-draft', 'offline-safe');
  f.loseResponse();
  assert.equal((await first.scheduler.requestSync()).state, 'error');
  const restarted = f.create();
  assert.equal((await restarted.scheduler.start()).state, 'idle');
  assert.deepEqual(f.sent[0], f.sent[1]);
  assert.equal(f.remote.get('user-a:practice-draft').revision, 1);
});

test('an edit during a request is sent afterward without losing either change', async () => {
  const f = fixture(); const { adapter, scheduler } = f.create();
  await adapter.set('practice-draft', 'first');
  const release = f.hold();
  const running = scheduler.requestSync();
  while (!f.sent.length) await nextTurn();
  await adapter.set('practice-draft', 'second');
  scheduler.requestSync();
  release();
  assert.equal((await running).state, 'idle');
  assert.equal(f.remote.get('user-a:practice-draft').state_value, 'second');
  assert.equal(f.remote.get('user-a:practice-draft').revision, 2);
});

test('a different transport account cannot receive a pending write', async () => {
  const f = fixture(); const { adapter, scheduler } = f.create();
  await adapter.set('practice-draft', 'private');
  f.switchToken();
  assert.equal((await scheduler.requestSync()).state, 'error');
  assert.equal(f.remote.has('user-b:practice-draft'), false);
  assert.equal(await adapter.get('practice-draft', ''), 'private');
});
