import { validateBackupData } from "./backupValidation.js";

// The browser-only namespace contains additional settings and secrets; only these learning keys are eligible.
export const LEGACY_LEARNING_FIELDS = Object.freeze({
  "streak-data": ["streakData", "Streak days"],
  "daily-blocks": ["blockData", "Daily practice"],
  "anki-log": ["ankiLog", "Anki history"],
  "grammar-progress": ["grammarProgress", "Grammar progress"],
  "vocab-words": ["vocabWords", "Vocabulary"],
  "frequency-adventure-progress": ["frequencyAdventureProgress", "Adventure progress"],
  "frequency-adventure-session": ["frequencyAdventureSession", "Adventure session"],
  "speaking-log": ["speakingLog", "Speaking history"],
  "story-progress": ["storyProgress", "Story progress"],
  "chat-history": ["chatHistory", "Chat history"],
  "practice-messages": ["practiceMessages", "Practice conversations"],
  "practice-scenario": ["practiceScenario", "Practice scenario"],
  "practice-draft": ["practiceDraft", "Practice draft"],
  "saved-sentences": ["savedSentences", "Saved sentences"],
  "sentence-explanations": ["sentenceExplanations", "Sentence explanations"],
  "kept-examples": ["keptExamples", "Kept examples"],
  "grammar-lessons": ["grammarLessons", "Grammar lessons"],
  "grammar-session": ["grammarSession", "Grammar session"],
  "daily-timers": ["timerState", "Daily timers"],
  "think-state": ["thinkState", "Writing and thoughts"],
  "stories-list": ["storedStories", "Stories"],
  "story-session": ["storySession", "Story session"],
  "mission-progress": ["missionProgress", "Mission progress"],
  "danger-list": ["dangerList", "Review list"],
  "freq-known": ["freqKnown", "Known frequent words"],
  "freq-review-progress": ["freqReviewProgress", "Frequent-word reviews"],
  "vocab-review-preferences": ["vocabReviewPreferences", "Review preferences"],
});

const countItems = (value) => Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : value === null || value === "" ? 0 : 1;

/** Preview known raw SQLite keys without writing or exposing excluded values. */
export function previewLegacyRecords(records) {
  if (!records || typeof records !== "object" || Array.isArray(records)) throw new Error("Legacy records must be an object.");
  const snapshot = {};
  const entries = [];
  const errors = [];
  const unknownKeys = Object.keys(records).filter((key) => !Object.hasOwn(LEGACY_LEARNING_FIELDS, key) && key !== "openai-api-key");
  for (const [key, [field, label]] of Object.entries(LEGACY_LEARNING_FIELDS)) {
    if (!Object.hasOwn(records, key) || records[key] === undefined) continue;
    try {
      const value = typeof records[key] === "string" ? JSON.parse(records[key]) : records[key];
      validateBackupData({ [field]: value });
      snapshot[field] = value;
      entries.push({ key, field, label, count: countItems(value) });
    } catch {
      errors.push({ key, label, message: "This stored item could not be validated." });
    }
  }
  return { snapshot, entries, errors, unknownKeys };
}

/** SQLite's get API does not enumerate keys; only the explicit allowlist is read. */
export async function readLegacyPreview(storage) {
  const records = {};
  for (const key of Object.keys(LEGACY_LEARNING_FIELDS)) {
    const value = await storage.get(key);
    if (value !== undefined && value !== null) records[key] = value;
  }
  const preview = previewLegacyRecords(records);
  return { ...preview, rawRecords: Object.fromEntries(preview.entries.map((entry) => [entry.key, records[entry.key]])) };
}

/** Read destination presence without changing either copy. Treat pending or divergent data as needing review. */
export async function compareLegacyDestination(preview, inspectAccount, capture = () => {}) {
  const entries = [];
  for (const entry of preview.entries) {
    const destination = await inspectAccount(entry.key);
    capture(entry.key, destination);
    const source = preview.snapshot[entry.field];
    const localPresent = Boolean(destination.local && !destination.local.deleted);
    const pending = Boolean(destination.local?.pending);
    const sameLocal = localPresent && JSON.stringify(destination.local.value) === JSON.stringify(source);
    const sameRemote = destination.remoteFound && !destination.remoteDeleted && JSON.stringify(destination.remote) === JSON.stringify(source);
    let status = "empty";
    if (pending) status = "pending";
    else if (localPresent || destination.remoteFound) {
      status = (!localPresent || sameLocal) && (!destination.remoteFound || sameRemote) ? "same" : "different";
    }
    entries.push({ ...entry, destination: status });
  }
  return { ...preview, entries };
}
