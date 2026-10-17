import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleHelp, Compass, Headphones, MapPin, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import {
  ADVENTURE_QUESTION_TYPES,
  completeAdventureSession,
  continueAdventureSession,
  createAdventureProgress,
  createAdventureSession,
  getCurrentAdventureQuestion,
  getDueAdventureWords,
  markAdventureWordFamiliar,
  pauseAdventureSession,
  resumeAdventureSession,
  revealAdventureAnswer,
  submitAdventureAnswer,
  useAdventureHint,
} from "./adventureEngine";
import { FREQUENCY_WORDS } from "./frequencyWords";
import { ADVENTURE_ENRICHMENT } from "./adventureEnrichment";
import { ADVENTURE_MISSIONS } from "./adventureMissions";

const POS_NAMES = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", pron: "pronoun", prep: "preposition", conj: "conjunction", num: "number", part: "particle", det: "determiner", intj: "interjection" };
const BASE_BUTTON = "rounded-xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-45";
const PRIMARY = `${BASE_BUTTON} bg-indigo-600 text-white hover:bg-indigo-700`;
const SECONDARY = `${BASE_BUTTON} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`;
const nowIso = () => new Date().toISOString();

const explainUse = (item) => {
  const gloss = String(item.t || "this meaning").split(/\s*(?:\/|;|\bor\b)\s*/iu)[0].replace(/^to\s+/iu, "");
  if (item.p === "n") return `Here “${item.w}” names ${gloss}. The noun is used with ${item.a}, and the sentence shows it in an everyday phrase.`;
  if (item.p === "v") return `Here “${item.w}” expresses ${gloss}. The example shows the verb in a complete sentence; compare its sentence form with this dictionary form.`;
  if (["adj", "adv", "part", "det", "prep", "conj"].includes(item.p)) return `Here “${item.w}” adds the idea “${gloss}” to the sentence. Read the words around it to see what it describes or connects.`;
  return `Here “${item.w}” is used with the meaning “${gloss}.” The example shows how it fits into a short, everyday sentence.`;
};

const adventureWords = FREQUENCY_WORDS.map((item, index) => {
  const id = `freq-${index + 1}`;
  const extra = ADVENTURE_ENRICHMENT[id] || {};
  return {
    id,
    rank: index + 1,
    word: item.w,
    article: item.a || "",
    pos: POS_NAMES[item.p] || item.p || "word",
    meaning: item.t,
    exampleDe: extra.exampleDe || item.s,
    exampleEn: extra.exampleEn || item.e,
    explanation: extra.explanation || explainUse(item),
    breakdown: extra.breakdown || null,
    memoryTrick: extra.memoryTip?.startsWith("Memory trick:") ? extra.memoryTip : "",
    compoundParts: extra.compoundParts || [],
  };
});

const missionsWithScenes = ADVENTURE_MISSIONS.map((mission) => ({
  ...mission,
  finalScene: typeof mission.finalScene === "string"
    ? { title: mission.title, intro: mission.finalScene }
    : mission.finalScene,
}));
const wordsById = new Map(adventureWords.map((word) => [word.id, word]));
const progressLabel = (state) => ({
  "new": "New",
  "encountered": "Met",
  "practised": "Practised",
  "recalled-independently": "Recalled",
  "due-for-review": "Review due",
  "remembered-across-sessions": "Remembered across sessions",
}[state] || "New");

function speakGerman(text, voice) {
  if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.voice = voice || null;
  utterance.lang = voice?.lang || "de-DE";
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
  return true;
}

export default function VocabularyAdventure({ progress, setProgress, progressLoaded = true, session, setSession }) {
  const [activeSession, setActiveSession] = useState(false);
  const [missionMapOpen, setMissionMapOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const [voices, setVoices] = useState([]);
  const safeProgress = useMemo(() => createAdventureProgress(progress), [progress]);
  const voice = voices.find((candidate) => candidate.lang?.toLowerCase() === "de-de")
    || voices.find((candidate) => candidate.lang?.toLowerCase().startsWith("de"))
    || null;
  const dueWords = useMemo(() => getDueAdventureWords(safeProgress, adventureWords, nowIso()), [safeProgress]);
  const dueCount = dueWords.length;
  const completedCount = missionsWithScenes.filter((mission) => safeProgress.missions[mission.id]?.completedAt).length;
  const activeSaved = session && ["active", "paused", "ready-to-complete"].includes(session.status);
  const savedMission = activeSaved ? missionsWithScenes.find((item) => item.id === session.missionId) : null;
  const currentQuestion = activeSession && session ? getCurrentAdventureQuestion(session) : null;
  const currentMission = activeSession && session ? missionsWithScenes.find((item) => item.id === session.missionId) : null;
  const currentTarget = currentQuestion ? wordsById.get(currentQuestion.wordId) : null;
  const response = currentQuestion?.response;
  const hasFeedback = Boolean(response?.submitted);
  const finished = activeSession && session?.status === "completed";
  const questionIsAudio = currentQuestion?.type === ADVENTURE_QUESTION_TYPES.AUDIO_RECOGNITION;

  useEffect(() => {
    if (!window.speechSynthesis) return undefined;
    const update = () => setVoices(window.speechSynthesis.getVoices?.() || []);
    update();
    window.speechSynthesis.addEventListener?.("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", update);
  }, []);

  useEffect(() => {
    setAnswer("");
    setHintVisible(false);
  }, [session?.id, session?.cursor, activeSession]);

  if (!progressLoaded) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600" aria-busy="true">Loading your saved adventure…</div>;

  const startMission = (mission) => {
    const created = createAdventureSession({
      mission,
      words: adventureWords,
      progress: safeProgress,
      now: nowIso(),
      options: { audioAvailable: Boolean(voice) },
    });
    setProgress(created.progress);
    setSession(created.session);
    setActiveSession(true);
  };

  const resume = () => {
    if (!session) return;
    const timestamp = nowIso();
    const restored = resumeAdventureSession({ session, progress: safeProgress, words: adventureWords, now: timestamp });
    if (restored.session.cursor >= restored.session.questions.length && restored.session.status !== "completed") {
      const completed = completeAdventureSession({ session: restored.session, progress: restored.progress, now: timestamp });
      setSession(completed.session);
      setProgress(completed.progress);
    } else {
      setSession(restored.session);
      setProgress(restored.progress);
    }
    setActiveSession(true);
  };

  const submit = (event) => {
    event.preventDefault();
    if (!session || hasFeedback || !answer.trim()) return;
    const result = submitAdventureAnswer({ session, progress: safeProgress, answer, now: nowIso() });
    setSession(result.session);
    setProgress(result.progress);
  };

  const continueQuestion = () => {
    if (!session) return;
    const next = continueAdventureSession({ session, now: nowIso() });
    if (next.status === "ready-to-complete") {
      const completed = completeAdventureSession({ session: next, progress: safeProgress, now: nowIso() });
      setSession(completed.session);
      setProgress(completed.progress);
    } else {
      setSession(next);
    }
  };

  const pause = () => {
    if (!session) return;
    setSession(pauseAdventureSession({ session, now: nowIso() }));
    setActiveSession(false);
  };

  const exitToMap = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setActiveSession(false);
  };

  const useHint = () => {
    if (!session || hasFeedback) return;
    const result = useAdventureHint({ session, now: nowIso() });
    setSession(result.session);
    setHintVisible(true);
  };

  const reveal = () => {
    if (!session || hasFeedback) return;
    const result = revealAdventureAnswer({ session, progress: safeProgress, now: nowIso() });
    setSession(result.session);
    setProgress(result.progress);
  };

  const markFamiliar = () => {
    if (!session || hasFeedback) return;
    const result = markAdventureWordFamiliar({ session, progress: safeProgress, now: nowIso() });
    setSession(result.session);
    setProgress(result.progress);
  };

  const sayQuestion = () => {
    if (!currentQuestion || !voice) return;
    const audioText = questionIsAudio
      ? (currentQuestion.audioText || currentQuestion.contextDe || currentQuestion.word)
      : currentQuestion.contextDe || currentQuestion.word;
    speakGerman(audioText, voice);
  };

  if (activeSession && finished && currentMission) {
    const missionRecord = safeProgress.missions[currentMission.id] || {};
    const nextMission = missionsWithScenes.find((item) => !safeProgress.missions[item.id]?.completedAt);
    return (
      <section className="mx-auto max-w-3xl space-y-5" aria-labelledby="adventure-complete-title">
        <section className="rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-7 text-white shadow-lg sm:p-10">
          <p className="text-sm font-semibold text-indigo-100">Mission complete · {currentMission.location}</p>
          <h2 id="adventure-complete-title" className="mt-2 text-3xl font-bold">A good step forward.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-50">You worked with ten new targets and revisited earlier words. One session is useful practice; later recall is what shows which words are becoming familiar.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-2xl bg-white/15 px-4 py-3"><p className="text-xs text-indigo-100">Points earned</p><p className="text-2xl font-bold">{session.score.points}</p></div>
            <div className="rounded-2xl bg-white/15 px-4 py-3"><p className="text-xs text-indigo-100">Independent recalls</p><p className="text-2xl font-bold">{session.score.independentCorrect}</p></div>
            <div className="rounded-2xl bg-white/15 px-4 py-3"><p className="text-xs text-indigo-100">Missions explored</p><p className="text-2xl font-bold">{completedCount} / 100</p></div>
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-bold">Your words have a next step</h3>
          <p className="mt-1 text-sm text-slate-600">{Object.values(missionRecord.targetWordIds || {}).length || currentMission.wordIds.length} words were included. Due words return in later adventures.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {nextMission && <button className={PRIMARY} onClick={() => startMission(nextMission)}>Continue adventure <ArrowRight size={16} className="ml-1 inline" /></button>}
            <button className={SECONDARY} onClick={exitToMap}>Take a break / mission map</button>
          </div>
        </section>
      </section>
    );
  }

  if (activeSession && currentQuestion && currentMission) {
    const percent = Math.round((currentQuestion.position / currentQuestion.total) * 100);
    const encounter = currentQuestion.stage === "encounter";
    const revealed = Boolean(response?.revealed || response?.forceReveal || encounter && hasFeedback);
    const expectedAnswer = currentQuestion.expectedAnswer;
    const audioAvailableNow = Boolean(voice && window.speechSynthesis);
    const audioFallback = questionIsAudio && !audioAvailableNow;
    const answerChoices = currentQuestion.choices || currentQuestion.answerChoices || [];
    return (
      <section className="mx-auto max-w-3xl space-y-4" aria-labelledby="adventure-session-title">
        <header className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">{currentMission.location} · {currentQuestion.stage === "final" ? "Final scene" : currentQuestion.stage === "review" ? "Due review" : `Question ${currentQuestion.position} of ${currentQuestion.total}`}</p><h2 id="adventure-session-title" className="mt-1 text-xl font-bold sm:text-2xl">{currentMission.title}</h2></div>
            <div className="flex gap-2"><button className={SECONDARY} onClick={pause} aria-label="Pause and save session"><Pause size={16} /><span className="ml-1">Pause</span></button><button className={SECONDARY} onClick={exitToMap}>Exit</button></div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Mission progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%` }} /></div>
          <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Independent recall earns points</span><span>{session.score.points} points</span></div>
        </header>

        {currentQuestion.stage === "final" && (currentQuestion.sceneIntro || currentMission.finalScene?.intro) && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Final scene</p><p className="mt-1 text-sm leading-6 text-amber-950">{currentQuestion.sceneIntro || currentMission.finalScene.intro}</p></section>}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">{currentQuestion.stage === "encounter" ? "Encounter" : currentQuestion.stage === "practice" ? "Practice" : currentQuestion.stage === "retry" ? "Try again later" : currentQuestion.stage === "review" ? "Review" : currentQuestion.stage === "final" ? "Final challenge" : "Recall"}</span>{currentTarget && <span>Rank #{currentTarget.rank}</span>}</div>
            {voice && <button type="button" className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100" onClick={sayQuestion} aria-label="Hear German audio"><Volume2 size={17} className="mr-1 inline" />Hear German</button>}
          </div>
          {questionIsAudio && audioAvailableNow && <div className="mt-5 rounded-2xl bg-indigo-50 p-5 text-center"><Headphones className="mx-auto text-indigo-600" /><p className="mt-2 text-sm font-semibold text-indigo-950">Listen, then identify the meaning.</p><button type="button" className={`${SECONDARY} mt-3`} onClick={sayQuestion}><Play size={15} className="mr-1 inline" />Play again</button></div>}
          <h3 className="mt-5 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{audioFallback ? `Text version: write the useful English meaning of “${currentQuestion.article ? `${currentQuestion.article} ` : ""}${currentQuestion.word}”.` : currentQuestion.prompt}</h3>
          {currentQuestion.requiresArticle && <p className="mt-2 text-sm font-medium text-indigo-700">Include the noun's article (der, die, or das).</p>}
          {currentQuestion.contextDe && <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{questionIsAudio && audioAvailableNow ? "Spoken sentence" : "Situation"}</p>{!(questionIsAudio && audioAvailableNow) && <p className="mt-2 text-base font-semibold leading-7">{currentQuestion.contextDe}</p>}{currentQuestion.contextEn && <p className="mt-1 text-sm text-slate-600">{currentQuestion.contextEn}</p>}</div>}
          {currentQuestion.compoundParts?.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Compound parts">{currentQuestion.compoundParts.map((part, index) => <React.Fragment key={`${part}-${index}`}>{index > 0 && <span aria-hidden="true" className="text-slate-400">+</span>}<span className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 font-semibold text-indigo-800">{part}</span></React.Fragment>)}</div>}
          {questionIsAudio && audioFallback && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">The same meaning question is available as text while German audio is unavailable.</p>}
          {hintVisible && currentTarget && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><CircleHelp size={16} className="mr-1 inline" />Hint revealed: {currentTarget.meaning}. This question will not earn independent recall points.</p>}

          {!hasFeedback && <form onSubmit={submit} className="mt-5 space-y-3">
            {answerChoices.length > 0 ? <div className="grid gap-2 sm:grid-cols-2">{answerChoices.map((choice) => <button type="button" key={choice} onClick={() => setAnswer(choice)} aria-pressed={answer === choice} className={`${SECONDARY} text-left ${answer === choice ? "border-indigo-400 bg-indigo-50 text-indigo-800" : ""}`}>{choice}</button>)}</div> : <label className="block"><span className="sr-only">Your answer</span><input value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder={currentQuestion.answerLanguage === "de" ? "Your German answer" : "Your English meaning"} /></label>}
            <div className="flex flex-wrap gap-2"><button type="submit" className={PRIMARY} disabled={!answer.trim()}>Check answer</button><button type="button" className={SECONDARY} onClick={useHint}>Hint</button><button type="button" className={SECONDARY} onClick={reveal}>I don't know</button>{encounter && <button type="button" className="rounded-xl px-3 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50" onClick={markFamiliar}><Check size={16} className="mr-1 inline" />I already know this</button>}</div>
          </form>}

          {hasFeedback && <div className={`mt-5 rounded-2xl border p-4 ${response.result?.correct ? "border-emerald-200 bg-emerald-50" : response.result?.status === "self-reported-familiar" ? "border-indigo-200 bg-indigo-50" : "border-rose-200 bg-rose-50"}`} role="status" aria-live="polite"><p className={`font-bold ${response.result?.correct ? "text-emerald-900" : "text-slate-900"}`}>{response.result?.feedback}</p>{revealed && currentTarget && <div className="mt-4 border-t border-black/10 pt-4"><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><h4 className="text-xl font-bold">{currentTarget.article && <span className="text-slate-500">{currentTarget.article} </span>}{currentTarget.word}</h4><span className="text-sm text-slate-500">{currentTarget.pos}</span></div><p className="mt-1 text-base font-semibold">{currentTarget.meaning}</p><div className="mt-3 flex flex-wrap items-center gap-2"><p className="font-medium">{currentTarget.exampleDe}</p>{!response.result?.correct && window.speechSynthesis && <button type="button" className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400" onClick={() => speakGerman(currentTarget.exampleDe, voice)} aria-label="Play the German example sentence"><Volume2 size={16} className="mr-1 inline" />Listen</button>}</div><p className="text-sm text-slate-600">{currentTarget.exampleEn}</p><p className="mt-2 text-sm leading-6 text-slate-700">{currentTarget.explanation}</p>{currentTarget.breakdown && <p className="mt-2 rounded-xl bg-white/70 p-3 text-sm text-slate-800"><span className="font-bold">Word parts:</span> {currentTarget.breakdown}</p>}{currentTarget.memoryTrick && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{currentTarget.memoryTrick}</p>}<p className="mt-2 text-xs font-semibold text-slate-500">Progress: {progressLabel(safeProgress.words[currentTarget.id]?.state)}</p></div>}{!revealed && !response.result?.correct && <p className="mt-2 text-sm text-slate-700">Answer: <strong>{expectedAnswer}</strong></p>}<button type="button" className={`${PRIMARY} mt-4`} onClick={continueQuestion}>Continue <ArrowRight size={16} className="ml-1 inline" /></button></div>}
        </section>
      </section>
    );
  }

  const resumable = activeSaved && savedMission;
  const startingIndex = Math.max(0, missionsWithScenes.findIndex((item) => item.id === `mission-${safeProgress.startingMissionNumber}`));
  const missionOrder = [...missionsWithScenes.slice(startingIndex), ...missionsWithScenes.slice(0, startingIndex)];
  const nextMission = missionOrder.find((item) => !safeProgress.missions[item.id]?.completedAt) || missionOrder.at(-1);
  const nextTargets = nextMission.wordIds.map((id) => wordsById.get(id)).filter(Boolean);
  const encountered = Object.values(safeProgress.words).filter((item) => item.encountered).length;
  const practised = Object.values(safeProgress.words).filter((item) => item.practised).length;
  const recalled = Object.values(safeProgress.words).filter((item) => item.independentRecallCount > 0).length;
  const remembered = Object.values(safeProgress.words).filter((item) => item.state === "remembered-across-sessions").length;

  return (
    <section className="mx-auto max-w-4xl space-y-5" aria-labelledby="adventure-title">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#182346] via-indigo-800 to-violet-700 p-6 text-white shadow-lg sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">1,000 Words Adventure</p><h2 id="adventure-title" className="mt-2 text-3xl font-extrabold sm:text-4xl">German, one moment at a time.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">Explore the app’s curated frequency-based vocabulary through everyday scenes, short practice rounds, and later recall. A session helps you practise; it does not promise permanent mastery.</p></div><div className="hidden rounded-2xl bg-white/10 p-3 sm:block"><Compass size={26} aria-hidden="true" /></div></div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Missions", `${completedCount} / 100`], ["Encountered", encountered], ["Practised", practised], ["Remembered later", remembered]].map(([label, value]) => <div key={label} className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-indigo-100">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>
        <div className="mt-3 text-xs text-indigo-100">{recalled} words have had at least one independent recall · {dueCount} due for review</div>
      </section>

      {resumable ? <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Your saved session</p><h3 className="mt-1 text-xl font-bold text-slate-900">{savedMission.title}</h3><p className="mt-1 text-sm text-slate-600">{session.status === "paused" ? "Paused and ready when you are." : "Pick up where you left off."} Your answer and mission progress are saved on this device/account.</p><div className="mt-4 flex flex-wrap gap-2"><button className={PRIMARY} onClick={resume}>Continue adventure <ArrowRight size={16} className="ml-1 inline" /></button><button className={SECONDARY} onClick={() => { setSession({ ...session, status: "paused" }); }}>Keep paused</button></div></section> : <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Next up · {nextMission.location}</p><h3 className="mt-1 text-2xl font-bold">{nextMission.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{nextMission.intro}</p><div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><MapPin size={14} />{nextMission.category}<span>·</span>10 new targets<span>·</span>due words return for practice</div><button className={`${PRIMARY} mt-5`} onClick={() => startMission(nextMission)}>Start this mission <ArrowRight size={16} className="ml-1 inline" /></button></article>
        <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">A useful pause point</p><h3 className="mt-1 text-lg font-bold text-amber-950">Short rounds, lasting progress</h3><p className="mt-2 text-sm leading-6 text-amber-900">Each mission introduces two words at a time, then returns to them after other questions. Later sessions check recall again. Take a break whenever you like; earned progress stays saved.</p>{dueCount > 0 && <p className="mt-3 text-sm font-bold text-amber-950">{dueCount} words are ready for review in your next mission.</p>}</aside>
      </section>}

      {!resumable && <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"><div><h3 className="font-bold">Choose your starting level</h3><p className="mt-1 text-sm text-slate-600">Skip ahead if the first frequent words are already familiar. Earlier missions stay available for later review.</p></div><div className="mt-3 flex flex-wrap gap-2 sm:mt-0">{[[1, "Start at the basics"], [11, "A bit more challenge"], [21, "Skip ahead"]].map(([missionNumber, label]) => <button key={missionNumber} type="button" aria-pressed={safeProgress.startingMissionNumber === missionNumber} className={safeProgress.startingMissionNumber === missionNumber ? "rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white" : "rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"} onClick={() => setProgress({ ...safeProgress, startingMissionNumber: missionNumber })}>{label}</button>)}</div></section>}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Your journey</h3><p className="text-sm text-slate-500">Choose any location or continue from your next mission.</p></div><button className={SECONDARY} onClick={() => setMissionMapOpen((open) => !open)} aria-expanded={missionMapOpen}>{missionMapOpen ? "Hide mission map" : "Explore the mission map"}</button></div>
        {!missionMapOpen && !resumable && <div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Mission {nextMission.id.split("-")[1]} · {nextMission.location}</p><p className="mt-1 font-semibold">{nextMission.title}</p></div><BookOpen className="text-indigo-500" size={20} /></div><div className="mt-3 flex gap-1" aria-hidden="true">{nextTargets.map((word) => <span key={word.id} className="h-1.5 flex-1 rounded-full bg-indigo-200" />)}</div></div>}
        {missionMapOpen && <div className="mt-4 max-h-[32rem] space-y-2 overflow-auto pr-1" aria-label="100 vocabulary missions">{missionsWithScenes.map((mission, index) => { const record = safeProgress.missions[mission.id]; const done = Boolean(record?.completedAt); const isNext = mission.id === nextMission.id; return <button key={mission.id} onClick={() => startMission(mission)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${done ? "border-emerald-200 bg-emerald-50/50" : isNext ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200 bg-white"}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700"}`}>{done ? <Check size={16} /> : index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{mission.title}</span><span className="block text-xs text-slate-500">{mission.location} · {mission.category}</span></span><span className="shrink-0 text-xs font-bold text-slate-500">{done ? "Complete" : isNext ? "Next" : "10 words"}</span></button>; })}</div>}
      </section>

      <p className="px-1 text-xs leading-5 text-slate-500">This is the app’s curated frequency-based set, not a definitive ranking of all German. Word familiarity alone does not establish conversational comprehension.</p>
    </section>
  );
}
