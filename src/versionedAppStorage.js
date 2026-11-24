import { createVersionedScheduler } from "./versionedScheduler.js";
import { withLocalApiKey } from "./versionedLocalKey.js";

// This composition remains opt-in until the versioned server and account migration are ready.
export function createVersionedAppStorage({ adapter, local, owner, isCurrentSession, keys, onStatus }) {
  if (!Array.isArray(keys) || !keys.length || keys.includes("openai-api-key")) throw new Error("Invalid sync key list.");
  const active = () => isCurrentSession(owner);
  const scheduler = createVersionedScheduler({ adapter, owner, isCurrentSession, getSyncState: () => adapter.getSyncState(keys), onStatus });
  const storage = withLocalApiKey(adapter, local, active);
  let frozen = false;
  let writeFailed = false;
  const writes = new Set();
  const mutate = (method) => (key, ...args) => {
    if (frozen) { writeFailed = true; return Promise.reject(new Error("Storage is paused while applying changes.")); }
    const operation = Promise.resolve().then(() => storage[method](key, ...args)).then((result) => {
      if (key !== "openai-api-key") scheduler.requestSync();
      return result;
    });
    writes.add(operation);
    operation.then(() => writes.delete(operation), () => { writeFailed = true; writes.delete(operation); });
    return operation;
  };
  const freezeWrites = async () => {
    frozen = true;
    const results = await Promise.allSettled([...writes]);
    if (writeFailed || results.some((result) => result.status === "rejected")) { frozen = false; throw new Error("A local write failed. Save your work elsewhere and reload before resolving this conflict."); }
  };
  const assertWritesFrozen = () => {
    if (!frozen || writeFailed || writes.size) throw new Error("A local edit could not be saved. Copy it elsewhere before reloading.");
  };
  return { ...storage, set: mutate("set"), setWithLocalAck: mutate("setWithLocalAck"), remove: mutate("remove"), startSync: scheduler.start, retrySync: scheduler.retry, stopSync: scheduler.stop, getSyncStatus: scheduler.getStatus, freezeWrites, assertWritesFrozen, resumeWrites: () => { frozen = false; } };
}
