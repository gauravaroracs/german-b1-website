/**
 * Pure vocabulary-review helpers. Callers own all React and persistence state.
 */

export const RECALL_DIRECTIONS = Object.freeze({
  GERMAN_TO_MEANING: "german-to-meaning",
  CUE_TO_GERMAN: "cue-to-german",
});

const ARTICLES = new Set(["der", "die", "das"]);
const RATING_NAMES = ["Again", "Hard", "Good", "Easy"];

/** Normalize presentation differences while keeping the complete answer intact. */
export function normalizeRecallText(value = "") {
  return String(value)
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[.!?…]+$/u, "")
    .trim();
}

const uniqueAnswers = (answers) => Array.from(new Set(
  answers.map((answer) => String(answer || "").trim()).filter(Boolean),
));

const germanAnswerFor = (word, artikel) => {
  const cleanWord = String(word || "").trim();
  const normalizedWord = normalizeRecallText(cleanWord);
  const wordAlreadyHasArticle = /^(der|die|das)\s+/u.test(normalizedWord);
  return artikel && !wordAlreadyHasArticle ? `${artikel} ${cleanWord}` : cleanWord;
};

const contextFor = (card, variation) => {
  const contexts = Array.isArray(card?.contexts)
    ? card.contexts.filter((context) => context?.sentence || context?.translation)
    : [];
  if (!contexts.length) return null;
  const index = Math.abs(Number(variation) || 0) % contexts.length;
  return contexts[index];
};

const clozeTarget = (sentence, target) => {
  if (!sentence || !target) return "";
  const bareTarget = String(target).replace(/^(der|die|das)\s+/iu, "");
  const escaped = bareTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const targetPattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu");
  return String(sentence).replace(targetPattern, (_, prefix) => `${prefix}_____`);
};

/**
 * Build one challenge in either direction. Explicit accepted-answer arrays may be
 * stored as acceptedTranslations or acceptedGermanAnswers on the vocabulary item.
 */
export function createRecallChallenge(card = {}, direction = RECALL_DIRECTIONS.GERMAN_TO_MEANING, options = {}) {
  if (!Object.values(RECALL_DIRECTIONS).includes(direction)) {
    throw new RangeError(`Unknown recall direction: ${direction}`);
  }

  const storedArtikel = normalizeRecallText(card.artikel);
  const wordArtikel = normalizeRecallText(card.word).match(/^(der|die|das)\s+/u)?.[1] || "";
  const artikel = ARTICLES.has(storedArtikel) ? storedArtikel : wordArtikel;
  const requiresArticle = direction === RECALL_DIRECTIONS.CUE_TO_GERMAN && Boolean(artikel);
  const variation = options.variation ?? card.srsLapses ?? 0;
  const context = contextFor(card, variation);

  if (direction === RECALL_DIRECTIONS.GERMAN_TO_MEANING) {
    const acceptedAnswers = uniqueAnswers([
      card.translation,
      ...(Array.isArray(card.acceptedTranslations) ? card.acceptedTranslations : []),
      ...(Array.isArray(options.acceptedAnswers) ? options.acceptedAnswers : []),
    ]);
    return {
      direction,
      prompt: germanAnswerFor(card.word, artikel),
      expectedAnswer: acceptedAnswers[0] || "",
      acceptedAnswers,
      requiresArticle: false,
      context: context ? { ...context } : null,
      clozeSentence: "",
    };
  }

  const germanAnswers = [
    card.word,
    ...(Array.isArray(card.acceptedGermanAnswers) ? card.acceptedGermanAnswers : []),
    ...(Array.isArray(options.acceptedAnswers) ? options.acceptedAnswers : []),
  ].map((answer) => germanAnswerFor(answer, requiresArticle ? artikel : ""));
  const acceptedAnswers = uniqueAnswers(germanAnswers);

  return {
    direction,
    prompt: String(card.translation || context?.translation || "").trim(),
    expectedAnswer: acceptedAnswers[0] || "",
    acceptedAnswers,
    requiresArticle,
    context: context ? { ...context } : null,
    clozeSentence: clozeTarget(context?.sentence, String(card.word || "").replace(/(?:\s*\.{3}|…)+$/u, "").trim()),
  };
}

/** Compare the entire normalized response; substrings and extra words never pass. */
export function checkRecallAnswer(answer, challenge) {
  const normalizedAnswer = normalizeRecallText(answer);
  const normalizedExpected = uniqueAnswers(challenge?.acceptedAnswers || [challenge?.expectedAnswer])
    .map(normalizeRecallText)
    .filter(Boolean);
  const expectedAnswer = challenge?.expectedAnswer || challenge?.acceptedAnswers?.[0] || "";
  const bareExpected = challenge?.requiresArticle
    ? normalizedExpected.map((expected) => expected.replace(/^(der|die|das)\s+/u, ""))
    : [];

  return {
    correct: Boolean(normalizedAnswer) && normalizedExpected.includes(normalizedAnswer),
    missingArticle: Boolean(challenge?.requiresArticle && normalizedAnswer && bareExpected.includes(normalizedAnswer)),
    normalizedAnswer,
    expectedAnswer,
  };
}

const clampEase = (ease) => Math.max(1.3, Number.isFinite(Number(ease)) ? Number(ease) : 2.5);
const positiveNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const parseDateKey = (key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!match) throw new TypeError("today must use YYYY-MM-DD format");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
    throw new RangeError(`Invalid review date: ${key}`);
  }
  return date;
};

const dateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const addDaysKey = (key, days) => {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + Math.max(1, Math.round(days)));
  return dateKey(date);
};

const ratingIndex = (rating) => {
  if (Number.isInteger(rating) && rating >= 0 && rating <= 3) return rating;
  const index = RATING_NAMES.findIndex((name) => name.toLowerCase() === String(rating).toLowerCase());
  if (index < 0) throw new RangeError(`Unknown review rating: ${rating}`);
  return index;
};

/**
 * Return fields that can be spread onto the existing vocabulary item. “Again” is
 * due tomorrow even when it is also retried once in the current session.
 */
export function scheduleReview(card = {}, rating, today) {
  const grade = ratingIndex(rating);
  let srsInterval = positiveNumber(card.srsInterval ?? card.interval, 1);
  let srsEase = clampEase(card.srsEase ?? card.easeFactor);
  let srsReps = Math.max(0, Number(card.srsReps ?? card.repetitions) || 0);
  let srsLapses = Math.max(0, Number(card.srsLapses) || 0);

  if (grade === 0) {
    srsInterval = 1;
    srsEase = clampEase(srsEase - 0.2);
    srsReps = 0;
    srsLapses += 1;
  } else if (grade === 1) {
    srsInterval = Math.max(1, Math.round(srsInterval * 1.2));
    srsEase = clampEase(srsEase - 0.15);
    srsReps += 1;
  } else if (grade === 2) {
    srsInterval = srsReps === 0 ? 1 : srsReps === 1 ? 6 : Math.max(1, Math.round(srsInterval * srsEase));
    srsReps += 1;
  } else {
    srsInterval = Math.max(1, Math.round(srsInterval * srsEase * 1.3));
    srsEase = clampEase(srsEase + 0.15);
    srsReps += 1;
  }

  return {
    srsInterval,
    srsDue: addDaysKey(today, srsInterval),
    srsEase: Number(srsEase.toFixed(2)),
    srsReps,
    srsLapses,
    srsLastReviewed: today,
    srsLastRating: RATING_NAMES[grade],
  };
}

/**
 * Insert an “Again” card after other cards, at most once per session by default.
 * Pass the card's prior session again count; an empty queue is never made to loop.
 */
export function requeueMissedCard(remainingDeck = [], card, options = {}) {
  const minGap = Math.max(1, Math.round(options.minGap ?? 3));
  const againCount = Math.max(0, Math.round(options.againCount ?? 0));
  const maxRequeues = Math.max(0, Math.round(options.maxRequeues ?? 1));
  const withoutCard = remainingDeck.filter((candidate) => (
    card?.id ? candidate?.id !== card.id : candidate !== card
  ));

  if (!card || !withoutCard.length || againCount >= maxRequeues) return [...withoutCard];

  const insertAt = Math.min(minGap, withoutCard.length);
  return [
    ...withoutCard.slice(0, insertAt),
    card,
    ...withoutCard.slice(insertAt),
  ];
}
