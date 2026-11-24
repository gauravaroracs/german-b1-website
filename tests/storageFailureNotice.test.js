import test from 'node:test';
import assert from 'node:assert/strict';
import { withStorageFailureNotice } from '../src/storageFailureNotice.js';

test('reports local read and write failures and preserves the rejection', async () => {
  let failures = 0;
  const failure = new Error('disk full');
  const storage = withStorageFailureNotice({ get: async () => { throw failure; }, set: async () => { throw failure; }, setWithLocalAck: async () => {}, remove: async () => {} }, () => { failures += 1; });
  await assert.rejects(storage.get('key'), (error) => error === failure);
  await assert.rejects(storage.set('key', 1), (error) => error === failure);
  assert.equal(failures, 2);
});

test('does not report a normal account-session invalidation as a storage failure', async () => {
  let failures = 0;
  const storage = withStorageFailureNotice({ get: async () => { throw new Error('Storage session changed.'); }, set: async () => {}, setWithLocalAck: async () => {}, remove: async () => {} }, () => { failures += 1; });
  await assert.rejects(storage.get('key'), /session changed/);
  assert.equal(failures, 0);
});
