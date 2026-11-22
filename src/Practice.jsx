import React, { useMemo, useRef, useState } from "react";
import { Bookmark, Check, ChevronLeft, Mic, Send, Volume2, X } from "lucide-react";

const scenarios = [
  { id: "interview", title: "Job interview", subtitle: "Introduce yourself and talk about your experience", level: "B1", opening: "Guten Tag, schön, dass Sie da sind. Können Sie sich kurz vorstellen?", openingEn: "Good afternoon. It’s nice to have you here. Could you briefly introduce yourself?" },
  { id: "burgeramt", title: "Bürgeramt", subtitle: "An appointment, a form, or a certificate", level: "B1", opening: "Guten Tag. Wie kann ich Ihnen helfen?", openingEn: "Good afternoon. How can I help you?" },
  { id: "housing", title: "Finding a home", subtitle: "Ask about an apartment and its terms", level: "B1", opening: "Guten Tag. Was ist Ihnen bei einer Wohnung besonders wichtig?", openingEn: "Good afternoon. What matters most to you in an apartment?" },
  { id: "doctor", title: "At the doctor", subtitle: "Describe a symptom and understand advice", level: "B1", opening: "Guten Tag. Was führt Sie heute zu mir?", openingEn: "Good afternoon. What brings you in today?" },
  { id: "cafe", title: "At a café", subtitle: "Order, ask a question, and pay", level: "A2", opening: "Hallo! Was darf ich Ihnen bringen?", openingEn: "Hello! What can I get for you?" },
  { id: "transport", title: "Train and bus", subtitle: "Tickets, platforms, and delays", level: "A2", opening: "Guten Morgen. Wohin möchten Sie fahren?", openingEn: "Good morning. Where would you like to go?" },
];

const wordBook = {
  bewerben: { translation: "to apply for a job", wordType: "verb", cefrLevel: "B1", forms: { present: "bewirbt sich", past: "bewarb sich", perfect: "hat sich beworben" }, example: "Ich habe mich gestern beworben.", exampleEn: "I applied yesterday.", inflections: ["bewerben", "bewirbst", "bewirbt", "bewerbe", "bewarb", "beworben"] },
  stelle: { translation: "position; job opening", artikel: "die", wordType: "noun", inflections: ["stelle", "stelle"] },
  team: { translation: "team", artikel: "das", wordType: "noun" },
  besonders: { translation: "particularly; especially", wordType: "adverb" },
  interessant: { translation: "interesting", wordType: "adjective" },
  spannend: { translation: "exciting; engaging", wordType: "adjective" },
  aufgabe: { translation: "task; responsibility", artikel: "die", wordType: "noun" },
  erfahrung: { translation: "experience", artikel: "die", wordType: "noun" },
};

const todayKey = () => new Date().toLocaleDateString("en-CA");
const clean = (value = "") => value.toLowerCase().normalize("NFC").replace(/[.!?,;:]/g, "").replace(/\s+/g, " ").trim();
const keyForLesson = (lesson) => `${lesson.scenario}:${lesson.category}:${clean(lesson.example)}`;
const speakGerman = (text) => {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang?.startsWith("de"));
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "de-DE";
  window.speechSynthesis.speak(utterance);
  return true;
};

function validTurn(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.reply !== "string" || !value.reply.trim() || value.reply.length > 1200) return null;
  if (typeof value.translation !== "string" || !value.translation.trim() || value.translation.length > 2000 || !Array.isArray(value.corrections)) return null;
  const corrections = value.corrections;
  if (corrections.length > 6 || corrections.some((item) => !item || typeof item.original !== "string" || typeof item.corrected !== "string" || typeof item.explanation !== "string")) return null;
  const validCorrections = corrections.filter((item) => item.original.trim() && item.corrected.trim() && item.explanation.trim());
  if (validCorrections.some((item) => item.original.length > 500 || item.corrected.length > 500 || item.explanation.length > 700)) return null;
  return { reply: value.reply.trim(), translation: value.translation.trim(), correctedText: String(value.correctedText || validCorrections[0]?.corrected || "").trim(), corrections: validCorrections.map((item) => ({ original: item.original.trim(), corrected: item.corrected.trim(), explanation: item.explanation.trim(), category: String(item.category || "Grammar"), example: String(item.example || item.corrected).trim() })) };
}

function fixtureTurn(input) {
  if (/gestern habe ich mich für diese stelle bewerben, weil ich arbeite gern im team/i.test(input)) return validTurn({
    reply: "Das klingt nach einer interessanten Stelle. Du hast dich also schon beworben. Was spricht dich an der Aufgabe besonders an?",
    translation: "That sounds like an interesting position. So you have already applied. What appeals to you most about the role?",
    correctedText: "Gestern habe ich mich für diese Stelle beworben, weil ich gern im Team arbeite.",
    corrections: [
      { original: "habe ich mich für diese Stelle bewerben", corrected: "Gestern habe ich mich für diese Stelle beworben, weil ich gern im Team arbeite.", explanation: "In the Perfekt, use the past participle ‘beworben’ with ‘habe’, not the infinitive ‘bewerben’.", category: "Grammar · Perfekt", example: "Ich habe mich gestern beworben." },
      { original: "weil ich arbeite gern im Team", corrected: "Gestern habe ich mich für diese Stelle beworben, weil ich gern im Team arbeite.", explanation: "After ‘weil’, the conjugated verb goes to the end of the clause: ‘…weil ich gern im Team arbeite.’", category: "Word order · weil clause", example: "Ich lerne Deutsch, weil ich in Deutschland arbeite." },
    ],
  });
  if (/keine fehler|ich habe schon in einem team gearbeitet/i.test(input)) return validTurn({ reply: "Das ist eine gute Erfahrung für die Stelle. Welche Aufgabe hat dir in dem Projekt am meisten Spaß gemacht?", translation: "That is good experience for the position. Which task did you enjoy most in that project?", corrections: [] });
  return validTurn({ reply: "Danke, das hilft mir, dich besser kennenzulernen. Kannst du mir dazu noch ein konkretes Beispiel geben?", translation: "Thanks, that helps me get to know you better. Can you give me one specific example?", corrections: [] });
}

function tokenize(text, onWord) {
  return text.split(/([\p{L}ÄÖÜäöüß-]+)/u).map((part, index) => (/^[\p{L}ÄÖÜäöüß-]+$/u.test(part)
    ? <button key={`${part}-${index}`} type="button" onClick={() => onWord(part)} className="rounded-sm text-left decoration-indigo-300 underline decoration-dotted underline-offset-4 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{part}</button>
    : <React.Fragment key={index}>{part}</React.Fragment>));
}

export default function Practice({ apiKey, vocabWords, setVocabWords, savedSentences, setSavedSentences, grammarLessons, setGrammarLessons, practiceMessages, setPracticeMessages, practiceScenario, setPracticeScenario, practiceDraft, setPracticeDraft, onAskLena }) {
  const [scenario, setScenario] = useState(practiceScenario || null);
  const [demoMode, setDemoMode] = useState(true);
  const [messages, setMessages] = useState(practiceMessages || []);
  const [draft, setDraft] = useState(practiceDraft || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState(null);
  const [lessonOffer, setLessonOffer] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");
  const [audioFallback, setAudioFallback] = useState(false);
  const [view, setView] = useState(practiceScenario && practiceMessages?.length ? "conversation" : "scenarios");
  const sendingRef = useRef(false);
  const chosenScenario = scenarios.find((item) => item.id === scenario);
  const hasCorrections = messages.some((item) => item.role === "assistant" && item.turn?.corrections?.length);
  const corrections = messages.flatMap((item) => item.role === "assistant" ? item.turn?.corrections || [] : []);
  const lessonCandidates = useMemo(() => corrections.map((item) => ({
    id: `${scenario}:${item.category}:${clean(item.example)}`,
    title: item.category.split("·")[0].trim() === "Word order" ? "Verb position in a ‘weil’ clause" : "Perfekt: use the past participle",
    category: item.category.toLowerCase().includes("word order") ? "Word order" : "Grammar",
    explanation: item.explanation,
    example: item.example,
    scenario: chosenScenario?.title || "Practice",
    createdAt: todayKey(),
  })).filter((item, index, list) => list.findIndex((other) => keyForLesson(other) === keyForLesson(item)) === index), [messages, scenario]);

  const start = (id, demo = true) => {
    const selected = scenarios.find((item) => item.id === id);
    setScenario(id); setPracticeScenario(id);
    setDemoMode(demo);
    setView("conversation");
    const opening = { id: `${Date.now()}-opening`, role: "assistant", turn: { reply: selected.opening, translation: selected.openingEn, corrections: [] } };
    setMessages([opening]); setPracticeMessages([opening]);
    setDraft(""); setPracticeDraft(""); setError(""); setLessonOffer(false); setLookup(null);
  };

  const send = async () => {
    const input = draft.trim();
    if (!input || busy || sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true); setError("");
    try {
      const turn = demoMode || apiKey === "offline-mode" ? fixtureTurn(input) : validTurn(await onAskLena(scenario, messages, input));
      if (!turn) throw new Error("Lena’s reply could not be checked. Your message is safe; retry it when you’re ready.");
      const next = [...messages, { id: `${Date.now()}-user`, role: "user", text: input }, { id: `${Date.now()}-lena`, role: "assistant", turn }];
      setMessages(next); setPracticeMessages(next); setDraft(""); setPracticeDraft("");
    } catch (cause) {
      setDraft(input); setPracticeDraft(input);
      setError(cause.message || "Lena couldn’t reply. Your draft is still here.");
    } finally { sendingRef.current = false; setBusy(false); }
  };

  const lookupWord = (surface, sentence, levelOverride) => {
    const lowered = clean(surface);
    const matchedWord = vocabWords.find((item) => [item.word, ...(item.forms ? Object.values(item.forms) : [])].some((form) => clean(form).split(" ").includes(lowered)));
    const lemma = matchedWord?.word || Object.keys(wordBook).find((key) => wordBook[key].inflections?.includes(lowered) || key === lowered) || (wordBook[lowered] ? lowered : null);
    const details = matchedWord || (lemma && wordBook[lemma]);
    setLookup(details ? { surface, lemma: matchedWord?.word || lemma, sentence, level: levelOverride || matchedWord?.cefrLevel || wordBook[lemma]?.cefrLevel || chosenScenario?.level, details, saved: Boolean(matchedWord) } : { surface, sentence, error: true });
  };

  const addLookup = () => {
    if (!lookup || lookup.error) return;
    if (lookup.details.id) { setLookup({ ...lookup, saved: true }); return; }
    const source = lookup.sentence || lookup.details.example || "";
    const entry = { id: `practice-${Date.now()}`, word: lookup.lemma, artikel: lookup.details.artikel || null, wordType: lookup.details.wordType || "word", translation: lookup.details.translation, forms: lookup.details.forms || null, tags: [lookup.details.cefrLevel || chosenScenario?.level || "B1", "Practice"], cefrLevel: lookup.details.cefrLevel || chosenScenario?.level || "B1", sourceContext: source, contexts: [{ sentence: source, translation: lookup.details.exampleEn || "", register: "casual" }], addedAt: todayKey(), srsInterval: 1, srsDue: todayKey(), srsEase: 2.5, srsReps: 0, srsLapses: 0 };
    setVocabWords((current) => [...current, entry]);
    setLookup({ ...lookup, saved: true, details: { ...lookup.details, id: entry.id } });
  };

  const bookmark = (message) => {
    if (savedSentences.some((item) => item.sourceMessageId === message.id)) return;
    setSavedSentences((current) => [...current, { id: `sentence-${message.id}`, sourceMessageId: message.id, german: message.turn.reply, translation: message.turn.translation, scenario: chosenScenario?.title || "Practice", cefrLevel: chosenScenario?.level || "B1", pronunciation: message.turn.reply, createdAt: todayKey(), srsInterval: 1, srsDue: todayKey(), srsEase: 2.5, srsReps: 0, srsLapses: 0 }]);
    setSavedNotice("Saved as one sentence for later practice.");
  };

  const saveLessons = () => {
    setGrammarLessons((current) => {
      const existing = new Set(current.map(keyForLesson));
      return [...current, ...lessonCandidates.filter((item) => !existing.has(keyForLesson(item)))];
    });
    setLessonOffer(false); setSavedNotice(`${lessonCandidates.length} lesson${lessonCandidates.length === 1 ? "" : "s"} saved.`); setView("scenarios"); setScenario(null); setPracticeScenario(null);
  };

  const leave = () => {
    if (hasCorrections) setLessonOffer(true);
    else { setView("scenarios"); setScenario(null); setPracticeScenario(null); }
  };

  if (view === "saved") return <main className="mx-auto max-w-2xl space-y-4 pb-24" aria-label="Saved Sentences">
    <button onClick={() => setView("scenarios")} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#4F46E5]"><ChevronLeft size={18} /> Back to Practice</button>
    <header><p className="text-xs font-bold uppercase tracking-[.16em] text-[#5B55D9]">Practice library</p><h2 className="mt-2 text-3xl font-semibold">Saved Sentences <span className="text-[#8A8B93]">· {savedSentences.length}</span></h2></header>
    {savedSentences.length ? savedSentences.map((sentence) => <article key={sentence.id} className="rounded-2xl border border-[#E8E5DF] bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><p className="text-base leading-7">{tokenize(sentence.german, (word) => lookupWord(word, sentence.german, sentence.cefrLevel))}</p><button aria-label="Play sentence" onClick={() => { if (!speakGerman(sentence.german)) setAudioFallback(true); }} className="h-11 w-11 rounded-xl bg-[#F4F2ED] text-[#5752C9]"><Volume2 size={18} /></button></div><p className="mt-2 text-sm text-[#757780]">{sentence.translation}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#767780]">{sentence.scenario} · {sentence.cefrLevel}</p></article>) : <div className="rounded-2xl border border-dashed border-[#D8D5CF] p-8 text-center text-sm text-[#70727B]">Bookmark a tutor reply to keep the whole reply here.</div>}
    {audioFallback && <p role="status" className="text-xs text-[#747680]">Audio is unavailable here. Read the German text shown above.</p>}
    {lookup && <WordLookup lookup={lookup} level={lookup.level} onAdd={addLookup} onSpeak={() => { if (!speakGerman(lookup.lemma || lookup.surface)) setAudioFallback(true); }} onClose={() => setLookup(null)} />}
  </main>;

  if (view === "conversation" && chosenScenario) return <main className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-2xl flex-col pb-24">
    <header className="sticky top-[72px] z-10 -mx-2 mb-4 flex items-center justify-between border-b border-[#E9E6E0] bg-[#F8F7F4]/95 px-2 py-3 backdrop-blur sm:top-[76px]"><div className="flex items-center gap-3"><button onClick={leave} aria-label="Leave conversation" className="grid h-11 w-11 place-items-center rounded-full border border-[#E7E4DE] bg-white"><ChevronLeft size={19} /></button><div><h2 className="font-semibold">{chosenScenario.title}</h2><p className="text-xs text-[#777983]">Lena · {demoMode ? "practice demo" : "B1 practice"}</p></div></div><button onClick={() => setView("saved")} className="min-h-11 rounded-full border border-[#DFDDF2] bg-[#F1F0FC] px-3 text-xs font-semibold text-[#4E49C5]">Saved Sentences · {savedSentences.length}</button></header>
    <section className="flex-1 space-y-4" aria-live="polite">{messages.map((message) => message.role === "user" ? <div key={message.id} className="flex justify-end"><p className="max-w-[88%] rounded-2xl rounded-br-md bg-[#5D55D6] px-4 py-3 text-sm leading-6 text-white">{message.text}</p></div> : <div key={message.id} className="space-y-2"><article className="rounded-2xl rounded-tl-md border border-[#E7E4DE] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="flex-1 text-sm leading-7">{tokenize(message.turn.reply, (word) => lookupWord(word, message.turn.reply))}</p><div className="flex gap-1"><button aria-label="Play tutor reply" onClick={() => { if (!speakGerman(message.turn.reply)) setAudioFallback(true); }} className="grid h-10 w-10 place-items-center rounded-lg text-[#5D55D6] hover:bg-[#F2F0FA]"><Volume2 size={17} /></button><button aria-label="Bookmark entire tutor reply" aria-pressed={savedSentences.some((item) => item.sourceMessageId === message.id)} title="Save the entire reply" onClick={() => bookmark(message)} className="grid h-10 w-10 place-items-center rounded-lg text-[#5D55D6] hover:bg-[#F2F0FA]"><Bookmark size={17} /></button></div></div>{message.turn.translation && <p className="mt-2 text-xs leading-5 text-[#777983]">{message.turn.translation}</p>}<p className="mt-2 text-[10px] text-[#92939A]">Tap a word for its meaning · bookmark saves the whole reply</p></article>
      {!!message.turn.corrections.length && <article className="rounded-2xl border border-[#D8EEE4] bg-[#F1FAF5] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[#236B4B]"><Check size={17} /> A clearer way to say it</div><p className="mt-3 text-sm font-semibold leading-6 text-[#252832]">{message.turn.correctedText || message.turn.corrections[0].corrected}</p>{message.turn.corrections.map((correction, index) => <div key={index} className="mt-3 border-t border-[#DCEFE5] pt-3 first:border-0 first:pt-0"><p className="text-xs font-semibold text-[#5C6265]">{correction.category}</p><p className="mt-1 text-xs leading-5 text-[#5C6265]">{correction.explanation}</p></div>)}<button onClick={() => setLessonOffer(true)} className="mt-3 text-xs font-semibold text-[#385DB5]">Keep these lessons</button></article>}</div>)}</section>
    {busy && <p className="my-3 text-sm text-[#777983]" role="status">Lena is thinking…</p>}{error && <div role="alert" className="my-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error} <button onClick={send} className="ml-2 font-bold underline">Retry</button></div>}
    <form onSubmit={(event) => { event.preventDefault(); send(); }} className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 mt-4 flex items-end gap-2 border-t border-[#E6E3DD] bg-[#F8F7F4]/95 py-3 backdrop-blur sm:bottom-0"><label className="sr-only" htmlFor="practice-message">Write your answer in German</label><textarea id="practice-message" value={draft} onChange={(event) => { setDraft(event.target.value); setPracticeDraft(event.target.value); }} disabled={busy} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Write your answer in German…" rows={2} className="min-h-12 flex-1 resize-y rounded-2xl border border-[#DDDAD3] bg-white px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#625BD7]"/><button type="submit" disabled={busy || !draft.trim()} aria-label="Send message" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#5D55D6] text-white disabled:opacity-50"><Send size={18} /></button></form>
    {audioFallback && <p role="status" className="mb-2 text-xs text-[#747680]">Audio is unavailable here. Read the German text shown above.</p>}
    {lookup && <WordLookup lookup={lookup} level={lookup.details?.cefrLevel || chosenScenario?.level} onAdd={addLookup} onSpeak={() => { if (!speakGerman(lookup.lemma || lookup.surface)) setAudioFallback(true); }} onClose={() => setLookup(null)} />}
    {lessonOffer && <div role="dialog" aria-modal="true" aria-labelledby="lesson-offer-title" className="fixed inset-0 z-40 grid place-items-center bg-black/35 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"><h3 id="lesson-offer-title" className="text-lg font-semibold">Keep what you learned?</h3><p className="mt-2 text-sm leading-6 text-[#70727B]">Lena found {lessonCandidates.length} distinct lesson{lessonCandidates.length === 1 ? "" : "s"} in this conversation.</p><div className="mt-4 flex gap-2"><button onClick={saveLessons} className="min-h-11 flex-1 rounded-xl bg-[#5D55D6] px-4 text-sm font-semibold text-white">Save lessons</button><button onClick={() => { setLessonOffer(false); setView("scenarios"); setScenario(null); }} className="min-h-11 rounded-xl border border-[#E3E0DA] px-4 text-sm font-semibold">Not now</button></div></div></div>}
    {savedNotice && <button onClick={() => setSavedNotice("")} role="status" className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#25283A] px-4 py-2 text-sm text-white shadow-lg">{savedNotice}</button>}
  </main>;

  return <main className="mx-auto max-w-3xl space-y-5 pb-24">
    <header><p className="text-xs font-bold uppercase tracking-[.16em] text-[#5B55D9]">Speak with Lena</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Practice real German</h2><p className="mt-1 text-sm text-[#747680]">Choose a situation. Lena will keep the conversation moving and explain useful corrections.</p></header>
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#EFEEE9] p-1"><button onClick={() => setView("scenarios")} className={`min-h-11 rounded-xl text-sm font-semibold ${view === "scenarios" ? "bg-white shadow-sm" : "text-[#676974]"}`}>Scenarios</button><button onClick={() => setView("saved")} className="min-h-11 rounded-xl text-sm font-semibold text-[#676974]">Saved Sentences · {savedSentences.length}</button></div>
    <section className="rounded-2xl border border-[#E6E3DD] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Job interview</h3><p className="mt-1 text-sm text-[#757780]">Recommended · B1 · answer a real interview question</p></div><button onClick={() => start("interview", demoMode)} className="min-h-11 rounded-xl bg-[#5D55D6] px-4 text-sm font-semibold text-white">{demoMode ? "Try the deterministic demo" : "Start with Lena"}</button></div><div className="mt-3 flex items-center gap-2"><label className="flex items-center gap-2 text-xs text-[#757780]"><input type="checkbox" checked={!demoMode} onChange={(event) => setDemoMode(!event.target.checked)} /> Use Lena’s live AI when a key is set</label>{apiKey === "offline-mode" && <span className="text-xs text-[#858791]">Offline demo works without AI.</span>}</div></section>
    <div className="grid gap-3 sm:grid-cols-2">{scenarios.map((item) => <button key={item.id} onClick={() => start(item.id, demoMode)} className="group min-h-24 rounded-2xl border border-[#E6E3DD] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#BBB7EA] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#625BD7]"><div className="flex items-center justify-between"><span className="font-semibold">{item.title}</span><span className="rounded-full bg-[#F1F0FC] px-2 py-1 text-[10px] font-bold text-[#514BC5]">{item.level}</span></div><p className="mt-2 text-xs leading-5 text-[#767780]">{item.subtitle}</p></button>)}</div>
    <p className="text-xs leading-5 text-[#777983]">Demo replies are fixed examples for practicing and checking the save flows. Live AI replies require your saved OpenAI key.</p>
    {lookup && <WordLookup lookup={lookup} level={lookup.level} onAdd={addLookup} onSpeak={() => { if (!speakGerman(lookup.lemma || lookup.surface)) setAudioFallback(true); }} onClose={() => setLookup(null)} />}
  </main>;
}

function WordLookup({ lookup, level, onAdd, onSpeak, onClose }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="lookup-title" className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-lg rounded-2xl border border-[#E2DFD9] bg-white p-4 shadow-xl sm:inset-x-auto sm:bottom-6"><div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-2"><h3 id="lookup-title" className="font-semibold">{lookup.lemma || lookup.surface}</h3>{!lookup.error && <button aria-label="Hear word" onClick={onSpeak} className="grid h-9 w-9 place-items-center rounded-lg text-[#5752C9] hover:bg-[#F4F2ED]"><Volume2 size={16} /></button>}</div>{lookup.error ? <p className="mt-1 text-sm text-[#6F717B]">No safe dictionary match was found. Nothing was saved.</p> : <><p className="mt-1 text-sm text-[#656872]">{lookup.details.translation}</p><p className="mt-1 text-xs text-[#6F717B]">{level || "Level unknown"} · {lookup.details.wordType}</p>{lookup.details.forms && <p className="mt-2 text-xs leading-5 text-[#6F717B]">{Object.entries(lookup.details.forms).map(([name, form]) => `${name}: ${form}`).join(" · ")}</p>}<p className="mt-2 text-xs text-[#777983]">Source: “{lookup.sentence}”</p></>}</div><button aria-label="Close word lookup" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-[#F4F2ED]"><X size={17} /></button></div>{!lookup.error && <div className="mt-3 flex justify-end"><button onClick={onAdd} disabled={lookup.saved} className="min-h-10 rounded-xl bg-[#5D55D6] px-4 text-sm font-semibold text-white disabled:bg-[#E8F3ED] disabled:text-[#286447]">{lookup.saved ? "Already saved" : "Add to Words"}</button></div>}</div>;
}

export function GrammarLessonsPage({ lessons, onNavigate }) {
  const [filter, setFilter] = useState("All");
  const categories = ["All", ...new Set((lessons || []).map((lesson) => lesson.category).filter(Boolean))];
  const visible = (lessons || []).filter((lesson) => filter === "All" || lesson.category === filter);
  return <main className="mx-auto max-w-3xl space-y-5 pb-24"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#5B55D9]">Lena’s notebook</p><h2 className="mt-2 text-3xl font-semibold">Grammar lessons</h2><p className="mt-1 text-sm text-[#737680]">{lessons.length} short notes saved from your practice conversations.</p></div><button onClick={() => onNavigate("Practice")} className="min-h-11 rounded-xl bg-[#5D55D6] px-4 text-sm font-semibold text-white">Practice with Lena</button></header><div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category} onClick={() => setFilter(category)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${filter === category ? "border-[#5D55D6] bg-[#5D55D6] text-white" : "border-[#E4E1DB] bg-white text-[#5E606A]"}`}>{category} · {category === "All" ? lessons.length : lessons.filter((lesson) => lesson.category === category).length}</button>)}</div>{visible.length ? visible.map((lesson) => <article key={lesson.id} className="rounded-2xl border border-[#E6E3DD] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{lesson.title}</h3><span className="rounded-full bg-[#F0EFFA] px-2.5 py-1 text-[10px] font-bold uppercase text-[#514BC5]">{lesson.category}</span></div><p className="mt-3 rounded-xl bg-[#F5F4F0] p-3 text-xs text-[#737680]">{lesson.scenario}</p><p className="mt-3 text-sm leading-6 text-[#50525C]">{lesson.explanation}</p><p className="mt-3 border-l-2 border-[#C9C5EC] pl-3 text-sm font-medium leading-6">{lesson.example}</p><p className="mt-3 text-xs text-[#858791]">{lesson.createdAt}</p></article>) : <div className="rounded-2xl border border-dashed border-[#D8D5CF] p-8 text-center text-sm text-[#70727B]">No lessons yet. Keep a correction when you finish a conversation with Lena.</div>}</main>;
}
