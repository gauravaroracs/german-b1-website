import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createLegacyImportBatch } from '../src/legacyImportPlan.js';

test('SQLite saves acknowledge transaction commit and discard a failed in-memory write', async () => {
  let persisted;
  let autoCommit = true;
  let pending;
  let writes = 0;
  globalThis.indexedDB = {
    open(name) {
      const open = {};
      queueMicrotask(() => {
        if (name === 'deutsch-meister-storage') { open.onerror?.(); return; }
        open.result = {
          transaction(_store, mode) {
            const tx = { error: null, abort() { queueMicrotask(() => tx.onabort?.()); } };
            tx.objectStore = () => ({
              get() { const request = {}; queueMicrotask(() => { request.result = persisted; request.onsuccess?.(); }); return request; },
              put(bytes) {
                writes += 1;
                const request = {};
                pending = { tx, bytes };
                queueMicrotask(() => {
                  request.onsuccess?.();
                  if (autoCommit) { persisted = bytes; tx.oncomplete?.(); pending = null; }
                });
                return request;
              },
            });
            return tx;
          },
        };
        open.onsuccess?.();
      });
      return open;
    },
  };
  try {
    const require = createRequire(import.meta.url);
    const sqlPath = require.resolve('sql.js');
    const wasmPath = path.join(path.dirname(sqlPath), 'sql-wasm.wasm');
    const source = (await readFile(new URL('../src/sqliteStorage.js', import.meta.url), 'utf8'))
      .replace('import initSqlJs from "sql.js";', `import initSqlJs from ${JSON.stringify(pathToFileURL(sqlPath).href)};`)
      .replace('import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";', `const wasmUrl = ${JSON.stringify(wasmPath)};`);
    const { createSqliteStorage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const storage = createSqliteStorage();
    assert.equal(await storage.get('key'), undefined);
    const initialWrites = writes;
    await storage.get('key');
    assert.equal(writes, initialWrites, 'reads do not rewrite the database');
    autoCommit = false;
    let resolved = false;
    const first = storage.set('key', 'committed').then(() => { resolved = true; });
    while (!pending) await nextTurn();
    await nextTurn();
    assert.equal(resolved, false, 'request success alone is not a commit');
    persisted = pending.bytes;
    pending.tx.oncomplete(); pending = null;
    await first;
    const failed = storage.set('key', 'uncommitted');
    while (!pending) await nextTurn();
    pending.tx.error = new Error('transaction aborted');
    pending.tx.onabort(); pending = null;
    await assert.rejects(failed, /transaction aborted/);
    assert.equal(await storage.get('key'), 'committed');
    autoCommit = true;
    const otherTab = createSqliteStorage();
    assert.equal(await otherTab.get('key'), 'committed');
    await storage.set('key', 'newer in first tab');
    await assert.rejects(otherTab.set('key', 'stale second tab'), /changed in another tab/);
    assert.equal(await otherTab.get('key'), 'newer in first tab');

    await storage.set('source', 'browser copy');
    await storage.set('target', 'account copy');
    await storage.compareAndSetBatch({
      checks: [{ key: 'source', expected: 'browser copy' }, { key: 'target', expected: 'account copy' }, { key: 'new', expected: undefined }],
      writes: [{ key: 'target', value: 'imported' }, { key: 'new', value: 'new value' }],
    });
    assert.equal(await storage.get('source'), 'browser copy');
    assert.equal(await storage.get('target'), 'imported');
    assert.equal(await storage.get('new'), 'new value');

    await assert.rejects(storage.compareAndSetBatch({
      checks: [{ key: 'target', expected: 'stale' }, { key: 'new', expected: 'new value' }],
      writes: [{ key: 'target', value: 'wrong' }, { key: 'new', value: undefined }],
    }), /changed since the preview/);
    assert.equal(await storage.get('target'), 'imported');
    assert.equal(await storage.get('new'), 'new value');
    assert.throws(() => storage.compareAndSetBatch({ checks: [], writes: [{ key: 'target', value: 'unchecked' }] }), /Invalid batch write/);

    autoCommit = false;
    const interrupted = storage.compareAndSetBatch({
      checks: [{ key: 'target', expected: 'imported' }, { key: 'new', expected: 'new value' }],
      writes: [{ key: 'target', value: 'not saved' }, { key: 'new', value: undefined }],
    });
    while (!pending) await nextTurn();
    pending.tx.error = new Error('batch transaction aborted');
    pending.tx.onabort(); pending = null;
    await assert.rejects(interrupted, /batch transaction aborted/);
    assert.equal(await storage.get('target'), 'imported');
    assert.equal(await storage.get('new'), 'new value');

    autoCommit = true;
    const staleTab = createSqliteStorage();
    assert.equal(await staleTab.get('target'), 'imported');
    await storage.set('source', 'edited elsewhere');
    await assert.rejects(staleTab.compareAndSetBatch({
      checks: [{ key: 'source', expected: 'browser copy' }, { key: 'target', expected: 'imported' }],
      writes: [{ key: 'target', value: 'stale import' }],
    }), /changed in another tab/);
    assert.equal(await staleTab.get('source'), 'edited elsewhere');
    assert.equal(await staleTab.get('target'), 'imported');
    await staleTab.compareAndSetBatch({ checks: [{ key: 'new', expected: 'new value' }], writes: [{ key: 'new', value: undefined }] });
    assert.equal(await staleTab.get('new'), undefined);
    await assert.rejects(storage.set('practice-draft', 'stale'), /changed in another tab/);

    const sourceRecords = { 'practice-draft': '"browser text"' };
    const scopedKey = '__cloud_account__:user-a:practice-draft';
    const localRaw = JSON.stringify({ pending: false, deleted: false, value: 'account text', baseRevision: 1 });
    await storage.set('practice-draft', sourceRecords['practice-draft']);
    await storage.set(scopedKey, localRaw);
    const plan = createLegacyImportBatch({ owner: 'user-a', backupId: 'recovery_1', sourceRecords, selectedKeys: ['practice-draft'], replaceKeys: ['practice-draft'], destinations: { 'practice-draft': { localRaw, remoteFound: true, remote: 'cloud text', remoteRevision: 2, remoteDeleted: false } } });
    await storage.compareAndSetBatch(plan);
    assert.equal(await storage.get('practice-draft'), '"browser text"');
    assert.equal(JSON.parse(await storage.get(scopedKey)).value, 'browser text');
    assert.equal(JSON.parse(await storage.get('__legacy_import_recovery__:user-a:recovery_1')).records['practice-draft'].localRaw, localRaw);
    assert.throws(() => storage.compareAndSetBatch({ checks: [{ key: 'x', expected: undefined }, { key: 'x', expected: undefined }], writes: [{ key: 'x', value: 'value' }] }), /Invalid batch check/);
  } finally {
    delete globalThis.indexedDB;
  }
});

test('an explicitly isolated database does not read or modify the primary database', async () => {
  const databases = new Map();
  const opened = [];
  globalThis.indexedDB = { open(name) {
    opened.push(name);
    const request = {};
    queueMicrotask(() => {
      if (name === 'deutsch-meister-storage') { request.onerror?.(); return; }
      request.result = { transaction() {
        const tx = { error: null, abort() { queueMicrotask(() => tx.onabort?.()); } };
        tx.objectStore = () => ({
          get() { const result = {}; queueMicrotask(() => { result.result = databases.get(name); result.onsuccess?.(); }); return result; },
          put(bytes) { queueMicrotask(() => { databases.set(name, bytes); tx.oncomplete?.(); }); return {}; },
        });
        return tx;
      } };
      request.onsuccess?.();
    });
    return request;
  } };
  try {
    const require = createRequire(import.meta.url);
    const sqlPath = require.resolve('sql.js');
    const wasmPath = path.join(path.dirname(sqlPath), 'sql-wasm.wasm');
    const source = (await readFile(new URL('../src/sqliteStorage.js', import.meta.url), 'utf8'))
      .replace('import initSqlJs from "sql.js";', `import initSqlJs from ${JSON.stringify(pathToFileURL(sqlPath).href)};`)
      .replace('import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";', `const wasmUrl = ${JSON.stringify(wasmPath)};`);
    const { createSqliteStorage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const primary = createSqliteStorage();
    await primary.set('draft', 'primary');
    const before = opened.filter((name) => name === 'deutsch-meister-storage').length;
    const isolated = createSqliteStorage([], { databaseName: 'deutsch-meister-experimental', migrateLegacy: false });
    assert.equal(await isolated.get('draft'), undefined);
    await isolated.set('draft', 'isolated');
    assert.equal(await primary.get('draft'), 'primary');
    assert.equal(opened.filter((name) => name === 'deutsch-meister-storage').length, before);
  } finally { delete globalThis.indexedDB; }
});
