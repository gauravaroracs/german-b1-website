import React, { useState } from "react";

// The selectable grouped list follows the 21st.dev Data Export Checkbox Group pattern.
export default function ExperimentalLegacyImport({ entries, snapshot = {}, destinations = {}, busy, onImport }) {
  const [selected, setSelected] = useState([]);
  const [replacements, setReplacements] = useState([]);
  const [expanded, setExpanded] = useState([]);
  const toggle = (setItems, key, checked) => setItems((items) => checked ? [...new Set([...items, key])] : items.filter((item) => item !== key));
  const blocked = entries.some((entry) => selected.includes(entry.key) && entry.destination === "different" && !replacements.includes(entry.key));
  return <section className="mt-4 border-t border-[#E5E7EB] pt-4">
    <h4 className="font-semibold">Choose browser data to import</h4>
    <p className="mt-1 text-xs text-[#6B7280]">Nothing is imported until you apply your selection. Pending account changes must be resolved first.</p>
    <fieldset disabled={busy} className="mt-3 space-y-3"><legend className="sr-only">Browser data categories</legend>{entries.map((entry) => <div key={entry.key} className="rounded-xl border border-[#E5E7EB] p-3">
      <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={selected.includes(entry.key)} disabled={entry.destination === "pending"} onChange={(event) => toggle(setSelected, entry.key, event.target.checked)} /><span className="font-medium">{entry.label} · {entry.count} top-level items</span></label>
      <p className="ml-6 text-xs text-[#6B7280]">{({ empty: "Account has no value", same: "Matches the account", different: "Account has a different value", pending: "Account has pending changes" })[entry.destination]}</p>
      <details className="ml-6 mt-2" onToggle={(event) => toggle(setExpanded, entry.key, event.currentTarget.open)}><summary className="min-h-10 cursor-pointer py-2 text-xs font-semibold text-[#4F46E5]">View browser and account data</summary>{expanded.includes(entry.key) && <div className="grid gap-3 py-2 md:grid-cols-2"><section><h5 className="text-xs font-semibold">Browser data</h5><pre tabIndex={0} className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-100 p-3 text-xs">{JSON.stringify(snapshot[entry.field], null, 2)}</pre></section><section><h5 className="text-xs font-semibold">Cloud account</h5><pre tabIndex={0} className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-100 p-3 text-xs">{destinations[entry.key]?.remoteFound ? destinations[entry.key]?.remoteDeleted ? "Deleted" : JSON.stringify(destinations[entry.key]?.remote, null, 2) : "No cloud record"}</pre>{destinations[entry.key]?.local && <><h5 className="mt-2 text-xs font-semibold">Account copy on this browser</h5><pre tabIndex={0} className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-100 p-3 text-xs">{destinations[entry.key].local.deleted ? "Deleted" : JSON.stringify(destinations[entry.key].local.value, null, 2)}</pre></>}</section></div>}</details>
      {entry.destination === "different" && selected.includes(entry.key) && <label className="ml-6 mt-2 flex min-h-10 items-center gap-2 text-xs font-semibold text-amber-800"><input type="checkbox" checked={replacements.includes(entry.key)} onChange={(event) => toggle(setReplacements, entry.key, event.target.checked)} /> I understand this replaces the account value</label>}
    </div>)}</fieldset>
    <p className="mt-3 text-xs text-[#6B7280]">The original browser data stays in place; a recovery copy is saved before any account value is replaced.</p>
    <button onClick={() => onImport({ selectedKeys: selected, replaceKeys: replacements.filter((key) => selected.includes(key)) })} disabled={busy || !selected.length || blocked} className="mt-3 min-h-10 rounded-xl bg-[#4F46E5] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Preparing import…" : `Import ${selected.length} ${selected.length === 1 ? "category" : "categories"}`}</button>
  </section>;
}
