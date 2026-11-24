import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readLegacyPreview, compareLegacyDestination } from '../src/legacyPreview.js';
import { stageLegacyImport } from '../src/legacyImportService.js';
import { createVersionedStorage } from '../src/versionedStorage.js';

async function fixture() {
  const persisted = new Map();
  globalThis.indexedDB = { open(name) {
    const open = {};
    queueMicrotask(() => {
      if (name === 'deutsch-meister-storage') { open.onerror?.(); return; }
      open.result = { transaction() {
        const tx = { error: null, abort() { queueMicrotask(() => tx.onabort?.()); } };
        tx.objectStore = () => ({
          get() { const result = {}; queueMicrotask(() => { result.result = persisted.get(name); result.onsuccess?.(); }); return result; },
          put(bytes) { queueMicrotask(() => { persisted.set(name, bytes); tx.oncomplete?.(); }); return {}; },
        });
        return tx;
      } };
      open.onsuccess?.();
    });
    return open;
  } };
  const require = createRequire(import.meta.url);
  const sqlPath = require.resolve('sql.js');
  const wasmPath = path.join(path.dirname(sqlPath), 'sql-wasm.wasm');
  const source = (await readFile(new URL('../src/sqliteStorage.js', import.meta.url), 'utf8'))
    .replace('import initSqlJs from "sql.js";', `import initSqlJs from ${JSON.stringify(pathToFileURL(sqlPath).href)};`)
    .replace('import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";', `const wasmUrl = ${JSON.stringify(wasmPath)};`);
  const { createSqliteStorage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const sourceStorage = createSqliteStorage([], { databaseName: 'legacy-test', migrateLegacy: false });
  const makeTarget = () => createSqliteStorage([], { databaseName: 'account-test', migrateLegacy: false });
  const remote = new Map();
  const sent = [];
  const client = { async rpc(name, args) {
    assert.equal(args.p_expected_user, 'user-a');
    if (name === 'read_deutsch_meister_state') {
      const row = remote.get(args.p_key);
      return { data: row ? { found: true, ...row } : { found: false } };
    }
    assert.equal(name, 'apply_deutsch_meister_state_batch');
    sent.push(structuredClone(args));
    for (const change of args.p_changes) {
      const actual = remote.get(change.key)?.revision || 0;
      if (actual !== change.expectedRevision) return { data: { ok: false, key: change.key, expectedRevision: change.expectedRevision, actualRevision: actual } };
    }
    const revisions = args.p_changes.map((change) => {
      const revision = change.expectedRevision + 1;
      remote.set(change.key, { revision, deleted: change.deleted, state_value: change.deleted ? null : change.value });
      return { key: change.key, revision };
    });
    return { data: { ok: true, revisions } };
  } };
  let counter = 0;
  const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
  const adapter = (storage) => createVersionedStorage({ storage, client, owner: 'user-a', isCurrentSession: () => true, newId });
  return { sourceStorage, makeTarget, adapter, remote, sent };
}

test('reviewed browser records stage into isolated SQLite, survive restart, and sync selected data', async () => {
  try {
    const f = await fixture();
    const original = JSON.stringify([{ word: 'Haus', translation: 'house' }]);
    await f.sourceStorage.set('vocab-words', original);
    await f.sourceStorage.set('practice-draft', JSON.stringify('keep on browser'));
    await f.sourceStorage.set('openai-api-key', JSON.stringify('private key'));
    f.remote.set('vocab-words', { revision: 2, deleted: false, state_value: [{ word: 'Baum' }] });
    const target = f.makeTarget();
    const adapter = f.adapter(target);
    const preview = await readLegacyPreview(f.sourceStorage);
    const destinations = {};
    const compared = await compareLegacyDestination(preview, adapter.inspectAccount, (key, value) => { destinations[key] = value; });
    assert.equal(compared.entries.find((entry) => entry.key === 'vocab-words').destination, 'different');
    assert.equal(Object.hasOwn(preview.rawRecords, 'openai-api-key'), false);
    await stageLegacyImport({ sourceStorage: f.sourceStorage, storage: target, inspectAccount: adapter.inspectAccount, isCurrentSession: () => true, owner: 'user-a', sourceRecords: preview.rawRecords, destinations, selectedKeys: ['vocab-words'], replaceKeys: ['vocab-words'], backupId: 'review1' });
    const recovery = JSON.parse(await target.get('__legacy_import_recovery__:user-a:review1'));
    assert.equal(recovery.records['vocab-words'].sourceRaw, original);
    assert.deepEqual(recovery.records['vocab-words'].remote, [{ word: 'Baum' }]);
    assert.equal(await f.sourceStorage.get('vocab-words'), original);
    assert.equal(await f.sourceStorage.get('practice-draft'), JSON.stringify('keep on browser'));
    assert.equal(await f.sourceStorage.get('openai-api-key'), JSON.stringify('private key'));
    assert.equal(f.sent.length, 0, 'staging itself does not call the cloud write RPC');
    const restarted = f.adapter(f.makeTarget());
    assert.deepEqual(await restarted.get('vocab-words', []), [{ word: 'Haus', translation: 'house' }]);
    assert.equal((await restarted.sync(['vocab-words'])).status, 'synced');
    assert.deepEqual(f.remote.get('vocab-words').state_value, [{ word: 'Haus', translation: 'house' }]);
    assert.equal(f.remote.has('practice-draft'), false);
    assert.equal(f.sent.length, 1);
  } finally { delete globalThis.indexedDB; }
});

test('a cloud revision change after preview rejects staging and preserves both databases', async () => {
  try {
    const f = await fixture();
    await f.sourceStorage.set('practice-draft', JSON.stringify('browser draft'));
    f.remote.set('practice-draft', { revision: 1, deleted: false, state_value: 'cloud draft' });
    const target = f.makeTarget();
    const adapter = f.adapter(target);
    const preview = await readLegacyPreview(f.sourceStorage);
    const destinations = {};
    await compareLegacyDestination(preview, adapter.inspectAccount, (key, value) => { destinations[key] = value; });
    f.remote.set('practice-draft', { revision: 2, deleted: false, state_value: 'newer cloud draft' });
    await assert.rejects(stageLegacyImport({ sourceStorage: f.sourceStorage, storage: target, inspectAccount: adapter.inspectAccount, isCurrentSession: () => true, owner: 'user-a', sourceRecords: preview.rawRecords, destinations, selectedKeys: ['practice-draft'], replaceKeys: ['practice-draft'], backupId: 'review2' }), /Cloud data changed/);
    assert.equal(await f.sourceStorage.get('practice-draft'), JSON.stringify('browser draft'));
    assert.equal(await target.get('__cloud_account__:user-a:practice-draft'), undefined);
    assert.equal(await target.get('__legacy_import_recovery__:user-a:review2'), undefined);
    assert.equal(f.remote.get('practice-draft').state_value, 'newer cloud draft');
    assert.equal(f.sent.length, 0);
  } finally { delete globalThis.indexedDB; }
});

test('a cloud edit after staging becomes a conflict without losing either version', async () => {
  try {
    const f = await fixture();
    await f.sourceStorage.set('practice-draft', JSON.stringify('browser draft'));
    f.remote.set('practice-draft', { revision: 1, deleted: false, state_value: 'cloud draft' });
    const target = f.makeTarget();
    const adapter = f.adapter(target);
    const preview = await readLegacyPreview(f.sourceStorage);
    const destinations = {};
    await compareLegacyDestination(preview, adapter.inspectAccount, (key, value) => { destinations[key] = value; });
    await stageLegacyImport({ sourceStorage: f.sourceStorage, storage: target, inspectAccount: adapter.inspectAccount, isCurrentSession: () => true, owner: 'user-a', sourceRecords: preview.rawRecords, destinations, selectedKeys: ['practice-draft'], replaceKeys: ['practice-draft'], backupId: 'review3' });
    f.remote.set('practice-draft', { revision: 2, deleted: false, state_value: 'newer cloud draft' });
    const restarted = f.adapter(f.makeTarget());
    assert.equal((await restarted.sync(['practice-draft'])).status, 'conflict');
    assert.equal(await restarted.get('practice-draft', ''), 'browser draft');
    assert.deepEqual(await restarted.getSyncState(['practice-draft']), { pendingKeys: [], conflictedKeys: ['practice-draft'], unfinished: false });
    assert.equal(f.remote.get('practice-draft').state_value, 'newer cloud draft');
    assert.equal(await f.sourceStorage.get('practice-draft'), JSON.stringify('browser draft'));
    assert.equal(JSON.parse(await f.makeTarget().get('__legacy_import_recovery__:user-a:review3')).records['practice-draft'].remote, 'cloud draft');
  } finally { delete globalThis.indexedDB; }
});
