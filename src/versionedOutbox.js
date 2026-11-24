import { prepareVersionedBatch, sendVersionedBatch } from "./versionedStateClient.js";

// The caller supplies an owner-bound session guard and reconciles acknowledgements with local values.
export function createVersionedOutbox({ storage, client, owner, isCurrentSession }) {
  if (!storage || typeof storage.get !== "function" || typeof storage.compareAndSetBatch !== "function" || !client || typeof client.rpc !== "function" || typeof owner !== "string" || !owner || typeof isCurrentSession !== "function") throw new Error("Invalid outbox configuration.");
  const prefix = `__versioned_outbox__:${encodeURIComponent(owner)}`;
  const pendingKey = `${prefix}:pending`;
  const receiptKey = `${prefix}:receipt`;
  const accountKey = (key) => `__cloud_account__:${encodeURIComponent(owner)}:${encodeURIComponent(key)}`;
  const active = () => Boolean(isCurrentSession(owner));
  const requireSession = () => { if (!active()) throw new Error("Storage session changed."); };
  const read = async (key) => {
    requireSession();
    const value = await storage.get(key);
    requireSession();
    return value;
  };
  const parsePrepared = (raw) => {
    let stored;
    try { stored = JSON.parse(raw); } catch { throw new Error("Invalid saved outbox request."); }
    if (!stored || stored.owner !== owner || typeof stored.body !== "string") throw new Error("Invalid saved outbox request.");
    let changes;
    try { changes = JSON.parse(stored.body); } catch { throw new Error("Invalid saved outbox request."); }
    const prepared = prepareVersionedBatch(stored.requestId, changes);
    if (prepared.body !== stored.body || prepared.requestId !== stored.requestId) throw new Error("Invalid saved outbox request.");
    return prepared;
  };
  const conflictAlreadyRecorded = async (raw, prepared, result) => {
    if (await read(pendingKey) === raw) return false;
    const saved = await read(accountKey(result.key));
    let record;
    try { record = JSON.parse(saved); } catch { throw new Error("The outbox changed while recording the conflict; review it before retrying."); }
    if (record?.conflict?.requestId === prepared.requestId && record.conflict.body === prepared.body && JSON.stringify(record.conflict.result) === JSON.stringify(result)) return true;
    throw new Error("The outbox changed while recording the conflict; review it before retrying.");
  };

  return {
    async stage(requestId, changes) {
      requireSession();
      const prepared = prepareVersionedBatch(requestId, changes);
      const raw = JSON.stringify({ owner, ...prepared });
      const checks = [{ key: pendingKey, expected: undefined }, { key: receiptKey, expected: undefined }];
      const writes = [{ key: pendingKey, value: raw }];
      for (const change of JSON.parse(prepared.body)) {
        const key = accountKey(change.key);
        const saved = await read(key);
        let record;
        try { record = JSON.parse(saved); } catch { throw new Error("Pending local record is missing or invalid."); }
        if (!record || typeof record !== "object" || Array.isArray(record) || record.pending !== true || typeof record.deleted !== "boolean" || !Object.hasOwn(record, "value") || record.baseRevision !== change.expectedRevision || typeof record.mutationId !== "string" || !record.mutationId.trim() || Object.hasOwn(record, "inFlight") || Object.hasOwn(record, "conflict") || record.deleted !== change.deleted || (!change.deleted && JSON.stringify(record.value) !== JSON.stringify(change.value))) throw new Error("Pending local record does not match the batch.");
        checks.push({ key, expected: saved });
        writes.push({ key, value: JSON.stringify({ ...record, inFlight: { requestId: prepared.requestId, mutationId: record.mutationId } }) });
      }
      requireSession();
      await storage.compareAndSetBatch({ checks, writes });
      if (!active()) throw new Error("Storage session changed; the request was saved for its original account.");
      return prepared;
    },

    async send() {
      const raw = await read(pendingKey);
      if (raw === undefined) throw new Error("No pending state batch.");
      const prepared = parsePrepared(raw);
      const result = await sendVersionedBatch(client, prepared, active, owner);
      requireSession();
      if (!result.ok) {
        const changes = JSON.parse(prepared.body);
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const checks = [{ key: pendingKey, expected: raw }];
          const writes = [{ key: pendingKey, value: undefined }];
          for (const change of changes) {
            const key = accountKey(change.key);
            const saved = await read(key);
            let record;
            try { record = JSON.parse(saved); } catch {
              if (await conflictAlreadyRecorded(raw, prepared, result)) return result;
              throw new Error("Rejected request cannot be saved for review; pending request was retained.");
            }
            const sameSent = record && record.deleted === change.deleted && (change.deleted || JSON.stringify(record.value) === JSON.stringify(change.value));
            if (!record || typeof record !== "object" || Array.isArray(record) || record.pending !== true || typeof record.deleted !== "boolean" || !Object.hasOwn(record, "value") || record.baseRevision !== change.expectedRevision || typeof record.mutationId !== "string" || !record.mutationId.trim() || !record.inFlight || record.inFlight.requestId !== prepared.requestId || typeof record.inFlight.mutationId !== "string" || !record.inFlight.mutationId.trim() || (record.mutationId === record.inFlight.mutationId && !sameSent) || Object.hasOwn(record, "conflict")) {
              if (await conflictAlreadyRecorded(raw, prepared, result)) return result;
              throw new Error("Rejected request cannot be saved for review; pending request was retained.");
            }
            const { inFlight, ...next } = record;
            if (change.key === result.key) next.conflict = { requestId: prepared.requestId, body: prepared.body, result };
            checks.push({ key, expected: saved });
            writes.push({ key, value: JSON.stringify(next) });
          }
          requireSession();
          try {
            await storage.compareAndSetBatch({ checks, writes });
            if (!active()) throw new Error("Storage session changed; the conflict was saved for its original account.");
            return result;
          } catch (error) {
            if (!active()) throw error;
            if (await conflictAlreadyRecorded(raw, prepared, result)) return result;
            if (attempt === 2) throw new Error(`Could not save the conflict for review; pending request was retained: ${error.message}`);
          }
        }
      }
      const receipt = JSON.stringify({ owner, ...prepared, result });
      try {
        await storage.compareAndSetBatch({ checks: [{ key: pendingKey, expected: raw }, { key: receiptKey, expected: undefined }], writes: [{ key: pendingKey, value: undefined }, { key: receiptKey, value: receipt }] });
      } catch (error) {
        throw new Error(`Cloud batch succeeded, but its local receipt could not be saved: ${error.message}. Retry only with the same request ID and body.`);
      }
      if (!active()) throw new Error("Storage session changed; a receipt was saved for the original account.");
      return result;
    },

    async getPending() {
      const raw = await read(pendingKey);
      return raw === undefined ? null : parsePrepared(raw);
    },

    async getConflict(key) {
      prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: 0, deleted: true }]);
      const saved = await read(accountKey(key));
      if (saved === undefined) return null;
      let record;
      try { record = JSON.parse(saved); } catch { throw new Error("Invalid saved account record."); }
      if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Invalid saved account record.");
      if (!Object.hasOwn(record, "conflict")) return null;
      const conflict = record.conflict;
      const prepared = parsePrepared(JSON.stringify({ owner, requestId: conflict?.requestId, body: conflict?.body }));
      const result = conflict?.result;
      const changes = JSON.parse(prepared.body);
      const change = changes.find((item) => item.key === key);
      if (!result || result.ok !== false || result.key !== key || !change || result.expectedRevision !== change.expectedRevision || !Number.isSafeInteger(result.actualRevision) || result.actualRevision < 0 || result.actualRevision === result.expectedRevision) throw new Error("Invalid saved conflict.");
      return { requestId: prepared.requestId, body: prepared.body, result };
    },

    async getReceipt() {
      const raw = await read(receiptKey);
      if (raw === undefined) return null;
      let receipt;
      try { receipt = JSON.parse(raw); } catch { throw new Error("Invalid saved outbox receipt."); }
      if (!receipt || receipt.owner !== owner || !receipt.result || receipt.result.ok !== true) throw new Error("Invalid saved outbox receipt.");
      const prepared = parsePrepared(raw);
      const expected = new Map(JSON.parse(prepared.body).map((change) => [change.key, change.expectedRevision + 1]));
      if (!Array.isArray(receipt.result.revisions) || receipt.result.revisions.length !== expected.size) throw new Error("Invalid saved outbox receipt.");
      for (const item of receipt.result.revisions) {
        if (!item || !expected.has(item.key) || expected.get(item.key) !== item.revision) throw new Error("Invalid saved outbox receipt.");
        expected.delete(item.key);
      }
      return { raw, requestId: receipt.requestId, body: receipt.body, result: receipt.result };
    },

    async reconcile(receiptRaw, checks, writes) {
      requireSession();
      if (typeof receiptRaw !== "string" || !Array.isArray(checks) || !Array.isArray(writes) || [...checks, ...writes].some((entry) => !entry || entry.key === pendingKey || entry.key === receiptKey)) throw new Error("Invalid outbox reconciliation.");
      const currentReceipt = await this.getReceipt();
      if (!currentReceipt || currentReceipt.raw !== receiptRaw) throw new Error("Outbox receipt changed.");
      await storage.compareAndSetBatch({ checks: [{ key: receiptKey, expected: receiptRaw }, ...checks], writes: [{ key: receiptKey, value: undefined }, ...writes] });
      if (!active()) throw new Error("Storage session changed after reconciliation.");
    },
  };
}
