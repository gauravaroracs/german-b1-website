import test from 'node:test';
import assert from 'node:assert/strict';
import { createVersionedScheduler } from '../src/versionedScheduler.js';

const gate = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

test('resumes an unfinished receipt before syncing pending account records', async () => {
  let state = { pendingKeys: ['draft'], unfinished: true };
  const calls = [];
  const scheduler = createVersionedScheduler({ owner: 'a', isCurrentSession: (owner) => owner === 'a', getSyncState: async () => state, adapter: { async sync(keys) { calls.push(keys); state = calls.length === 1 ? { pendingKeys: ['draft'], unfinished: false } : { pendingKeys: [], unfinished: false }; return { status: calls.length === 1 ? 'reconciled' : 'synced' }; } } });
  assert.deepEqual(await scheduler.start(), { state: 'idle' });
  assert.deepEqual(calls, [[], ['draft']]);
});

test('serializes runs and revisits an edit made while a request is in flight', async () => {
  let pending = ['draft'];
  const held = gate();
  let calls = 0;
  let concurrent = 0;
  let maxConcurrent = 0;
  const scheduler = createVersionedScheduler({ owner: 'a', isCurrentSession: () => true, getSyncState: async () => ({ pendingKeys: pending, unfinished: false }), adapter: { async sync() { calls += 1; concurrent += 1; maxConcurrent = Math.max(maxConcurrent, concurrent); if (calls === 1) await held.promise; else pending = []; concurrent -= 1; return { status: 'synced' }; } } });
  const first = scheduler.start();
  await new Promise((resolve) => setImmediate(resolve));
  const second = scheduler.requestSync();
  held.resolve();
  await Promise.all([first, second]);
  assert.equal(calls, 2);
  assert.equal(maxConcurrent, 1);
  assert.equal(scheduler.getStatus().state, 'idle');
});

test('conflict pauses automatic work until explicit retry', async () => {
  let calls = 0;
  let pending = ['draft'];
  const scheduler = createVersionedScheduler({ owner: 'a', isCurrentSession: () => true, getSyncState: async () => ({ pendingKeys: pending, unfinished: false }), adapter: { async sync() { calls += 1; if (calls === 1) return { status: 'conflict', key: 'draft' }; pending = []; return { status: 'synced' }; } } });
  assert.equal((await scheduler.start()).state, 'conflict');
  assert.equal((await scheduler.requestSync()).state, 'conflict');
  assert.equal(calls, 1);
  assert.equal((await scheduler.retry()).state, 'idle');
  assert.equal(calls, 2);
});

test('after restart, unrelated pending records sync before an existing conflict is reported', async () => {
  let pending = ['other'];
  const calls = [];
  const scheduler = createVersionedScheduler({ owner: 'a', isCurrentSession: () => true, getSyncState: async () => ({ pendingKeys: pending, conflictedKeys: ['draft'], unfinished: false }), adapter: { async sync(keys) { calls.push(keys); pending = []; return { status: 'synced' }; } } });
  assert.deepEqual(await scheduler.start(), { state: 'conflict', keys: ['draft'] });
  assert.deepEqual(calls, [['other']]);
});

test('network failure and stalled sync pause without spinning and preserve pending state', async () => {
  let calls = 0;
  const pending = ['draft'];
  const scheduler = createVersionedScheduler({ owner: 'a', isCurrentSession: () => true, getSyncState: async () => ({ pendingKeys: pending, unfinished: false }), adapter: { async sync() { calls += 1; if (calls === 1) throw new Error('offline'); return { status: 'synced' }; } } });
  assert.match((await scheduler.start()).message, /offline/);
  assert.deepEqual(pending, ['draft']);
  assert.match((await scheduler.retry()).message, /no local progress/);
  assert.equal(calls, 2);
});

test('session changes and stop prevent subsequent writes', async () => {
  const held = gate();
  let active = true;
  let calls = 0;
  const scheduler = createVersionedScheduler({ owner: 'a', isCurrentSession: () => active, getSyncState: async () => ({ pendingKeys: ['draft'], unfinished: false }), adapter: { async sync() { calls += 1; await held.promise; return { status: 'synced' }; } } });
  const run = scheduler.start();
  await new Promise((resolve) => setImmediate(resolve));
  active = false;
  held.resolve();
  assert.match((await run).message, /session changed/i);
  assert.equal(calls, 1);
  scheduler.stop();
  assert.equal((await scheduler.retry()).state, 'stopped');
  assert.equal(calls, 1);
});

test('a mutation reported as the scheduler becomes idle is not missed', async () => {
  let pending = [];
  let calls = 0;
  let scheduler;
  scheduler = createVersionedScheduler({ owner: 'a', isCurrentSession: () => true, getSyncState: async () => ({ pendingKeys: pending, unfinished: false }), adapter: { async sync() { calls += 1; pending = []; return { status: 'synced' }; } }, onStatus(status) { if (status.state === 'idle' && calls === 0) { pending = ['draft']; scheduler.requestSync(); } } });
  assert.equal((await scheduler.start()).state, 'idle');
  assert.equal(calls, 1);
});

test('a status callback cannot re-enter and start a second sync', async () => {
  let pending = ['draft'];
  let calls = 0;
  let scheduler;
  scheduler = createVersionedScheduler({ owner: 'a', isCurrentSession: () => true, getSyncState: async () => ({ pendingKeys: pending, unfinished: false }), adapter: { async sync() { calls += 1; pending = []; return { status: 'synced' }; } }, onStatus(status) { if (status.state === 'syncing') scheduler.requestSync(); } });
  assert.equal((await scheduler.start()).state, 'idle');
  assert.equal(calls, 1);
});
