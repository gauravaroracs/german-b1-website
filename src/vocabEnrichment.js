const text = (value) => typeof value === "string" ? value.trim() : "";

export function mergeVocabEnrichment(word, generated) {
  const tip = text(generated.memoryTip);
  const type = text(generated.wordType);
  const forms = Object.fromEntries(Object.entries(generated.forms || {}).filter(([, value]) => text(value)));
  if (!tip || !type || (type === "verb" && !Object.keys(forms).length) || (type === "noun" && !text(generated.artikel))) {
    throw new Error("Incomplete grammar or memory tip returned. Try again.");
  }
  const oldTip = text(word.memoryTip);
  const isFallback = !oldTip || /^Picture (this example:|“.*” in a familiar everyday scene)/.test(oldTip);
  const mergedForms = { ...forms, ...(word.forms || {}) };
  return {
    ...word,
    wordType: type,
    artikel: word.artikel || generated.artikel || null,
    plural: word.plural || generated.plural || null,
    forms: Object.keys(mergedForms).length ? mergedForms : null,
    memoryTip: isFallback ? tip : oldTip,
    enrichmentVersion: 1,
  };
}
