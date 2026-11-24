// A personal key is browser-local and must never be passed to the cloud adapter.
export function withLocalApiKey(versioned, local, isCurrentSession) {
  if (!versioned || !local || typeof isCurrentSession !== "function") throw new Error("Invalid storage configuration.");
  const check = () => { if (!isCurrentSession()) throw new Error("Storage session changed."); };
  const handle = (method) => async (key, ...args) => {
    check();
    if (key !== "openai-api-key") return versioned[method](key, ...args);
    let result;
    if (method === "get") {
      const raw = await local.get(key);
      result = raw == null ? args[0] : JSON.parse(raw);
    } else if (method === "remove") {
      result = await local.remove(key);
    } else {
      result = await local.set(key, JSON.stringify(args[0]));
    }
    check();
    return result;
  };
  return { ...versioned, get: handle("get"), set: handle("set"), setWithLocalAck: handle("setWithLocalAck"), remove: handle("remove") };
}
