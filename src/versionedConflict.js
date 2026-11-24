import { createVersionedOutbox } from "./versionedOutbox.js";
import { prepareVersionedBatch } from "./versionedStateClient.js";

const scopedKey = (owner, key) => `__cloud_account__:${encodeURIComponent(owner)}:${encodeURIComponent(key)}`;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

export function createVersionedConflictReview({ storage, client, owner, isCurrentSession, newId = () => globalThis.crypto.randomUUID() }) {
  if (!storage || typeof storage.get !== "function" || typeof storage.compareAndSetBatch !== "function" || !client || typeof client.rpc !== "function" || typeof owner !== "string" || !owner || typeof isCurrentSession !== "function" || typeof newId !== "function") throw new Error("Invalid conflict review configuration.");
  const active = () => Boolean(isCurrentSession(owner));
  const requireSession = () => { if (!active()) throw new Error("Storage session changed."); };
  const outbox = createVersionedOutbox({ storage, client, owner, isCurrentSession });

  async function preview(key) {
    requireSession();
    prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: 0, deleted: true }]);
    const raw = await storage.get(scopedKey(owner, key));
    requireSession();
    let local;
    try { local = JSON.parse(raw); } catch { throw new Error("Local conflict record is missing or invalid."); }
    if (!local || typeof local !== "object" || Array.isArray(local) || local.pending !== true || typeof local.deleted !== "boolean" || !Object.hasOwn(local, "value") || !Number.isSafeInteger(local.baseRevision) || local.baseRevision < 0 || typeof local.mutationId !== "string" || !local.mutationId || local.inFlight) throw new Error("Local conflict record is missing or invalid.");
    const conflict = await outbox.getConflict(key);
    requireSession();
    if (!conflict || !same(conflict, local.conflict) || conflict.result.expectedRevision !== local.baseRevision) throw new Error("Conflict changed. Review it again.");
    const response = await client.rpc("read_deutsch_meister_state", { p_expected_user: owner, p_key: key });
    requireSession();
    if (response?.error) throw new Error(response.error.message || "Cloud read failed.");
    const data = response?.data;
    if (!data || typeof data.found !== "boolean") throw new Error("Invalid cloud record.");
    if (data.found && (!Number.isSafeInteger(data.revision) || data.revision < 1 || typeof data.deleted !== "boolean" || !Object.hasOwn(data, "state_value"))) throw new Error("Invalid cloud record.");
    if (data.found && !data.deleted) prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: data.revision, deleted: false, value: data.state_value }]);
    const remote = data.found ? { found: true, revision: data.revision, deleted: data.deleted, value: data.deleted ? null : data.state_value } : { found: false, revision: 0, deleted: true, value: null };
    if (remote.revision < conflict.result.actualRevision) throw new Error("Cloud revision regressed; review later.");
    return { owner, key, raw, local, remote };
  }

  async function resolve(review, choice) {
    if (!review || review.owner !== owner || !["local", "cloud"].includes(choice)) throw new Error("Choose which conflict version to keep.");
    const current = await preview(review.key);
    if (current.raw !== review.raw || !same(current.remote, review.remote)) throw new Error("Conflict changed. Review it again.");
    const backupId = newId();
    if (typeof backupId !== "string" || !/^[A-Za-z0-9_-]+$/.test(backupId)) throw new Error("Invalid recovery identifier.");
    const backupKey = `__versioned_conflict_recovery__:${encodeURIComponent(owner)}:${backupId}`;
    const { conflict, inFlight, ...local } = current.local;
    const baseRemote = current.remote.found ? { found: true, deleted: current.remote.deleted, value: current.remote.value } : { found: false };
    const next = choice === "local"
      ? { ...local, pending: true, baseRevision: current.remote.revision, baseRemote }
      : { pending: false, deleted: current.remote.deleted, value: current.remote.value, baseRevision: current.remote.revision, baseRemote };
    requireSession();
    await storage.compareAndSetBatch({
      checks: [{ key: scopedKey(owner, review.key), expected: current.raw }, { key: backupKey, expected: undefined }],
      writes: [{ key: scopedKey(owner, review.key), value: JSON.stringify(next) }, { key: backupKey, value: JSON.stringify({ owner, key: review.key, localRaw: current.raw, remote: current.remote, choice }) }],
    });
    return { owner, key: review.key, choice, backupId, sessionChanged: !active() };
  }

  return { preview, resolve };
}
