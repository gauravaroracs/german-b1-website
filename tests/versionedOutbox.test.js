import test from 'node:test';
import assert from 'node:assert/strict';
import { createVersionedOutbox } from '../src/versionedOutbox.js';
import { reconcileVersionedReceipt } from '../src/versionedReconcile.js';

const id = '10000000-0000-0000-0000-000000000001';
const changes = [{ key: 'practice-draft', expectedRevision: 0, deleted: false, value: 'draft' }];

function fixture() {
  const accountKey = '__cloud_account__:a:practice-draft';
  const initial = { pending: true, deleted: false, value: 'draft', baseRevision: 0, mutationId: 'mutation-1' };
  const values = new Map([[accountKey, JSON.stringify(initial)]]);
  let currentOwner = 'a';
  const calls = [];
  const storage = {
    async get(key) { return values.get(key); },
    async compareAndSetBatch({ checks, writes }) {
      for (const { key, expected } of checks) if (values.get(key) !== expected) throw new Error('conflict');
      for (const { key, value } of writes) value === undefined ? values.delete(key) : values.set(key, value);
    },
  };
  const client = { async rpc(name, args) { calls.push([name, structuredClone(args)]); return { data: { ok: true, revisions: [{ key: 'practice-draft', revision: 1 }] } }; } };
  const open = (owner = 'a') => createVersionedOutbox({ owner, storage, client, isCurrentSession: (boundOwner) => currentOwner === boundOwner });
  return { values, storage, client, calls, open, accountKey, initial, switchOwner: (owner) => { currentOwner = owner; } };
}

test('persists before send and retries the exact request after a lost response and reload', async () => {
  const f = fixture();
  await f.open().stage(id, changes);
  f.client.rpc = async (name, args) => { f.calls.push([name, structuredClone(args)]); throw new Error('timeout'); };
  await assert.rejects(f.open().send(), /outcome may be unknown/);
  assert.equal((await f.open().getPending()).requestId, id);
  f.client.rpc = async (name, args) => { f.calls.push([name, structuredClone(args)]); return { data: { ok: true, revisions: [{ key: 'practice-draft', revision: 1 }] } }; };
  assert.equal((await f.open().send()).ok, true);
  assert.deepEqual(f.calls[0], f.calls[1]);
  assert.equal(await f.open().getPending(), null);
  assert.equal((await f.open().getReceipt()).requestId, id);
  await assert.rejects(f.open().stage(id, changes), /does not match/);
  assert.equal((await f.open().getReceipt()).requestId, id);
});

test('definite conflicts preserve the rejected request for review and block its replacement', async () => {
  const f = fixture();
  await f.open().stage(id, changes);
  f.client.rpc = async () => ({ data: { ok: false, key: 'practice-draft', expectedRevision: 0, actualRevision: 1 } });
  assert.equal((await f.open().send()).ok, false);
  assert.equal(await f.open().getPending(), null);
  assert.equal((await f.open().getConflict('practice-draft')).requestId, id);
  assert.equal(Object.hasOwn(JSON.parse(f.values.get(f.accountKey)), 'inFlight'), false);
  await assert.rejects(f.open().stage('20000000-0000-0000-0000-000000000002', changes), /does not match/);
  assert.equal((await f.open().getConflict('practice-draft')).result.actualRevision, 1);
  assert.equal(await f.open().getReceipt(), null);
});

test('a rejected multi-key batch preserves newer edits and frees unrelated records', async () => {
  const f = fixture();
  const secondKey = '__cloud_account__:a:saved-sentences';
  const second = { pending: true, deleted: false, value: [{ german: 'Hallo' }], baseRevision: 2, mutationId: 'second-1' };
  f.values.set(secondKey, JSON.stringify(second));
  const batch = [...changes, { key: 'saved-sentences', expectedRevision: 2, deleted: false, value: second.value }];
  const outbox = f.open();
  await outbox.stage(id, batch);
  const current = JSON.parse(f.values.get(f.accountKey));
  f.values.set(f.accountKey, JSON.stringify({ ...current, value: 'edited while sending', mutationId: 'mutation-2' }));
  f.client.rpc = async () => ({ data: { ok: false, key: 'practice-draft', expectedRevision: 0, actualRevision: 1 } });
  await outbox.send();
  const conflict = JSON.parse(f.values.get(f.accountKey));
  assert.equal(conflict.value, 'edited while sending');
  assert.equal(conflict.mutationId, 'mutation-2');
  assert.deepEqual(conflict.conflict.result, { ok: false, key: 'practice-draft', expectedRevision: 0, actualRevision: 1 });
  assert.equal(Object.hasOwn(conflict, 'inFlight'), false);
  assert.deepEqual(JSON.parse(f.values.get(secondKey)), second);
  await f.open().stage('20000000-0000-0000-0000-000000000002', [batch[1]]);
  assert.equal((await f.open().getPending()).requestId, '20000000-0000-0000-0000-000000000002');
  assert.equal((await f.open().getConflict('practice-draft')).requestId, id);
  f.switchOwner('b');
  assert.equal(await f.open('b').getConflict('practice-draft'), null);
});

test('a concurrent edit during conflict transition is preserved after retry', async () => {
  const f = fixture();
  const outbox = f.open();
  await outbox.stage(id, changes);
  f.client.rpc = async () => ({ data: { ok: false, key: 'practice-draft', expectedRevision: 0, actualRevision: 2 } });
  const commit = f.storage.compareAndSetBatch;
  let editOnce = true;
  f.storage.compareAndSetBatch = async (batch) => {
    if (editOnce) {
      editOnce = false;
      const record = JSON.parse(f.values.get(f.accountKey));
      f.values.set(f.accountKey, JSON.stringify({ ...record, value: 'newer local', mutationId: 'mutation-2' }));
    }
    return commit(batch);
  };
  assert.equal((await outbox.send()).ok, false);
  assert.equal(JSON.parse(f.values.get(f.accountKey)).value, 'newer local');
  assert.equal((await f.open().getConflict('practice-draft')).result.actualRevision, 2);
  assert.equal(await f.open().getPending(), null);
});

test('two concurrent senders accept the same durably recorded conflict', async () => {
  const f = fixture();
  const outbox = f.open();
  await outbox.stage(id, changes);
  f.client.rpc = async () => ({ data: { ok: false, key: 'practice-draft', expectedRevision: 0, actualRevision: 2 } });
  const results = await Promise.all([f.open().send(), f.open().send()]);
  assert.deepEqual(results.map((result) => result.ok), [false, false]);
  assert.equal(await outbox.getPending(), null);
  assert.equal((await outbox.getConflict('practice-draft')).requestId, id);
});

test('failed conflict persistence leaves the exact request available', async () => {
  const f = fixture();
  const outbox = f.open();
  await outbox.stage(id, changes);
  f.client.rpc = async () => ({ data: { ok: false, key: 'practice-draft', expectedRevision: 0, actualRevision: 1 } });
  f.storage.compareAndSetBatch = async () => { throw new Error('disk error'); };
  await assert.rejects(outbox.send(), /pending request was retained/);
  assert.equal((await f.open().getPending()).requestId, id);
  assert.equal(JSON.parse(f.values.get(f.accountKey)).inFlight.requestId, id);
});

test('account switch before saving a definite conflict leaves the original request intact', async () => {
  const f = fixture();
  const outbox = f.open();
  await outbox.stage(id, changes);
  f.client.rpc = async () => ({ data: { ok: false, key: 'practice-draft', expectedRevision: 0, actualRevision: 1 } });
  const originalGet = f.storage.get;
  f.storage.get = async (key) => {
    const value = await originalGet(key);
    if (key === f.accountKey) f.switchOwner('b');
    return value;
  };
  await assert.rejects(outbox.send(), /session changed/);
  f.storage.get = originalGet;
  assert.equal(await f.open('b').getPending(), null);
  f.switchOwner('a');
  assert.equal((await f.open().getPending()).requestId, id);
  assert.equal(JSON.parse(f.values.get(f.accountKey)).inFlight.requestId, id);
  assert.equal(await f.open().getConflict('practice-draft'), null);
});

test('session switch during send retains the original owner request', async () => {
  const f = fixture();
  await f.open().stage(id, changes);
  f.client.rpc = async () => { f.switchOwner('b'); return { data: { ok: true, revisions: [{ key: 'practice-draft', revision: 1 }] } }; };
  await assert.rejects(f.open().send(), /may have committed/);
  assert.equal(await f.open('b').getPending(), null);
  f.switchOwner('a');
  assert.equal((await f.open().getPending()).requestId, id);
});

test('reconciles receipt and local state atomically and retains receipt on conflict', async () => {
  const f = fixture();
  const outbox = f.open();
  await outbox.stage(id, changes);
  await outbox.send();
  const receipt = await outbox.getReceipt();
  f.values.set('account-data', 'newer local value');
  await assert.rejects(outbox.reconcile(receipt.raw, [{ key: 'account-data', expected: 'old' }], [{ key: 'account-data', value: 'bad' }]), /conflict/);
  assert.equal((await outbox.getReceipt()).raw, receipt.raw);
  await outbox.reconcile(receipt.raw, [{ key: 'account-data', expected: 'newer local value' }], [{ key: 'account-data', value: 'reconciled' }]);
  assert.equal(f.values.get('account-data'), 'reconciled');
  assert.equal(await outbox.getReceipt(), null);
  f.values.set(f.accountKey, JSON.stringify({ ...f.initial, value: 'new draft', mutationId: 'mutation-2', baseRevision: 1 }));
  await outbox.stage('20000000-0000-0000-0000-000000000002', [{ ...changes[0], value: 'new draft', expectedRevision: 1 }]);
});

test('invalid stored records fail closed and stay in storage', async () => {
  const f = fixture();
  const key = '__versioned_outbox__:a:pending';
  f.values.set(key, '{');
  await assert.rejects(f.open().send(), /Invalid saved outbox request/);
  assert.equal(f.values.get(key), '{');
  assert.equal(f.calls.length, 0);
});

test('a failed receipt commit preserves the sent request for an idempotent retry', async () => {
  const f = fixture();
  const outbox = f.open();
  await outbox.stage(id, changes);
  const commit = f.storage.compareAndSetBatch;
  let failOnce = true;
  f.storage.compareAndSetBatch = async (batch) => {
    if (failOnce) { failOnce = false; throw new Error('disk error'); }
    return commit(batch);
  };
  await assert.rejects(outbox.send(), /Cloud batch succeeded.*Retry only with the same request ID/);
  assert.equal((await outbox.getPending()).requestId, id);
  await outbox.send();
  assert.deepEqual(f.calls[0], f.calls[1]);
  assert.equal((await outbox.getReceipt()).requestId, id);
});

test('stages the request and matching mutation markers atomically, then reconciles the receipt', async () => {
  const f = fixture();
  const outbox = f.open();
  await outbox.stage(id, changes);
  const staged = JSON.parse(f.values.get(f.accountKey));
  assert.deepEqual(staged, { ...f.initial, inFlight: { requestId: id, mutationId: 'mutation-1' } });
  assert.equal((await outbox.getPending()).requestId, id);
  await outbox.send();
  assert.deepEqual(await reconcileVersionedReceipt({ storage: f.storage, outbox, owner: 'a' }), { acknowledged: 1, pending: 0 });
  assert.equal(await outbox.getReceipt(), null);
  const reconciled = JSON.parse(f.values.get(f.accountKey));
  assert.equal(reconciled.pending, false);
  assert.equal(reconciled.baseRevision, 1);
  assert.equal(Object.hasOwn(reconciled, 'inFlight'), false);
});

test('rejects missing, malformed, already staged, or mismatched local mutations without writing', async () => {
  const f = fixture();
  const candidates = [undefined, '{', JSON.stringify({ ...f.initial, baseRevision: 1 }), JSON.stringify({ ...f.initial, mutationId: '' }), JSON.stringify({ ...f.initial, value: 'other' }), JSON.stringify({ ...f.initial, deleted: true }), JSON.stringify({ ...f.initial, inFlight: null })];
  for (const candidate of candidates) {
    if (candidate === undefined) f.values.delete(f.accountKey); else f.values.set(f.accountKey, candidate);
    await assert.rejects(f.open().stage(id, changes), /missing or invalid|does not match/);
    assert.equal(f.values.has('__versioned_outbox__:a:pending'), false);
    assert.equal(f.values.get(f.accountKey), candidate);
  }
});

test('a concurrent local edit or account switch during staging never commits a stale batch', async () => {
  const f = fixture();
  const originalCommit = f.storage.compareAndSetBatch;
  const concurrent = JSON.stringify({ ...f.initial, value: 'newer', mutationId: 'mutation-2' });
  f.storage.compareAndSetBatch = async (batch) => { f.values.set(f.accountKey, concurrent); return originalCommit(batch); };
  await assert.rejects(f.open().stage(id, changes), /conflict/);
  assert.equal(f.values.get(f.accountKey), concurrent);
  assert.equal(await f.open().getPending(), null);

  f.values.set(f.accountKey, JSON.stringify(f.initial));
  f.storage.compareAndSetBatch = originalCommit;
  const originalGet = f.storage.get;
  f.storage.get = async (key) => { const value = await originalGet(key); f.switchOwner('b'); return value; };
  await assert.rejects(f.open().stage(id, changes), /session changed/);
  assert.equal(f.values.has('__versioned_outbox__:a:pending'), false);
  assert.equal(f.values.get(f.accountKey), JSON.stringify(f.initial));
});

test('a stale item in a multi-record batch prevents all request and marker writes', async () => {
  const f = fixture();
  const secondKey = '__cloud_account__:a:saved-sentences';
  const second = { pending: true, deleted: true, value: null, baseRevision: 2, mutationId: 'mutation-2' };
  f.values.set(secondKey, JSON.stringify(second));
  const batch = [...changes, { key: 'saved-sentences', expectedRevision: 2, deleted: true }];
  const commit = f.storage.compareAndSetBatch;
  const newer = JSON.stringify({ ...second, deleted: false, value: [], mutationId: 'mutation-3' });
  f.storage.compareAndSetBatch = async (pending) => { f.values.set(secondKey, newer); return commit(pending); };
  await assert.rejects(f.open().stage(id, batch), /conflict/);
  assert.equal(f.values.get(f.accountKey), JSON.stringify(f.initial));
  assert.equal(f.values.get(secondKey), newer);
  assert.equal(await f.open().getPending(), null);
});
