const finiteVerb = /^(bin|bist|ist|sind|seid|war|warst|waren|wart|habe|hast|hat|haben|habt|wurde|wirst|wird|werden|kann|kannst|können|könnt|muss|musst|müssen|müsst|will|willst|wollen|wollt|soll|sollst|sollen|sollt|darf|darfst|dürfen|dürft|bleibt|bleiben|geht|gehe|gehst|gehen|kommt|komme|kommst|machen|macht|mache|lerne|lernt|lernen|lernst|arbeitet|arbeite|arbeiten|schläft|schlafe|schlafen|sagt|sage|sagen|fragt|frage|fragen|denkt|denke|denken|findet|finde|finden|fühlt|fühle|fühlen|passiert|passieren|gibt|gebe|geben|braucht|brauche|brauchen|möchte|möchtest|möchten)$/iu;

// shortcut: heuristics cannot reliably distinguish every sentence from a phrase; offer users an explicit choice.
function looksLikeSentence(text) {
  if (/[.!?;:]/u.test(text)) return true;
  const tokens = text.split(/\s+/u).filter(Boolean).map((word) => word.replace(/[^\p{L}]/gu, ""));
  if (tokens.length < 2) return false;
  const personalSubject = /^(ich|du|er|sie|es|wir|ihr|man)$/iu;
  const startsLikeSentence = /^(ich|du|er|sie|es|wir|ihr|man|vielleicht|heute|gestern|morgen|danach|deshalb|trotzdem|das|der|die|ein|eine|wie|wann|wo|warum|obwohl|weil)$/iu;
  if (tokens.some((token) => finiteVerb.test(token)) && (startsLikeSentence.test(tokens[0]) || tokens.length >= 4)) return true;
  return personalSubject.test(tokens[0]) && /(?:e|st|t|en)$/iu.test(tokens[1]);
}

export function classifyVocabInput(value = "") {
  const text = value.trim();
  if (!text) return "empty";
  const parts = text.split(/[,\n\r]+/u).map((part) => part.trim()).filter(Boolean);
  if (parts.some(looksLikeSentence)) return "sentence";
  if (parts.length > 1) return "list";
  return looksLikeSentence(text) ? "sentence" : "word";
}

export function parseVocabList(value = "") {
  if (classifyVocabInput(value) !== "list") return [];
  return parseSeparatedItems(value);
}

export function parseSeparatedItems(value = "") {
  return value.split(/[,\n\r]+/u).map((part) => part.trim()).filter(Boolean);
}

export function splitSentences(value = "") {
  const text = value.trim();
  if (!text) return [];
  if (typeof Intl.Segmenter !== "function") return [text];
  return Array.from(new Intl.Segmenter("de", { granularity: "sentence" }).segment(text), (part) => part.segment.trim()).filter(Boolean);
}
