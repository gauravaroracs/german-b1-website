const sentenceKey = (text) => (typeof text === "string" ? text.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de") : "");

export const isWritingPatternKept = (sentences, pattern) => sentences.some((item) => item.writingPattern && sentenceKey(item.german) === sentenceKey(pattern.german));

export function keepWritingPattern(sentences, pattern, exercise, today, id) {
  const key = sentenceKey(pattern.german);
  if (!key) return sentences;
  const index = sentences.findIndex((item) => sentenceKey(item.german) === key);
  if (index >= 0) {
    if (sentences[index].writingPattern) return sentences;
    return sentences.map((item, position) => position === index ? { ...item, writingPattern: true } : item);
  }
  return [...sentences, {
    id, german: pattern.german, translation: pattern.english,
    scenario: `Writing · ${exercise.title}`, writingPattern: true,
    reviewEligible: true, createdAt: today, srsDue: today, srsReps: 0, srsLapses: 0,
  }];
}
