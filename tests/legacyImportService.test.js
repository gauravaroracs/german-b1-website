import test from 'node:test';
import assert from 'node:assert/strict';
import { stageLegacyImport } from '../src/legacyImportService.js';
import { createVersionedOutbox } from '../src/versionedOutbox.js';

function fixture() {
  let current = true;
  let writes = 0;
  const source = new Map([['practice-draft', '"browser"']]);
  const target = new Map();
  let remote = { remoteFound: true, remote: 'cloud', remoteRevision: 3, remoteDeleted: false };
  const args = {
    sourceStorage: { async get(key) { return source.get(key); } },
    storage: { async get(key) { return target.get(key); }, async compareAndSetBatch({ checks, writes: updates }) {
      for (const check of checks) if (target.get(check.key) !== check.expected) throw new Error('stale target');
      for (const update of updates) if (update.value === undefined) target.delete(update.key); else target.set(update.key, update.value);
      writes += 1;
    } },
    inspectAccount: async () => remote,
    isCurrentSession: () => current,
    owner: 'user-a', backupId: 'safe_1', sourceRecords: { 'practice-draft': '"browser"' },
    selectedKeys: ['practice-draft'], replaceKeys: ['practice-draft'],
    destinations: { 'practice-draft': { ...remote } },
  };
  return { args, source, target, setRemote(value) { remote = value; }, stopSession() { current = false; }, writes: () => writes };
}

test('stages a reviewed batch in a separate database without mutating source or cloud', async () => {
  const f = fixture();
  assert.deepEqual(await stageLegacyImport(f.args), { owner: 'user-a', backupId: 'safe_1', staged: 1, sessionChanged: false });
  assert.equal(f.writes(), 1);
  assert.equal(f.source.get('practice-draft'), '"browser"');
  const staged = JSON.parse(f.target.get('__cloud_account__:user-a:practice-draft'));
  assert.equal(staged.baseRevision, 3);
  assert.equal(staged.mutationId, 'safe_1:practice-draft');
  const saved = JSON.parse(f.target.get('__legacy_import_recovery__:user-a:safe_1'));
  assert.equal(saved.records['practice-draft'].sourceRaw, '"browser"');
  assert.equal(saved.records['practice-draft'].remote, 'cloud');
});

test('changed source, cloud revision or session blocks the local batch', async () => {
  const f = fixture();
  f.source.set('practice-draft', '"new browser"');
  await assert.rejects(stageLegacyImport(f.args), /Browser data changed/);
  assert.equal(f.writes(), 0);
  f.source.set('practice-draft', '"browser"');
  f.setRemote({ remoteFound: true, remote: 'cloud', remoteRevision: 4, remoteDeleted: false });
  await assert.rejects(stageLegacyImport(f.args), /Cloud data changed/);
  assert.equal(f.writes(), 0);
  f.stopSession();
  await assert.rejects(stageLegacyImport(f.args), /Storage session changed/);
  assert.equal(f.writes(), 0);
});

test('target compare-and-set rejects changed account data without a partial batch', async () => {
  const f = fixture();
  f.target.set('__cloud_account__:user-a:practice-draft', 'new account record');
  await assert.rejects(stageLegacyImport(f.args), /stale target/);
  assert.equal(f.target.size, 1);
  assert.equal(f.writes(), 0);
});

test('if source changes during destination commit, exact reviewed source remains in recovery', async () => {
  const f = fixture();
  const commit = f.args.storage.compareAndSetBatch;
  f.args.storage.compareAndSetBatch = async (batch) => { f.source.set('practice-draft', '"newer"'); return commit(batch); };
  await stageLegacyImport(f.args);
  assert.equal(f.source.get('practice-draft'), '"newer"');
  assert.equal(JSON.parse(f.target.get('__legacy_import_recovery__:user-a:safe_1')).records['practice-draft'].sourceRaw, '"browser"');
});

test('a session change during a committed batch is reported to the caller', async () => {
  const f = fixture();
  const commit = f.args.storage.compareAndSetBatch;
  f.args.storage.compareAndSetBatch = async (batch) => { await commit(batch); f.stopSession(); };
  const result = await stageLegacyImport(f.args);
  assert.equal(result.owner, 'user-a');
  assert.equal(result.sessionChanged, true);
});

test('staged data is accepted by versioned outbox with the observed revision', async () => {
  const f = fixture();
  await stageLegacyImport(f.args);
  let sent;
  const client = { async rpc(_name, args) { sent = args; return { data: { ok: true, revisions: [{ key: 'practice-draft', revision: 4 }] } }; } };
  const outbox = createVersionedOutbox({ storage: f.args.storage, client, owner: 'user-a', isCurrentSession: () => true });
  await outbox.stage('00000000-0000-4000-8000-000000000001', [{ key: 'practice-draft', expectedRevision: 3, deleted: false, value: 'browser' }]);
  assert.equal((await outbox.send()).ok, true);
  assert.equal(sent.p_expected_user, 'user-a');
  assert.equal(sent.p_changes[0].expectedRevision, 3);
  assert.equal(f.source.get('practice-draft'), '"browser"');
});
