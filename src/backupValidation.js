const OBJECT_FIELDS = ["streakData", "blockData", "ankiLog", "grammarProgress", "speakingLog", "storyProgress", "storySession", "missionProgress", "grammarSession", "timerState", "thinkState", "freqKnown", "freqReviewProgress", "vocabReviewPreferences", "frequencyAdventureProgress"];
const ARRAY_FIELDS = ["vocabWords", "storedStories", "dangerList", "chatHistory", "practiceMessages", "savedSentences", "sentenceExplanations", "keptExamples", "grammarLessons"];
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hasText = (value) => typeof value === "string" && Boolean(value.trim());
const validPracticeMessage = (message) => {
  if (!isObject(message)) return false;
  if (message.role === "user") return typeof message.text === "string";
  if (message.role === "assistant") return isObject(message.turn) && typeof message.turn.reply === "string" && (message.turn.corrections === undefined || Array.isArray(message.turn.corrections) && message.turn.corrections.every((correction) => isObject(correction) && typeof correction.category === "string" && typeof correction.corrected === "string" && typeof correction.explanation === "string"));
  if (message.role === "__practice_history__") return Array.isArray(message.conversations) && message.conversations.every((conversation) => isObject(conversation) && Array.isArray(conversation.messages) && conversation.messages.every((item) => isObject(item) && item.role !== "__practice_history__" && validPracticeMessage(item)));
  return false;
};

export function validateBackupData(data) {
  if (!isObject(data)) throw new Error("The backup must contain a data object.");
  const fields = [...OBJECT_FIELDS, ...ARRAY_FIELDS, "practiceScenario", "practiceDraft", "frequencyAdventureSession"];
  if (!fields.some((field) => Object.hasOwn(data, field))) throw new Error("No recognized learning data was found in this backup.");
  for (const field of OBJECT_FIELDS) if (Object.hasOwn(data, field) && !isObject(data[field])) throw new Error(`Invalid backup field: ${field}.`);
  for (const field of ARRAY_FIELDS) if (Object.hasOwn(data, field) && (!Array.isArray(data[field]) || data[field].some((item) => !isObject(item)))) throw new Error(`Invalid backup field: ${field}.`);
  if (data.vocabWords?.some((item) => typeof (item.word || item.lemma) !== "string" || !(item.word || item.lemma).trim())) throw new Error("Invalid backup field: vocabWords contains a word without text.");
  if (data.savedSentences?.some((item) => typeof item.german !== "string" || !item.german.trim())) throw new Error("Invalid backup field: savedSentences contains a sentence without German text.");
  if (data.storedStories?.some((story) => !hasText(story.id) || !hasText(story.title) || !hasText(story.text) || !Array.isArray(story.questions) || story.questions.some((question) => !isObject(question) || !hasText(question.q) || !Array.isArray(question.options) || question.options.some((option) => typeof option !== "string") || typeof question.answer !== "string") || story.words !== undefined && (!Array.isArray(story.words) || story.words.some((word) => !isObject(word) || !hasText(word.word))))) throw new Error("Invalid backup field: storedStories contains an incomplete story.");
  if (data.practiceMessages?.some((message) => !validPracticeMessage(message))) throw new Error("Invalid backup field: practiceMessages contains an incomplete conversation.");
  if (Object.hasOwn(data, "practiceScenario") && data.practiceScenario !== null && typeof data.practiceScenario !== "string") throw new Error("Invalid backup field: practiceScenario.");
  if (Object.hasOwn(data, "practiceDraft") && typeof data.practiceDraft !== "string") throw new Error("Invalid backup field: practiceDraft.");
  if (Object.hasOwn(data, "frequencyAdventureSession") && data.frequencyAdventureSession !== null && !isObject(data.frequencyAdventureSession)) throw new Error("Invalid backup field: frequencyAdventureSession.");
  return data;
}
