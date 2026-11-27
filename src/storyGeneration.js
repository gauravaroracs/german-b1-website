import { reviewLevelOf } from "./reviewSelection.js";
import { selectDailyStoryWords } from "./dailyStory.js";

export const STORY_LEVELS = ["A1", "A2", "B1", "B2"];

export function filterStoryWords(words, filter, level, search = "") {
  const available = words.filter((word) => typeof word.word === "string" && word.word.trim() && word.id != null);
  const normalizedSearch = search.trim().toLocaleLowerCase("de");
  const searched = available.filter((word) => word.word.toLocaleLowerCase("de").includes(normalizedSearch));
  if (filter === "level") return searched.filter((word) => { const index = STORY_LEVELS.indexOf(reviewLevelOf(word)); return index >= 0 && index <= STORY_LEVELS.indexOf(level); });
  if (filter === "learning") return searched.filter((word) => (word.srsReps || 0) < 5 || (word.srsInterval || 0) < 21);
  if (filter !== "recent") return searched;
  return searched.map((word, index) => ({ word, index })).sort((a, b) => String(b.word.addedAt || "").localeCompare(String(a.word.addedAt || "")) || a.index - b.index).slice(0, 50).map(({ word }) => word);
}

export function selectStoryWords(words, mode, selectedIds, level = "B1") {
  const available = filterStoryWords(words, "all", level);
  if (mode === "manual") {
    const selected = new Set(selectedIds);
    return available.filter((word) => selected.has(word.id));
  }
  const eligible = filterStoryWords(available, "level", level);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return selectDailyStoryWords(eligible, today);
}
