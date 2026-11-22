import React, { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, ClipboardCheck, MessageCircle, Plus } from "lucide-react";

const dateKey = () => {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
};

export default function Home({ vocabWords, savedSentences, blockData, grammarProgress, thinkState, setThinkState, stories, onNavigate }) {
  const today = dateKey();
  const dayBlocks = blockData[today] || {};
  const reviewDone = vocabWords.filter((item) => item.srsLastReviewed === today).length;
  const dueCount = vocabWords.filter((item) => !item.srsDue || item.srsDue <= today).length + savedSentences.filter((item) => !item.srsDue || item.srsDue <= today).length;
  const addedCount = vocabWords.filter((item) => item.addedAt === today).length;
  const grammarDone = Boolean(dayBlocks.grammar);
  const explanation = thinkState[today]?.textExplanation || "";
  const [draft, setDraft] = useState(explanation);
  const [saved, setSaved] = useState(Boolean(explanation.trim()));
  useEffect(() => { setDraft(explanation); setSaved(Boolean(explanation.trim())); }, [explanation]);
  const text = stories?.[0]?.text?.slice(0, 260) || "In Deutschland ist der Alltag oft voller neuer Wörter. Wer regelmäßig übt, kann sich Schritt für Schritt sicherer ausdrücken.";
  const doneCount = Number(reviewDone >= 5) + Number(addedCount >= 1) + Number(grammarDone) + Number(saved);

  const saveExplanation = (event) => {
    event.preventDefault();
    const answer = draft.trim();
    if (!answer) return;
    setThinkState((current) => ({ ...current, [today]: { ...(current[today] || {}), textExplanation: answer, textExplanationAt: new Date().toISOString() } }));
    setSaved(true);
  };

  const tasks = [
    { key: "review", title: "Review five words", detail: `${Math.min(reviewDone, 5)} of 5 rated today · ${dueCount} due in your library`, icon: ClipboardCheck, action: "Open review", destination: "Review", complete: reviewDone >= 5 },
    { key: "word", title: "Save one new word", detail: `${addedCount ? "A word saved today" : "Choose a word from Words or Lena"}`, icon: Plus, action: "Open Words", destination: "Words", complete: addedCount >= 1 },
    { key: "grammar", title: "Practise one grammar rule", detail: grammarDone ? "Grammar topic completed today" : "Continue your current B1 grammar topic", icon: BookOpen, action: "Open Grammar", destination: "Grammar", complete: grammarDone },
  ];

  return <main className="mx-auto max-w-3xl space-y-6 pb-24">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#5B55D9]">Deutsch Meister · B1 learning plan</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Today’s practice</h2><p className="mt-1 text-sm text-[#747680]">Four clear steps, connected to what you actually do.</p></div><div className="rounded-full border border-[#E4E1DB] bg-white px-4 py-2 text-sm font-semibold">{doneCount}/4 complete</div></header>
    <section aria-label="Today's finite session" className="rounded-3xl border border-[#E5E2DC] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#6C6D75]">Today’s session</p><span className="text-sm font-semibold text-[#5752C9]">{doneCount} of 4</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECEAE5]"><div className="h-full rounded-full bg-[#5D55D6] transition-all" style={{ width: `${doneCount * 25}%` }} /></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{tasks.map((task) => {
      const Icon = task.icon;
      return <article key={task.key} className={`rounded-2xl border p-4 ${task.complete ? "border-[#CDE8D8] bg-[#F2FAF5]" : "border-[#E8E5DF] bg-[#FCFBF9]"}`}><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${task.complete ? "bg-[#D9F0E2] text-[#286447]" : "bg-[#F0EFFA] text-[#514BC5]"}`}>{task.complete ? <Check size={18} /> : <Icon size={18} />}</span><div className="min-w-0 flex-1"><h3 className="font-semibold">{task.title}</h3><p className="mt-1 text-xs leading-5 text-[#737680]">{task.detail}</p><button onClick={() => onNavigate(task.destination)} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[#514BC5] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#625BD7]">{task.action}<ArrowRight size={15} /></button></div></div></article>;
    })}
      <article className={`rounded-2xl border p-4 ${saved ? "border-[#CDE8D8] bg-[#F2FAF5]" : "border-[#E8E5DF] bg-[#FCFBF9]"}`}><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${saved ? "bg-[#D9F0E2] text-[#286447]" : "bg-[#F0EFFA] text-[#514BC5]"}`}>{saved ? <Check size={18} /> : <MessageCircle size={18} />}</span><div className="min-w-0 flex-1"><h3 className="font-semibold">Explain a text</h3><p className="mt-1 text-xs leading-5 text-[#737680]">In German, say what the passage means in your own words.</p><blockquote className="mt-3 border-l-2 border-[#DAD7CF] pl-3 text-xs leading-5 text-[#555761]">{text}{text.length >= 260 ? "…" : ""}</blockquote><form onSubmit={saveExplanation} className="mt-3 space-y-2"><label className="sr-only" htmlFor="text-explanation">Explain the passage in German</label><textarea id="text-explanation" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Der Text handelt von…" className="w-full rounded-xl border border-[#DDDAD3] bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#625BD7]"/><button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#5D55D6] px-3 text-sm font-semibold text-white disabled:opacity-50" disabled={!draft.trim()}>{saved ? "Update explanation" : "Save explanation"}<ArrowRight size={15} /></button></form></div></div></article>
    </div></section>
    <div className="grid gap-3 sm:grid-cols-2"><section className="rounded-2xl border border-[#E5E2DC] bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-[#737680]">Review backlog</p><p className="mt-2 text-3xl font-semibold">{dueCount}</p><p className="text-sm text-[#737680]">words and saved sentences due</p><button onClick={() => onNavigate("Review")} className="mt-3 min-h-10 text-sm font-semibold text-[#514BC5]">Set up review →</button></section><section className="rounded-2xl border border-[#E5E2DC] bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-[#737680]">Long-term B1 progress</p><p className="mt-2 text-lg font-semibold">{(grammarProgress.completedTopics || []).length} / 10 grammar topics</p><p className="mt-1 text-sm text-[#737680]">{vocabWords.length} saved words · your B1 plan stays intact</p><button onClick={() => onNavigate("Mission")} className="mt-2 min-h-10 text-sm font-semibold text-[#514BC5]">Open the full learning plan →</button></section></div>
  </main>;
}
