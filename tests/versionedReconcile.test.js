import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileVersionedReceipt } from '../src/versionedReconcile.js';

const requestId = '10000000-0000-0000-0000-000000000001';
const key = '__cloud_account__:user-a:practice-draft';
const sent = { key: 'practice-draft', expectedRevision: 3, deleted: false, value: 'sent' };
const pending = (extra = {}) => ({ pending: true, deleted: false, value: 'sent', baseRevision: 3, mutationId: 'mutation-1', inFlight: { requestId, mutationId: 'mutation-1' }, ...extra });

function fixture(record = pending(), change = sent) {
  const data = new Map([[key, JSON.stringify(record)]]);
  const body = JSON.stringify([change]);
  const result = { ok: true, revisions: [{ key: change.key, revision: change.expectedRevision + 1 }] };
  let receipt = { raw: JSON.stringify({ owner: 'user-a', requestId, body, result }), requestId, body, result };
  let beforeCommit = () => {};
  const storage = { async get(name) { return data.get(name); } };
  const outbox = {
    async getReceipt() { return receipt; },
    async reconcile(raw, checks, writes) {
      beforeCommit();
      if (!receipt || receipt.raw !== raw || checks.some((check) => data.get(check.key) !== check.expected)) throw new Error('concurrent modification');
      writes.forEach((write) => data.set(write.key, write.value));
      receipt = null;
    },
  };
  return { args: { storage, outbox, owner: 'user-a' }, data, getReceipt: () => receipt, beforeCommit: (fn) => { beforeCommit = fn; } };
}

test('clears an unchanged sent mutation and advances its server baseline atomically', async () => {
  const f = fixture();
  assert.deepEqual(await reconcileVersionedReceipt(f.args), { acknowledged: 1, pending: 0 });
  assert.deepEqual(JSON.parse(f.data.get(key)), { pending: false, deleted: false, value: 'sent', baseRevision: 4, mutationId: 'mutation-1', baseRemote: { found: true, deleted: false, value: 'sent' } });
  assert.equal(f.getReceipt(), null);
  await assert.rejects(reconcileVersionedReceipt(f.args), /No state batch receipt/);
});

test('retains newer edits, even if their value returns to the sent value', async () => {
  for (const value of ['newer', 'sent']) {
    const f = fixture(pending({ value, mutationId: 'mutation-2' }));
    assert.equal((await reconcileVersionedReceipt(f.args)).pending, 1);
    const result = JSON.parse(f.data.get(key));
    assert.equal(result.value, value);
    assert.equal(result.pending, true);
    assert.equal(result.baseRevision, 4);
    assert.equal(result.baseRemote.value, 'sent');
  }
});

test('preserves a newer local deletion and records an acknowledged remote tombstone', async () => {
  const f = fixture(pending({ deleted: true, value: null, mutationId: 'mutation-2' }));
  await reconcileVersionedReceipt(f.args);
  assert.equal(JSON.parse(f.data.get(key)).deleted, true);
  assert.equal(JSON.parse(f.data.get(key)).pending, true);
  const removed = { ...sent, deleted: true, value: undefined };
  const g = fixture(pending({ deleted: true, value: null }), removed);
  await reconcileVersionedReceipt(g.args);
  assert.deepEqual(JSON.parse(g.data.get(key)).baseRemote, { found: true, deleted: true, value: null });
});

test('rejects missing baseline, missing mutation markers or mismatched data without clearing the receipt', async () => {
  for (const record of [pending({ baseRevision: undefined }), pending({ mutationId: undefined }), pending({ inFlight: undefined }), pending({ inFlight: { requestId: 'other', mutationId: 'mutation-1' } }), pending({ value: 'changed without new token' })]) {
    const f = fixture(record);
    await assert.rejects(reconcileVersionedReceipt(f.args), /does not match/);
    assert.ok(f.getReceipt());
    assert.equal(f.data.get(key), JSON.stringify(record));
  }
});

test('rejects a receipt bound to another owner', async () => {
  const f = fixture();
  f.args.owner = 'user-b';
  await assert.rejects(reconcileVersionedReceipt(f.args), /does not match this account/);
  assert.ok(f.getReceipt());
});

test('a concurrent change or failed commit retains the receipt and local edit', async () => {
  const f = fixture();
  const newer = pending({ mutationId: 'mutation-2', value: 'later' });
  f.beforeCommit(() => f.data.set(key, JSON.stringify(newer)));
  await assert.rejects(reconcileVersionedReceipt(f.args), /concurrent modification/);
  assert.ok(f.getReceipt());
  assert.equal(f.data.get(key), JSON.stringify(newer));
  f.beforeCommit(() => {});
  await reconcileVersionedReceipt(f.args);
  assert.equal(JSON.parse(f.data.get(key)).pending, true);
});
