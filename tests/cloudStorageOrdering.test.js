import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';

const scoped = (owner, key) => `__cloud_account__:${encodeURIComponent(owner)}:${encodeURIComponent(key)}`;
const record = (f, owner, key) => JSON.parse(f.values.get(scoped(owner, key)));

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function createFixture() {
  const values = new Map();
  const remote = new Map();
  const operations = [];
  let holdFirst;
  let holdRead;
  let holdLocal;
  let failNext = false;
  let failLocal = false;
  const supabase = {
    from() {
      return {
        select() {
          const where = {};
          return { eq(column, value) { where[column] = value; return this; }, async maybeSingle() {
            const id = `${where.user_id}:${where.state_key}`;
            const data = remote.has(id) ? { state_value: remote.get(id) } : null;
            operations.push(`get:${where.state_key}`);
            if (holdRead) { const held = holdRead; holdRead = null; await held.promise; }
            return { data, error: null };
          } };
        },
        async upsert(row) {
          operations.push(`set:${row.state_key}:${row.state_value}`);
          if (holdFirst) { const held = holdFirst; holdFirst = null; await held.promise; }
          if (failNext) { failNext = false; return { error: { message: 'network failed' } }; }
          remote.set(`${row.user_id}:${row.state_key}`, row.state_value);
          return { error: null };
        },
        delete() {
          const where = {};
          return { eq(column, value) {
            where[column] = value;
            if (column === 'user_id') return this;
            operations.push(`remove:${where.state_key}`);
            if (failNext) { failNext = false; return Promise.resolve({ error: { message: 'network failed' } }); }
            remote.delete(`${where.user_id}:${where.state_key}`);
            return Promise.resolve({ error: null });
          } };
        },
      };
    },
  };
  const local = {
    async get(key) { return values.get(key); },
    async set(key, value) { if (holdLocal) { const held = holdLocal; holdLocal = null; await held.promise; } if (failLocal) { failLocal = false; throw new Error('local save failed'); } values.set(key, value); },
    async remove(key) { values.delete(key); },
  };
  const key = `__cloudTest_${Math.random().toString(36).slice(2)}`;
  globalThis[key] = supabase;
  const src = (await readFile(new URL('../src/cloudStorage.js', import.meta.url), 'utf8'))
    .replace('import { supabase, isSupabaseConfigured } from "./supabaseClient";', `const supabase = globalThis[${JSON.stringify(key)}]; const isSupabaseConfigured = true;`);
  const module = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
  delete globalThis[key];
  module.setCloudStorageUser('user-a');
  return { module, storage: module.createCloudBackedStorage(local), local, values, remote, operations, hold: () => { holdFirst = deferred(); return holdFirst; }, holdRead: () => { holdRead = deferred(); return holdRead; }, holdLocal: () => { holdLocal = deferred(); return holdLocal; }, failNext: () => { failNext = true; }, failLocal: () => { failLocal = true; } };
}

test('local acknowledgement waits for local persistence but not a pending cloud request', async () => {
  const f = await createFixture();
  const localGate = f.holdLocal();
  const cloudGate = f.hold();
  let acknowledged = false;
  const write = f.storage.setWithLocalAck('draft', 'saved').then(() => { acknowledged = true; });
  await nextTurn();
  assert.equal(acknowledged, false);
  localGate.resolve();
  await write;
  assert.equal(record(f, 'user-a', 'draft').value, 'saved');
  assert.equal(f.remote.has('user-a:draft'), false);
  cloudGate.resolve();
});

test('local acknowledgement reports a failed local save', async () => {
  const f = await createFixture();
  f.failLocal();
  await assert.rejects(f.storage.setWithLocalAck('draft', 'saved'), /local save failed/);
  assert.equal(f.remote.has('user-a:draft'), false);
});

test('an unrelated successful sync does not hide a pending error and subscribers are notified', async () => {
  const f = await createFixture();
  let changes = 0;
  const unsubscribe = f.module.subscribeCloudStorageStatus(() => { changes += 1; });
  f.failNext();
  await f.storage.set('draft', 'local only');
  assert.equal(f.module.getCloudStorageStatus().lastError, 'network failed');
  await f.storage.set('other', 'synced');
  assert.equal(f.module.getCloudStorageStatus().lastError, 'network failed');
  assert.ok(changes >= 1);
  unsubscribe();
  const before = changes;
  f.module.setCloudStorageUser('user-b');
  assert.equal(changes, before);
  assert.equal(f.module.getCloudStorageStatus().lastError, '');
});

test('same-key cloud writes stay in order while the latest value is saved locally', async () => {
  const f = await createFixture();
  const gate = f.hold();
  const first = f.storage.set('think-state', 'first');
  const second = f.storage.set('think-state', 'second');
  await nextTurn();
  assert.equal(record(f, 'user-a', 'think-state').value, 'second');
  assert.deepEqual(f.operations, ['set:think-state:first']);
  gate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(f.operations, ['set:think-state:first', 'set:think-state:second']);
  assert.equal(f.remote.get('user-a:think-state'), 'second');
});

test('remove stays ordered between sets and failed writes block automatic replay', async () => {
  const f = await createFixture();
  const gate = f.hold();
  const first = f.storage.set('draft', 'before');
  const remove = f.storage.remove('draft');
  const last = f.storage.set('draft', 'after');
  await nextTurn();
  assert.equal(record(f, 'user-a', 'draft').value, 'after');
  gate.resolve();
  await Promise.all([first, remove, last]);
  assert.deepEqual(f.operations, ['set:draft:before', 'remove:draft', 'set:draft:after']);
  assert.equal(f.remote.get('user-a:draft'), 'after');
  f.failNext();
  await f.storage.set('draft', 'fails');
  assert.equal(f.module.getCloudStorageStatus().lastError, 'network failed');
  await f.storage.set('draft', 'newer local');
  assert.equal(f.remote.get('user-a:draft'), 'after');
  assert.equal(record(f, 'user-a', 'draft').value, 'newer local');
  assert.match(f.module.getCloudStorageStatus().lastError, /needs review/);
});

test('a queued write is not sent to a different signed-in user', async () => {
  const f = await createFixture();
  const gate = f.hold();
  const first = f.storage.set('draft', 'first');
  const queued = f.storage.set('draft', 'queued');
  await nextTurn();
  f.module.setCloudStorageUser('user-b');
  gate.resolve();
  await Promise.all([first, queued]);
  assert.deepEqual(f.operations, ['set:draft:first']);
  assert.equal(f.remote.has('user-b:draft'), false);
});

test('a delayed key does not block another key and API keys stay local', async () => {
  const f = await createFixture();
  const gate = f.hold();
  const first = f.storage.set('slow', 'waiting');
  await nextTurn();
  await f.storage.set('other', 'ready');
  await f.storage.set('openai-api-key', 'local-secret');
  assert.equal(f.remote.get('user-a:other'), 'ready');
  assert.equal(f.remote.has('user-a:openai-api-key'), false);
  gate.resolve();
  await first;
});

test('a stale cloud read started before a set returns the newer local value', async () => {
  const f = await createFixture();
  f.remote.set('user-a:draft', 'old cloud');
  f.values.set('draft', '"old local"');
  const gate = f.holdRead();
  const read = f.storage.get('draft', 'fallback');
  await nextTurn();
  await f.storage.set('draft', 'new draft');
  gate.resolve();
  assert.equal(await read, 'new draft');
  assert.equal(record(f, 'user-a', 'draft').value, 'new draft');
  assert.equal(f.remote.get('user-a:draft'), 'new draft');
});

test('a stale cloud read cannot restore an item removed while reading', async () => {
  const f = await createFixture();
  f.remote.set('user-a:draft', 'old cloud');
  f.values.set('draft', '"old local"');
  const gate = f.holdRead();
  const read = f.storage.get('draft', 'fallback');
  await nextTurn();
  await f.storage.remove('draft');
  gate.resolve();
  assert.equal(await read, 'fallback');
  assert.equal(record(f, 'user-a', 'draft').deleted, true);
  assert.equal(f.values.get('draft'), '"old local"');
  assert.equal(f.remote.has('user-a:draft'), false);
});

test('reading while cloud writes are pending returns latest local state without a cloud read', async () => {
  const f = await createFixture();
  const gate = f.hold();
  const write = f.storage.set('draft', 'local newer');
  await nextTurn();
  assert.equal(await f.storage.get('draft', 'fallback'), 'local newer');
  assert.deepEqual(f.operations, ['set:draft:local newer']);
  gate.resolve();
  await write;
});

test('legacy browser data is not uploaded when a cloud key is missing', async () => {
  const f = await createFixture();
  f.values.set('draft', '"legacy"');
  assert.equal(await f.storage.get('draft', 'fallback'), 'fallback');
  assert.deepEqual(f.operations, ['get:draft']);
  assert.equal(f.values.get('draft'), '"legacy"');
  assert.equal(f.remote.has('user-a:draft'), false);
  await f.storage.set('draft', 'account draft');
  assert.equal(f.values.get('draft'), '"legacy"');
  assert.equal(f.remote.get('user-a:draft'), 'account draft');
});

test('a cloud read for a previous user does not hydrate or return that user’s data', async () => {
  const f = await createFixture();
  f.remote.set('user-a:draft', 'private A');
  const gate = f.holdRead();
  const read = f.storage.get('draft', 'fallback');
  await nextTurn();
  f.module.setCloudStorageUser('user-b');
  gate.resolve();
  assert.equal(await read, 'fallback');
  assert.equal(f.values.has('draft'), false);
});

test('sign-out and sign-in again restarts an earlier pending hydration', async () => {
  const f = await createFixture();
  f.remote.set('user-a:draft', 'old session');
  const gate = f.holdRead();
  const read = f.storage.get('draft', 'fallback');
  await nextTurn();
  f.module.setCloudStorageUser(null);
  f.module.setCloudStorageUser('user-a');
  gate.resolve();
  assert.equal(await read, 'old session');
  assert.equal(record(f, 'user-a', 'draft').value, 'old session');
  assert.deepEqual(f.operations, ['get:draft', 'get:draft']);
});

test('a set during a delayed local hydration wins over the mirrored cloud value', async () => {
  const f = await createFixture();
  f.remote.set('user-a:draft', 'cloud old');
  const gate = f.holdLocal();
  const read = f.storage.get('draft', 'fallback');
  await nextTurn();
  const write = f.storage.set('draft', 'new local');
  gate.resolve();
  assert.equal(await read, 'new local');
  await write;
  assert.equal(record(f, 'user-a', 'draft').value, 'new local');
  assert.equal(f.remote.get('user-a:draft'), 'new local');
});

test('failed cloud writes keep the local value readable instead of rehydrating stale cloud data', async () => {
  const f = await createFixture();
  f.remote.set('user-a:draft', 'old cloud');
  f.failNext();
  await f.storage.set('draft', 'unsynced local');
  const count = f.operations.length;
  assert.equal(await f.storage.get('draft', 'fallback'), 'unsynced local');
  assert.equal(f.operations.length, count);
  await f.storage.set('draft', 'newer local');
  assert.equal(await f.storage.get('draft', 'fallback'), 'newer local');
  assert.equal(f.remote.get('user-a:draft'), 'old cloud');
});

test('another user does not receive an unsynced draft from the previous user', async () => {
  const f = await createFixture();
  const gate = f.hold();
  const write = f.storage.set('draft', 'private A');
  await nextTurn();
  f.module.setCloudStorageUser('user-b');
  assert.equal(await f.storage.get('draft', 'fallback'), 'fallback');
  gate.resolve();
  await write;
  assert.equal(await f.storage.get('draft', 'fallback'), 'fallback');
  assert.equal(f.remote.has('user-b:draft'), false);
});

test('a new account hydrates its cloud data while the previous account has a pending write', async () => {
  const f = await createFixture();
  f.remote.set('user-b:draft', 'user B existing draft');
  const gate = f.hold();
  const write = f.storage.set('draft', 'private A');
  await nextTurn();
  f.module.setCloudStorageUser('user-b');
  const value = await f.storage.get('draft', 'fallback');
  assert.equal(value, 'user B existing draft');
  assert.equal(record(f, 'user-b', 'draft').value, 'user B existing draft');
  gate.resolve();
  await write;
  assert.equal(f.remote.get('user-b:draft'), 'user B existing draft');
});

test('an account change during a cloud read restarts hydration for the new account', async () => {
  const f = await createFixture();
  f.remote.set('user-a:draft', 'private A');
  f.remote.set('user-b:draft', 'private B');
  const gate = f.holdRead();
  const read = f.storage.get('draft', 'fallback');
  await nextTurn();
  f.module.setCloudStorageUser('user-b');
  gate.resolve();
  assert.equal(await read, 'private B');
  assert.equal(record(f, 'user-b', 'draft').value, 'private B');
  assert.equal(f.remote.get('user-b:draft'), 'private B');
});

test('an account change while waiting for local I/O restarts hydration for the new account', async () => {
  const f = await createFixture();
  f.remote.set('user-b:draft', 'private B');
  const gate = f.holdLocal();
  const oldWrite = f.storage.set('draft', 'private A');
  const read = f.storage.get('draft', 'fallback');
  await nextTurn();
  f.module.setCloudStorageUser('user-b');
  gate.resolve();
  assert.equal(await read, 'private B');
  await oldWrite;
  assert.equal(record(f, 'user-b', 'draft').value, 'private B');
  assert.equal(f.remote.get('user-b:draft'), 'private B');
});

test('account switch during cloud lookup never exposes legacy data', async () => {
  const f = await createFixture();
  f.values.set('draft', '"legacy A"');
  f.remote.set('user-b:draft', 'cloud B');
  const gate = f.holdRead();
  const oldRead = f.storage.get('draft', 'fallback');
  await nextTurn();
  f.module.setCloudStorageUser('user-b');
  gate.resolve();
  assert.equal(await oldRead, 'cloud B');
  assert.equal(f.values.get('draft'), '"legacy A"');
  assert.equal(record(f, 'user-b', 'draft').value, 'cloud B');
  assert.equal(f.remote.has('user-a:draft'), false);
});

test('failed account writes and deletions survive a storage restart without replacing remote data', async () => {
  const f = await createFixture();
  f.remote.set('user-a:draft', 'remote version');
  f.failNext();
  await f.storage.set('draft', 'offline edit');
  const restarted = f.module.createCloudBackedStorage(f.local);
  assert.equal(await restarted.get('draft', 'fallback'), 'offline edit');
  await restarted.set('draft', 'later offline edit');
  assert.equal(f.remote.get('user-a:draft'), 'remote version');
  assert.equal(record(f, 'user-a', 'draft').pending, true);
  await restarted.remove('draft');
  const restartedAgain = f.module.createCloudBackedStorage(f.local);
  assert.equal(await restartedAgain.get('draft', 'fallback'), 'fallback');
  assert.equal(record(f, 'user-a', 'draft').deleted, true);
  assert.equal(f.remote.get('user-a:draft'), 'remote version');
});

test('queued writes stay local when an earlier cloud write fails', async () => {
  const f = await createFixture();
  const gate = f.hold();
  f.failNext();
  const first = f.storage.set('draft', 'first');
  await nextTurn();
  const second = f.storage.set('draft', 'second');
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(f.remote.has('user-a:draft'), false);
  assert.equal(record(f, 'user-a', 'draft').value, 'second');
  assert.equal(record(f, 'user-a', 'draft').pending, true);
});

test('a failed cloud deletion survives a restart as a local tombstone', async () => {
  const f = await createFixture();
  f.remote.set('user-a:draft', 'remote version');
  f.failNext();
  await f.storage.remove('draft');
  const restarted = f.module.createCloudBackedStorage(f.local);
  assert.equal(await restarted.get('draft', 'fallback'), 'fallback');
  assert.equal(record(f, 'user-a', 'draft').pending, true);
  assert.equal(record(f, 'user-a', 'draft').deleted, true);
  assert.equal(f.remote.get('user-a:draft'), 'remote version');
});

test('subsequent edits retain the recorded baseline of a staged import', async () => {
  const f = await createFixture();
  const original = { pending: true, deleted: false, value: 'imported', baseRemote: { found: true, value: 'original cloud' } };
  f.values.set(scoped('user-a', 'draft'), JSON.stringify(original));
  await f.storage.set('draft', 'edited after import');
  assert.deepEqual(record(f, 'user-a', 'draft'), { ...original, value: 'edited after import' });
  assert.equal(f.remote.has('user-a:draft'), false);
});

test('session-bound storage rejects stale callbacks and in-flight reads', async () => {
  const f = await createFixture();
  f.remote.set('user-a:draft', 'private A');
  const bound = f.storage.bindCurrentUser();
  const gate = f.holdRead();
  const pending = bound.get('draft', 'fallback');
  await nextTurn();
  f.module.setCloudStorageUser('user-b');
  gate.resolve();
  await assert.rejects(pending, /Storage session changed/);
  await assert.rejects(bound.set('draft', 'stale A'), /Storage session changed/);
  await assert.rejects(bound.remove('draft'), /Storage session changed/);
  assert.equal(f.remote.has('user-b:draft'), false);
  assert.equal(f.values.has(scoped('user-b', 'draft')), false);
});

test('a session guard remains invalid after signing back into the same account', async () => {
  const f = await createFixture();
  const guard = f.module.bindCloudSession('user-a');
  assert.equal(guard(), true);
  f.module.setCloudStorageUser(null);
  f.module.setCloudStorageUser('user-a');
  assert.equal(guard(), false);
  assert.equal(f.module.bindCloudSession('user-a')(), true);
});

test('account inspection does not hydrate or write and stops on an account switch', async () => {
  const f = await createFixture();
  f.values.set('draft', '"legacy"');
  f.remote.set('user-a:draft', 'account value');
  const bound = f.storage.bindCurrentUser();
  assert.deepEqual(await bound.inspectAccount('draft'), { local: undefined, remoteFound: true, remote: 'account value' });
  assert.equal(f.values.get('draft'), '"legacy"');
  assert.equal(f.values.has(scoped('user-a', 'draft')), false);
  const gate = f.holdRead();
  const pending = bound.inspectAccount('draft');
  await nextTurn();
  f.module.setCloudStorageUser('user-b');
  gate.resolve();
  await assert.rejects(pending, /Storage session changed/);
  await assert.rejects(bound.inspectAccount('openai-api-key'), /Storage session changed/);
});
