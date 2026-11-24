import { supabase, isSupabaseConfigured } from "./supabaseClient";

let userId = null;
let userRevision = 0;
const cloudErrors = new Map();
const cloudStatusListeners = new Set();
const notifyCloudStatus = () => cloudStatusListeners.forEach((listener) => listener());
const updateCloudError = (key, message) => {
  if (message) cloudErrors.set(key, message); else cloudErrors.delete(key);
  notifyCloudStatus();
};
const LOCAL_ONLY_KEYS = new Set(["openai-api-key"]);
const accountKey = (owner, key) => `__cloud_account__:${encodeURIComponent(owner)}:${encodeURIComponent(key)}`;

export function setCloudStorageUser(nextUserId) {
  const next = nextUserId || null;
  if (next !== userId) { userRevision += 1; cloudErrors.clear(); }
  userId = next;
  notifyCloudStatus();
}

export function subscribeCloudStorageStatus(listener) {
  cloudStatusListeners.add(listener);
  return () => cloudStatusListeners.delete(listener);
}

export function bindCloudSession(owner) {
  const revision = userRevision;
  return () => Boolean(owner && userId === owner && userRevision === revision);
}

export function getCloudStorageStatus() {
  return {
    configured: isSupabaseConfigured,
    connected: Boolean(isSupabaseConfigured && userId),
    lastError: cloudErrors.values().next().value || "",
  };
}

export function createCloudBackedStorage(localStorage) {
  const pendingWrites = new Map();
  const pendingLocalWrites = new Map();
  const revisions = new Map();
  const failedWrites = new Set();
  const revision = (key) => revisions.get(key) || 0;
  const enqueueLocal = (key, operation) => {
    const pending = pendingLocalWrites.get(key) || Promise.resolve();
    const result = pending.then(operation);
    const tail = result.catch(() => {});
    pendingLocalWrites.set(key, tail);
    tail.then(() => { if (pendingLocalWrites.get(key) === tail) pendingLocalWrites.delete(key); });
    return result;
  };
  const enqueueWrite = (key, localOperation, cloudOperation) => {
    const localResult = Promise.resolve(localOperation).then(() => null, (error) => ({ error }));
    const pending = pendingWrites.get(key) || Promise.resolve();
    const result = pending.then(async () => {
      const localFailure = await localResult;
      if (localFailure) throw localFailure.error;
      await cloudOperation();
    });
    const tail = result.catch(() => {});
    pendingWrites.set(key, tail);
    tail.then(() => { if (pendingWrites.get(key) === tail) pendingWrites.delete(key); });
    return result;
  };
  const readLocal = async (key) => {
    const raw = await localStorage.get(key);
    if (raw === undefined || raw === null || raw === "") return undefined;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  };
  const readLatestLocal = async (key) => {
    while (true) {
      const before = revision(key);
      await (pendingLocalWrites.get(key) || Promise.resolve());
      const value = await readLocal(key);
      if (revision(key) === before) return value;
    }
  };
  const scope = (key, owner) => owner && !LOCAL_ONLY_KEYS.has(key) ? accountKey(owner, key) : key;
  const unpack = (record, fallback, scoped) => scoped
    ? record && !record.deleted ? record.value : fallback
    : record === undefined ? fallback : record;
  const pendingMessage = "A cloud change is saved locally but needs review before syncing.";

  const get = async (key, fallback) => {
    const owner = userId;
    const ownerRevision = userRevision;
    const scoped = Boolean(owner && !LOCAL_ONLY_KEYS.has(key));
    const localKey = scope(key, owner);
    const ownerChanged = () => owner !== userId || ownerRevision !== userRevision;
    const readAfterMutation = async () => {
      const value = unpack(await readLatestLocal(localKey), fallback, scoped);
      return ownerChanged() ? get(key, fallback) : value;
    };
    const initialRevision = revision(localKey);
    const record = await readLatestLocal(localKey);
    if (ownerChanged()) return get(key, fallback);
    const local = unpack(record, fallback, scoped);
    if (revision(localKey) !== initialRevision || pendingWrites.has(localKey)) return local;
    if (scoped && record?.pending) { updateCloudError(localKey, pendingMessage); return local; }
    if (!supabase || !scoped) return local;

    try {
      const { data, error } = await supabase.from("deutsch_meister_state")
        .select("state_value").eq("user_id", owner).eq("state_key", key).maybeSingle();
      if (error) throw error;
      if (ownerChanged()) return get(key, fallback);
      if (revision(localKey) !== initialRevision) return readAfterMutation();
      if (data) {
        await enqueueLocal(localKey, () => {
          if (ownerChanged() || revision(localKey) !== initialRevision) return;
          return localStorage.set(localKey, JSON.stringify({ pending: false, deleted: false, value: data.state_value }));
        });
        if (ownerChanged()) return get(key, fallback);
        if (revision(localKey) !== initialRevision) return readAfterMutation();
        updateCloudError(localKey, "");
        return data.state_value ?? fallback;
      }
      // Missing cloud data never claims the browser-only record or uploads a local value.
      updateCloudError(localKey, "");
      return local;
    } catch (error) {
      if (!ownerChanged()) updateCloudError(localKey, error.message || "Cloud sync failed.");
      if (ownerChanged()) return get(key, fallback);
      if (revision(localKey) !== initialRevision) return readAfterMutation();
      return local;
    }
  };

  const beginMutation = (key, value, deleted) => {
    const owner = userId;
    const ownerRevision = userRevision;
    const scoped = Boolean(owner && !LOCAL_ONLY_KEYS.has(key));
    const localKey = scope(key, owner);
    const priorInFlight = pendingWrites.has(localKey);
    revisions.set(localKey, revision(localKey) + 1);
    const writeRevision = revision(localKey);
    let blockedByPending = false;
    const localOperation = enqueueLocal(localKey, async () => {
      if (!scoped) return deleted ? localStorage.remove(localKey) : localStorage.set(localKey, JSON.stringify(value));
      const existing = await readLocal(localKey);
      // shortcut: an unresolved prior-session write requires review; add conflict resolution before retrying it.
      blockedByPending = Boolean(existing?.pending && !priorInFlight);
      const baseRemote = existing?.pending && Object.hasOwn(existing, "baseRemote") ? { baseRemote: existing.baseRemote } : {};
      return localStorage.set(localKey, JSON.stringify({ pending: true, deleted, value: deleted ? null : value, ...baseRemote }));
    });
    const cloudOperation = enqueueWrite(localKey, localOperation, async () => {
      if (!supabase || !scoped || owner !== userId || ownerRevision !== userRevision) return;
      if (blockedByPending || failedWrites.has(localKey)) { updateCloudError(localKey, pendingMessage); return; }
      try {
        let result;
        if (deleted) {
          result = await supabase.from("deutsch_meister_state").delete().eq("user_id", owner).eq("state_key", key);
        } else {
          result = await supabase.from("deutsch_meister_state").upsert({ user_id: owner, state_key: key, state_value: value, updated_at: new Date().toISOString() }, { onConflict: "user_id,state_key" });
        }
        if (result.error) throw result.error;
        if (owner !== userId || ownerRevision !== userRevision || revision(localKey) !== writeRevision) return;
        await enqueueLocal(localKey, async () => {
          if (owner !== userId || ownerRevision !== userRevision || revision(localKey) !== writeRevision) return;
          await localStorage.set(localKey, JSON.stringify({ pending: false, deleted, value: deleted ? null : value }));
        });
        updateCloudError(localKey, "");
      } catch (error) {
        failedWrites.add(localKey);
        if (owner === userId && ownerRevision === userRevision) updateCloudError(localKey, error.message || "Cloud sync failed.");
      }
    });
    return { localOperation, cloudOperation };
  };

  const storage = {
    get,
    async inspectAccount(key) {
      const owner = userId;
      const ownerRevision = userRevision;
      if (!supabase || !owner || LOCAL_ONLY_KEYS.has(key)) throw new Error("A signed-in account is required.");
      const local = await readLatestLocal(accountKey(owner, key));
      if (owner !== userId || ownerRevision !== userRevision) throw new Error("Storage session changed.");
      const { data, error } = await supabase.from("deutsch_meister_state")
        .select("state_value").eq("user_id", owner).eq("state_key", key).maybeSingle();
      if (error) throw error;
      if (owner !== userId || ownerRevision !== userRevision) throw new Error("Storage session changed.");
      return { local, remoteFound: Boolean(data), remote: data?.state_value };
    },
    async set(key, value) { return beginMutation(key, value, false).cloudOperation; },
    async setWithLocalAck(key, value) {
      const { localOperation, cloudOperation } = beginMutation(key, value, false);
      cloudOperation.catch(() => {});
      return localOperation;
    },
    async remove(key) { return beginMutation(key, null, true).cloudOperation; },
  };
  storage.bindCurrentUser = () => {
    const owner = userId;
    const ownerRevision = userRevision;
    const guarded = (method) => async (...args) => {
      if (owner !== userId || ownerRevision !== userRevision) throw new Error("Storage session changed.");
      const result = await storage[method](...args);
      if (owner !== userId || ownerRevision !== userRevision) throw new Error("Storage session changed.");
      return result;
    };
    return { get: guarded("get"), inspectAccount: guarded("inspectAccount"), set: guarded("set"), setWithLocalAck: guarded("setWithLocalAck"), remove: guarded("remove") };
  };
  return storage;
}
