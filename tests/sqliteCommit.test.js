import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

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
            const tx = { error: null };
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
  } finally {
    delete globalThis.indexedDB;
  }
});
