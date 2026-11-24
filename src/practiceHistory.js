// Store history in the existing messages key so a switch is saved together
// with the new conversation and remains part of existing backup formats.
const HISTORY_ROLE = "__practice_history__";

export function unpackPracticeMessages(records) {
  const list = Array.isArray(records) ? records : [];
  const marker = list.find((item) => item?.role === HISTORY_ROLE);
  return {
    messages: list.filter((item) => item?.role !== HISTORY_ROLE),
    history: Array.isArray(marker?.conversations) ? marker.conversations : [],
  };
}

export function packPracticeMessages(messages, history) {
  return history.length ? [...messages, { role: HISTORY_ROLE, conversations: history }] : messages;
}

export function archivePractice(history, scenario, messages) {
  if (!messages.some((message) => message.role === "user")) return history;
  const id = messages[0]?.id || `conversation-${Date.now()}-${Math.random()}`;
  return [{ id, scenario, messages }, ...history.filter((item) => item.id !== id)];
}
