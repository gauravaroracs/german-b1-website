export function orderAndFilterTexts(texts, query = "") {
  const needle = query.trim().toLocaleLowerCase();
  return texts
    .filter((item) => !needle || `${item.original || ""} ${item.analysis?.translation || ""}`.toLocaleLowerCase().includes(needle))
    .map((item, index) => ({ item, index, date: Date.parse(item.createdAt) || 0 }))
    .sort((a, b) => b.date - a.date || a.index - b.index)
    .map(({ item }) => item);
}
