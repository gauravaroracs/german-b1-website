import test from 'node:test';
import assert from 'node:assert/strict';
import { createVersionedConflictReview } from '../src/versionedConflict.js';
import { prepareVersionedBatch } from '../src/versionedStateClient.js';

function fixture() {
  const owner = 'user-a'; const key = 'practice-draft'; const scoped = '__cloud_account__:user-a:practice-draft';
  const id = '00000000-0000-4000-8000-000000000001';
  const prepared = prepareVersionedBatch(id, [{ key, expectedRevision: 0, deleted: false, value: 'local' }]);
  const conflict = { requestId: id, body: prepared.body, result: { ok: false, key, expectedRevision: 0, actualRevision: 1 } };
  const values = new Map([[scoped, JSON.stringify({ pending: true, deleted: false, value: 'local', baseRevision: 0, mutationId: 'm1', conflict })]]);
  let remote = { found: true, revision: 1, deleted: false, state_value: 'cloud' }; let active = true; let fail = false; let writes = 0;
  const storage = { async get(name) { return values.get(name); }, async compareAndSetBatch({ checks, writes: updates }) { if (fail) throw new Error('aborted'); for (const check of checks) if (values.get(check.key) !== check.expected) throw new Error('stale'); for (const update of updates) { if (update.value === undefined) values.delete(update.key); else values.set(update.key, update.value); } writes++; } };
  const client = { async rpc(name, args) { assert.equal(name, 'read_deutsch_meister_state'); assert.equal(args.p_expected_user, owner); assert.equal(args.p_key, key); return { data: structuredClone(remote) }; } };
  const create = () => createVersionedConflictReview({ storage, client, owner, isCurrentSession: (value) => active && value === owner, newId: () => 'backup_1' });
  return { create, values, scoped, conflict, writes: () => writes, setRemote(value) { remote = value; }, stop() { active = false; }, fail() { fail = true; } };
}

test('keep local saves both originals and rebases only after explicit choice', async () => {
  const f = fixture(); const review = await f.create().preview('practice-draft');
  assert.equal(f.writes(), 0);
  await f.create().resolve(review, 'local');
  const result = JSON.parse(f.values.get(f.scoped));
  assert.equal(result.pending, true); assert.equal(result.value, 'local'); assert.equal(result.baseRevision, 1);
  assert.equal(result.conflict, undefined);
  const backup = JSON.parse(f.values.get('__versioned_conflict_recovery__:user-a:backup_1'));
  assert.equal(JSON.parse(backup.localRaw).value, 'local'); assert.equal(backup.remote.value, 'cloud');
});

test('keep cloud handles tombstones and can be reopened after restart', async () => {
  const f = fixture(); f.setRemote({ found: true, revision: 2, deleted: true, state_value: null });
  const review = await f.create().preview('practice-draft');
  await f.create().resolve(review, 'cloud');
  const record = JSON.parse(f.values.get(f.scoped));
  assert.equal(record.pending, false); assert.equal(record.deleted, true); assert.equal(record.baseRevision, 2);
  assert.ok(f.values.has('__versioned_conflict_recovery__:user-a:backup_1'));
});

test('changed local or remote, failed writes and session switches never replace data', async () => {
  const f = fixture(); const service = f.create(); const review = await service.preview('practice-draft');
  f.setRemote({ found: true, revision: 2, deleted: false, state_value: 'new cloud' });
  await assert.rejects(service.resolve(review, 'cloud'), /changed/);
  assert.equal(f.writes(), 0);
  f.setRemote({ found: true, revision: 1, deleted: false, state_value: 'cloud' });
  f.values.set(f.scoped, JSON.stringify({ ...review.local, value: 'new local', mutationId: 'm2' }));
  await assert.rejects(service.resolve(review, 'cloud'), /changed/);
  const latest = await service.preview('practice-draft');
  f.fail(); await assert.rejects(service.resolve(latest, 'cloud'), /aborted/);
  assert.equal(JSON.parse(f.values.get(f.scoped)).value, 'new local');
  f.stop(); await assert.rejects(service.resolve(latest, 'local'), /session changed/);
  assert.equal(f.writes(), 0);
});

test('rejects missing cloud history and unrecognized secret keys', async () => {
  const f = fixture(); f.setRemote({ found: false });
  await assert.rejects(f.create().preview('practice-draft'), /regressed/);
  await assert.rejects(f.create().preview('openai-api-key'), /Invalid state change/);
});

test('an existing recovery identifier is never overwritten', async () => {
  const f = fixture(); const service = f.create(); const review = await service.preview('practice-draft');
  const backupKey = '__versioned_conflict_recovery__:user-a:backup_1';
  f.values.set(backupKey, 'existing recovery');
  await assert.rejects(service.resolve(review, 'local'), /stale/);
  assert.equal(f.values.get(backupKey), 'existing recovery');
  assert.equal(JSON.parse(f.values.get(f.scoped)).value, 'local');
});
