import React, { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, ClipboardCheck, MessageCircle, Plus, Sparkles } from "lucide-react";
import { grammarPractisedToday } from "./grammarSession";
import StudioProgress from "./StudioProgress";

const dateKey = () => {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
};

export default function Home({ vocabWords, savedSentences, blockData, grammarProgress, grammarSession, thinkState, setThinkState, stories, onNavigate }) {
  const today = dateKey();
  const reviewDone = vocabWords.filter((item) => item.srsLastReviewed === today).length;
  const dueCount = vocabWords.filter((item) => !item.srsDue || item.srsDue <= today).length + savedSentences.filter((item) => !item.srsDue || item.srsDue <= today).length;
  const addedCount = vocabWords.filter((item) => item.addedAt === today).length;
  const grammarDone = grammarPractisedToday(blockData, grammarSession, today);
  const explanation = thinkState[today]?.textExplanation || "";
  const [draft, setDraft] = useState(explanation);
  const [saved, setSaved] = useState(Boolean(explanation.trim()));
  useEffect(() => { setDraft(explanation); setSaved(Boolean(explanation.trim())); }, [explanation]);
  const text = stories?.[0]?.text?.slice(0, 260) || "In Deutschland ist der Alltag oft voller neuer Wörter. Wer regelmäßig übt, kann sich Schritt für Schritt sicherer ausdrücken.";
  const doneCount = Number(reviewDone >= 5) + Number(addedCount >= 1) + Number(grammarDone) + Number(saved);
  const tasks = [
    { title: "Review five words", detail: `${Math.min(reviewDone, 5)} of 5 rated today`, icon: ClipboardCheck, action: "Open review", destination: "Review", complete: reviewDone >= 5 },
    { title: "Save one new word", detail: addedCount ? "A word saved today" : "Find a word worth keeping", icon: Plus, action: "Open words", destination: "Words", complete: addedCount >= 1 },
    { title: "Practise a grammar rule", detail: grammarDone ? "Grammar practice completed" : "Continue a B1 topic", icon: BookOpen, action: "Open grammar", destination: "Grammar", complete: grammarDone },
  ];
  const next = tasks.find(task => !task.complete);
  const saveExplanation = (event) => {
    event.preventDefault();
    const answer = draft.trim();
    if (!answer) return;
    setThinkState((current) => ({ ...current, [today]: { ...(current[today] || {}), textExplanation: answer, textExplanationAt: new Date().toISOString() } }));
    setSaved(true);
  };

  return <div className="studio-home">
    <div className="studio-home-top"><div><p className="studio-eyebrow"><Sparkles size={14}/> YOUR SPACE TO LEARN</p><h2>Hallo, ready to practise?</h2><p>Small steps today. More confidence in German tomorrow.</p></div><span className="studio-date">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span></div>
    <div className="studio-home-grid"><div className="studio-home-main">
      <section className="studio-hero"><div className="studio-hero-copy"><p className="studio-eyebrow">YOUR NEXT STEP <span>✳</span></p><h3>{next ? next.title : saved ? "You’ve completed today’s plan" : "Explain a text in German"}</h3><p>{next ? next.detail : saved ? "Come back whenever you’re ready for more practice." : "Put what you’ve read into your own words."}</p><button type="button" onClick={() => next ? onNavigate(next.destination) : saved ? onNavigate("Review") : document.getElementById("text-explanation")?.focus()}>{next ? next.action : saved ? "Open review" : "Write your explanation"}<ArrowRight size={17}/></button></div><div className="studio-hero-art" aria-hidden="true"><span>Wort für Wort.</span><strong>Dein<br/>Deutsch.</strong><div className="studio-hero-circle">B1<br/><small>DEIN WEG</small></div></div></section>
      <div className="studio-section-heading"><div><p className="studio-eyebrow">A LITTLE EVERY DAY</p><h3>Today’s practice</h3></div><span>{doneCount} of 4 complete</span></div>
      <div className="studio-task-list">{tasks.map(({ title, detail, icon: Icon, action, destination, complete }) => <article className="studio-task" key={title}><div className={`studio-task-icon ${complete ? "is-complete" : ""}`}>{complete ? <Check size={19}/> : <Icon size={19}/>}</div><div className="studio-task-copy"><h4>{title}</h4><p>{detail}</p></div><button type="button" onClick={() => onNavigate(destination)} aria-label={`${action}: ${title}`}>{action}<ArrowRight size={16}/></button></article>)}</div>
      <section className="studio-writing"><div className="studio-writing-title"><div className="studio-task-icon"><MessageCircle size={19}/></div><div><h4>Explain a text</h4><p>In German, say what the passage means in your own words.</p></div>{saved && <span className="studio-saved"><Check size={14}/> Saved</span>}</div><blockquote>{text}{text.length >= 260 ? "…" : ""}</blockquote><form onSubmit={saveExplanation}><label htmlFor="text-explanation">Your explanation</label><textarea id="text-explanation" rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Der Text handelt von…"/><button disabled={!draft.trim()}>{saved ? "Update explanation" : "Save explanation"}<ArrowRight size={16}/></button></form></section>
    </div><aside className="studio-home-aside"><section className="studio-side-card"><p className="studio-eyebrow">YOUR DAILY ROUTINE</p><h3>One step at a time.</h3><p>Your practice comes together here, at your own pace.</p><StudioProgress value={doneCount} max={4} label="Today's progress" /></section><section className="studio-side-card"><p className="studio-eyebrow">YOUR LIBRARY</p><div className="studio-stat"><strong>{dueCount}</strong><span>words and sentences<br/>ready to review</span></div><button type="button" onClick={() => onNavigate("Review")}>Start a review <ArrowRight size={16}/></button></section><section className="studio-side-card studio-side-tint"><p className="studio-eyebrow">YOUR B1 JOURNEY</p><h3>{(grammarProgress.completedTopics || []).length} <span>/ 10 topics</span></h3><p>{vocabWords.length} words saved in your library.</p><button type="button" onClick={() => onNavigate("Mission")}>See your learning plan <ArrowRight size={16}/></button></section><button type="button" className="studio-quick-link" onClick={() => onNavigate("Articles")}>Practise articles <ArrowRight size={16}/></button><button type="button" className="studio-quick-link" onClick={() => onNavigate("GrammarGaps")}>Try ten grammar gaps <ArrowRight size={16}/></button></aside></div>
  </div>;
}
