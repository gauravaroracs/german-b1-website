// getSyncState must read durable account state and return { pendingKeys, unfinished }.
// Every completed local mutation must call requestSync so in-flight edits are revisited.
export function createVersionedScheduler({ adapter, getSyncState, owner, isCurrentSession, onStatus = () => {} }) {
  if (!adapter || typeof adapter.sync !== "function" || typeof getSyncState !== "function" || typeof owner !== "string" || !owner || typeof isCurrentSession !== "function" || typeof onStatus !== "function") throw new Error("Invalid sync scheduler configuration.");
  let stopped = false;
  let paused = false;
  let running = null;
  let generation = 0;
  let status = { state: "idle" };
  const active = () => !stopped && Boolean(isCurrentSession(owner));
  const publish = (next) => {
    status = next;
    try { onStatus(next); } catch { /* A display callback must not change sync state. */ }
  };
  const readState = async () => {
    if (!active()) throw new Error("Storage session changed.");
    const snapshot = await getSyncState();
    if (!active()) throw new Error("Storage session changed.");
    if (!snapshot || !Array.isArray(snapshot.pendingKeys) || typeof snapshot.unfinished !== "boolean" || snapshot.pendingKeys.some((key) => typeof key !== "string" || !key) || new Set(snapshot.pendingKeys).size !== snapshot.pendingKeys.length) throw new Error("Invalid pending sync state.");
    const conflictedKeys = snapshot.conflictedKeys ?? [];
    if (!Array.isArray(conflictedKeys) || conflictedKeys.some((key) => typeof key !== "string" || !key) || new Set(conflictedKeys).size !== conflictedKeys.length) throw new Error("Invalid conflicted sync state.");
    return { pendingKeys: [...snapshot.pendingKeys].sort(), conflictedKeys: [...conflictedKeys].sort(), unfinished: snapshot.unfinished };
  };
  const run = () => {
    if (running) return running;
    if (stopped || paused) return Promise.resolve(status);
    running = Promise.resolve().then(async () => {
      publish({ state: "syncing" });
      try {
        let observed = generation;
        let snapshot = await readState();
        while (active()) {
          if (!snapshot.unfinished && !snapshot.pendingKeys.length) {
            if (generation !== observed) { observed = generation; snapshot = await readState(); continue; }
            if (snapshot.conflictedKeys.length) { paused = true; publish({ state: "conflict", keys: snapshot.conflictedKeys }); return status; }
            publish({ state: "idle" });
            if (generation !== observed) { publish({ state: "syncing" }); observed = generation; snapshot = await readState(); continue; }
            return status;
          }
          const before = generation;
          const result = await adapter.sync(snapshot.unfinished ? [] : snapshot.pendingKeys.slice(0, 64));
          if (!active()) throw new Error("Storage session changed.");
          if (result?.status === "conflict") { paused = true; publish({ state: "conflict", conflict: result }); return status; }
          if (result?.status !== "synced" && result?.status !== "reconciled") throw new Error("Invalid sync result.");
          const beforeRead = generation;
          const next = await readState();
          if (generation === before && JSON.stringify(next) === JSON.stringify(snapshot)) throw new Error("Sync made no local progress. Review pending changes before retrying.");
          observed = beforeRead;
          snapshot = next;
        }
        throw new Error("Storage session changed.");
      } catch (error) {
        if (stopped) publish({ state: "stopped" });
        else { paused = true; publish({ state: "error", message: error?.message || "Sync failed." }); }
      }
      return status;
    }).finally(() => { running = null; });
    return running;
  };
  return {
    start: run,
    requestSync() { generation += 1; return run(); },
    retry() { if (!stopped) paused = false; return run(); },
    stop() { stopped = true; publish({ state: "stopped" }); },
    getStatus: () => status,
  };
}
