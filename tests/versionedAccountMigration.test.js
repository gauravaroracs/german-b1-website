import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateMatchingAccountRecord } from '../src/versionedAccountMigration.js';

const key = 'practice-draft';
const localKey = '__cloud_account__:user-a:practice-draft';
const backupKey = '__account_version_migration__:user-a:backup1:practice-draft';

function fixture() {
  let active = true;
  let remote = { found: true, revision: 4, deleted: false, state_value: { a: 1, b: 2 } };
  let rpcCalls = 0;
  const original = JSON.stringify({ pending: false, deleted: false, value: { b: 2, a: 1 }, extra: 'keep' });
  const values = new Map([[localKey, original]]);
  const storage = {
    async get(key) { return values.get(key); },
    async compareAndSetBatch({ checks, writes }) {
      for (const check of checks) if (values.get(check.key) !== check.expected) throw new Error('stale local snapshot');
      for (const write of writes) values.set(write.key, write.value);
    },
  };
  const client = { async rpc(name, args) { rpcCalls += 1; assert.equal(name, 'read_deutsch_meister_state'); assert.deepEqual(args, { p_expected_user: 'user-a', p_key: key }); return { data: remote }; } };
  const args = { storage, client, owner: 'user-a', key, backupId: 'backup1', isCurrentSession: (owner) => active && owner === 'user-a' };
  return { args, values, original, setRemote: (value) => { remote = value; }, stop: () => { active = false; }, calls: () => rpcCalls };
}

test('atomically preserves original data and migrates a matching clean account record', async () => {
  const f = fixture();
  assert.deepEqual(await migrateMatchingAccountRecord(f.args), { status: 'migrated', key, backupKey, sessionChanged: false });
  const record = JSON.parse(f.values.get(localKey));
  assert.equal(record.baseRevision, 4);
  assert.deepEqual(record.baseRemote, { found: true, deleted: false, value: { a: 1, b: 2 } });
  assert.equal(record.extra, 'keep');
  assert.equal(JSON.parse(f.values.get(backupKey)).originalRaw, f.original);
  assert.equal(f.calls(), 1);
});

test('never migrates pending, divergent, missing or invalid records', async () => {
  const cases = [
    { raw: JSON.stringify({ pending: true, deleted: false, value: 'new' }), reason: 'pending-or-deleted' },
    { raw: JSON.stringify({ pending: false, deleted: true, value: null }), reason: 'pending-or-deleted' },
    { raw: '{', reason: 'invalid-local' },
    { raw: undefined, reason: 'missing-local' },
  ];
  for (const item of cases) {
    const f = fixture();
    if (item.raw === undefined) f.values.delete(localKey); else f.values.set(localKey, item.raw);
    assert.deepEqual(await migrateMatchingAccountRecord(f.args), { status: 'review', reason: item.reason });
    assert.equal(f.values.has(backupKey), false);
    assert.equal(f.calls(), 0);
  }
  const f = fixture(); f.setRemote({ found: true, deleted: false, revision: 3, state_value: 'different' });
  assert.equal((await migrateMatchingAccountRecord(f.args)).reason, 'different-cloud');
  assert.equal(f.values.get(localKey), f.original);
  f.setRemote({ found: false });
  assert.equal((await migrateMatchingAccountRecord(f.args)).reason, 'missing-or-deleted-cloud');
  assert.equal(f.values.has(backupKey), false);
});

test('rejects stale local snapshots and duplicate recovery IDs without partial changes', async () => {
  const f = fixture();
  f.args.client.rpc = async () => { f.values.set(localKey, '"edited"'); return { data: { found: true, revision: 1, deleted: false, state_value: { a: 1, b: 2 } } }; };
  await assert.rejects(migrateMatchingAccountRecord(f.args), /stale local snapshot/);
  assert.equal(f.values.get(localKey), '"edited"');
  assert.equal(f.values.has(backupKey), false);
  const other = fixture(); other.values.set(backupKey, 'existing backup');
  await assert.rejects(migrateMatchingAccountRecord(other.args), /stale local snapshot/);
  assert.equal(other.values.get(localKey), other.original);
  assert.equal(other.values.get(backupKey), 'existing backup');
});

test('fails closed on account changes, invalid RPC responses and API-key requests', async () => {
  const f = fixture();
  f.args.client.rpc = async () => { f.stop(); return { data: { found: true, revision: 1, deleted: false, state_value: { a: 1, b: 2 } } }; };
  await assert.rejects(migrateMatchingAccountRecord(f.args), /session changed/);
  assert.equal(f.values.get(localKey), f.original);
  const other = fixture(); other.setRemote({ found: true, revision: 1, deleted: 'yes', state_value: null });
  await assert.rejects(migrateMatchingAccountRecord(other.args), /Invalid account read response/);
  await assert.rejects(migrateMatchingAccountRecord({ ...other.args, key: 'openai-api-key' }), /Invalid state change/);
  assert.equal(other.values.get(localKey), other.original);
  const tokenRace = fixture(); tokenRace.args.client.rpc = async () => ({ error: { message: 'Account changed' } });
  await assert.rejects(migrateMatchingAccountRecord(tokenRace.args), /Account changed/);
  assert.equal(tokenRace.values.get(localKey), tokenRace.original);
  assert.equal(tokenRace.values.has(backupKey), false);
});

test('reports a session change after a completed commit without misreporting failure', async () => {
  const f = fixture(); const commit = f.args.storage.compareAndSetBatch;
  f.args.storage.compareAndSetBatch = async (batch) => { await commit(batch); f.stop(); };
  assert.equal((await migrateMatchingAccountRecord(f.args)).sessionChanged, true);
  assert.equal(JSON.parse(f.values.get(backupKey)).originalRaw, f.original);
});
