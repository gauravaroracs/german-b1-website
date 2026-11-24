import { prepareVersionedBatch } from "./versionedStateClient.js";

const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

// A matching clean local mirror is the only case with an unambiguous owner and baseline.
export async function migrateMatchingAccountRecord({ storage, client, owner, isCurrentSession, key, backupId }) {
  if (!storage || typeof storage.get !== "function" || typeof storage.compareAndSetBatch !== "function" || !client || typeof client.rpc !== "function" || typeof owner !== "string" || !owner || typeof isCurrentSession !== "function" || typeof backupId !== "string" || !/^[A-Za-z0-9_-]+$/.test(backupId)) throw new Error("Invalid account migration configuration.");
  prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: 0, deleted: true }]);
  const active = () => Boolean(isCurrentSession(owner));
  const check = () => { if (!active()) throw new Error("Storage session changed."); };
  const localKey = `__cloud_account__:${encodeURIComponent(owner)}:${encodeURIComponent(key)}`;
  const backupKey = `__account_version_migration__:${encodeURIComponent(owner)}:${backupId}:${encodeURIComponent(key)}`;
  check();
  const raw = await storage.get(localKey);
  check();
  if (raw === undefined) return { status: "review", reason: "missing-local" };
  let record;
  try { record = JSON.parse(raw); } catch { return { status: "review", reason: "invalid-local" }; }
  if (!record || typeof record !== "object" || Array.isArray(record) || typeof record.pending !== "boolean" || typeof record.deleted !== "boolean" || !Object.hasOwn(record, "value")) return { status: "review", reason: "invalid-local" };
  if (Object.hasOwn(record, "baseRevision")) return { status: "review", reason: "already-versioned-or-invalid" };
  if (record.pending || record.deleted || Object.hasOwn(record, "inFlight") || Object.hasOwn(record, "conflict")) return { status: "review", reason: "pending-or-deleted" };
  try { prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: 0, deleted: false, value: record.value }]); }
  catch { return { status: "review", reason: "invalid-local" }; }
  const response = await client.rpc("read_deutsch_meister_state", { p_expected_user: owner, p_key: key });
  check();
  if (response?.error) throw new Error(`Cannot compare account data: ${response.error.message || "cloud unavailable"}.`);
  const remote = response?.data;
  if (!remote || typeof remote.found !== "boolean") throw new Error("Invalid account read response.");
  if (!remote.found) return { status: "review", reason: "missing-or-deleted-cloud" };
  if (!Number.isSafeInteger(remote.revision) || remote.revision < 1 || typeof remote.deleted !== "boolean" || !Object.hasOwn(remote, "state_value")) throw new Error("Invalid account read response.");
  if (remote.deleted) return { status: "review", reason: "missing-or-deleted-cloud" };
  try { prepareVersionedBatch("00000000-0000-0000-0000-000000000000", [{ key, expectedRevision: remote.revision, deleted: false, value: remote.state_value }]); }
  catch { throw new Error("Invalid account read response."); }
  if (!same(record.value, remote.state_value)) return { status: "review", reason: "different-cloud" };
  const migrated = { ...record, baseRevision: remote.revision, baseRemote: { found: true, deleted: false, value: remote.state_value } };
  const backup = { owner, key, originalRaw: raw, observedRemote: remote };
  check();
  await storage.compareAndSetBatch({
    checks: [{ key: localKey, expected: raw }, { key: backupKey, expected: undefined }],
    writes: [{ key: localKey, value: JSON.stringify(migrated) }, { key: backupKey, value: JSON.stringify(backup) }],
  });
  return { status: "migrated", key, backupKey, sessionChanged: !active() };
}
