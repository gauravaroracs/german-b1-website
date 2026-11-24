const stringValue = (value) => typeof value === 'string' ? value : '';

export function validateSentenceAnalysis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !stringValue(value.meaning).trim() || !stringValue(value.translation).trim() || !Array.isArray(value.chunks) || !Array.isArray(value.tokens) || !Array.isArray(value.contexts)) return null;
  const chunks = value.chunks.filter((item) => item && typeof item === 'object' && stringValue(item.text).trim()).map((item) => ({ text: item.text, role: stringValue(item.role), gloss: stringValue(item.gloss) }));
  const tokens = value.tokens.filter((item) => item && typeof item === 'object' && stringValue(item.surface).trim()).map((item) => ({ surface: item.surface, lemma: stringValue(item.lemma), translation: stringValue(item.translation), artikel: stringValue(item.artikel), type: stringValue(item.type), level: stringValue(item.level), pronunciation: stringValue(item.pronunciation), memoryTip: stringValue(item.memoryTip) }));
  if (!chunks.length || !tokens.length) return null;
  const contexts = value.contexts.filter((item) => item && typeof item === 'object' && stringValue(item.german).trim() && stringValue(item.translation).trim()).slice(0, 2).map((item) => ({ german: item.german, translation: item.translation }));
  return { expressionType: stringValue(value.expressionType), level: stringValue(value.level), meaning: value.meaning, translation: value.translation, whenToSay: stringValue(value.whenToSay), memoryTip: stringValue(value.memoryTip), wordOrder: stringValue(value.wordOrder), followUp: stringValue(value.followUp), chunks, tokens, contexts };
}
