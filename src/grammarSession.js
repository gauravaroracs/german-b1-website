const empty = (value) => !value || Object.keys(value).length === 0;

export function grammarPractisedToday(blockData, grammarSession, today) {
  return Boolean(blockData?.[today]?.grammar || grammarSession?.__gapRound?.completedOn === today);
}

export function updateGrammarTopicSession(current, topicIndex, answers, feedback, hints) {
  const previous = current[topicIndex];
  if (!previous && empty(answers) && empty(feedback) && empty(hints)) return current;
  const next = { ...(previous || {}), answers, feedback, hints };
  if (previous && JSON.stringify(previous) === JSON.stringify(next)) return current;
  return { ...current, [topicIndex]: next };
}
