import { reviewLevelOf } from "./reviewSelection.js";

export function articleNouns(words, filter = "All") {
  const nouns = words.filter((item) => item && typeof item.word === "string" && item.word.trim() && ["der", "die", "das"].includes(item.artikel));
  if (filter === "Recent") return nouns.map((word, index) => ({ word, index })).sort((a, b) => String(b.word.addedAt || "").localeCompare(String(a.word.addedAt || "")) || a.index - b.index).slice(0, 50).map(({ word }) => word);
  return filter === "All" ? nouns : nouns.filter((word) => reviewLevelOf(word) === filter);
}

export function advanceArticleQueue(queue, result) {
  if (!queue.length) return [];
  return result === "wrong" ? [...queue.slice(1), queue[0]] : queue.slice(1);
}

export function articleNounText(word) {
  return word.word.trim().replace(/^(der|die|das)\s+/iu, "");
}
