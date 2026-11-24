export function reviewLevelOf(item) {
  const level = item.cefrLevel || item.level || (item.tags || []).find((tag) => /^(A[12]|B[12]|C[12])$/.test(tag)) || "";
  return /^(A[12]|B[12]|C[12])$/.test(level) ? level : "Unknown";
}

export function selectDailyReviewWords(dueWords, level, newLimit) {
  const matches = (item) => level === "All" || reviewLevelOf(item) === level;
  const established = dueWords.filter((item) => (item.srsReps || 0) > 0 || (item.srsLapses || 0) > 0).filter(matches);
  const fresh = dueWords.filter((item) => !(item.srsReps || 0) && !(item.srsLapses || 0)).filter(matches);
  return [...established, ...fresh.slice(0, Math.max(0, Number(newLimit) || 0))];
}
