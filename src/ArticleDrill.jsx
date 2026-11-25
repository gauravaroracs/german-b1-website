import React, { useEffect, useRef, useState } from "react";
import { advanceArticleQueue, articleNouns, articleNounText } from "./articleDrill";
import { reviewLevelOf } from "./reviewSelection";

// Progress semantics adapted from 21st.dev Segmented Progress Questionnaire, demo 29790.
export default function ArticleDrill({ vocabWords, speak, grammarSession, setGrammarSession }) {
  const session = grammarSession.__articleDrill || {};
  const { filter = "All", queue = null, feedback = null, total = 0, done = 0, misses = 0 } = session;
  const [setupVisible, setSetupVisible] = useState(false);
  const update = (changes) => setGrammarSession((current) => ({ ...current, __articleDrill: { ...(current.__articleDrill || {}), ...changes } }));
  const lock = useRef(Boolean(feedback));
  const nouns = articleNouns(vocabWords, filter);
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2", "Unknown"].filter((level) => articleNouns(vocabWords).some((word) => reviewLevelOf(word) === level));
  const card = queue?.[0];

  const choose = (article) => {
    if (!card || lock.current) return;
    lock.current = true;
    const correct = article === card.artikel;
    update({ misses: misses + (correct ? 0 : 1), feedback: correct ? "correct" : "wrong" });
  };
  const reveal = () => {
    if (!card || lock.current) return;
    lock.current = true; update({ feedback: "revealed" });
  };
  const next = () => {
    if (!feedback) return;
    update({ done: done + (feedback === "wrong" ? 0 : 1), queue: advanceArticleQueue(queue, feedback), feedback: null });
    lock.current = false;
  };
  useEffect(() => {
    if (!card || feedback || setupVisible) return;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target instanceof HTMLElement && event.target.matches("input, textarea, select, [contenteditable='true']")) return;
      if (["1", "2", "3"].includes(event.key)) { event.preventDefault(); choose(["der", "die", "das"][Number(event.key) - 1]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, feedback, setupVisible]);

  if (queue && !card && !setupVisible) return <main className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-6"><h2 className="text-2xl font-semibold">Round complete</h2><p className="text-sm text-[#6B7280]">{done} nouns practised · {misses} incorrect {misses === 1 ? "choice" : "choices"}. Your regular review schedule has not changed.</p><button onClick={() => { update({ queue: null, feedback: null }); setSetupVisible(true); }} className="min-h-11 rounded-xl bg-teal-600 px-4 font-semibold text-white">Choose another round</button></main>;
  if (card && !setupVisible) return <main className="mx-auto max-w-xl space-y-5 rounded-2xl border border-[#E5E7EB] bg-white p-6"><button onClick={() => setSetupVisible(true)} className="min-h-11 text-sm font-semibold text-teal-700">← Pause and return to setup</button><div role="progressbar" aria-label="Nouns completed" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-2 overflow-hidden rounded-full bg-[#ECEAE5]"><div className="h-full bg-teal-600" style={{ width: `${done / total * 100}%` }} /></div><p className="text-sm text-[#6B7280]">{done} of {total} nouns complete{misses ? ` · ${misses} missed ${misses === 1 ? "attempt" : "attempts"}` : ""}</p><div><h2 className="text-3xl font-semibold">{articleNounText(card)}</h2>{card.translation && <p className="mt-2 text-sm text-[#6B7280]">{card.translation}</p>}<button onClick={() => speak(articleNounText(card))} className="mt-2 min-h-11 text-sm font-semibold text-teal-700">Play pronunciation</button></div><div aria-label="Choose an article" className="grid grid-cols-3 gap-2">{["der", "die", "das"].map((article, index) => <button key={article} disabled={Boolean(feedback)} onClick={() => choose(article)} className="min-h-12 rounded-xl border border-teal-200 bg-teal-50 px-3 font-semibold text-teal-800 disabled:opacity-60">{article}<span aria-hidden="true" className="ml-1 text-xs">{index + 1}</span></button>)}</div>{feedback ? <div role="status" className="space-y-3"><p className="text-sm font-semibold">{feedback === "correct" ? "Correct!" : feedback === "wrong" ? "Not quite. This noun will return later in the round." : "Answer shown; no missed attempt added."} {card.artikel} {articleNounText(card)}</p><button onClick={next} className="min-h-11 rounded-xl bg-teal-600 px-4 font-semibold text-white">Next</button></div> : <div><p className="text-xs text-[#6B7280]">Choose an article or press 1, 2, or 3.</p><button onClick={reveal} className="mt-3 min-h-11 text-sm font-semibold text-teal-700">Not sure? Show answer</button></div>}</main>;
  return <main className="mx-auto max-w-xl space-y-5 rounded-2xl border border-[#E5E7EB] bg-white p-6"><div><p className="text-xs font-bold uppercase tracking-wide text-teal-700">Practice your nouns</p><h2 className="mt-2 text-2xl font-semibold">Articles: der, die, das</h2><p className="mt-2 text-sm text-[#6B7280]">Practise up to 15 saved nouns. A missed noun returns later in the same round; revealing the answer does not count as a miss.</p></div><label className="block text-sm font-semibold">Which nouns<select value={filter} onChange={(event) => update({ filter: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3"><option value="All">All</option><option value="Recent">Recent</option>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label><p role="status" className="text-sm text-[#6B7280]">{nouns.length} {nouns.length === 1 ? "noun has" : "nouns have"} a saved article{filter === "Recent" ? " in the latest 50" : ""}.</p>{card && <button onClick={() => setSetupVisible(false)} className="mr-3 min-h-11 rounded-xl border border-teal-200 px-4 font-semibold text-teal-700">Resume current round</button>}<button disabled={!nouns.length} onClick={() => { const round = nouns.slice(0, 15); update({ total: round.length, done: 0, misses: 0, feedback: null, queue: round }); lock.current = false; setSetupVisible(false); }} className="min-h-11 rounded-xl bg-teal-600 px-4 font-semibold text-white disabled:opacity-50">{card ? "Start new round (replaces current round)" : "Start article practice"}</button>{!nouns.length && <p className="text-sm text-[#6B7280]">Add nouns with a known article in Words to start.</p>}</main>;
}
