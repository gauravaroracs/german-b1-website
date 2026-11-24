const STATE_KEYS = new Set([
  "active-tab", "streak-data", "daily-blocks", "anki-log", "grammar-progress", "vocab-words",
  "frequency-adventure-progress", "frequency-adventure-session", "speaking-log", "story-progress",
  "chat-history", "practice-messages", "practice-scenario", "practice-draft", "saved-sentences",
  "sentence-explanations", "kept-examples", "grammar-lessons", "grammar-session", "daily-timers",
  "think-state", "stories-list", "story-session", "mission-progress", "danger-list", "freq-known",
  "freq-review-progress", "vocab-review-preferences",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validRevision = (value) => Number.isSafeInteger(value) && value >= 0;
const validJson = (value, seen = new Set()) => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
  seen.add(value);
  const valid = (Array.isArray(value) ? Array.from(value) : Object.values(value)).every((item) => validJson(item, seen));
  seen.delete(value);
  return valid;
};

// Persist this prepared request before sending so an uncertain outcome can be retried with the same ID and body.
export function prepareVersionedBatch(requestId, changes) {
  if (typeof requestId !== "string" || !UUID.test(requestId) || !Array.isArray(changes) || !changes.length || changes.length > 64) throw new Error("Invalid state batch.");
  const keys = new Set();
  for (const change of changes) {
    if (!change || typeof change !== "object" || !STATE_KEYS.has(change.key) || keys.has(change.key) || !validRevision(change.expectedRevision) || change.expectedRevision === Number.MAX_SAFE_INTEGER || typeof change.deleted !== "boolean" || (!change.deleted && (!Object.hasOwn(change, "value") || !validJson(change.value)))) throw new Error("Invalid state change.");
    keys.add(change.key);
  }
  const payload = changes.map(({ key, expectedRevision, deleted, value }) => deleted ? { key, expectedRevision, deleted } : { key, expectedRevision, deleted, value });
  const body = JSON.stringify(payload);
  if (new TextEncoder().encode(body).length > 900000) throw new Error("State batch is too large.");
  return Object.freeze({ requestId: requestId.toLowerCase(), body });
}

export async function sendVersionedBatch(client, prepared, isCurrentSession, owner) {
  if (!prepared || !Object.isFrozen(prepared) || typeof isCurrentSession !== "function" || typeof owner !== "string" || !owner) throw new Error("A prepared state batch, owner and session guard are required.");
  let changes;
  try { changes = JSON.parse(prepared.body); } catch { throw new Error("Invalid prepared state batch."); }
  const checked = prepareVersionedBatch(prepared.requestId, changes);
  if (checked.body !== prepared.body) throw new Error("Invalid prepared state batch.");
  if (!isCurrentSession()) throw new Error("Storage session changed before sending.");
  let response;
  try { response = await client.rpc("apply_deutsch_meister_state_batch", { p_expected_user: owner, p_request_id: checked.requestId, p_changes: changes }); }
  catch (error) { throw new Error(`State batch failed: ${error?.message || "network error"}. Its outcome may be unknown; retry only with the same request ID and body.`); }
  if (!isCurrentSession()) throw new Error("Storage session changed; the batch may have committed. Retry only with the same request ID and body.");
  const { data, error } = response || {};
  if (error) throw new Error(`State batch failed: ${error.message || "request error"}. Its outcome may be unknown; retry only with the same request ID and body.`);
  if (!data || typeof data !== "object" || typeof data.ok !== "boolean") throw new Error("Invalid state batch response; its outcome may be unknown.");
  const expected = new Map(changes.map((change) => [change.key, change.expectedRevision]));
  if (!data.ok) {
    if (!expected.has(data.key) || !validRevision(data.expectedRevision) || data.expectedRevision !== expected.get(data.key) || !validRevision(data.actualRevision) || data.actualRevision === data.expectedRevision) throw new Error("Invalid state batch response; its outcome may be unknown.");
    return { ok: false, key: data.key, expectedRevision: data.expectedRevision, actualRevision: data.actualRevision };
  }
  if (!Array.isArray(data.revisions) || data.revisions.length !== changes.length) throw new Error("Invalid state batch response; its outcome may be unknown.");
  const revisions = new Map();
  for (const item of data.revisions) {
    if (!item || !expected.has(item.key) || revisions.has(item.key) || !validRevision(item.revision) || item.revision !== expected.get(item.key) + 1) throw new Error("Invalid state batch response; its outcome may be unknown.");
    revisions.set(item.key, item.revision);
  }
  return { ok: true, revisions: [...revisions].map(([key, revision]) => ({ key, revision })) };
}
