import test from 'node:test';
import assert from 'node:assert/strict';
import { createLegacyImportBatch } from '../src/legacyImportPlan.js';

const scoped = '__cloud_account__:user-a:practice-draft';
const sourceRecords = { 'practice-draft': '"browser draft"' };
const base = { owner: 'user-a', backupId: 'one', sourceRecords, selectedKeys: ['practice-draft'] };
const empty = { remoteFound: false, remote: null, remoteRevision: 0, remoteDeleted: false };

test('stages selected data with account checks and a recovery copy without changing the source', () => {
  const localRaw = JSON.stringify({ pending: false, deleted: false, value: 'old account draft', baseRevision: 1 });
  const destinations = { 'practice-draft': { localRaw, remoteFound: true, remote: 'old cloud draft', remoteRevision: 2, remoteDeleted: false } };
  assert.throws(() => createLegacyImportBatch({ ...base, destinations }), /Confirm each account replacement/);
  const result = createLegacyImportBatch({ ...base, destinations, replaceKeys: ['practice-draft'] });
  assert.deepEqual(result.checks[0], { key: scoped, expected: localRaw });
  assert.equal(result.checks.some((check) => check.key === 'practice-draft'), false, 'source is a separate database');
  assert.deepEqual(JSON.parse(result.writes[0].value), { pending: true, deleted: false, value: 'browser draft', baseRevision: 2, mutationId: 'one:practice-draft', baseRemote: { found: true, deleted: false, value: 'old cloud draft' } });
  const backup = JSON.parse(result.writes[1].value);
  assert.equal(backup.records['practice-draft'].sourceRaw, sourceRecords['practice-draft']);
  assert.equal(backup.records['practice-draft'].localRaw, localRaw);
  assert.equal(backup.records['practice-draft'].remote, 'old cloud draft');
  assert.equal(result.checks.at(-1).expected, undefined);
  assert.equal(sourceRecords['practice-draft'], '"browser draft"');
});

test('rejects pending, unversioned, invalid and unauthorized inputs', () => {
  const destination = (localRaw) => ({ 'practice-draft': { ...empty, localRaw } });
  assert.throws(() => createLegacyImportBatch({ ...base, destinations: destination(JSON.stringify({ pending: true, deleted: false, value: 'pending', baseRevision: 0 })) }), /Resolve pending/);
  assert.throws(() => createLegacyImportBatch({ ...base, destinations: destination(JSON.stringify({ pending: false, deleted: false, value: 'legacy' })) }), /unversioned/);
  assert.throws(() => createLegacyImportBatch({ ...base, destinations: destination('{') }), /account record is invalid/);
  assert.throws(() => createLegacyImportBatch({ ...base, destinations: {} }), /comparison is incomplete/);
  assert.throws(() => createLegacyImportBatch({ ...base, selectedKeys: ['openai-api-key'], sourceRecords: { 'openai-api-key': '"secret"' }, destinations: {} }), /missing or invalid/);
  assert.throws(() => createLegacyImportBatch({ ...base, selectedKeys: ['practice-draft', 'practice-draft'], destinations: {} }), /Select valid/);
  assert.throws(() => createLegacyImportBatch({ ...base, destinations: { 'practice-draft': { ...empty, remoteFound: true } } }), /comparison is incomplete/);
});

test('permits an empty or equal account and retains tombstone revisions on explicit replacement', () => {
  const same = createLegacyImportBatch({ ...base, destinations: { 'practice-draft': { remoteFound: true, remote: 'browser draft', remoteRevision: 4, remoteDeleted: false } } });
  assert.equal(JSON.parse(same.writes[0].value).baseRevision, 4);
  const absent = createLegacyImportBatch({ ...base, destinations: { 'practice-draft': empty } });
  assert.deepEqual(JSON.parse(absent.writes[0].value).baseRemote, { found: false });
  const tombstone = { 'practice-draft': { remoteFound: true, remote: null, remoteRevision: 5, remoteDeleted: true } };
  assert.throws(() => createLegacyImportBatch({ ...base, destinations: tombstone }), /Confirm each account replacement/);
  const restored = createLegacyImportBatch({ ...base, destinations: tombstone, replaceKeys: ['practice-draft'] });
  assert.deepEqual(JSON.parse(restored.writes[0].value).baseRemote, { found: true, deleted: true, value: null });
  assert.equal(JSON.parse(restored.writes[0].value).baseRevision, 5);
});
