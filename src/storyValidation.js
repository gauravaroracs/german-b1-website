const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

export function validateGeneratedStory(value) {
  if (!value || !nonempty(value.title) || !nonempty(value.category) || !nonempty(value.text) || !nonempty(value.nextPrompt) || !nonempty(value.modelContinuation) || !Array.isArray(value.words) || !Array.isArray(value.questions) || !value.questions.length) return null;
  if (value.questions.length > 4) return null;
  if (value.words.some((item) => !item || !nonempty(item.word) || !nonempty(item.meaning))) return null;
  if (value.questions.some((item) => !item || !nonempty(item.q) || !Array.isArray(item.options) || item.options.length < 2 || item.options.some((option) => !nonempty(option)) || !nonempty(item.answer) || !item.options.includes(item.answer))) return null;
  return {
    title: value.title,
    category: value.category,
    text: value.text,
    translation: nonempty(value.translation) ? value.translation.trim() : "",
    words: value.words.map(({ word, meaning, lemma, artikel, plural, wordType, cefrLevel, forms }) => ({
      word,
      meaning,
      ...(nonempty(lemma) ? { lemma: lemma.trim() } : {}),
      ...(nonempty(artikel) ? { artikel: artikel.trim() } : {}),
      ...(nonempty(plural) ? { plural: plural.trim() } : {}),
      ...(nonempty(wordType) ? { wordType: wordType.trim() } : {}),
      ...(nonempty(cefrLevel) && /^(A[12]|B[12]|C[12])$/.test(cefrLevel.trim()) ? { cefrLevel: cefrLevel.trim() } : {}),
      ...(forms && typeof forms === "object" && !Array.isArray(forms) ? { forms: Object.fromEntries(Object.entries(forms).filter(([, form]) => nonempty(form)).map(([key, form]) => [key, form.trim()])) } : {}),
    })),
    questions: value.questions.map(({ q, options, answer }) => ({ q, options, answer })),
    nextPrompt: value.nextPrompt,
    modelContinuation: value.modelContinuation,
  };
}

export function validStoryCorrection(text, corrections) {
  if (typeof text !== "string" || !text.includes("---CORRECTIONS---") || !text.includes("---END---")) return false;
  const body = text.split("---CORRECTIONS---")[1].split("---END---")[0].trim();
  return body === "NONE" || (Array.isArray(corrections) && corrections.length > 0 && corrections.every((item) => nonempty(item.MISTAKE) && nonempty(item.CORRECT) && nonempty(item.WHY)));
}
