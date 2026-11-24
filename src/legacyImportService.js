import { createLegacyImportBatch } from "./legacyImportPlan.js";

// This stages an immutable reviewed snapshot locally and never writes to the cloud.
export async function stageLegacyImport({ sourceStorage, storage, inspectAccount, isCurrentSession, owner, sourceRecords, destinations, selectedKeys, replaceKeys, backupId }) {
  if (!sourceStorage || typeof sourceStorage.get !== "function" || !storage || typeof storage.compareAndSetBatch !== "function" || sourceStorage === storage || typeof inspectAccount !== "function" || typeof isCurrentSession !== "function" || !Array.isArray(selectedKeys) || replaceKeys !== undefined && !Array.isArray(replaceKeys)) throw new Error("Invalid import configuration.");
  if (!isCurrentSession()) throw new Error("Storage session changed.");
  const selected = [...selectedKeys];
  const replacements = replaceKeys === undefined ? [] : [...replaceKeys];
  const reviewedSource = Object.fromEntries(selected.map((key) => [key, sourceRecords?.[key]]));
  let reviewedDestinations;
  try { reviewedDestinations = JSON.parse(JSON.stringify(destinations)); }
  catch { throw new Error("Account comparison is invalid."); }
  const batch = createLegacyImportBatch({ owner, sourceRecords: reviewedSource, destinations: reviewedDestinations, selectedKeys: selected, replaceKeys: replacements, backupId });
  const checkSource = async () => {
    for (const key of selected) {
      const current = await sourceStorage.get(key);
      if (!isCurrentSession()) throw new Error("Storage session changed.");
      if (current !== reviewedSource[key]) throw new Error("Browser data changed since the preview. Review it again.");
    }
  };
  await checkSource();
  for (const key of selected) {
    const current = await inspectAccount(key);
    if (!isCurrentSession()) throw new Error("Storage session changed.");
    const reviewed = reviewedDestinations[key];
    if (!current || current.remoteFound !== reviewed.remoteFound || current.remoteRevision !== reviewed.remoteRevision || current.remoteDeleted !== reviewed.remoteDeleted || current.remoteFound && JSON.stringify(current.remote) !== JSON.stringify(reviewed.remote)) throw new Error("Cloud data changed since the preview. Review it again.");
  }
  // The databases cannot share a transaction. Recheck just before commit and retain the exact reviewed source in recovery.
  await checkSource();
  if (!isCurrentSession()) throw new Error("Storage session changed.");
  await storage.compareAndSetBatch(batch);
  return { owner, backupId, staged: selected.length, sessionChanged: !isCurrentSession() };
}
