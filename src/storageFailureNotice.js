export function withStorageFailureNotice(storage, reportFailure) {
  const wrapped = { ...storage };
  for (const method of ["get", "set", "setWithLocalAck", "remove"]) {
    wrapped[method] = async (...args) => {
      try { return await storage[method](...args); }
      catch (error) {
        if (error?.message !== "Storage session changed.") reportFailure();
        throw error;
      }
    };
  }
  return wrapped;
}
