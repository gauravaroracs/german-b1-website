import { prepareVersionedBatch } from "./versionedStateClient.js";

const accountKey = (owner, key) => `__cloud_account__:${encodeURIComponent(owner)}:${encodeURIComponent(key)}`;
const token = (value) => typeof value === "string" && value.length > 0;

// The staging transaction must record the request ID and each sent mutation ID on its account record.
export async function reconcileVersionedReceipt({ storage, outbox, owner }) {
  if (!storage || typeof storage.get !== "function" || !outbox || typeof outbox.getReceipt !== "function" || typeof outbox.reconcile !== "function" || typeof owner !== "string" || !owner) throw new Error("Invalid reconciliation configuration.");
  const receipt = await outbox.getReceipt();
  if (!receipt) throw new Error("No state batch receipt to reconcile.");
  let storedReceipt;
  try { storedReceipt = JSON.parse(receipt.raw); } catch { throw new Error("Invalid state batch receipt."); }
  if (!storedReceipt || storedReceipt.owner !== owner || storedReceipt.requestId !== receipt.requestId || storedReceipt.body !== receipt.body || JSON.stringify(storedReceipt.result) !== JSON.stringify(receipt.result)) throw new Error("State batch receipt does not match this account.");
  let changes;
  try { changes = JSON.parse(receipt.body); } catch { throw new Error("Invalid state batch receipt."); }
  const prepared = prepareVersionedBatch(receipt.requestId, changes);
  if (prepared.body !== receipt.body || !receipt.result || receipt.result.ok !== true || !Array.isArray(receipt.result.revisions)) throw new Error("Invalid state batch receipt.");
  const revisions = new Map();
  for (const item of receipt.result.revisions) {
    if (!item || revisions.has(item.key) || !Number.isSafeInteger(item.revision) || item.revision < 1) throw new Error("Invalid state batch receipt.");
    revisions.set(item.key, item.revision);
  }
  if (revisions.size !== changes.length) throw new Error("Invalid state batch receipt.");
  const checks = [];
  const writes = [];
  for (const change of changes) {
    const key = accountKey(owner, change.key);
    const raw = await storage.get(key);
    let current;
    try { current = JSON.parse(raw); } catch { throw new Error("Pending local record is missing or invalid."); }
    if (!current || typeof current !== "object" || Array.isArray(current) || current.pending !== true || typeof current.deleted !== "boolean" || !Object.hasOwn(current, "value") || current.baseRevision !== change.expectedRevision || !token(current.mutationId) || !current.inFlight || current.inFlight.requestId !== prepared.requestId || !token(current.inFlight.mutationId) || revisions.get(change.key) !== change.expectedRevision + 1) throw new Error("Pending local record does not match the receipt.");
    const matchesSent = current.deleted === change.deleted && (change.deleted || JSON.stringify(current.value) === JSON.stringify(change.value));
    const unchanged = current.mutationId === current.inFlight.mutationId;
    if (unchanged && !matchesSent) throw new Error("Pending local mutation does not match the receipt.");
    const { inFlight, ...record } = current;
    record.pending = !unchanged;
    record.baseRevision = revisions.get(change.key);
    record.baseRemote = { found: true, deleted: change.deleted, value: change.deleted ? null : change.value };
    checks.push({ key, expected: raw });
    writes.push({ key, value: JSON.stringify(record) });
  }
  await outbox.reconcile(receipt.raw, checks, writes);
  return { acknowledged: changes.length, pending: writes.filter((write) => JSON.parse(write.value).pending).length };
}
