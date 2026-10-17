/**
 * Pure learning engine for 1,000 Words Adventure.
 *
 * Callers supply timestamps and persist the returned plain objects. The engine
 * does not read the clock, browser APIs, React state, or storage.
 */

export const ADVENTURE_SCHEMA_VERSION = 1;

export const ADVENTURE_QUESTION_TYPES = Object.freeze({
  SENTENCE_MEANING: "sentence-meaning",
  MEANING_RECALL: "meaning-recall",
  GERMAN_RECALL: "german-recall",
  CLOZE: "cloze",
  COMPOUND_ASSEMBLY: "compound-assembly",
  AUDIO_RECOGNITION: "audio-recognition",
  FINAL_SCENE: "final-scene",
});

export const ADVENTURE_WORD_STATES = Object.freeze({
  NEW: "new",
  ENCOUNTERED: "encountered",
  PRACTISED: "practised",
  RECALLED: "recalled-independently",
  DUE: "due-for-review",
  REMEMBERED: "remembered-across-sessions",
});

const ARTICLES = new Set(["der", "die", "das"]);
const DEFAULT_OPTIONS = Object.freeze({
  batchSize: 2,
  finalWordCount: 3,
  maxDueReviews: 5,
  minRetryGap: 3,
  minRevealGap: 3,
  audioAvailable: false,
  independentRecallPoints: 10,
  finalRecallPoints: 15,
  missionCompletionPoints: 50,
});

const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);

const uniqueStrings = (values) => Array.from(new Set(
  values
    .flatMap(asArray)
    .filter((value) => typeof value === "string" || typeof value === "number")
    .map((value) => String(value).trim())
    .filter(Boolean),
));

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

const requiredText = (value, label) => {
  const text = String(value ?? "").trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
};

const isoTime = (value, label = "now") => {
  const text = requiredText(value, label);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${label} must be a valid date or ISO timestamp`);
  return date.toISOString();
};

const addDays = (iso, days) => {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + Math.max(0, Math.round(days)));
  return date.toISOString();
};

const mergeOptions = (options = {}) => ({ ...DEFAULT_OPTIONS, ...options });

/**
 * Normalize an answer without changing its meaning. German mode also treats
 * ae/oe/ue and ss as keyboard equivalents of umlauts and ß.
 */
export function normalizeAdventureAnswer(value = "", options = {}) {
  const text = Array.isArray(value) ? value.join(" ") : String(value ?? "");
  let normalized = text
    .normalize("NFKC")
    .toLocaleLowerCase(options.language === "de" ? "de-DE" : "en")
    .replace(/[\u2018\u2019\u201A\u201B]/gu, "'")
    .replace(/[\u2010-\u2015]/gu, "-")
    .replace(/[^\p{L}\p{N}'-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (options.language === "de") {
    normalized = normalized
      .replace(/ä/gu, "ae")
      .replace(/ö/gu, "oe")
      .replace(/ü/gu, "ue")
      .replace(/ß/gu, "ss");
  }

  return normalized;
}

const stripArticle = (value) => value.replace(/^(der|die|das)\s+/u, "");
const articleOf = (value) => value.match(/^(der|die|das)\s+/u)?.[1] || "";
const stripInfinitiveTo = (value) => value.replace(/^to\s+/u, "").trim();
const stripParenthetical = (value) => value.replace(/\s*\([^)]*\)\s*/gu, " ").replace(/\s+/gu, " ").trim();

/** Expand a stored English gloss into exact, safely gradable alternatives. */
export function meaningAnswerOptions(word = {}, extra = []) {
  const raw = uniqueStrings([
    word.meaning,
    word.translation,
    word.acceptedMeanings,
    word.acceptedEnglish,
    word.alternateMeanings,
    word.meaningAlternatives,
    word.meanings,
    word.acceptedTranslations,
    extra,
  ]);
  const expanded = [];

  raw.forEach((meaning) => {
    const pieces = meaning.split(/\s*(?:\/|;|,|\bor\b)\s*/iu).filter(Boolean);
    [meaning, ...pieces].forEach((candidate) => {
      expanded.push(candidate);
      const withoutParenthetical = stripParenthetical(candidate);
      if (withoutParenthetical && withoutParenthetical !== candidate) expanded.push(withoutParenthetical);
      const withoutTo = stripInfinitiveTo(candidate);
      if (withoutTo && withoutTo !== candidate) expanded.push(withoutTo);
    });
  });

  return uniqueStrings(expanded);
}

const wordArticle = (word = {}) => {
  const stored = normalizeAdventureAnswer(word.article ?? word.artikel, { language: "de" });
  if (ARTICLES.has(stored)) return stored;
  const prefixed = articleOf(normalizeAdventureAnswer(word.word, { language: "de" }));
  return ARTICLES.has(prefixed) ? prefixed : "";
};

/** Build accepted German forms, adding an article only when explicitly required. */
export function germanAnswerOptions(word = {}, requiresArticle = false, extra = []) {
  const article = wordArticle(word);
  const base = uniqueStrings([
    word.word,
    word.acceptedGermanAnswers,
    word.acceptedGerman,
    word.germanAnswers,
    word.alternateGerman,
    word.inflectedForms,
    Array.isArray(word.forms) ? word.forms : [],
    extra,
  ]);

  return uniqueStrings(base.map((answer) => {
    if (!requiresArticle || !article) return answer;
    const normalized = normalizeAdventureAnswer(answer, { language: "de" });
    return articleOf(normalized) ? answer : `${article} ${answer}`;
  }));
}

const answerForms = (answers, language, requiresArticle) => uniqueStrings(answers).map((answer) => {
  const normalized = normalizeAdventureAnswer(answer, { language });
  return {
    source: answer,
    normalized,
    article: requiresArticle ? articleOf(normalized) : "",
    bare: requiresArticle ? stripArticle(normalized) : normalized,
  };
}).filter((answer) => answer.normalized);

const comparisonVariants = (value) => new Set([
  value,
  value.replace(/['-]/gu, ""),
  value.replace(/['-]/gu, " ").replace(/\s+/gu, " ").trim(),
]);

const sameNormalizedAnswer = (left, right) => {
  const leftVariants = comparisonVariants(left);
  return [...comparisonVariants(right)].some((variant) => leftVariants.has(variant));
};

/**
 * Grade one constrained answer. The comparison is exact after presentation
 * normalization; it never relies on substring or fuzzy matching.
 */
export function evaluateAdventureAnswer(answer, question = {}) {
  const language = question.answerLanguage === "de" ? "de" : "en";
  const requiresArticle = Boolean(question.requiresArticle);
  const submitted = normalizeAdventureAnswer(answer, { language });
  const accepted = answerForms(
    question.acceptedAnswers?.length ? question.acceptedAnswers : [question.expectedAnswer],
    language,
    requiresArticle,
  );
  const expectedAnswer = question.expectedAnswer || accepted[0]?.source || "";

  if (!submitted) {
    return {
      correct: false,
      status: "empty",
      normalizedAnswer: submitted,
      expectedAnswer,
      feedback: "No answer was entered. Review the answer, then try this word again later.",
    };
  }

  if (question.type === ADVENTURE_QUESTION_TYPES.COMPOUND_ASSEMBLY) {
    const compact = submitted.replace(/[\s'-]+/gu, "");
    const correct = accepted.some((candidate) => candidate.normalized.replace(/[\s'-]+/gu, "") === compact);
    return {
      correct,
      status: correct ? "correct" : "incorrect",
      normalizedAnswer: submitted,
      expectedAnswer,
      feedback: correct
        ? "Correct. The supplied parts form the complete compound."
        : `Not quite. The complete compound is ${expectedAnswer}.`,
    };
  }

  if (requiresArticle) {
    const submittedArticle = articleOf(submitted);
    const submittedBare = stripArticle(submitted);
    const exact = accepted.some((candidate) => sameNormalizedAnswer(candidate.normalized, submitted));
    if (exact) {
      return {
        correct: true,
        status: "correct",
        normalizedAnswer: submitted,
        expectedAnswer,
        feedback: "Correct, including the noun's article.",
      };
    }

    const sameNoun = accepted.find((candidate) => sameNormalizedAnswer(candidate.bare, submittedBare));
    if (sameNoun && !submittedArticle) {
      return {
        correct: false,
        status: "missing-article",
        missingArticle: true,
        normalizedAnswer: submitted,
        expectedAnswer,
        expectedArticle: sameNoun.article,
        feedback: `The noun is right, but this question also asks for the article: ${expectedAnswer}.`,
      };
    }
    if (sameNoun && submittedArticle !== sameNoun.article) {
      return {
        correct: false,
        status: "wrong-article",
        wrongArticle: true,
        normalizedAnswer: submitted,
        expectedAnswer,
        expectedArticle: sameNoun.article,
        submittedArticle,
        feedback: `The noun is right, but the article is ${sameNoun.article}: ${expectedAnswer}.`,
      };
    }
  } else {
    const submittedWithoutOptionalArticle = language === "de" ? stripArticle(submitted) : submitted;
    const correct = accepted.some((candidate) => {
      const candidateWithoutOptionalArticle = language === "de"
        ? stripArticle(candidate.normalized)
        : candidate.normalized;
      return sameNormalizedAnswer(candidateWithoutOptionalArticle, submittedWithoutOptionalArticle);
    });
    if (correct) {
      return {
        correct: true,
        status: "correct",
        normalizedAnswer: submitted,
        expectedAnswer,
        feedback: "Correct.",
      };
    }
  }

  return {
    correct: false,
    status: "incorrect",
    normalizedAnswer: submitted,
    expectedAnswer,
    feedback: `Not quite. A correct answer is ${expectedAnswer}.`,
  };
}

const revealFor = (word) => ({
  wordId: word.id,
  word: word.word,
  article: wordArticle(word),
  partOfSpeech: word.pos || word.partOfSpeech || "",
  meaning: word.meaning || word.translation || "",
  pronunciation: word.pronunciation || word.word,
  exampleDe: word.exampleDe || word.sentence || "",
  exampleEn: word.exampleEn || word.sentenceEnglish || "",
  explanation: word.explanation || "",
  breakdown: word.breakdown || null,
  memoryTrick: word.memoryTrick || "",
});

const baseQuestion = (mission, word, fields) => ({
  missionId: mission.id,
  wordId: word.id,
  rank: word.rank,
  word: word.word,
  article: wordArticle(word),
  reveal: revealFor(word),
  ...fields,
});

const encounterQuestion = (mission, word) => baseQuestion(mission, word, {
  id: `${mission.id}:encounter:${word.id}`,
  type: ADVENTURE_QUESTION_TYPES.SENTENCE_MEANING,
  stage: "encounter",
  prompt: `What does “${word.word}” mean in this situation?`,
  contextDe: word.exampleDe || word.sentence || "",
  answerLanguage: "en",
  expectedAnswer: meaningAnswerOptions(word)[0] || word.meaning || "",
  acceptedAnswers: meaningAnswerOptions(word),
  requiresArticle: false,
  alwaysRevealAfterAttempt: true,
});

const explicitCloze = (word) => {
  if (word.cloze && typeof word.cloze === "object") {
    const sentence = word.cloze.sentence || word.cloze.prompt || "";
    const answers = uniqueStrings([
      word.cloze.answer,
      word.cloze.acceptedAnswers,
      word.cloze.answers,
    ]);
    if (sentence.includes("_____") && answers.length) return { sentence, answers };
  }

  const sentence = String(word.exampleDe || word.sentence || "");
  const target = String(word.word || "").trim();
  if (!sentence || !target || /\s/u.test(target)) return null;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, "iu");
  const match = sentence.match(pattern);
  if (!match) return null;
  return {
    sentence: sentence.replace(pattern, (_, prefix) => `${prefix}_____`),
    answers: [match[2]],
  };
};

const germanRecallQuestion = (mission, word, fields = {}) => {
  const requiresArticle = fields.requiresArticle ?? Boolean(wordArticle(word));
  const acceptedAnswers = germanAnswerOptions(word, requiresArticle, fields.acceptedAnswers);
  const articleInstruction = requiresArticle ? " Include the article." : "";
  return baseQuestion(mission, word, {
    ...fields,
    id: fields.id || `${mission.id}:recall:${word.id}`,
    type: fields.type || ADVENTURE_QUESTION_TYPES.GERMAN_RECALL,
    stage: fields.stage || "recall",
    prompt: fields.prompt || `Write the German word for “${word.meaning || word.translation}”.${articleInstruction}`,
    contextDe: fields.contextDe || "",
    contextEn: fields.contextEn || word.exampleEn || word.sentenceEnglish || "",
    answerLanguage: "de",
    expectedAnswer: acceptedAnswers[0] || word.word,
    acceptedAnswers,
    requiresArticle,
  });
};

const meaningRecallQuestion = (mission, word, fields = {}) => {
  const acceptedAnswers = meaningAnswerOptions(word, fields.acceptedAnswers);
  return baseQuestion(mission, word, {
    ...fields,
    id: fields.id || `${mission.id}:meaning-recall:${word.id}`,
    type: fields.type || ADVENTURE_QUESTION_TYPES.MEANING_RECALL,
    stage: fields.stage || "recall",
    prompt: fields.prompt || `Recall the useful English meaning of “${word.word}”.`,
    contextDe: fields.contextDe || word.exampleDe || word.sentence || "",
    answerLanguage: "en",
    expectedAnswer: acceptedAnswers[0] || word.meaning || "",
    acceptedAnswers,
    requiresArticle: false,
  });
};

const recognitionQuestion = (mission, word, audioAvailable) => {
  const acceptedAnswers = meaningAnswerOptions(word);
  const spokenTarget = wordArticle(word) ? `${wordArticle(word)} ${word.word}` : word.word;
  return baseQuestion(mission, word, {
    id: `${mission.id}:recognition:${word.id}`,
    type: audioAvailable
      ? ADVENTURE_QUESTION_TYPES.AUDIO_RECOGNITION
      : ADVENTURE_QUESTION_TYPES.MEANING_RECALL,
    stage: "recognition-practice",
    prompt: audioAvailable
      ? "Listen to the German target, then enter its useful English meaning."
      : `Enter a useful English meaning of “${word.word}”.`,
    audioText: audioAvailable ? spokenTarget : "",
    audioTarget: audioAvailable ? spokenTarget : "",
    contextDe: audioAvailable ? "" : (word.exampleDe || word.sentence || ""),
    answerLanguage: "en",
    expectedAnswer: acceptedAnswers[0] || word.meaning || "",
    acceptedAnswers,
    requiresArticle: false,
    independentEligible: false,
  });
};

const practiceQuestion = (mission, word) => {
  const parts = asArray(word.compoundParts).map((part) => String(part).trim()).filter(Boolean);
  if (parts.length >= 2) {
    const answers = germanAnswerOptions(word, false, [parts.join("")]);
    return baseQuestion(mission, word, {
      id: `${mission.id}:practice:${word.id}`,
      type: ADVENTURE_QUESTION_TYPES.COMPOUND_ASSEMBLY,
      stage: "practice",
      prompt: `Assemble the supplied parts into the German word for “${word.meaning || word.translation}”.`,
      answerLanguage: "de",
      expectedAnswer: answers[0] || word.word,
      acceptedAnswers: answers,
      requiresArticle: false,
      compoundParts: parts,
    });
  }

  const cloze = explicitCloze(word);
  if (cloze) {
    return baseQuestion(mission, word, {
      id: `${mission.id}:practice:${word.id}`,
      type: ADVENTURE_QUESTION_TYPES.CLOZE,
      stage: "practice",
      prompt: "Complete the sentence with the missing German word.",
      contextDe: cloze.sentence,
      contextEn: word.exampleEn || word.sentenceEnglish || "",
      answerLanguage: "de",
      expectedAnswer: cloze.answers[0],
      acceptedAnswers: cloze.answers,
      requiresArticle: false,
    });
  }

  return germanRecallQuestion(mission, word, {
    id: `${mission.id}:practice:${word.id}`,
    stage: "practice",
  });
};

const reviewQuestion = (mission, word) => germanRecallQuestion(mission, word, {
  id: `${mission.id}:due-review:${word.id}`,
  stage: "review",
  prompt: `Due review: write the German word for “${word.meaning || word.translation}”.${wordArticle(word) ? " Include the article." : ""}`,
});

const customFinalQuestions = (mission, wordById) => asArray(mission.finalScene?.steps).map((step, index) => {
  const word = wordById.get(step.wordId);
  if (!word) throw new RangeError(`Final scene references missing word ${step.wordId}`);
  if (!mission.wordIds.includes(step.wordId)) {
    throw new RangeError(`Final scene word ${step.wordId} is not a target of ${mission.id}`);
  }
  const language = step.answerLanguage === "en" ? "en" : "de";
  const requiresArticle = Boolean(step.requiresArticle);
  const acceptedAnswers = language === "de"
    ? germanAnswerOptions(word, requiresArticle, step.acceptedAnswers || step.answers)
    : meaningAnswerOptions(word, step.acceptedAnswers || step.answers);
  return baseQuestion(mission, word, {
    id: `${mission.id}:final:${index + 1}:${word.id}`,
    type: ADVENTURE_QUESTION_TYPES.FINAL_SCENE,
    stage: "final",
    sceneTitle: mission.finalScene?.title || mission.title || "Final scene",
    sceneIntro: mission.finalScene?.intro || "",
    prompt: requiredText(step.prompt, `finalScene.steps[${index}].prompt`),
    contextDe: step.contextDe || step.sentence || "",
    contextEn: step.contextEn || "",
    answerLanguage: language,
    expectedAnswer: acceptedAnswers[0] || "",
    acceptedAnswers,
    requiresArticle,
  });
}).filter(Boolean);

const fallbackFinalQuestions = (mission, targets, count) => {
  const wanted = Math.max(1, Math.min(targets.length, Number(count) || DEFAULT_OPTIONS.finalWordCount));
  const indexes = wanted === 1
    ? [targets.length - 1]
    : Array.from({ length: wanted }, (_, index) => Math.round(index * (targets.length - 1) / (wanted - 1)));
  return Array.from(new Set(indexes)).map((targetIndex, index) => {
    const word = targets[targetIndex];
    return germanRecallQuestion(mission, word, {
      id: `${mission.id}:final:${index + 1}:${word.id}`,
      type: ADVENTURE_QUESTION_TYPES.FINAL_SCENE,
      stage: "final",
      sceneTitle: mission.title || "Final scene",
      sceneIntro: mission.finalScene?.intro || "Use the mission vocabulary to finish this everyday situation.",
      prompt: `In the final scene, write the German target word for “${word.meaning || word.translation}”.${wordArticle(word) ? " Include the article." : ""}`,
      contextEn: word.exampleEn || word.sentenceEnglish || "",
    });
  });
};

const wordIndex = (words) => new Map(asArray(words).map((word) => [word.id, word]));

/**
 * Create a deterministic question order. New words are introduced in small
 * batches; delayed recalls and a short final scene follow the batch practice.
 */
export function createAdventureQuestionPlan({ mission, words, dueWords = [], options = {} }) {
  if (!mission || !Array.isArray(mission.wordIds)) throw new TypeError("mission.wordIds is required");
  requiredText(mission.id, "mission.id");
  if (mission.wordIds.length !== 10) throw new RangeError(`Mission ${mission.id} must contain exactly 10 target IDs`);
  const settings = mergeOptions(options);
  const byId = wordIndex(words);
  const targets = mission.wordIds.map((id) => {
    const word = byId.get(id);
    if (!word) throw new RangeError(`Mission ${mission.id} references missing word ${id}`);
    return word;
  });
  if (new Set(mission.wordIds).size !== mission.wordIds.length) {
    throw new RangeError(`Mission ${mission.id} contains duplicate target IDs`);
  }

  const targetIds = new Set(mission.wordIds);
  const due = asArray(dueWords)
    .filter((word) => word?.id && !targetIds.has(word.id))
    .slice(0, Math.max(0, Number(settings.maxDueReviews) || 0));
  const questions = due.map((word) => reviewQuestion(mission, word));
  const batchSize = Math.max(1, Math.round(Number(settings.batchSize) || DEFAULT_OPTIONS.batchSize));

  for (let start = 0; start < targets.length; start += batchSize) {
    const batch = targets.slice(start, start + batchSize);
    questions.push(...batch.map((word) => encounterQuestion(mission, word)));
    questions.push(...batch.map((word) => practiceQuestion(mission, word)));
    if (batch[0]) questions.push(recognitionQuestion(mission, batch[0], Boolean(settings.audioAvailable)));
  }

  questions.push(...targets.map((word, index) => (
    index % 2 === 0
      ? germanRecallQuestion(mission, word, { id: `${mission.id}:delayed:${word.id}`, stage: "delayed-recall" })
      : meaningRecallQuestion(mission, word, { id: `${mission.id}:delayed:${word.id}`, stage: "delayed-recall" })
  )));

  const customFinals = customFinalQuestions(mission, byId);
  questions.push(...(customFinals.length
    ? customFinals
    : fallbackFinalQuestions(mission, targets, settings.finalWordCount)));

  const ids = questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length) throw new RangeError(`Mission ${mission.id} produced duplicate question IDs`);
  return questions;
}

/** Return a dedicated progress object without altering unrelated app data. */
export function createAdventureProgress(existing = {}) {
  const requestedStart = Number(existing.startingMissionNumber);
  return {
    schemaVersion: ADVENTURE_SCHEMA_VERSION,
    words: clone(existing.words || {}),
    missions: clone(existing.missions || {}),
    totalPoints: Math.max(0, Number(existing.totalPoints) || 0),
    startingMissionNumber: [1, 11, 21].includes(requestedStart) ? requestedStart : 1,
  };
}

const defaultWordProgress = (wordId) => ({
  wordId,
  state: ADVENTURE_WORD_STATES.NEW,
  encountered: false,
  practised: false,
  independentRecallCount: 0,
  independentRecallSessions: [],
  independentRecallDays: [],
  lapseCount: 0,
  dueAt: null,
  rememberedAt: null,
  provisionalFamiliar: false,
});

const isDueAt = (entry, now) => Boolean(entry?.dueAt && new Date(entry.dueAt).getTime() <= new Date(now).getTime());

/** Mark elapsed review dates as due while preserving remembered history. */
export function refreshAdventureDueStates(progress, now) {
  const timestamp = isoTime(now);
  const next = createAdventureProgress(progress);
  Object.entries(next.words).forEach(([wordId, stored]) => {
    if (!isDueAt(stored, timestamp)) return;
    next.words[wordId] = { ...stored, state: ADVENTURE_WORD_STATES.DUE };
  });
  return next;
}

/** Get due records that can be resolved against the supplied vocabulary list. */
export function getDueAdventureWords(progress, words, now, limit = DEFAULT_OPTIONS.maxDueReviews) {
  const timestamp = isoTime(now);
  const byId = wordIndex(words);
  return Object.values(progress?.words || {})
    .filter((entry) => isDueAt(entry, timestamp) && byId.has(entry.wordId))
    .sort((left, right) => String(left.dueAt).localeCompare(String(right.dueAt)) || left.wordId.localeCompare(right.wordId))
    .slice(0, Math.max(0, Number(limit) || 0))
    .map((entry) => byId.get(entry.wordId));
}

/**
 * Start a resumable session. Pass all vocabulary records when due reviews from
 * earlier missions should be placed before this mission's new words.
 */
export function createAdventureSession({ mission, words, progress = {}, now, sessionId, options = {} }) {
  const timestamp = isoTime(now);
  const settings = mergeOptions(options);
  const refreshedProgress = refreshAdventureDueStates(progress, timestamp);
  const dueWords = getDueAdventureWords(refreshedProgress, words, timestamp, settings.maxDueReviews);
  const questions = createAdventureQuestionPlan({ mission, words, dueWords, options: settings });
  const id = sessionId || `${mission.id}:${timestamp}`;

  return {
    progress: refreshedProgress,
    session: {
      schemaVersion: ADVENTURE_SCHEMA_VERSION,
      id,
      missionId: mission.id,
      targetWordIds: [...mission.wordIds],
      status: "active",
      startedAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      cursor: 0,
      questions,
      responses: {},
      wordStats: {},
      requeuedWordIds: [],
      score: {
        points: 0,
        independentCorrect: 0,
        correct: 0,
        attempted: 0,
      },
      completionAwarded: false,
      options: {
        minRetryGap: settings.minRetryGap,
        minRevealGap: settings.minRevealGap,
        independentRecallPoints: settings.independentRecallPoints,
        finalRecallPoints: settings.finalRecallPoints,
        missionCompletionPoints: settings.missionCompletionPoints,
        audioAvailable: Boolean(settings.audioAvailable),
      },
    },
  };
}

const assertSession = (session) => {
  if (!session || !Array.isArray(session.questions) || !Number.isInteger(session.cursor)) {
    throw new TypeError("A valid adventure session is required");
  }
};

/** Validate and clone saved JSON session state for continued use. */
export function resumeAdventureSession({ session, progress = {}, words, now }) {
  assertSession(session);
  const timestamp = isoTime(now);
  const nextSession = clone(session);
  const available = new Set(asArray(words).map((word) => word.id));
  const missing = nextSession.questions.find((question) => !available.has(question.wordId));
  if (missing) throw new RangeError(`Saved session references missing word ${missing.wordId}`);
  if (nextSession.status !== "completed") nextSession.status = "active";
  nextSession.updatedAt = timestamp;
  return {
    session: nextSession,
    progress: refreshAdventureDueStates(progress, timestamp),
  };
}

/** The interface should keep this question mounted while its submitted feedback is shown. */
export function getCurrentAdventureQuestion(session) {
  assertSession(session);
  const question = session.questions[session.cursor] || null;
  if (!question) return null;
  return {
    ...clone(question),
    response: clone(session.responses?.[question.id] || null),
    position: session.cursor + 1,
    total: session.questions.length,
  };
}

const updateWordState = (stored, result, context) => {
  const next = { ...defaultWordProgress(context.wordId), ...stored };
  next.lastSeenAt = context.now;
  next.lastMissionId = context.missionId;
  next.lastSessionId = context.sessionId;
  next.encountered = true;
  next.encounteredAt ||= context.now;

  if (context.stage !== "encounter") {
    next.practised = true;
    next.practisedAt = context.now;
  }

  if (!result.correct) {
    if (context.stage !== "encounter") {
      next.lapseCount = Math.max(0, Number(next.lapseCount) || 0) + 1;
      next.dueAt = context.now;
      next.state = ADVENTURE_WORD_STATES.DUE;
    } else {
      next.state = ADVENTURE_WORD_STATES.ENCOUNTERED;
    }
    return next;
  }

  if (context.independent) {
    const sessions = Array.from(new Set([...(next.independentRecallSessions || []), context.sessionId]));
    const recallDay = context.now.slice(0, 10);
    const days = Array.from(new Set([...(next.independentRecallDays || []), recallDay]));
    const isNewRecallSession = sessions.length > (next.independentRecallSessions || []).length;
    next.independentRecallSessions = sessions;
    next.independentRecallDays = days;
    if (isNewRecallSession) next.independentRecallCount = Math.max(0, Number(next.independentRecallCount) || 0) + 1;
    next.lastIndependentRecallAt = context.now;

    if (days.length >= 2) {
      next.state = ADVENTURE_WORD_STATES.REMEMBERED;
      next.rememberedAt ||= context.now;
    } else {
      next.state = ADVENTURE_WORD_STATES.RECALLED;
    }

    const intervalDays = [1, 3, 7, 14, 30][Math.min(days.length - 1, 4)];
    next.dueAt = addDays(context.now, intervalDays);
    return next;
  }

  next.dueAt = addDays(context.now, 1);
  next.state = context.stage === "encounter"
    ? ADVENTURE_WORD_STATES.ENCOUNTERED
    : ADVENTURE_WORD_STATES.PRACTISED;
  return next;
};

const wordStatsFor = (session, wordId) => ({
  attempts: 0,
  correct: 0,
  independentCorrect: 0,
  lastRevealCursor: null,
  provisionalFamiliar: false,
  ...(session.wordStats?.[wordId] || {}),
});

const canCountIndependent = (session, question, response) => {
  if (!response.result?.correct || question.stage === "encounter") return false;
  if (question.independentEligible === false) return false;
  if (response.hintUsed || response.revealedBeforeSubmit || response.forceReveal) return false;
  const stats = wordStatsFor(session, question.wordId);
  if (stats.lastRevealCursor == null) return true;
  const intervening = session.cursor - stats.lastRevealCursor - 1;
  return intervening >= Math.max(0, Number(session.options?.minRevealGap) || DEFAULT_OPTIONS.minRevealGap);
};

const retryQuestion = (question) => ({
  ...clone(question),
  id: `${question.id}:retry`,
  stage: "retry",
  retryOf: question.id,
  prompt: question.type === ADVENTURE_QUESTION_TYPES.FINAL_SCENE
    ? `Try this mission word again: ${question.prompt}`
    : question.prompt,
  alwaysRevealAfterAttempt: false,
});

const maybeInsertRetry = (session, question, result) => {
  if (result.correct || question.stage === "encounter" || question.stage === "retry") return session;
  if (session.requeuedWordIds.includes(question.wordId)) return session;
  const gap = Math.max(3, Number(session.options?.minRetryGap) || DEFAULT_OPTIONS.minRetryGap);
  const remaining = session.questions.length - session.cursor - 1;
  if (remaining < gap) return session;

  const insertionIndex = session.cursor + 1 + gap;
  const questions = [...session.questions];
  questions.splice(insertionIndex, 0, retryQuestion(question));
  return {
    ...session,
    questions,
    requeuedWordIds: [...session.requeuedWordIds, question.wordId],
  };
};

const withRecordedAttempt = ({ session, progress, question, answer, result, now, hintUsed, forceReveal }) => {
  let nextSession = clone(session);
  const priorDraft = nextSession.responses[question.id] || {};
  const revealedBeforeSubmit = Boolean(priorDraft.revealed);
  const response = {
    questionId: question.id,
    wordId: question.wordId,
    submitted: true,
    submittedAt: now,
    answer: String(answer ?? ""),
    hintUsed: Boolean(hintUsed || priorDraft.hintUsed),
    forceReveal: Boolean(forceReveal),
    revealedBeforeSubmit,
    revealed: Boolean(forceReveal || question.alwaysRevealAfterAttempt || priorDraft.revealed || !result.correct),
    result,
  };
  response.independent = canCountIndependent(nextSession, question, response);
  response.pointsAwarded = response.independent
    ? (question.stage === "final"
      ? Number(nextSession.options?.finalRecallPoints) || DEFAULT_OPTIONS.finalRecallPoints
      : Number(nextSession.options?.independentRecallPoints) || DEFAULT_OPTIONS.independentRecallPoints)
    : 0;

  nextSession.responses[question.id] = response;
  const stats = wordStatsFor(nextSession, question.wordId);
  stats.attempts += 1;
  if (result.correct) stats.correct += 1;
  if (response.independent) stats.independentCorrect += 1;
  if (response.revealed) stats.lastRevealCursor = nextSession.cursor;
  nextSession.wordStats[question.wordId] = stats;
  nextSession.score.attempted += 1;
  if (result.correct) nextSession.score.correct += 1;
  if (response.independent) nextSession.score.independentCorrect += 1;
  nextSession.score.points += response.pointsAwarded;
  nextSession.updatedAt = now;
  nextSession = maybeInsertRetry(nextSession, question, result);

  const nextProgress = createAdventureProgress(progress);
  nextProgress.words[question.wordId] = updateWordState(nextProgress.words[question.wordId], result, {
    wordId: question.wordId,
    missionId: nextSession.missionId,
    sessionId: nextSession.id,
    stage: question.stage,
    independent: response.independent,
    now,
  });
  nextProgress.totalPoints += response.pointsAwarded;
  return { session: nextSession, progress: nextProgress, response };
};

/**
 * Submit the current answer. Repeating a submission returns the saved result and
 * cannot award points, schedule another retry, or change progress.
 */
export function submitAdventureAnswer({ session, progress = {}, answer, now, forceReveal = false }) {
  assertSession(session);
  const timestamp = isoTime(now);
  const question = session.questions[session.cursor];
  if (!question) throw new RangeError("There is no current question to answer");
  const existing = session.responses?.[question.id];
  if (existing?.submitted) {
    return {
      session: clone(session),
      progress: createAdventureProgress(progress),
      result: { ...clone(existing.result), duplicateSubmission: true },
      response: clone(existing),
      question: clone(question),
    };
  }

  const result = forceReveal
    ? {
      correct: false,
      status: "revealed",
      normalizedAnswer: "",
      expectedAnswer: question.expectedAnswer,
      feedback: `Review the answer: ${question.expectedAnswer}. This reveal does not count as independent recall.`,
    }
    : evaluateAdventureAnswer(answer, question);
  const recorded = withRecordedAttempt({
    session,
    progress,
    question,
    answer,
    result,
    now: timestamp,
    hintUsed: existing?.hintUsed,
    forceReveal,
  });
  return { ...recorded, result, question: clone(question) };
}

/** Reveal “I don't know” as a completed attempt so feedback remains until Continue. */
export function revealAdventureAnswer({ session, progress = {}, now }) {
  return submitAdventureAnswer({ session, progress, answer: "", now, forceReveal: true });
}

/** Mark the current question as hinted. Hinted answers can never earn recall credit. */
export function useAdventureHint({ session, now }) {
  assertSession(session);
  const timestamp = isoTime(now);
  const question = session.questions[session.cursor];
  if (!question) throw new RangeError("There is no current question for a hint");
  const existing = session.responses?.[question.id];
  if (existing?.submitted) return { session: clone(session), question: clone(question), response: clone(existing) };
  const nextSession = clone(session);
  const response = {
    ...(nextSession.responses[question.id] || {}),
    questionId: question.id,
    wordId: question.wordId,
    submitted: false,
    hintUsed: true,
    hintedAt: timestamp,
  };
  nextSession.responses[question.id] = response;
  nextSession.updatedAt = timestamp;
  return { session: nextSession, question: clone(question), response };
}

/**
 * Record “I already know this” during an encounter. It is provisional, awards
 * no points, reveals the teaching card, and still requires later recall.
 */
export function markAdventureWordFamiliar({ session, progress = {}, now }) {
  assertSession(session);
  const timestamp = isoTime(now);
  const question = session.questions[session.cursor];
  if (!question || question.stage !== "encounter") {
    throw new RangeError("Familiarity can only be marked on a new-word encounter");
  }
  const existing = session.responses?.[question.id];
  if (existing?.submitted) {
    return { session: clone(session), progress: createAdventureProgress(progress), response: clone(existing) };
  }

  const result = {
    correct: null,
    status: "self-reported-familiar",
    expectedAnswer: question.expectedAnswer,
    feedback: "Marked as familiar for now. A later independent recall will confirm it.",
  };
  const recorded = withRecordedAttempt({
    session,
    progress,
    question,
    answer: "",
    result,
    now: timestamp,
    hintUsed: false,
    forceReveal: true,
  });
  recorded.session.wordStats[question.wordId].provisionalFamiliar = true;
  const wordProgress = recorded.progress.words[question.wordId];
  recorded.progress.words[question.wordId] = {
    ...wordProgress,
    provisionalFamiliar: true,
    provisionalFamiliarAt: timestamp,
  };
  return { ...recorded, result, question: clone(question) };
}

/** Advance only after a submitted result, preserving feedback until this call. */
export function continueAdventureSession({ session, now }) {
  assertSession(session);
  const timestamp = isoTime(now);
  if (session.status === "completed") return clone(session);
  const question = session.questions[session.cursor];
  if (!question) return { ...clone(session), status: "ready-to-complete", updatedAt: timestamp };
  if (!session.responses?.[question.id]?.submitted) {
    throw new RangeError("Submit, reveal, or mark the current word familiar before continuing");
  }
  const next = clone(session);
  next.cursor += 1;
  const response = next.responses[question.id];
  if (response.result?.correct && response.independent) {
    const answeredWordId = question.wordId;
    next.questions = [
      ...next.questions.slice(0, next.cursor),
      ...next.questions.slice(next.cursor).filter((candidate) => candidate.wordId !== answeredWordId),
    ];
  }
  next.status = next.cursor >= next.questions.length ? "ready-to-complete" : "active";
  next.updatedAt = timestamp;
  return next;
}

export function pauseAdventureSession({ session, now }) {
  assertSession(session);
  if (session.status === "completed") return clone(session);
  return { ...clone(session), status: "paused", updatedAt: isoTime(now) };
}

/**
 * Complete once all questions are handled. Repeated calls are idempotent and a
 * mission's completion reward is granted only once in persisted progress.
 */
export function completeAdventureSession({ session, progress = {}, now }) {
  assertSession(session);
  const timestamp = isoTime(now);
  const currentQuestion = session.questions[session.cursor];
  if (currentQuestion || session.cursor < session.questions.length) {
    throw new RangeError("The session still has unanswered questions");
  }
  if (session.status === "completed" && session.completionAwarded) {
    return { session: clone(session), progress: createAdventureProgress(progress), pointsAwarded: 0 };
  }

  const nextSession = clone(session);
  const nextProgress = createAdventureProgress(progress);
  const priorMission = nextProgress.missions[nextSession.missionId] || {};
  const firstCompletion = !priorMission.completedAt;
  const reward = firstCompletion
    ? Number(nextSession.options?.missionCompletionPoints) || DEFAULT_OPTIONS.missionCompletionPoints
    : 0;
  nextProgress.missions[nextSession.missionId] = {
    ...priorMission,
    missionId: nextSession.missionId,
    completedAt: priorMission.completedAt || timestamp,
    lastCompletedAt: timestamp,
    completionCount: Math.max(0, Number(priorMission.completionCount) || 0) + (nextSession.completionAwarded ? 0 : 1),
    bestPoints: Math.max(Number(priorMission.bestPoints) || 0, nextSession.score.points + reward),
    targetWordIds: [...nextSession.targetWordIds],
  };
  nextProgress.totalPoints += reward;
  nextSession.score.points += reward;
  nextSession.status = "completed";
  nextSession.completedAt ||= timestamp;
  nextSession.updatedAt = timestamp;
  nextSession.completionAwarded = true;
  return { session: nextSession, progress: nextProgress, pointsAwarded: reward };
}

/**
 * Lightweight built-in checks for the edge cases most likely to regress. Throws
 * with a concise message; returns a summary when all checks pass.
 */
export function runAdventureEngineChecks() {
  const now = "2026-01-01T10:00:00.000Z";
  const noun = {
    id: "freq-1",
    rank: 1,
    word: "Bahnhof",
    article: "der",
    pos: "n",
    meaning: "train station / railway station",
    exampleDe: "Der Bahnhof ist dort.",
    exampleEn: "The train station is there.",
  };
  const articleQuestion = germanRecallQuestion({ id: "mission-check" }, noun, { id: "article-check" });
  const missingArticle = evaluateAdventureAnswer("Bahnhof!", articleQuestion);
  const wrongArticle = evaluateAdventureAnswer("die Bahnhof", articleQuestion);
  const typingConvention = evaluateAdventureAnswer("der bahnhof.", articleQuestion);
  if (!missingArticle.missingArticle) throw new Error("Article omission check failed");
  if (!wrongArticle.wrongArticle) throw new Error("Wrong article check failed");
  if (!typingConvention.correct) throw new Error("Answer normalization check failed");

  const words = Array.from({ length: 10 }, (_, index) => ({
    ...noun,
    id: `freq-${index + 1}`,
    rank: index + 1,
    word: index === 0 ? "Bahnhof" : `Wort${index + 1}`,
    article: index === 0 ? "der" : "",
    pos: index === 0 ? "n" : "adv",
    meaning: index === 0 ? noun.meaning : `meaning ${index + 1}`,
    exampleDe: index === 0 ? noun.exampleDe : `Hier steht Wort${index + 1}.`,
    exampleEn: index === 0 ? noun.exampleEn : `Here is word ${index + 1}.`,
  }));
  const mission = { id: "mission-check", wordIds: words.map((word) => word.id) };
  const textPlan = createAdventureQuestionPlan({ mission, words });
  const audioPlan = createAdventureQuestionPlan({ mission, words, options: { audioAvailable: true } });
  const textRecognition = textPlan.find((question) => question.stage === "recognition-practice");
  const audioRecognition = audioPlan.find((question) => question.stage === "recognition-practice");
  if (textRecognition?.type !== ADVENTURE_QUESTION_TYPES.MEANING_RECALL) {
    throw new Error("Text fallback recognition check failed");
  }
  if (audioRecognition?.type !== ADVENTURE_QUESTION_TYPES.AUDIO_RECOGNITION || !audioRecognition.audioText) {
    throw new Error("Optional audio recognition check failed");
  }

  let created = createAdventureSession({ mission, words, now, sessionId: "check-session" });
  let session = created.session;
  let progress = created.progress;
  const first = submitAdventureAnswer({ session, progress, answer: "wrong", now });
  const duplicate = submitAdventureAnswer({ session: first.session, progress: first.progress, answer: noun.meaning, now });
  if (first.session.score.points !== duplicate.session.score.points) throw new Error("Duplicate submission awarded points");
  const retryIndex = first.session.questions.findIndex((question) => question.retryOf === first.question.id);
  if (retryIndex >= 0) throw new Error("Encounter should not be requeued");

  session = continueAdventureSession({ session: first.session, now });
  ({ session, progress } = markAdventureWordFamiliar({ session, progress: first.progress, now }));
  if (session.score.points !== 0) throw new Error("Self-reported familiarity awarded points");
  if (!progress.words[session.questions[1].wordId].provisionalFamiliar) throw new Error("Provisional familiarity was not saved");

  const practiceIndex = session.questions.findIndex((question) => question.stage === "practice");
  const correctSession = clone(created.session);
  correctSession.cursor = practiceIndex;
  const correctPractice = submitAdventureAnswer({
    session: correctSession,
    progress,
    answer: correctSession.questions[practiceIndex].expectedAnswer,
    now,
  });
  const afterCorrect = continueAdventureSession({ session: correctPractice.session, now });
  if (afterCorrect.questions.slice(afterCorrect.cursor).some((question) => question.wordId === correctSession.questions[practiceIndex].wordId)) {
    throw new Error("A correctly recalled word was repeated again in the same session");
  }

  session.cursor = practiceIndex;
  const miss = submitAdventureAnswer({ session, progress, answer: "wrong", now });
  const practiceRetryIndex = miss.session.questions.findIndex((question) => question.retryOf === miss.question.id);
  if (practiceRetryIndex - practiceIndex - 1 < 3) throw new Error("Retry gap is shorter than three questions");
  const retryCount = miss.session.questions.filter((question) => question.wordId === miss.question.wordId && question.retryOf).length;
  if (retryCount !== 1) throw new Error("Missed word was not requeued exactly once");

  const retrySession = clone(miss.session);
  retrySession.cursor = practiceRetryIndex;
  const retryMiss = submitAdventureAnswer({ session: retrySession, progress: miss.progress, answer: "wrong", now });
  const retryCountAfterSecondMiss = retryMiss.session.questions
    .filter((question) => question.wordId === miss.question.wordId && question.retryOf).length;
  if (retryCountAfterSecondMiss !== 1) throw new Error("A word was requeued more than once");

  const hintedSession = clone(created.session);
  hintedSession.cursor = hintedSession.questions.findIndex((question) => question.stage === "delayed-recall");
  const hintedQuestion = hintedSession.questions[hintedSession.cursor];
  const hinted = useAdventureHint({ session: hintedSession, now });
  const hintedAnswer = submitAdventureAnswer({
    session: hinted.session,
    progress: created.progress,
    answer: hintedQuestion.expectedAnswer,
    now,
  });
  if (hintedAnswer.response.independent || hintedAnswer.response.pointsAwarded) {
    throw new Error("Hinted answer received independent recall credit");
  }

  const firstRecallSession = clone(created.session);
  firstRecallSession.cursor = firstRecallSession.questions.findIndex((question) => question.stage === "delayed-recall");
  const firstRecallQuestion = firstRecallSession.questions[firstRecallSession.cursor];
  const firstRecall = submitAdventureAnswer({
    session: firstRecallSession,
    progress: created.progress,
    answer: firstRecallQuestion.expectedAnswer,
    now,
  });
  const sameDay = "2026-01-01T16:00:00.000Z";
  const sameDayCreated = createAdventureSession({
    mission,
    words,
    progress: firstRecall.progress,
    now: sameDay,
    sessionId: "check-session-same-day",
  });
  const sameDaySession = clone(sameDayCreated.session);
  sameDaySession.cursor = sameDaySession.questions.findIndex((question) => (
    question.wordId === firstRecallQuestion.wordId && question.stage === "delayed-recall"
  ));
  const sameDayQuestion = sameDaySession.questions[sameDaySession.cursor];
  const sameDayRecall = submitAdventureAnswer({
    session: sameDaySession,
    progress: sameDayCreated.progress,
    answer: sameDayQuestion.expectedAnswer,
    now: sameDay,
  });
  if (sameDayRecall.progress.words[firstRecallQuestion.wordId].state === ADVENTURE_WORD_STATES.REMEMBERED) {
    throw new Error("Same-day sessions established remembered status");
  }

  const later = "2026-01-03T10:00:00.000Z";
  const laterCreated = createAdventureSession({
    mission,
    words,
    progress: sameDayRecall.progress,
    now: later,
    sessionId: "check-session-later",
  });
  const laterSession = clone(laterCreated.session);
  laterSession.cursor = laterSession.questions.findIndex((question) => (
    question.wordId === firstRecallQuestion.wordId && question.stage === "delayed-recall"
  ));
  const laterQuestion = laterSession.questions[laterSession.cursor];
  const laterRecall = submitAdventureAnswer({
    session: laterSession,
    progress: laterCreated.progress,
    answer: laterQuestion.expectedAnswer,
    now: later,
  });
  if (laterRecall.progress.words[firstRecallQuestion.wordId].state !== ADVENTURE_WORD_STATES.REMEMBERED) {
    throw new Error("Later-session remembered state check failed");
  }

  const completeSession = clone(created.session);
  completeSession.cursor = completeSession.questions.length;
  completeSession.status = "ready-to-complete";
  const completed = completeAdventureSession({ session: completeSession, progress: created.progress, now });
  const completedAgain = completeAdventureSession({
    session: completed.session,
    progress: completed.progress,
    now,
  });
  if (!completed.pointsAwarded || completedAgain.pointsAwarded !== 0) {
    throw new Error("Mission completion idempotence check failed");
  }

  return {
    passed: true,
    checks: [
      "answer normalization",
      "article feedback",
      "duplicate submission idempotence",
      "correctly recalled words are not repeated in the same session",
      "provisional familiarity",
      "missed-word retry gap",
      "one retry per word",
      "hinted answer scoring",
      "optional audio with text fallback",
      "same-day recall remains provisional",
      "later-session remembered state",
      "mission completion idempotence",
    ],
  };
}
