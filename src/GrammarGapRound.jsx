import React, { useRef, useState } from "react";
import { GRAMMAR_GAPS, advanceGrammarGap } from "./grammarGap";

// Progress and question-card semantics adapted from 21st.dev demo 29790.
export default function GrammarGapRound({ grammarSession, persistGrammarSession, onSavingChange, onNavigate, onFinish, today }) {
  const state = grammarSession.__gapRound || {};
  const { queue = null, result = null, done = 0, misses = 0, total = GRAMMAR_GAPS.length } = state;
  const [setup, setSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);
  const locked = useRef(Boolean(result));
  const update = async (changes) => {
    if (savingRef.current) return false;
    savingRef.current = true; onSavingChange(true); setSaving(true); setSaveError("");
    try {
      await persistGrammarSession({ ...grammarSession, __gapRound: { ...state, ...changes } });
      return true;
    } catch {
      setSaveError("Could not save this step locally. Your previous progress is still available; try again.");
      return false;
    } finally { savingRef.current = false; onSavingChange(false); setSaving(false); }
  };
  const current = queue?.[0];
  const choose = async (choice) => {
    if (!current || locked.current || savingRef.current) return;
    locked.current = true;
    const correct = choice === current.answer;
    if (!await update({ result: { choice, correct }, misses: misses + (correct ? 0 : 1) })) locked.current = false;
  };
  const next = async () => {
    if (!result || !locked.current || savingRef.current) return;
    const complete = result.correct && queue.length === 1;
    if (await update({ queue: advanceGrammarGap(queue, result.correct), done: done + (result.correct ? 1 : 0), result: null, ...(complete ? { completedOn: today } : {}) })) {
      locked.current = false;
      if (complete) onFinish();
    }
  };
  const start = async () => { if (await update({ queue: GRAMMAR_GAPS, total: GRAMMAR_GAPS.length, result: null, done: 0, misses: 0 })) { locked.current = false; setSetup(false); } };
  const message = <>{saving && <p role="status" className="text-sm text-[#6B7280]">Saving locally…</p>}{saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}</>;

  if (queue && !current && !setup) return <main className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-6"><h2 className="text-2xl font-semibold">Grammar round complete</h2><p className="text-sm text-[#6B7280]">{done} gaps completed · {misses} incorrect {misses === 1 ? "attempt" : "attempts"}.</p><button disabled={saving} onClick={async () => { if (await update({ queue: null, result: null })) setSetup(true); }} className="min-h-11 rounded-xl bg-teal-600 px-4 font-semibold text-white">Choose another round</button>{message}</main>;
  if (current && !setup) return <main className="mx-auto max-w-xl space-y-5 rounded-2xl border border-[#E5E7EB] bg-white p-6"><button disabled={saving} onClick={() => setSetup(true)} className="min-h-11 text-sm font-semibold text-teal-700">← Pause and return to setup</button><div role="progressbar" aria-label="Grammar gaps completed" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-2 overflow-hidden rounded-full bg-[#ECEAE5]"><div className="h-full bg-teal-600" style={{ width: `${done / total * 100}%` }} /></div><p className="text-sm text-[#6B7280]">{done} of {total} gaps complete{misses ? ` · ${misses} incorrect ${misses === 1 ? "attempt" : "attempts"}` : ""}</p><h2 className="text-xl font-semibold">{current.prompt}</h2><div className="grid gap-2" aria-label="Choose the missing words">{current.options.map((option) => <button key={option} onClick={() => choose(option)} disabled={Boolean(result) || saving} className="min-h-11 rounded-xl border border-[#dce6dd] bg-white px-4 text-left font-semibold text-[#30324A] disabled:opacity-60">{option}</button>)}</div>{result && <div role="status" className="space-y-3 rounded-xl bg-[#edf6ef] p-4"><p className="font-semibold">{result.correct ? "Correct." : `Not quite. The answer is ${current.answer}; this gap will return.`}</p><p className="text-sm leading-6">{current.rule}</p><button disabled={saving} onClick={next} className="min-h-11 rounded-xl bg-teal-600 px-4 font-semibold text-white">Next</button></div>}{message}</main>;
  return <main className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-6"><p className="text-xs font-bold uppercase tracking-wide text-teal-700">Offline practice</p><h2 className="text-2xl font-semibold">Fill the grammar gap</h2><p className="text-sm leading-6 text-[#6B7280]">Ten mixed-topic questions, with a short rule after each answer. Missed questions return later. This round does not change your topic lesson progress.</p>{current && <button onClick={() => setSetup(false)} className="mr-3 min-h-11 rounded-xl border border-teal-200 px-4 font-semibold text-teal-700">Resume round</button>}<button disabled={saving} onClick={start} className="min-h-11 rounded-xl bg-teal-600 px-4 font-semibold text-white">{current ? "Start new round (replaces current round)" : "Start ten gaps"}</button><button onClick={() => onNavigate("Grammar")} className="block min-h-11 text-sm font-semibold text-teal-700">Open grammar lessons →</button>{message}</main>;
}
