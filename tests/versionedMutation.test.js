import test from 'node:test';
import assert from 'node:assert/strict';
import { editVersionedRecord } from '../src/versionedMutation.js';

test('editing a pending in-flight value preserves its baseline and sent marker', () => {
  const record = { baseRevision: 3, pending: true, deleted: false, value: 'first', mutationId: 'm1', inFlight: { requestId: 'r1', mutationId: 'm1' }, baseRemote: { found: true, value: 'original' } };
  const updated = editVersionedRecord(record, { mutationId: 'm2', deleted: false, value: 'second' });
  assert.deepEqual(updated, { ...record, value: 'second', mutationId: 'm2' });
  assert.equal(record.value, 'first');
  assert.deepEqual(editVersionedRecord(updated, { mutationId: 'm3', deleted: true }), { ...updated, deleted: true, value: null, mutationId: 'm3' });
});

test('rejects missing baseline, reused tokens and invalid in-flight state', () => {
  const record = { baseRevision: 0, pending: false, deleted: false, value: 'value', mutationId: 'm1' };
  assert.throws(() => editVersionedRecord({ ...record, baseRevision: undefined }, { mutationId: 'm2', deleted: false, value: 'new' }), /versioned account/);
  assert.throws(() => editVersionedRecord(record, { mutationId: 'm1', deleted: false, value: 'new' }), /new mutation/);
  assert.throws(() => editVersionedRecord({ ...record, inFlight: { requestId: 'r', mutationId: 'm1' } }, { mutationId: 'm2', deleted: false, value: 'new' }), /in-flight/);
});
