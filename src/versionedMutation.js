// Versioned records require a known server revision; callers must obtain it before editing.
export function editVersionedRecord(record, { mutationId, deleted, value }) {
  if (!record || typeof record !== "object" || Array.isArray(record) || !Number.isSafeInteger(record.baseRevision) || record.baseRevision < 0 || typeof record.pending !== "boolean" || typeof record.deleted !== "boolean" || !Object.hasOwn(record, "value")) throw new Error("A versioned account record is required.");
  if (typeof mutationId !== "string" || !mutationId || mutationId === record.mutationId || mutationId === record.inFlight?.mutationId || typeof deleted !== "boolean" || (!deleted && value === undefined)) throw new Error("A new mutation identifier and value are required.");
  if (record.inFlight && (!record.pending || typeof record.inFlight.requestId !== "string" || !record.inFlight.requestId || typeof record.inFlight.mutationId !== "string" || !record.inFlight.mutationId)) throw new Error("The in-flight state is invalid.");
  return { ...record, pending: true, deleted, value: deleted ? null : value, mutationId };
}
