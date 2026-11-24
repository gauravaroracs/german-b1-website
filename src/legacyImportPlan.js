import { LEGACY_LEARNING_FIELDS, previewLegacyRecords } from "./legacyPreview.js";
import { prepareVersionedBatch } from "./versionedStateClient.js";

const accountKey = (owner, key) => `__cloud_account__:${encodeURIComponent(owner)}:${encodeURIComponent(key)}`;

// Source and destination can be separate databases: only destination checks belong in this batch.
export function createLegacyImportBatch({ owner, sourceRecords, destinations, selectedKeys, replaceKeys = [], backupId }) {
  if (typeof owner !== "string" || !owner || typeof backupId !== "string" || !/^[A-Za-z0-9_-]+$/.test(backupId)) throw new Error("Invalid import destination or recovery ID.");
  if (!Array.isArray(selectedKeys) || !selectedKeys.length || new Set(selectedKeys).size !== selectedKeys.length || !Array.isArray(replaceKeys) || new Set(replaceKeys).size !== replaceKeys.length || replaceKeys.some((key) => !selectedKeys.includes(key))) throw new Error("Select valid import categories.");
  const source = previewLegacyRecords(sourceRecords);
  const entries = new Map(source.entries.map((entry) => [entry.key, entry]));
  const checks = [];
  const writes = [];
  const recovery = {};
  for (const key of selectedKeys) {
    const entry = entries.get(key);
    if (!Object.hasOwn(LEGACY_LEARNING_FIELDS, key) || !entry || typeof sourceRecords[key] !== "string") throw new Error("A selected browser record is missing or invalid.");
    const destination = destinations?.[key];
    if (!destination || typeof destination.remoteFound !== "boolean" || typeof destination.remoteDeleted !== "boolean" || !Number.isSafeInteger(destination.remoteRevision) || (destination.remoteFound ? destination.remoteRevision < 1 : destination.remoteRevision !== 0 || destination.remoteDeleted) || (destination.remoteFound && !Object.hasOwn(destination, "remote")) || (destination.remoteFound && destination.remoteDeleted && destination.remote !== null) || (destination.remoteFound && !destination.remoteDeleted && destination.remote === undefined) || (destination.localRaw !== undefined && typeof destination.localRaw !== "string")) throw new Error("Account comparison is incomplete.");
    if (destination.remoteFound && !destination.remoteDeleted) prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: destination.remoteRevision, deleted: false, value: destination.remote }]);
    let local;
    try { local = destination.localRaw === undefined ? undefined : JSON.parse(destination.localRaw); }
    catch { throw new Error("An account record is invalid; review it before import."); }
    if (local !== undefined && (!local || typeof local !== "object" || Array.isArray(local) || typeof local.pending !== "boolean" || typeof local.deleted !== "boolean" || !Object.hasOwn(local, "value") || !Number.isSafeInteger(local.baseRevision) || local.baseRevision < 0)) throw new Error("An account record is unversioned or invalid; review it before import.");
    if (local && (local.pending || Object.hasOwn(local, "inFlight") || Object.hasOwn(local, "conflict"))) throw new Error("Resolve pending account changes before importing this category.");
    if (local && local.baseRevision > destination.remoteRevision) throw new Error("Cloud revision regressed; review before import.");
    if (local && local.baseRevision === destination.remoteRevision && (local.deleted !== (!destination.remoteFound || destination.remoteDeleted) || !local.deleted && JSON.stringify(local.value) !== JSON.stringify(destination.remote))) throw new Error("Account data does not match the reviewed revision.");
    const value = source.snapshot[entry.field];
    const localDifferent = local && (local.deleted ? local.baseRevision > 0 : JSON.stringify(local.value) !== JSON.stringify(value));
    const cloudDifferent = destination.remoteFound && (destination.remoteDeleted || JSON.stringify(destination.remote) !== JSON.stringify(value));
    if ((localDifferent || cloudDifferent) && !replaceKeys.includes(key)) throw new Error("Confirm each account replacement before import.");
    prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: destination.remoteRevision, deleted: false, value }]);
    const scoped = accountKey(owner, key);
    checks.push({ key: scoped, expected: destination.localRaw });
    recovery[key] = { sourceRaw: sourceRecords[key], localRaw: destination.localRaw ?? null, remoteFound: destination.remoteFound, remoteRevision: destination.remoteRevision, remoteDeleted: destination.remoteDeleted, ...(destination.remoteFound ? { remote: destination.remote } : {}) };
    const baseRemote = destination.remoteFound ? { found: true, deleted: destination.remoteDeleted, value: destination.remoteDeleted ? null : destination.remote } : { found: false };
    writes.push({ key: scoped, value: JSON.stringify({ pending: true, deleted: false, value, baseRevision: destination.remoteRevision, mutationId: `${backupId}:${key}`, baseRemote }) });
  }
  const recoveryKey = `__legacy_import_recovery__:${encodeURIComponent(owner)}:${backupId}`;
  checks.push({ key: recoveryKey, expected: undefined });
  writes.push({ key: recoveryKey, value: JSON.stringify({ owner, records: recovery }) });
  return { checks, writes };
}
