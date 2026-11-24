import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareVersionedBatch, sendVersionedBatch } from '../src/versionedStateClient.js';

const id = '10000000-0000-0000-0000-000000000001';
const changes = [{ key: 'practice-draft', expectedRevision: 3, deleted: false, value: { draft: 'Hallo' } }, { key: 'saved-sentences', expectedRevision: 0, deleted: true }];

test('prepares a detached immutable request and retries with the same body and ID', async () => {
  const input = structuredClone(changes);
  const prepared = prepareVersionedBatch(id, input);
  input[0].value.draft = 'changed';
  assert.equal(Object.isFrozen(prepared), true);
  const calls = [];
  const client = { async rpc(name, args) { calls.push([name, structuredClone(args)]); return { data: { ok: true, revisions: [{ key: 'saved-sentences', revision: 1 }, { key: 'practice-draft', revision: 4 }] }, error: null }; } };
  assert.equal((await sendVersionedBatch(client, prepared, () => true, 'user-a')).ok, true);
  await sendVersionedBatch(client, prepared, () => true, 'user-a');
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0][1].p_expected_user, 'user-a');
  assert.equal(calls[0][1].p_changes[0].value.draft, 'Hallo');
  assert.deepEqual(calls[0][1].p_changes[1], { key: 'saved-sentences', expectedRevision: 0, deleted: true });
});

test('rejects unrecognized keys, invalid values, duplicates, revisions and request IDs', () => {
  assert.throws(() => prepareVersionedBatch('no', changes), /Invalid state batch/);
  assert.throws(() => prepareVersionedBatch(id, [{ key: 'openai-api-key', expectedRevision: 0, deleted: false, value: 'secret' }]), /Invalid state change/);
  assert.throws(() => prepareVersionedBatch(id, [changes[0], changes[0]]), /Invalid state change/);
  assert.throws(() => prepareVersionedBatch(id, [{ key: 'practice-draft', expectedRevision: -1, deleted: true }]), /Invalid state change/);
  assert.throws(() => prepareVersionedBatch(id, [{ key: 'practice-draft', expectedRevision: 0, deleted: false, value: { a: undefined } }]), /Invalid state change/);
  assert.throws(() => prepareVersionedBatch(id, [{ key: 'practice-draft', expectedRevision: 0, deleted: false, value: NaN }]), /Invalid state change/);
});

test('returns validated conflicts and rejects malformed responses', async () => {
  const prepared = prepareVersionedBatch(id, changes);
  const client = { async rpc() { return { data: { ok: false, key: 'practice-draft', expectedRevision: 3, actualRevision: 4 } }; } };
  assert.equal((await sendVersionedBatch(client, prepared, () => true, 'user-a')).actualRevision, 4);
  client.rpc = async () => ({ data: { ok: false, key: 'unknown', expectedRevision: 3, actualRevision: 4 } });
  await assert.rejects(sendVersionedBatch(client, prepared, () => true, 'user-a'), /Invalid state batch response/);
  client.rpc = async () => ({ data: { ok: true, revisions: [{ key: 'practice-draft', revision: 4 }] } });
  await assert.rejects(sendVersionedBatch(client, prepared, () => true, 'user-a'), /Invalid state batch response/);
});

test('session changes and failures retain an uncertain-outcome warning', async () => {
  const prepared = prepareVersionedBatch(id, changes);
  let active = true;
  let calls = 0;
  const client = { async rpc() { calls++; active = false; return { data: { ok: true, revisions: [] } }; } };
  await assert.rejects(sendVersionedBatch(client, prepared, () => true), /owner/);
  await assert.rejects(sendVersionedBatch(client, prepared, () => active, 'user-a'), /may have committed/);
  await assert.rejects(sendVersionedBatch(client, prepared, () => active, 'user-a'), /before sending/);
  assert.equal(calls, 1);
  client.rpc = async () => { throw new Error('disconnected'); };
  await assert.rejects(sendVersionedBatch(client, prepared, () => true, 'user-a'), /outcome may be unknown/);
});
