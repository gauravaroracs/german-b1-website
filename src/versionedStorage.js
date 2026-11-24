import { createVersionedOutbox } from "./versionedOutbox.js";
import { reconcileVersionedReceipt } from "./versionedReconcile.js";
import { editVersionedRecord } from "./versionedMutation.js";
import { prepareVersionedBatch } from "./versionedStateClient.js";

const scopedKey = (owner, key) => `__cloud_account__:${encodeURIComponent(owner)}:${encodeURIComponent(key)}`;
const isRecord = (value) => value && typeof value === "object" && !Array.isArray(value) && Number.isSafeInteger(value.baseRevision) && value.baseRevision >= 0 && typeof value.pending === "boolean" && typeof value.deleted === "boolean" && Object.hasOwn(value, "value");
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

// Experimental: requires the matching server migration; call sync explicitly.
export function createVersionedStorage({ storage, client, owner, isCurrentSession, newId = () => globalThis.crypto.randomUUID() }) {
  if (!storage || typeof storage.get !== "function" || typeof storage.compareAndSetBatch !== "function" || !client || typeof client.rpc !== "function" || typeof owner !== "string" || !owner || typeof isCurrentSession !== "function" || typeof newId !== "function") throw new Error("Invalid versioned storage configuration.");
  const active = () => Boolean(isCurrentSession(owner));
  const requireSession = () => { if (!active()) throw new Error("Storage session changed."); };
  const outbox = createVersionedOutbox({ storage, client, owner, isCurrentSession });
  const queues = new Map();
  let syncOperation = Promise.resolve();
  const enqueue = (key, task) => {
    const result = (queues.get(key) || Promise.resolve()).catch(() => {}).then(task);
    const tail = result.catch(() => {});
    queues.set(key, tail);
    tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
    return result;
  };
  const readRaw = async (key) => {
    requireSession();
    const raw = await storage.get(scopedKey(owner, key));
    requireSession();
    if (raw === undefined) return { raw, record: undefined };
    let record;
    try { record = JSON.parse(raw); } catch { throw new Error("Account record is invalid; review local data."); }
    if (!isRecord(record)) throw new Error("Account record lacks a verified server revision; review local data.");
    return { raw, record };
  };
  const writeRecord = async (key, raw, record) => {
    requireSession();
    const localKey = scopedKey(owner, key);
    await storage.compareAndSetBatch({ checks: [{ key: localKey, expected: raw }], writes: [{ key: localKey, value: JSON.stringify(record) }] });
    requireSession();
  };
  const load = async (key) => {
    const { raw, record } = await readRaw(key);
    if (record?.pending) return record;
    let data;
    try {
      const response = await client.rpc("read_deutsch_meister_state", { p_expected_user: owner, p_key: key });
      requireSession();
      if (response.error) throw response.error;
      if (!response.data || typeof response.data.found !== "boolean") throw new Error("Invalid account read response.");
      data = response.data.found ? response.data : null;
    } catch (error) {
      requireSession();
      if (record) return record;
      throw new Error(`Cannot load account data: ${error?.message || "cloud unavailable"}.`);
    }
    if (data !== null && data !== undefined && (!Number.isSafeInteger(data.revision) || data.revision < 1 || typeof data.deleted !== "boolean" || !Object.hasOwn(data, "state_value"))) throw new Error("Cloud record has an invalid revision or value.");
    if (data && !data.deleted) prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: 0, deleted: false, value: data.state_value }]);
    const next = data == null
      ? { pending: false, deleted: true, value: null, baseRevision: 0, baseRemote: { found: false } }
      : { pending: false, deleted: data.deleted, value: data.deleted ? null : data.state_value, baseRevision: data.revision, baseRemote: { found: true, deleted: data.deleted, value: data.deleted ? null : data.state_value } };
    if (record && (next.baseRevision < record.baseRevision || next.baseRevision === record.baseRevision && (next.deleted !== record.deleted || !same(next.value, record.value)))) throw new Error("Cloud data does not match the saved revision; review before continuing.");
    if (!record || !same(record, next)) await writeRecord(key, raw, next);
    return next;
  };
  const get = (key, fallback) => enqueue(key, async () => {
    prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: 0, deleted: true }]);
    const record = await load(key);
    return record.deleted ? fallback : record.value;
  });
  const mutate = (key, value, deleted) => enqueue(key, async () => {
    const mutationId = newId();
    prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: 0, deleted, ...(deleted ? {} : { value }) }]);
    await load(key);
    const { raw, record } = await readRaw(key);
    const next = editVersionedRecord(record, { mutationId, deleted, value });
    await writeRecord(key, raw, next);
  });
  const sync = (keys) => {
    const result = syncOperation.catch(() => {}).then(async () => {
      requireSession();
      if (await outbox.getReceipt()) return { status: "reconciled", ...await reconcileVersionedReceipt({ storage, outbox, owner }) };
      let pending = await outbox.getPending();
      if (!pending) {
        if (!Array.isArray(keys) || !keys.length || new Set(keys).size !== keys.length) throw new Error("Choose pending keys to sync.");
        const changes = [];
        for (const key of keys) {
          await (queues.get(key) || Promise.resolve());
          const { record } = await readRaw(key);
          if (!record?.pending) throw new Error("A selected record has no pending changes.");
          changes.push({ key, expectedRevision: record.baseRevision, deleted: record.deleted, ...(record.deleted ? {} : { value: record.value }) });
        }
        pending = await outbox.stage(newId(), changes);
      }
      const response = await outbox.send();
      if (!response.ok) return { status: "conflict", ...response };
      const receipt = await reconcileVersionedReceipt({ storage, outbox, owner });
      return { status: "synced", ...receipt };
    });
    syncOperation = result.catch(() => {});
    return result;
  };
  const getSyncState = async (keys) => {
    requireSession();
    if (!Array.isArray(keys) || new Set(keys).size !== keys.length) throw new Error("Invalid sync keys.");
    const pendingKeys = [];
    const conflictedKeys = [];
    for (const key of keys) {
      prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: 0, deleted: true }]);
      await (queues.get(key) || Promise.resolve());
      const { record } = await readRaw(key);
      if (record?.conflict) conflictedKeys.push(key);
      else if (record?.pending) pendingKeys.push(key);
    }
    const unfinished = Boolean(await outbox.getPending() || await outbox.getReceipt());
    requireSession();
    return { pendingKeys, conflictedKeys, unfinished };
  };
  const inspectAccount = async (key) => {
    prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: 0, deleted: true }]);
    const { raw, record } = await readRaw(key);
    const response = await client.rpc("read_deutsch_meister_state", { p_expected_user: owner, p_key: key });
    requireSession();
    if (response.error) throw response.error;
    const data = response.data;
    if (!data || typeof data.found !== "boolean" || data.found && (!Number.isSafeInteger(data.revision) || data.revision < 1 || typeof data.deleted !== "boolean" || !Object.hasOwn(data, "state_value"))) throw new Error("Invalid account read response.");
    return { local: record, localRaw: raw, remoteFound: data.found, remote: data.found && !data.deleted ? data.state_value : null, remoteRevision: data.found ? data.revision : 0, remoteDeleted: data.found ? data.deleted : false };
  };
  return { get, set: (key, value) => mutate(key, value, false), setWithLocalAck: (key, value) => mutate(key, value, false), remove: (key) => mutate(key, null, true), sync, getSyncState, inspectAccount };
}
