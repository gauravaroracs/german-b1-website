import { supabase, isSupabaseConfigured } from "./supabaseClient";

let userId = null;
let userRevision = 0;
let lastCloudError = "";
const LOCAL_ONLY_KEYS = new Set(["openai-api-key"]);

export function setCloudStorageUser(nextUserId) {
  const next = nextUserId || null;
  if (next !== userId) userRevision += 1;
  userId = next;
}

export function getCloudStorageStatus() {
  return {
    configured: isSupabaseConfigured,
    connected: Boolean(isSupabaseConfigured && userId),
    lastError: lastCloudError,
  };
}

export function createCloudBackedStorage(localStorage) {
  const pendingWrites = new Map();
  const pendingLocalWrites = new Map();
  const revisions = new Map();
  const unsynced = new Map();
  const revision = (key) => revisions.get(key) || 0;
  const enqueueLocal = (key, operation) => {
    const pending = pendingLocalWrites.get(key) || Promise.resolve();
    const result = pending.then(operation);
    const tail = result.catch(() => {});
    pendingLocalWrites.set(key, tail);
    tail.then(() => { if (pendingLocalWrites.get(key) === tail) pendingLocalWrites.delete(key); });
    return result;
  };
  const enqueueWrite = (key, localOperation, cloudOperation, owner, ownerRevision) => {
    // Start local I/O immediately, but keep cloud mutations for each key in call order.
    const localResult = Promise.resolve(localOperation).then(() => null, (error) => ({ error }));
    const pending = pendingWrites.get(key)?.tail || Promise.resolve();
    const result = pending.then(async () => {
      const localFailure = await localResult;
      if (localFailure) throw localFailure.error;
      await cloudOperation();
    });
    const tail = result.catch(() => {});
    pendingWrites.set(key, { tail, owner, ownerRevision });
    tail.then(() => { if (pendingWrites.get(key)?.tail === tail) pendingWrites.delete(key); });
    return result;
  };
  const readLocal = async (key, fallback) => {
    try {
      const raw = await localStorage.get(key);
      if (raw === undefined || raw === null || raw === "") return fallback;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return fallback;
    }
  };

  const readLatestLocal = async (key, fallback) => {
    while (true) {
      const before = revision(key);
      await (pendingLocalWrites.get(key) || Promise.resolve());
      const value = await readLocal(key, fallback);
      if (revision(key) === before) return value;
    }
  };

  const writeCloud = async (key, value, owner = userId, ownerRevision = userRevision) => {
    if (!supabase || !owner || owner !== userId || ownerRevision !== userRevision || LOCAL_ONLY_KEYS.has(key)) return;
    const { error } = await supabase
      .from("deutsch_meister_state")
      .upsert({
        user_id: owner,
        state_key: key,
        state_value: value,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,state_key" });

    if (error) {
      lastCloudError = error.message;
      throw error;
    }
    lastCloudError = "";
  };

  const get = async (key, fallback) => {
      const owner = userId;
      const ownerRevision = userRevision;
      const ownerChanged = () => owner !== userId || ownerRevision !== userRevision;
      const readAfterMutation = async () => {
        const value = await readLatestLocal(key, fallback);
        return ownerChanged() ? get(key, fallback) : value;
      };
      const initialRevision = revision(key);
      const localValue = await readLatestLocal(key, fallback);
      if (ownerChanged()) return get(key, fallback);
      const dirty = unsynced.get(key);
      const foreignDirty = Boolean(dirty && (dirty.owner !== owner || dirty.ownerRevision !== ownerRevision));
      const pending = pendingWrites.get(key);
      const foreignPending = Boolean(pending && (pending.owner !== owner || pending.ownerRevision !== ownerRevision));
      const local = foreignDirty || foreignPending ? fallback : localValue;
      if (revision(key) !== initialRevision || (pending && !foreignPending && !foreignDirty)) return local;
      if (dirty?.owner === owner && dirty.ownerRevision === ownerRevision) return local;
      if (!supabase || !owner || LOCAL_ONLY_KEYS.has(key)) return local;

      try {
        const { data, error } = await supabase
          .from("deutsch_meister_state")
          .select("state_value")
          .eq("user_id", owner)
          .eq("state_key", key)
          .maybeSingle();

        if (error) throw error;
        if (ownerChanged()) return get(key, fallback);
        if (revision(key) !== initialRevision) return readAfterMutation();
        if (data) {
          await enqueueLocal(key, () => {
            if (owner !== userId || ownerRevision !== userRevision || revision(key) !== initialRevision) return;
            return localStorage.set(key, JSON.stringify(data.state_value));
          });
          if (ownerChanged()) return get(key, fallback);
          if (revision(key) !== initialRevision) return readAfterMutation();
          lastCloudError = "";
          return data.state_value ?? fallback;
        }

        if (local !== fallback) await enqueueWrite(key, Promise.resolve(), async () => {
          if (owner === userId && ownerRevision === userRevision && revision(key) === initialRevision) await writeCloud(key, local, owner, ownerRevision);
        }, owner, ownerRevision);
        if (ownerChanged()) return get(key, fallback);
        if (revision(key) !== initialRevision) return readAfterMutation();
        return local;
      } catch (error) {
        lastCloudError = error.message;
        if (ownerChanged()) return get(key, fallback);
        if (revision(key) !== initialRevision) return readAfterMutation();
        return local;
      }
  };

  const beginSet = (key, value) => {
    const owner = userId;
    const ownerRevision = userRevision;
    revisions.set(key, revision(key) + 1);
    const writeRevision = revision(key);
    if (supabase && owner && !LOCAL_ONLY_KEYS.has(key)) unsynced.set(key, { owner, ownerRevision, writeRevision });
    const localOperation = enqueueLocal(key, () => localStorage.set(key, JSON.stringify(value)));
    const cloudOperation = enqueueWrite(key, localOperation, async () => {
      try {
        await writeCloud(key, value, owner, ownerRevision);
        const dirty = unsynced.get(key);
        if (owner === userId && ownerRevision === userRevision && dirty?.owner === owner && dirty.ownerRevision === ownerRevision && dirty.writeRevision === writeRevision) unsynced.delete(key);
      } catch {
        // Local SQLite remains the offline source until cloud sync succeeds again.
      }
    }, owner, ownerRevision);
    return { localOperation, cloudOperation };
  };

  return {
    get,

    async set(key, value) {
      return beginSet(key, value).cloudOperation;
    },

    async setWithLocalAck(key, value) {
      const { localOperation, cloudOperation } = beginSet(key, value);
      cloudOperation.catch(() => {});
      return localOperation;
    },

    async remove(key) {
      const owner = userId;
      const ownerRevision = userRevision;
      revisions.set(key, revision(key) + 1);
      const writeRevision = revision(key);
      if (supabase && owner && !LOCAL_ONLY_KEYS.has(key)) unsynced.set(key, { owner, ownerRevision, writeRevision });
      const localOperation = enqueueLocal(key, () => localStorage.remove(key));
      return enqueueWrite(key, localOperation, async () => {
        if (!supabase || !owner || owner !== userId || ownerRevision !== userRevision || LOCAL_ONLY_KEYS.has(key)) return;
        try {
          const { error } = await supabase
            .from("deutsch_meister_state")
            .delete()
            .eq("user_id", owner)
            .eq("state_key", key);
          if (error) throw error;
          lastCloudError = "";
          const dirty = unsynced.get(key);
          if (owner === userId && ownerRevision === userRevision && dirty?.owner === owner && dirty.ownerRevision === ownerRevision && dirty.writeRevision === writeRevision) unsynced.delete(key);
        } catch (error) {
          lastCloudError = error.message;
        }
      }, owner, ownerRevision);
    },
  };
}
