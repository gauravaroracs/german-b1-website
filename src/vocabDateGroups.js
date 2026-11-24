const dayKey = (value) => {
  if (typeof value !== "string") return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? match[0].slice(0, 10) : "";
};

export function groupWordsByAddedDate(words, today) {
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  const groups = new Map();
  for (const word of words) {
    const key = dayKey(word.addedAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([key, items]) => {
    const dateLabel = key ? new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${key}T12:00:00`)) : "";
    return { key: key || "unknown", label: !key ? "Date unknown" : key === today ? `Today · ${dateLabel}` : key === yesterdayKey ? `Yesterday · ${dateLabel}` : dateLabel, items };
  });
}
