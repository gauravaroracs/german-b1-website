import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import "./styles.css";

const BLUE = "#4F46E5";
const GREEN = "#10B981";
const RED = "#F43F5E";
const AMBER = "#F59E0B";
const TODAY = new Date();
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const primaryButton = "rounded-full bg-[#4F46E5] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA] disabled:opacity-60";
const secondaryButton = "rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#111827] shadow-sm hover:bg-[#F9FAFB]";
const cardClass = "rounded-2xl border border-[#E5E7EB] bg-white shadow-sm";

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (date = TODAY) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const todayKey = dateKey(TODAY);
const normalize = (value) => value.trim().toLowerCase().replace(/[.!?]/g, "").replace(/\s+/g, " ");
const MotionButton = motion.button;
const MotionArticle = motion.article;

if (!window.storage) {
  const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("deutsch-meister-storage", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("kv");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transact = async (mode, action) => {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const store = db.transaction("kv", mode).objectStore("kv");
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };
  window.storage = {
    get: (key) => transact("readonly", (store) => store.get(key)),
    set: (key, value) => transact("readwrite", (store) => store.put(value, key)),
    remove: (key) => transact("readwrite", (store) => store.delete(key)),
  };
}

const storage = {
  async get(key, fallback) {
    try {
      if (!window.storage?.get) return fallback;
      const result = await window.storage.get(key);
      const raw = typeof result === "object" && result !== null && "value" in result ? result.value : result;
      if (raw === undefined || raw === null || raw === "") return fallback;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return fallback;
    }
  },
  async set(key, value) {
    if (!window.storage?.set) return;
    await window.storage.set(key, JSON.stringify(value));
  },
  async remove(key) {
    if (window.storage?.remove) await window.storage.remove(key);
  },
};

const seedVocab = [
  {
    id: "seed-bewerbung",
    word: "Bewerbung",
    gender: "die",
    meaning: "job application",
    sentence: "Ich habe meine Bewerbung gestern Abend abgeschickt.",
    sentence_english: "I sent my job application yesterday evening.",
    dateAdded: "2026-05-11",
  },
  {
    id: "seed-vorstellung",
    word: "Vorstellungsgespräch",
    gender: "das",
    meaning: "job interview",
    sentence: "Morgen habe ich ein Vorstellungsgespräch bei einer Firma in Frankfurt.",
    sentence_english: "Tomorrow I have a job interview at a company in Frankfurt.",
    dateAdded: "2026-05-11",
  },
  {
    id: "seed-stelle",
    word: "Stelle",
    gender: "die",
    meaning: "position",
    sentence: "Die Stelle klingt interessant, aber das Gehalt ist noch unklar.",
    sentence_english: "The position sounds interesting, but the salary is still unclear.",
    dateAdded: "2026-05-11",
  },
  {
    id: "seed-lebenslauf",
    word: "Lebenslauf",
    gender: "der",
    meaning: "CV",
    sentence: "Er hat seinen Lebenslauf auf Deutsch geschrieben.",
    sentence_english: "He wrote his CV in German.",
    dateAdded: "2026-05-11",
  },
  {
    id: "seed-faehigkeit",
    word: "Fähigkeit",
    gender: "die",
    meaning: "skill",
    sentence: "Teamarbeit ist eine wichtige Fähigkeit im Berufsleben.",
    sentence_english: "Teamwork is an important skill in professional life.",
    dateAdded: "2026-05-11",
  },
];

const grammarTopics = [
  {
    title: "Artikel + Nominativ",
    explanation: [
      "Der Nominativ zeigt, wer oder was etwas tut. In einfachen Sätzen steht das Subjekt meistens am Anfang: Der Kollege wartet. Die Chefin ruft an. Das Meeting beginnt um neun.",
      "Für B1 brauchst du den Artikel schnell und automatisch. Im Beruf klingt ein Satz sofort klarer, wenn der Artikel stimmt: Der Lebenslauf ist aktuell. Die Bewerbung ist fertig. Das Gespräch war freundlich.",
    ],
    exercises: [
      { type: "blank", prompt: "___ Lebenslauf ist aktuell.", answer: "Der" },
      { type: "choice", prompt: "___ Bewerbung ist fertig.", options: ["Der", "Die", "Das", "Den"], answer: "Die" },
      { type: "fix", prompt: "Die Kollege wartet im Büro.", answer: "Der Kollege wartet im Büro." },
      { type: "blank", prompt: "___ Meeting beginnt um neun Uhr.", answer: "Das" },
      { type: "choice", prompt: "___ Chefin ruft heute an.", options: ["Die", "Der", "Den", "Dem"], answer: "Die" },
    ],
  },
  {
    title: "Akkusativ",
    explanation: [
      "Der Akkusativ zeigt oft das direkte Objekt: Was kaufst du? Ich kaufe einen Kaffee. Wen triffst du? Ich treffe den Kunden.",
      "Nur maskuline Artikel ändern sich stark: der wird den, ein wird einen. Das ist im Alltag wichtig: Ich schreibe einen Bericht. Sie hat ihren Lebenslauf geschickt.",
    ],
    exercises: [
      { type: "blank", prompt: "Ich kaufe ___ Kaffee.", answer: "einen" },
      { type: "choice", prompt: "Sie liest ___ Vertrag.", options: ["den", "der", "dem", "das"], answer: "den" },
      { type: "fix", prompt: "Ich habe der Lebenslauf geschickt.", answer: "Ich habe den Lebenslauf geschickt." },
      { type: "blank", prompt: "Wir suchen ___ neue Wohnung.", answer: "eine" },
      { type: "choice", prompt: "Er braucht ___ Formular.", options: ["das", "der", "dem", "den"], answer: "das" },
    ],
  },
  {
    title: "Dativ",
    explanation: [
      "Der Dativ zeigt oft, wem etwas passiert oder für wen etwas ist: Ich helfe dem Kollegen. Sie antwortet der Kundin. Wir danken dem Team.",
      "Nach vielen festen Verben brauchst du Dativ. Im Beruf hörst du oft: Ich stimme dem Vorschlag zu. Das hilft meinem Projekt.",
    ],
    exercises: [
      { type: "blank", prompt: "Ich helfe ___ Kollegen.", answer: "dem" },
      { type: "choice", prompt: "Sie antwortet ___ Kundin.", options: ["der", "die", "den", "das"], answer: "der" },
      { type: "fix", prompt: "Wir danken das Team.", answer: "Wir danken dem Team." },
      { type: "blank", prompt: "Das gehört ___ Firma.", answer: "der" },
      { type: "choice", prompt: "Ich stimme ___ Vorschlag zu.", options: ["dem", "den", "der", "das"], answer: "dem" },
    ],
  },
  {
    title: "Präteritum",
    explanation: [
      "Das Präteritum benutzt du oft beim Schreiben und bei wichtigen Verben wie sein, haben und werden. Ich war gestern im Büro. Wir hatten ein langes Meeting.",
      "Für berufliche Geschichten ist es kurz und klar: Früher arbeitete ich in Delhi. Danach wurde ich Projektmanager.",
    ],
    exercises: [
      { type: "blank", prompt: "Gestern ___ ich im Büro.", answer: "war" },
      { type: "choice", prompt: "Wir ___ ein langes Meeting.", options: ["hatten", "haben", "hattet", "habt"], answer: "hatten" },
      { type: "fix", prompt: "Er ist früher Entwickler.", answer: "Er war früher Entwickler." },
      { type: "blank", prompt: "Danach ___ sie Teamleiterin.", answer: "wurde" },
      { type: "choice", prompt: "Ich ___ keine Zeit.", options: ["hatte", "war", "wurde", "habe"], answer: "hatte" },
    ],
  },
  {
    title: "Perfekt vs Präteritum",
    explanation: [
      "Im Gespräch nutzt du meistens Perfekt: Ich habe den Bericht geschrieben. Ich bin nach Berlin gefahren. Das klingt natürlich im Alltag.",
      "Präteritum ist normal bei sein, haben und werden: Ich war müde. Ich hatte viele Aufgaben. In Mails mischst du beides, wenn es klar klingt.",
    ],
    exercises: [
      { type: "blank", prompt: "Ich ___ den Bericht geschrieben.", answer: "habe" },
      { type: "choice", prompt: "Gestern ___ ich krank.", options: ["war", "bin gewesen", "habe", "hatte"], answer: "war" },
      { type: "fix", prompt: "Ich habe nach München gefahren.", answer: "Ich bin nach München gefahren." },
      { type: "blank", prompt: "Sie ___ das Formular ausgefüllt.", answer: "hat" },
      { type: "choice", prompt: "Wir ___ sehr wenig Zeit.", options: ["hatten", "haben gehabt", "sind", "wurden"], answer: "hatten" },
    ],
  },
  {
    title: "Konjunktiv II",
    explanation: [
      "Konjunktiv II macht Wünsche und höfliche Fragen möglich. Ich hätte gern einen Termin. Könnten Sie mir bitte helfen?",
      "Für professionelle Situationen ist er sehr wichtig, weil direkte Sätze oft hart klingen. Ich würde gern mehr über die Stelle erfahren.",
    ],
    exercises: [
      { type: "blank", prompt: "Ich ___ gern einen Termin.", answer: "hätte" },
      { type: "choice", prompt: "___ Sie mir bitte helfen?", options: ["Könnten", "Können", "Kannst", "Hätten"], answer: "Könnten" },
      { type: "fix", prompt: "Ich will gern mehr über die Stelle erfahren.", answer: "Ich würde gern mehr über die Stelle erfahren." },
      { type: "blank", prompt: "Das ___ sehr hilfreich.", answer: "wäre" },
      { type: "choice", prompt: "Ich ___ morgen Zeit.", options: ["hätte", "hatte", "habe", "bin"], answer: "hätte" },
    ],
  },
  {
    title: "Passiv",
    explanation: [
      "Passiv ist nützlich, wenn die Handlung wichtiger ist als die Person. Der Vertrag wird geprüft. Die Bewerbung wurde gestern abgeschickt.",
      "Im Beruf klingt Passiv sachlich und professionell. Die Unterlagen werden bis Freitag vorbereitet. Danach wird der Termin bestätigt.",
    ],
    exercises: [
      { type: "blank", prompt: "Der Vertrag ___ geprüft.", answer: "wird" },
      { type: "choice", prompt: "Die Unterlagen ___ vorbereitet.", options: ["werden", "wird", "wurde", "haben"], answer: "werden" },
      { type: "fix", prompt: "Die Bewerbung wird gestern abgeschickt.", answer: "Die Bewerbung wurde gestern abgeschickt." },
      { type: "blank", prompt: "Der Termin ___ bestätigt.", answer: "wird" },
      { type: "choice", prompt: "Das Formular ___ online ausgefüllt.", options: ["wird", "werden", "hat", "ist"], answer: "wird" },
    ],
  },
  {
    title: "Adjektivendungen",
    explanation: [
      "Adjektivendungen zeigen, wie das Nomen im Satz funktioniert. Ein aktueller Lebenslauf ist wichtig. Der aktuelle Lebenslauf liegt im Anhang.",
      "Du musst nicht jede Tabelle auswendig können, aber häufige Muster müssen sitzen: eine gute Bewerbung, ein freundliches Gespräch, mit einem neuen Kollegen.",
    ],
    exercises: [
      { type: "blank", prompt: "Das ist ein aktuell___ Lebenslauf.", answer: "er" },
      { type: "choice", prompt: "Sie schreibt eine gut___ Bewerbung.", options: ["e", "en", "er", "es"], answer: "e" },
      { type: "fix", prompt: "Ich hatte ein freundliche Gespräch.", answer: "Ich hatte ein freundliches Gespräch." },
      { type: "blank", prompt: "Ich arbeite mit einem neu___ Kollegen.", answer: "en" },
      { type: "choice", prompt: "Der wichtig___ Termin ist morgen.", options: ["e", "er", "en", "es"], answer: "e" },
    ],
  },
  {
    title: "Relativsätze",
    explanation: [
      "Relativsätze verbinden Informationen elegant. Das ist die Firma, die mich eingeladen hat. Ich kenne den Kollegen, der im Vertrieb arbeitet.",
      "Das Verb steht am Ende. Für B1 ist das wichtig, weil deine Sätze dadurch genauer klingen: Der Bericht, den ich gestern geschrieben habe, ist fertig.",
    ],
    exercises: [
      { type: "blank", prompt: "Das ist die Firma, ___ mich eingeladen hat.", answer: "die" },
      { type: "choice", prompt: "Ich kenne den Kollegen, ___ im Vertrieb arbeitet.", options: ["der", "den", "dem", "die"], answer: "der" },
      { type: "fix", prompt: "Der Bericht, den ich habe geschrieben, ist fertig.", answer: "Der Bericht, den ich geschrieben habe, ist fertig." },
      { type: "blank", prompt: "Das ist das Formular, ___ ich brauche.", answer: "das" },
      { type: "choice", prompt: "Die Chefin, ___ ich geantwortet habe, ist nett.", options: ["der", "die", "den", "das"], answer: "der" },
    ],
  },
  {
    title: "Wechselpräpositionen",
    explanation: [
      "Wechselpräpositionen nutzen Akkusativ für Bewegung und Dativ für Position. Ich gehe in das Büro. Ich bin im Büro.",
      "Die Frage hilft: Wohin? Akkusativ. Wo? Dativ. Ich lege den Vertrag auf den Tisch. Der Vertrag liegt auf dem Tisch.",
    ],
    exercises: [
      { type: "blank", prompt: "Ich gehe in ___ Büro.", answer: "das" },
      { type: "choice", prompt: "Ich bin in ___ Büro.", options: ["dem", "das", "den", "der"], answer: "dem" },
      { type: "fix", prompt: "Der Vertrag liegt auf den Tisch.", answer: "Der Vertrag liegt auf dem Tisch." },
      { type: "blank", prompt: "Ich lege den Stift auf ___ Tisch.", answer: "den" },
      { type: "choice", prompt: "Das Bild hängt an ___ Wand.", options: ["der", "die", "den", "das"], answer: "der" },
    ],
  },
];

const phrases = [
  ["Interview", "Ich bewerbe mich auf die ausgeschriebene Stelle als...", "I am applying for the advertised position as...", "Ich bewerbe mich auf die ausgeschriebene Stelle als Junior Projektmanager."],
  ["Interview", "Ich bringe Erfahrung in ... mit.", "I bring experience in...", "Ich bringe Erfahrung in Kundenservice und Planung mit."],
  ["Interview", "Meine größte Stärke ist...", "My greatest strength is...", "Meine größte Stärke ist, dass ich ruhig und strukturiert arbeite."],
  ["Interview", "Ich bin teamfähig und arbeite gerne mit anderen zusammen.", "I work well in teams.", "Ich bin teamfähig und arbeite gerne mit anderen zusammen, besonders bei komplexen Aufgaben."],
  ["Interview", "Wo sehen Sie sich in fünf Jahren?", "Where do you see yourself in five years?", "Wo sehen Sie sich in fünf Jahren in unserem Unternehmen?"],
  ["Interview", "Ich bin bereit, mich weiterzubilden.", "I am willing to continue developing myself.", "Ich bin bereit, mich weiterzubilden und neue Tools zu lernen."],
  ["Interview", "Ich habe in meinem letzten Job ... gelernt.", "In my last job I learned...", "Ich habe in meinem letzten Job gelernt, mit Kunden professionell zu sprechen."],
  ["Interview", "Können Sie mir mehr über die Aufgaben erzählen?", "Can you tell me more about the responsibilities?", "Können Sie mir mehr über die Aufgaben im ersten Monat erzählen?"],
  ["Interview", "Wann würde ich von Ihnen hören?", "When would I hear from you?", "Wann würde ich von Ihnen nach dem Gespräch hören?"],
  ["Interview", "Vielen Dank für das Gespräch.", "Thank you for the conversation.", "Vielen Dank für das Gespräch und Ihre Zeit."],
  ["E-Mails", "Vielen Dank für Ihre schnelle Rückmeldung.", "Thank you for your quick response.", "Vielen Dank für Ihre schnelle Rückmeldung zu meiner Bewerbung."],
  ["E-Mails", "Im Anhang finden Sie...", "Attached you will find...", "Im Anhang finden Sie meinen Lebenslauf und mein Anschreiben."],
  ["E-Mails", "Könnten Sie mir bitte bestätigen, dass...", "Could you please confirm that...", "Könnten Sie mir bitte bestätigen, dass Sie die Unterlagen erhalten haben?"],
  ["E-Mails", "Ich freue mich auf Ihre Antwort.", "I look forward to your reply.", "Ich freue mich auf Ihre Antwort und wünsche Ihnen einen schönen Tag."],
  ["E-Mails", "Entschuldigen Sie die späte Rückmeldung.", "Sorry for the late reply.", "Entschuldigen Sie die späte Rückmeldung, ich war gestern unterwegs."],
  ["E-Mails", "Ich hätte noch eine kurze Frage.", "I still have a quick question.", "Ich hätte noch eine kurze Frage zum Termin am Dienstag."],
  ["E-Mails", "Der Termin passt mir gut.", "The appointment works well for me.", "Der Termin passt mir gut, vielen Dank."],
  ["E-Mails", "Leider kann ich an diesem Tag nicht.", "Unfortunately I cannot on that day.", "Leider kann ich an diesem Tag nicht, aber Mittwoch wäre möglich."],
  ["E-Mails", "Ich melde mich bis Freitag bei Ihnen.", "I will get back to you by Friday.", "Ich melde mich bis Freitag bei Ihnen mit den fehlenden Informationen."],
  ["E-Mails", "Mit freundlichen Grüßen", "Kind regards", "Mit freundlichen Grüßen, Gaurav Arora"],
  ["Smalltalk", "Wie war Ihr Wochenende?", "How was your weekend?", "Wie war Ihr Wochenende, hatten Sie gutes Wetter?"],
  ["Smalltalk", "Ich bin noch dabei, Deutsch zu lernen.", "I am still learning German.", "Ich bin noch dabei, Deutsch zu lernen, aber ich übe jeden Tag."],
  ["Smalltalk", "Das klingt interessant.", "That sounds interesting.", "Das klingt interessant, erzählen Sie mir mehr darüber."],
  ["Smalltalk", "Ich kenne mich hier noch nicht so gut aus.", "I do not know my way around here very well yet.", "Ich kenne mich hier noch nicht so gut aus, weil ich neu in der Stadt bin."],
  ["Smalltalk", "Haben Sie einen Tipp für mich?", "Do you have a tip for me?", "Haben Sie einen Tipp für ein gutes Café in der Nähe?"],
  ["Smalltalk", "Das Wetter ist heute angenehm.", "The weather is pleasant today.", "Das Wetter ist heute angenehm, nicht zu warm und nicht zu kalt."],
  ["Smalltalk", "Ich wünsche Ihnen einen schönen Feierabend.", "Have a nice evening after work.", "Ich wünsche Ihnen einen schönen Feierabend und bis morgen."],
  ["Smalltalk", "Wie lange arbeiten Sie schon hier?", "How long have you been working here?", "Wie lange arbeiten Sie schon hier in der Abteilung?"],
  ["Smalltalk", "Ich muss mich erst daran gewöhnen.", "I have to get used to it first.", "Ich muss mich erst an den deutschen Winter gewöhnen."],
  ["Smalltalk", "Das habe ich auch schon gehört.", "I have heard that too.", "Das habe ich auch schon gehört, aber ich war noch nie dort."],
  ["Behörden", "Ich habe einen Termin um ... Uhr.", "I have an appointment at ... o'clock.", "Ich habe einen Termin um zehn Uhr wegen meiner Anmeldung."],
  ["Behörden", "Welche Unterlagen brauche ich dafür?", "Which documents do I need for that?", "Welche Unterlagen brauche ich dafür und muss ich Kopien mitbringen?"],
  ["Behörden", "Könnten Sie das bitte wiederholen?", "Could you please repeat that?", "Könnten Sie das bitte wiederholen, ich habe es nicht verstanden."],
  ["Behörden", "Ich möchte meine Adresse ändern.", "I would like to change my address.", "Ich möchte meine Adresse ändern, weil ich umgezogen bin."],
  ["Behörden", "Wo muss ich unterschreiben?", "Where do I have to sign?", "Wo muss ich unterschreiben, auf der ersten oder zweiten Seite?"],
  ["Behörden", "Ich habe dieses Formular online ausgefüllt.", "I filled out this form online.", "Ich habe dieses Formular online ausgefüllt und ausgedruckt."],
  ["Behörden", "Bis wann muss ich das einreichen?", "By when do I have to submit this?", "Bis wann muss ich das einreichen, damit es rechtzeitig bearbeitet wird?"],
  ["Behörden", "Ich brauche eine Bescheinigung.", "I need a certificate.", "Ich brauche eine Bescheinigung für meinen Arbeitgeber."],
  ["Behörden", "Kann ich das per E-Mail schicken?", "Can I send that by email?", "Kann ich das per E-Mail schicken oder muss ich persönlich kommen?"],
  ["Behörden", "Vielen Dank für Ihre Hilfe.", "Thank you for your help.", "Vielen Dank für Ihre Hilfe, das war sehr freundlich."],
  ["Arbeitsplatz", "Ich kümmere mich darum.", "I will take care of it.", "Ich kümmere mich darum und gebe Ihnen später ein Update."],
  ["Arbeitsplatz", "Ich habe dazu eine Frage.", "I have a question about that.", "Ich habe dazu eine Frage, bevor ich mit der Aufgabe starte."],
  ["Arbeitsplatz", "Können wir kurz darüber sprechen?", "Can we briefly talk about it?", "Können wir kurz darüber sprechen, wenn Sie Zeit haben?"],
  ["Arbeitsplatz", "Ich brauche noch etwas Zeit.", "I need a little more time.", "Ich brauche noch etwas Zeit, weil die Daten nicht vollständig sind."],
  ["Arbeitsplatz", "Das ist bereits erledigt.", "That is already done.", "Das ist bereits erledigt, ich habe es gestern abgeschlossen."],
  ["Arbeitsplatz", "Ich schicke Ihnen gleich die Datei.", "I will send you the file shortly.", "Ich schicke Ihnen gleich die Datei mit den aktuellen Zahlen."],
  ["Arbeitsplatz", "Ich bin mir nicht ganz sicher.", "I am not completely sure.", "Ich bin mir nicht ganz sicher, ob diese Lösung richtig ist."],
  ["Arbeitsplatz", "Lassen Sie uns einen Termin vereinbaren.", "Let us schedule an appointment.", "Lassen Sie uns einen Termin vereinbaren, um die nächsten Schritte zu planen."],
  ["Arbeitsplatz", "Ich gebe Ihnen Bescheid.", "I will let you know.", "Ich gebe Ihnen Bescheid, sobald ich eine Antwort habe."],
  ["Arbeitsplatz", "Das hat gut funktioniert.", "That worked well.", "Das hat gut funktioniert, wir können so weitermachen."],
].map(([category, german, english, example], id) => ({ id, category, german, english, example }));

const thoughtPrompts = [
  "Beschreibe deine Morgenroutine auf Deutsch, nur in deinem Kopf.",
  "Was hast du heute gegessen? Denk es Schritt für Schritt auf Deutsch.",
  "Plane deinen nächsten Einkauf innerlich auf Deutsch.",
  "Beschreibe den Weg zur Arbeit oder zur Uni in einfachen deutschen Sätzen.",
  "Denk an drei Dinge, die du heute erledigen musst.",
  "Beschreibe eine Person, die du heute gesehen hast.",
  "Erzähle dir selbst, warum du Deutsch lernst.",
  "Denk durch, was du morgen früh zuerst machen wirst.",
  "Beschreibe dein Zimmer oder deinen Arbeitsplatz.",
  "Formuliere drei höfliche Fragen, die du heute stellen könntest.",
];

const connectors = [
  ["aber", "Ich möchte kommen, aber ich habe heute wenig Zeit."],
  ["jedoch", "Der Job ist interessant, jedoch ist der Weg sehr lang."],
  ["trotzdem", "Ich bin müde, trotzdem lerne ich heute Deutsch."],
  ["deshalb", "Ich habe morgen ein Gespräch, deshalb bereite ich mich heute vor."],
  ["deswegen", "Der Bus ist spät, deswegen komme ich fünf Minuten später."],
  ["daher", "Ich möchte in Deutschland arbeiten, daher lerne ich berufliches Deutsch."],
  ["obwohl", "Obwohl die Aufgabe schwer ist, versuche ich es noch einmal."],
  ["außerdem", "Ich habe Erfahrung mit Kunden, außerdem arbeite ich gerne im Team."],
  ["eigentlich", "Eigentlich wollte ich früher schlafen, aber ich muss noch lernen."],
  ["zwar ... aber", "Die Grammatik ist zwar schwierig, aber sie wird langsam klarer."],
  ["jedenfalls", "Jedenfalls habe ich heute zwanzig Minuten geübt."],
];

const thinkingPhrases = [
  ["Warte mal...", "Wait a moment..."],
  ["Wie heißt das nochmal?", "What's that called again?"],
  ["Das macht Sinn.", "That makes sense."],
  ["Ich muss das überlegen.", "I need to think about that."],
  ["Keine Ahnung.", "No idea."],
  ["Das ist interessant.", "That's interesting."],
  ["Stimmt, das habe ich vergessen.", "Right, I forgot that."],
  ["Das brauche ich später.", "I will need that later."],
  ["Ich probiere es einfach.", "I will just try it."],
  ["Das ist nicht so schlimm.", "That is not so bad."],
];

const situations = [
  { situation: "Du gehst zur Mensa. Was denkst du?", native: "Ich habe Hunger. Vielleicht esse ich heute Reis mit Gemüse. Danach brauche ich einen Kaffee." },
  { situation: "Du wartest auf die Bahn. Was geht dir durch den Kopf?", native: "Die Bahn ist wieder spät. Ich hoffe, ich komme pünktlich. Ich schreibe kurz eine Nachricht." },
  { situation: "Du öffnest deinen Laptop am Morgen.", native: "Zuerst prüfe ich meine E-Mails. Dann plane ich meine Aufgaben. Heute möchte ich konzentriert arbeiten." },
  { situation: "Du bereitest dich auf ein Gespräch vor.", native: "Ich bin ein bisschen nervös, aber gut vorbereitet. Ich möchte ruhig sprechen und klare Beispiele geben." },
];

const builderExercises = [
  { words: ["Ich", "habe", "heute", "Kaffee", "getrunken"], answer: "Ich habe heute Kaffee getrunken" },
  { words: ["Morgen", "gehe", "ich", "zum", "Vorstellungsgespräch"], answer: "Morgen gehe ich zum Vorstellungsgespräch" },
  { words: ["Der", "Termin", "passt", "mir", "gut"], answer: "Der Termin passt mir gut" },
  { words: ["Ich", "muss", "noch", "meinen", "Lebenslauf", "schicken"], answer: "Ich muss noch meinen Lebenslauf schicken" },
];

const storyCategories = ["Behörden & Alltag", "Bewerbung", "Uni-Leben", "Smalltalk", "Tech-Welt"];

const staticStories = [
  {
    id: "auslaenderbehoerde",
    title: "Ein Termin bei der Ausländerbehörde",
    category: "Behörden & Alltag",
    status: "unread",
    cover: "from-indigo-100 to-emerald-100",
    words: [
      { word: "Unterlagen", meaning: "documents" },
      { word: "Termin", meaning: "appointment" },
      { word: "Bescheinigung", meaning: "certificate" },
      { word: "Wartezimmer", meaning: "waiting room" },
    ],
    text:
      "Arjun ist ein indischer Informatikstudent in Darmstadt. Am Dienstag hat er einen Termin bei der Ausländerbehörde. Er steht früh auf, weil er seine Unterlagen noch einmal prüfen möchte. Im Ordner liegen sein Pass, die Studienbescheinigung und ein Foto. Vor dem Gebäude wartet schon eine lange Schlange. Arjun ist etwas nervös, trotzdem bleibt er ruhig. Im Wartezimmer liest er eine E-Mail von einer Firma in Frankfurt. Sie möchten seinen Lebenslauf sehen. Nach zwanzig Minuten ruft eine Mitarbeiterin seinen Namen. Sie spricht schnell, aber freundlich. Arjun sagt: „Könnten Sie das bitte wiederholen?“ Die Mitarbeiterin lächelt und erklärt alles noch einmal langsam. Am Ende bekommt Arjun eine Bescheinigung. Er ist erleichtert, denn jetzt kann er sich wieder auf seine Bewerbung konzentrieren.",
    questions: [
      { q: "Warum steht Arjun früh auf?", options: ["Er möchte einkaufen.", "Er prüft seine Unterlagen.", "Er hat eine Vorlesung.", "Er fährt nach Berlin."], answer: "Er prüft seine Unterlagen." },
      { q: "Wie fühlt sich Arjun vor dem Termin?", options: ["Etwas nervös", "Sehr wütend", "Gelangweilt", "Krank"], answer: "Etwas nervös" },
      { q: "Was bekommt Arjun am Ende?", options: ["Eine Rechnung", "Eine Bescheinigung", "Einen Vertrag", "Ein Ticket"], answer: "Eine Bescheinigung" },
    ],
    nextPrompt: "Arjun verlässt die Behörde und sieht eine neue E-Mail von der Firma. Was passiert als Nächstes?",
    modelContinuation:
      "Nach dem Termin setzt sich Arjun in ein Café. Er öffnet seinen Laptop und verbessert seinen Lebenslauf. Danach schreibt er eine kurze, höfliche Antwort an die Firma. Er fühlt sich sicherer, weil ein wichtiges Problem gelöst ist.",
  },
  {
    id: "bewerbung-frankfurt",
    title: "Die Bewerbung nach Frankfurt",
    category: "Bewerbung",
    status: "unread",
    cover: "from-rose-100 to-amber-100",
    words: [
      { word: "ausgeschrieben", meaning: "advertised" },
      { word: "Gehalt", meaning: "salary" },
      { word: "Aufgaben", meaning: "responsibilities" },
      { word: "Rückmeldung", meaning: "response" },
    ],
    text:
      "Meera studiert Informatik in Darmstadt und sucht einen Werkstudentenjob. Am Abend findet sie eine ausgeschriebene Stelle bei einem Startup in Frankfurt. Die Aufgaben klingen spannend: Code Reviews, kleine Features und Gespräche mit Kunden. Das Gehalt steht nicht in der Anzeige, aber Meera möchte sich trotzdem bewerben. Sie öffnet ihr Anschreiben und schreibt, warum sie gut zum Team passt. Obwohl sie noch nicht perfekt Deutsch spricht, beschreibt sie ihre Erfahrung klar und selbstbewusst. Am nächsten Morgen schickt sie die Bewerbung ab. Zwei Tage später bekommt sie eine Rückmeldung. Die Firma möchte ein Vorstellungsgespräch mit ihr führen. Meera freut sich, aber sie weiß auch: Jetzt muss sie üben, über Projekte auf Deutsch zu sprechen.",
    questions: [
      { q: "Welche Stelle sucht Meera?", options: ["Eine Stelle im Supermarkt", "Einen Werkstudentenjob", "Eine Professorenstelle", "Einen Minijob im Café"], answer: "Einen Werkstudentenjob" },
      { q: "Was steht nicht in der Anzeige?", options: ["Der Ort", "Das Gehalt", "Die Firma", "Die Aufgaben"], answer: "Das Gehalt" },
      { q: "Was möchte die Firma?", options: ["Ein Vorstellungsgespräch", "Mehr Fotos", "Eine Wohnung", "Eine Rechnung"], answer: "Ein Vorstellungsgespräch" },
    ],
    nextPrompt: "Meera bereitet sich auf das Vorstellungsgespräch vor. Schreibe 3–5 Sätze.",
    modelContinuation:
      "Meera schreibt drei Beispiele aus ihren Projekten auf. Danach übt sie kurze Antworten vor dem Spiegel. Sie möchte ruhig sprechen und zeigen, dass sie schnell lernt. Am Abend bittet sie einen Freund um Feedback.",
  },
  {
    id: "code-review",
    title: "Code Review im Berliner Startup",
    category: "Tech-Welt",
    status: "unread",
    cover: "from-sky-100 to-indigo-100",
    words: [
      { word: "Besprechung", meaning: "meeting" },
      { word: "Vorschlag", meaning: "suggestion" },
      { word: "Fehler", meaning: "bug/mistake" },
      { word: "verbessern", meaning: "to improve" },
    ],
    text:
      "Rahul macht ein Praktikum bei einem kleinen Startup in Berlin. Jeden Morgen gibt es eine kurze Besprechung. Heute spricht das Team über eine neue Funktion in der App. Rahul hat gestern einen Pull Request erstellt. Seine Kollegin Anna findet den Code gut, aber sie hat einen Vorschlag. Eine Funktion ist zu lang und sollte in zwei kleinere Teile geteilt werden. Rahul versteht den Grund: So kann das Team Fehler schneller finden. Er fragt Anna, ob sie kurz zusammen auf den Code schauen können. Nach der Besprechung setzen sie sich an einen Bildschirm. Anna erklärt langsam, welche Namen natürlicher klingen. Rahul notiert neue Wörter und verbessert den Code. Am Nachmittag wird der Pull Request akzeptiert.",
    questions: [
      { q: "Wo macht Rahul ein Praktikum?", options: ["In München", "In Berlin", "In Hamburg", "In Köln"], answer: "In Berlin" },
      { q: "Was hat Rahul erstellt?", options: ["Einen Pull Request", "Eine Rechnung", "Einen Mietvertrag", "Eine Präsentation"], answer: "Einen Pull Request" },
      { q: "Warum soll die Funktion geteilt werden?", options: ["Sie ist zu kurz.", "Fehler sind dann leichter zu finden.", "Anna mag Java nicht.", "Die App ist fertig."], answer: "Fehler sind dann leichter zu finden." },
    ],
    nextPrompt: "Rahul möchte Anna für ihr Feedback danken. Was schreibt oder sagt er?",
    modelContinuation:
      "Rahul sagt: „Danke für dein Feedback, das war sehr hilfreich.“ Er erklärt, dass er die Funktion jetzt besser versteht. Danach fragt er, ob er beim nächsten Review wieder Fragen stellen darf. Anna sagt, dass das kein Problem ist.",
  },
];

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    storage.get(key, initialValue).then((stored) => {
      if (!mounted) return;
      setValue(stored);
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [key]);

  useEffect(() => {
    if (loaded) storage.set(key, value);
  }, [key, value, loaded]);

  return [value, setValue, loaded];
}

function App() {
  const [apiKey, setApiKey] = useState(null);
  const [keyInput, setKeyInput] = useState("");
  const [loadingKey, setLoadingKey] = useState(true);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [quickVocabOpen, setQuickVocabOpen] = useState(false);
  const [storedActiveTab, setStoredActiveTab] = useStoredState("active-tab", "Dashboard");
  const [streakData, setStreakData] = useStoredState("streak-data", {});
  const [blockData, setBlockData] = useStoredState("daily-blocks", {});
  const [ankiLog, setAnkiLog] = useStoredState("anki-log", {});
  const [grammarProgress, setGrammarProgress] = useStoredState("grammar-progress", { currentTopic: 0, completedTopics: [] });
  const [vocabWords, setVocabWords] = useStoredState("vocab-words", seedVocab);
  const [speakingLog, setSpeakingLog] = useStoredState("speaking-log", {});
  const [storyProgress, setStoryProgress] = useStoredState("story-progress", {});
  const [chatHistory, setChatHistory] = useStoredState("chat-history", []);
  const [grammarSession, setGrammarSession] = useStoredState("grammar-session", {});
  const [timerState, setTimerState] = useStoredState("daily-timers", {});
  const [thinkState, setThinkState] = useStoredState("think-state", {});
  const [storedStories, setStoredStories] = useStoredState("stories-list", staticStories);
  const [storySession, setStorySession] = useStoredState("story-session", {});

  useEffect(() => {
    storage.get("openai-api-key", null).then((key) => {
      setApiKey(key);
      setKeyInput(key || "");
      setLoadingKey(false);
    });
  }, []);

  useEffect(() => {
    if (!vocabWords?.length) setVocabWords(seedVocab);
  }, [vocabWords, setVocabWords]);

  useEffect(() => {
    if (storedActiveTab) setActiveTab(storedActiveTab);
  }, [storedActiveTab]);

  const changeTab = (tab) => {
    setActiveTab(tab);
    setStoredActiveTab(tab);
  };

  const saveKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    await storage.set("openai-api-key", trimmed);
    setApiKey(trimmed);
  };

  if (loadingKey) return <div className="min-h-screen bg-white" />;
  if (!apiKey) return <ApiKeyScreen keyInput={keyInput} setKeyInput={setKeyInput} saveKey={saveKey} />;

  const props = {
    apiKey,
    activeTab,
    setActiveTab: changeTab,
    streakData,
    setStreakData,
    blockData,
    setBlockData,
    ankiLog,
    setAnkiLog,
    grammarProgress,
    setGrammarProgress,
    vocabWords,
    setVocabWords,
    speakingLog,
    setSpeakingLog,
    storyProgress,
    setStoryProgress,
    chatHistory,
    setChatHistory,
    grammarSession,
    setGrammarSession,
    timerState,
    setTimerState,
    thinkState,
    setThinkState,
    storedStories,
    setStoredStories,
    storySession,
    setStorySession,
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#111827]">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-normal">Deutsch Meister</h1>
            <p className="text-[12px] text-[#6B7280]">A2 to B1 professional German in 4 months</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {["Dashboard", "Grammar", "Chat", "Vocab", "Phrases", "Think", "Stories"].map((tab) => (
              <button
                key={tab}
                onClick={() => changeTab(tab)}
                className={`relative whitespace-nowrap px-3 py-2 text-[13px] font-medium transition ${activeTab === tab ? "text-[#4F46E5]" : "text-[#6B7280] hover:text-[#111827]"}`}
              >
                {tab}
                {activeTab === tab && <motion.span layoutId="activeTab" className="absolute inset-x-2 bottom-0 h-1 rounded-full bg-[#4F46E5]" />}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            {activeTab === "Dashboard" && <Dashboard {...props} />}
            {activeTab === "Grammar" && <Grammar {...props} />}
            {activeTab === "Chat" && <Chat {...props} />}
            {activeTab === "Vocab" && <Vocab {...props} />}
            {activeTab === "Phrases" && <Phrases />}
            {activeTab === "Think" && <Think {...props} />}
            {activeTab === "Stories" && <Stories {...props} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <QuickVocabButton onClick={() => setQuickVocabOpen(true)} />
      <QuickVocabModal
        open={quickVocabOpen}
        onClose={() => setQuickVocabOpen(false)}
        apiKey={apiKey}
        vocabWords={vocabWords}
        setVocabWords={setVocabWords}
      />
    </div>
  );
}

function ApiKeyScreen({ keyInput, setKeyInput, saveKey }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F7F4] px-4">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${cardClass} w-full max-w-md p-8 text-center`}>
        <h1 className="text-3xl font-semibold">Willkommen, Gaurav</h1>
        <p className="mt-3 text-sm text-[#6B7280]">Enter your OpenAI API key to get started. It's saved locally and never shared.</p>
        <input
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveKey()}
          type="password"
          className="mt-6 w-full rounded-xl border border-[#E5E7EB] px-4 py-3 text-sm outline-none transition focus:border-[#4F46E5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]"
          placeholder="sk-..."
        />
        <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={saveKey} className={`${primaryButton} mt-3 w-full`}>
          Let's go →
        </MotionButton>
        <p className="mt-4 text-xs text-[#6B7280]">Get your key at platform.openai.com</p>
      </motion.div>
    </div>
  );
}

function Dashboard(props) {
  const { setActiveTab, streakData, setStreakData, blockData, setBlockData, ankiLog, setAnkiLog, grammarProgress, speakingLog, setSpeakingLog, timerState, setTimerState } = props;
  const [ankiCount, setAnkiCount] = useState(ankiLog[todayKey] || "");
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rating, setRating] = useState(speakingLog[todayKey]?.rating || 3);
  const [note, setNote] = useState(speakingLog[todayKey]?.note || "");
  const [confetti, setConfetti] = useState(false);

  const hour = TODAY.getHours();
  const greeting = hour < 11 ? "Guten Morgen, Gaurav" : hour < 18 ? "Guten Tag, Gaurav" : "Guten Abend, Gaurav";
  const todayBlocks = blockData[todayKey] || {};
  const completedCount = ["anki", "grammar", "chat"].filter((key) => todayBlocks[key]).length;
  const currentTopic = grammarTopics[Math.min(grammarProgress.currentTopic || 0, grammarTopics.length - 1)]?.title;

  const completeBlock = (block) => {
    const nextDay = { ...todayBlocks, [block]: true };
    const nextBlocks = { ...blockData, [todayKey]: nextDay };
    setBlockData(nextBlocks);
    if (["anki", "grammar", "chat"].every((key) => nextDay[key])) {
      setStreakData({ ...streakData, [todayKey]: true });
    }
  };

  const markAnki = () => {
    const count = Number(ankiCount || 0);
    setAnkiLog({ ...ankiLog, [todayKey]: count });
    if (count > 0) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 650);
    }
    completeBlock("anki");
  };

  const saveRating = () => {
    setSpeakingLog({ ...speakingLog, [todayKey]: { rating, note } });
    setRatingOpen(false);
  };

  return (
    <div className="space-y-7">
      <motion.div variants={{ show: { transition: { staggerChildren: 0.08 } } }} initial="hidden" animate="show">
        <motion.h2 variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="text-3xl font-semibold">{greeting}</motion.h2>
        <motion.p variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="mt-1 text-sm text-[#6B7280]">Today is {monthNames[TODAY.getMonth()]} {TODAY.getDate()}, {TODAY.getFullYear()}.</motion.p>
      </motion.div>
      <Calendar streakData={streakData} />
      <section className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#4F46E5]">Daily course path</p>
          <h3 className="mt-2 text-2xl font-semibold">Work down the steps</h3>
          <p className="mt-1 text-sm text-[#6B7280]">Start with flashcards, then move through grammar, speaking, thinking, and story context.</p>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          <DailyStepCard step="01" timerId={`${todayKey}-anki`} timerState={timerState} setTimerState={setTimerState} label="Memorize" title="Anki flashcards" minutes={15} done={todayBlocks.anki} icon={<BookOpen size={22} />} description="Start the session by reviewing cards before new input. Keep it focused and timed.">
            {todayBlocks.anki ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm font-semibold text-[#10B981]"><Check size={18} /> {ankiLog[todayKey] ?? 0} cards logged</motion.div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="relative">
                  <input type="number" min="0" max="50" value={ankiCount} onChange={(e) => setAnkiCount(e.target.value)} onBlur={() => Number(ankiCount) > 0 && setConfetti(true)} placeholder="Cards reviewed" className="w-full rounded-xl border border-[#E5E7EB] px-3 py-3 text-sm outline-none focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]" />
                  {confetti && <ConfettiBurst />}
                </div>
                <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} onClick={markAnki} className={primaryButton}>Mark Done ✓</MotionButton>
              </div>
            )}
          </DailyStepCard>
          <DailyStepCard step="02" timerId={`${todayKey}-grammar`} timerState={timerState} setTimerState={setTimerState} label="Understand" title={currentTopic || "Grammar lesson"} minutes={30} done={todayBlocks.grammar} icon={<CalendarDays size={22} />} description="Read the explanation, work the five exercises, and mark the topic complete when you finish.">
            <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setActiveTab("Grammar")} className={todayBlocks.grammar ? secondaryButton : primaryButton}>Start Grammar Lesson →</MotionButton>
          </DailyStepCard>
          <DailyStepCard step="03" timerId={`${todayKey}-chat`} timerState={timerState} setTimerState={setTimerState} label="Speak" title="German chat with Lena" minutes={30} done={todayBlocks.chat} icon={<MessageCircle size={22} />} description="Use the chat as your production practice. Lena will correct grammar, cases, word order, and connectors.">
            <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setActiveTab("Chat")} className={todayBlocks.chat ? secondaryButton : primaryButton}>Start Speaking →</MotionButton>
          </DailyStepCard>
          <DailyStepCard step="04" timerId={`${todayKey}-think`} timerState={timerState} setTimerState={setTimerState} label="Think" title="Think in German" minutes={5} done={false} icon={<Briefcase size={22} />} description="Warm up your inner monologue with connectors, thinking phrases, and a tiny sentence builder.">
            <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setActiveTab("Think")} className={secondaryButton}>Open Think →</MotionButton>
          </DailyStepCard>
          <DailyStepCard step="05" timerId={`${todayKey}-stories`} timerState={timerState} setTimerState={setTimerState} label="Read" title="Story context" minutes={10} done={false} icon={<FileText size={22} />} description="Read a short real-life story, tap unknown words, answer questions, and write a continuation.">
            <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setActiveTab("Stories")} className={secondaryButton}>Read Story →</MotionButton>
          </DailyStepCard>
        </div>
      </section>
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <motion.div className="h-full bg-[#10B981]" initial={{ width: 0 }} animate={{ width: `${(completedCount / 3) * 100}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
        </div>
        <p className="mt-2 text-xs text-[#6B7280]">{completedCount}/3 required blocks complete today</p>
      </div>
      <section className={`${cardClass} p-5`}>
        <h3 className="text-lg font-semibold">Speaking confidence log</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 31 }, (_, i) => {
            const day = i + 1;
            const key = `${TODAY.getFullYear()}-05-${pad(day)}`;
            const item = speakingLog[key];
            const color = !item ? "bg-neutral-200" : item.rating <= 2 ? "bg-[#F43F5E]" : item.rating === 3 ? "bg-[#F59E0B]" : "bg-[#10B981]";
            return (
              <MotionButton key={key} whileTap={{ scale: 0.85 }} onClick={() => day === TODAY.getDate() && setRatingOpen(true)} className={`relative h-5 w-5 overflow-hidden rounded-full ${color} ${day === TODAY.getDate() ? "ring-2 ring-[#4F46E5] ring-offset-2" : ""}`} title={`May ${day}`} />
            );
          })}
        </div>
        {ratingOpen && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${cardClass} mt-4 max-w-md p-4`}>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <MotionButton whileTap={{ scale: 0.92 }} key={n} onClick={() => setRating(n)} className={`h-9 w-9 rounded-xl text-sm font-semibold ${rating === n ? "bg-[#4F46E5] text-white" : "bg-[#F8F7F4]"}`}>{n}</MotionButton>
              ))}
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One-line note" className="mt-3 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]" />
            <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={saveRating} className={`${primaryButton} mt-3 py-2`}>Save</MotionButton>
          </motion.div>
        )}
        <Sparkline speakingLog={speakingLog} />
      </section>
    </div>
  );
}

function Calendar({ streakData }) {
  const year = TODAY.getFullYear();
  const month = 4;
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  return (
    <section>
      <h3 className="mb-3 text-lg font-semibold">May {year}</h3>
      <motion.div className="grid max-w-sm grid-cols-7 gap-1 text-center text-[12px] text-[#6B7280]" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.02 } } }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={`${d}-${i}`}>{d}</div>)}
        {Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const key = `${year}-05-${pad(day)}`;
          const date = new Date(year, month, day);
          const isToday = key === todayKey;
          const future = date > new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
          return (
            <motion.div variants={{ hidden: { scale: 0.8, opacity: 0 }, show: { scale: 1, opacity: 1 } }} key={key} className={`relative flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-sm ${isToday ? "border-2 border-[#4F46E5]" : "border-[#E5E7EB]"} ${future ? "text-neutral-300" : "text-[#111827]"}`}>
              {day}
              {streakData[key] && (
                <svg className="absolute inset-1" viewBox="0 0 32 32">
                  <motion.path d="M6 6 L26 26" stroke={RED} strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: "easeOut" }} />
                  <motion.path d="M26 6 L6 26" stroke={RED} strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }} />
                </svg>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

function SessionCard({ done, icon, title, subtitle, children }) {
  return (
    <motion.div layout whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} className={`rounded-2xl border p-5 shadow-sm transition ${done ? "border-[#10B981] bg-[#ECFDF5]" : "border-[#E5E7EB] bg-white"}`}>
      <div className="flex items-center gap-3 text-[#4F46E5]">{icon}<h3 className="text-[18px] font-semibold text-[#111827]">{title}</h3></div>
      <p className="mt-2 min-h-10 text-sm text-[#6B7280]">{subtitle}</p>
      {children}
    </motion.div>
  );
}

function DailyStepCard({ step, timerId, timerState, setTimerState, label, title, minutes, done, icon, description, children }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ backgroundColor: "#FFFFFF" }} className="grid gap-4 p-5 md:grid-cols-[92px_1fr_170px] md:items-center">
      <div className="flex items-center gap-3 md:block">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold ${done ? "bg-[#10B981] text-white" : "bg-[#4F46E5] text-white"}`}>
          {done ? "✓" : step}
        </div>
        <p className="mt-0 text-xs font-bold uppercase tracking-[0.18em] text-[#6B7280] md:mt-3">{label}</p>
      </div>
      <div>
        <div className="flex items-center gap-3 text-[#4F46E5]">
          {icon}
          <h4 className="text-xl font-semibold text-[#111827]">{title}</h4>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">{description}</p>
        <div className="mt-4">{children}</div>
      </div>
      <StepTimer id={timerId} minutes={minutes} done={done} timerState={timerState} setTimerState={setTimerState} />
    </motion.div>
  );
}

function StepTimer({ id, minutes, done, timerState, setTimerState }) {
  const initialSeconds = minutes * 60;
  const saved = timerState[id] || {};
  const [seconds, setSeconds] = useState(saved.seconds ?? initialSeconds);
  const [running, setRunning] = useState(saved.running || false);

  useEffect(() => {
    if (!running || seconds <= 0 || done) return undefined;
    const timer = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [running, seconds, done]);

  useEffect(() => {
    if (done) setRunning(false);
  }, [done]);

  useEffect(() => {
    setTimerState((current) => ({ ...current, [id]: { seconds, running: running && !done, minutes } }));
  }, [seconds, running, done]);

  const progress = 1 - seconds / initialSeconds;
  const time = `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F7F4] p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#6B7280]">{minutes} min timer</span>
        <span className="font-mono text-lg font-bold text-[#111827]">{done ? "Done" : time}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <motion.div className="h-full bg-[#4F46E5]" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.25 }} />
      </div>
      <div className="mt-3 flex gap-2">
        <MotionButton whileTap={{ scale: 0.96 }} onClick={() => setRunning(!running)} disabled={done || seconds === 0} className="flex-1 rounded-xl bg-[#111827] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {running ? "Pause" : "Start"}
        </MotionButton>
        <button onClick={() => { setSeconds(initialSeconds); setRunning(false); }} className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#6B7280]">Reset</button>
      </div>
    </div>
  );
}

function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute right-4 top-4">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="confetti-dot" style={{ "--x": `${Math.cos(i) * 28}px`, "--y": `${Math.sin(i) * 22 - 20}px`, background: [BLUE, GREEN, RED, AMBER][i % 4] }} />
      ))}
    </div>
  );
}

function Sparkline({ speakingLog }) {
  const values = [3, 3, 3, 3, 3, ...Array.from({ length: 31 }, (_, i) => speakingLog[`${TODAY.getFullYear()}-05-${pad(i + 1)}`]?.rating).filter(Boolean)];
  const width = 360;
  const height = 70;
  const points = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * width},${height - ((v - 1) / 4) * (height - 10) - 5}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-5 h-20 w-full max-w-lg rounded-md border border-neutral-100">
      <polyline fill="none" stroke={BLUE} strokeWidth="3" points={points} />
    </svg>
  );
}

function completeTodayBlock(block, blockData, setBlockData, streakData, setStreakData) {
  const todayBlocks = blockData[todayKey] || {};
  const nextDay = { ...todayBlocks, [block]: true };
  setBlockData({ ...blockData, [todayKey]: nextDay });
  if (["anki", "grammar", "chat"].every((key) => nextDay[key])) {
    setStreakData({ ...streakData, [todayKey]: true });
  }
}

function Grammar({ grammarProgress, setGrammarProgress, blockData, setBlockData, streakData, setStreakData, grammarSession, setGrammarSession }) {
  const topicIndex = Math.min(grammarProgress.currentTopic || 0, grammarTopics.length - 1);
  const topic = grammarTopics[topicIndex];
  const savedTopicSession = grammarSession[topicIndex] || {};
  const [answers, setAnswers] = useState(savedTopicSession.answers || {});
  const [feedback, setFeedback] = useState(savedTopicSession.feedback || {});

  useEffect(() => {
    const saved = grammarSession[topicIndex] || {};
    setAnswers(saved.answers || {});
    setFeedback(saved.feedback || {});
  }, [topicIndex]);

  useEffect(() => {
    setGrammarSession((current) => ({ ...current, [topicIndex]: { answers, feedback } }));
  }, [topicIndex, answers, feedback]);

  const check = (i, value) => {
    const exercise = topic.exercises[i];
    const correct = normalize(value) === normalize(exercise.answer);
    setFeedback({ ...feedback, [i]: { correct, answer: exercise.answer } });
  };

  const doneCount = Object.keys(feedback).length;
  const score = Object.values(feedback).filter((f) => f.correct).length;
  const markComplete = () => {
    const completed = Array.from(new Set([...(grammarProgress.completedTopics || []), topicIndex]));
    setGrammarProgress({ currentTopic: Math.min(topicIndex + 1, grammarTopics.length - 1), completedTopics: completed });
    completeTodayBlock("grammar", blockData, setBlockData, streakData, setStreakData);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {grammarTopics.map((t, i) => {
          const completed = grammarProgress.completedTopics?.includes(i);
          return (
            <button key={t.title} className={`relative whitespace-nowrap rounded-full border px-3 py-2 text-[12px] ${i === topicIndex ? "border-[#4F46E5] text-white" : completed ? "border-[#10B981] text-[#10B981]" : "border-[#E5E7EB] text-[#6B7280]"}`}>
              {i === topicIndex && <motion.span layoutId="activeTopic" className="absolute inset-0 rounded-full bg-[#4F46E5]" />}
              <span className="relative">{completed ? "✓ " : ""}{t.title}</span>
            </button>
          );
        })}
      </div>
      <section className={`${cardClass} p-6`}>
        <h2 className="text-2xl font-semibold">{topic.title}</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-[#6B7280]">{topic.explanation.map((p) => <p key={p}>{p}</p>)}</div>
      </section>
      <section className="space-y-4">
        {topic.exercises.map((ex, i) => (
          <motion.div key={`${topic.title}-${i}`} animate={feedback[i] && !feedback[i].correct ? { x: [-8, 8, -8, 8, 0] } : { x: 0 }} className={`${cardClass} p-4`}>
            <p className="text-sm font-medium">{i + 1}. {ex.prompt}</p>
            {ex.type === "choice" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {ex.options.map((option) => (
                  <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} key={option} onClick={() => check(i, option)} className={secondaryButton}>{option}</MotionButton>
                ))}
              </div>
            ) : (
              <input
                value={answers[i] || ""}
                onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && check(i, answers[i] || "")}
                placeholder={ex.type === "fix" ? "Correct the sentence" : "Type answer"}
                className="mt-3 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]"
              />
            )}
            {feedback[i] && <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 360, damping: 20 }} className={`mt-2 origin-left text-sm font-medium ${feedback[i].correct ? "text-[#10B981]" : "text-[#F43F5E]"}`}>{feedback[i].correct ? "Richtig." : `Nicht ganz. Correct: ${feedback[i].answer}`}</motion.p>}
          </motion.div>
        ))}
      </section>
      {doneCount === 5 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${cardClass} p-5`}>
          <p className="text-lg font-semibold"><AnimatedScore score={score} />/5 — {score >= 4 ? "Sehr gut!" : "Weiter üben."}</p>
          <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={markComplete} className={`${primaryButton} mt-4`}>Mark Topic Complete →</MotionButton>
        </motion.div>
      )}
    </div>
  );
}

function AnimatedScore({ score }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      setShown(Math.min(current, score));
      if (current >= score) clearInterval(timer);
    }, 70);
    return () => clearInterval(timer);
  }, [score]);
  return <>{shown}</>;
}

function splitLena(text) {
  const marker = "---CORRECTIONS---";
  const index = text.indexOf(marker);
  if (index === -1) return { main: text, corrections: [] };
  const main = text.slice(0, index).trim();
  const raw = text.slice(index).replace("---CORRECTIONS---", "").replace("---END---", "").trim();
  if (!raw || raw === "NONE") return { main, corrections: [] };
  const grouped = {};
  raw.split("\n").forEach((line) => {
    const match = line.match(/^([A-Z_]+)_(\d+):\s*(.*)$/);
    if (!match) return;
    const [, field, number, value] = match;
    grouped[number] = { ...(grouped[number] || {}), [field]: value };
  });
  return { main, corrections: Object.values(grouped) };
}

function highlightDiff(text, otherText, colorClass) {
  const words = text.split(/(\s+)/);
  const other = new Set(otherText.toLowerCase().split(/\s+/).map((w) => w.replace(/[.,!?]/g, "")));
  return words.map((word, i) => {
    const clean = word.toLowerCase().replace(/[.,!?]/g, "");
    const changed = clean && !other.has(clean);
    return changed ? <mark key={`${word}-${i}`} className={`rounded px-1 ${colorClass}`}>{word}</mark> : <span key={`${word}-${i}`}>{word}</span>;
  });
}

function CorrectionCard({ corrections }) {
  const [open, setOpen] = useState(true);
  if (!corrections?.length) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="text-xs font-semibold text-[#4F46E5]">{open ? "Hide correction" : "Show correction"}</button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="overflow-hidden">
            <motion.div variants={{ show: { transition: { staggerChildren: 0.1 } } }} initial="hidden" animate="show" className={`${cardClass} mt-2 space-y-3 p-4`}>
              {corrections.map((item, index) => (
                <div key={index} className="space-y-3 border-b border-[#E5E7EB] pb-3 last:border-0 last:pb-0">
                  <CorrectionSection tone="red" title="Was du geschrieben hast">{highlightDiff(item.MISTAKE || "", item.CORRECT || "", "bg-rose-200 text-rose-900")}</CorrectionSection>
                  <CorrectionSection tone="green" title="So ist der ganze Satz richtig">{highlightDiff(item.CORRECT || "", item.MISTAKE || "", "bg-emerald-200 text-emerald-900")}</CorrectionSection>
                  <CorrectionSection tone="blue" title="Warum?">{item.WHY}</CorrectionSection>
                  {item.PATTERN && <CorrectionSection tone="blue" title="Sentence pattern">{item.PATTERN}</CorrectionSection>}
                  {item.MEMORY_TIP && <CorrectionSection tone="amber" title="How to never forget it">{item.MEMORY_TIP}</CorrectionSection>}
                  {item.EXAMPLE && <CorrectionSection tone="green" title="Another example">{item.EXAMPLE}</CorrectionSection>}
                  {item.CONNECTOR_NOTE && <CorrectionSection tone="amber" title="Connector tip 💡">{item.CONNECTOR_NOTE}</CorrectionSection>}
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CorrectionSection({ tone, title, children }) {
  const tones = {
    red: "bg-rose-50 text-rose-900 border-rose-100",
    green: "bg-emerald-50 text-emerald-900 border-emerald-100",
    blue: "bg-indigo-50 text-indigo-900 border-indigo-100",
    amber: "bg-amber-50 text-amber-900 border-amber-100",
  };
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className={`rounded-xl border p-3 text-xs leading-5 ${tones[tone]}`}>
      <p className="mb-1 font-bold">{title}</p>
      <div>{children}</div>
    </motion.div>
  );
}

async function callOpenAI(apiKey, messages) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.7 }),
  });
  if (!response.ok) throw new Error("OpenAI request failed. Check your API key or connection.");
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function parseJsonResponse(text) {
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function fetchVocabEntry(apiKey, rawWord) {
  const prompt = `For the German word '${rawWord}', return JSON only with these fields: gender (der/die/das or empty string if not a noun), meaning (short English), examples (array of 2 objects, each with sentence and sentence_english; sentences must be natural German in professional or everyday context, with the target word embedded naturally), sentence (same as examples[0].sentence), sentence_english (same as examples[0].sentence_english). No markdown, no explanation, just JSON.`;
  const text = await callOpenAI(apiKey, [{ role: "user", content: prompt }]);
  const parsed = parseJsonResponse(text);
  const examples = Array.isArray(parsed.examples) && parsed.examples.length
    ? parsed.examples.slice(0, 2)
    : [{ sentence: parsed.sentence, sentence_english: parsed.sentence_english }].filter((item) => item.sentence);
  return {
    id: `${Date.now()}`,
    word: rawWord,
    gender: parsed.gender || "",
    meaning: parsed.meaning || "",
    sentence: parsed.sentence || examples[0]?.sentence || "",
    sentence_english: parsed.sentence_english || examples[0]?.sentence_english || "",
    examples,
    dateAdded: todayKey,
  };
}

function QuickVocabButton({ onClick }) {
  return (
    <MotionButton
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#111827] px-6 py-4 text-sm font-bold text-white shadow-xl shadow-black/10 sm:left-auto sm:right-6 sm:translate-x-0"
    >
      <Plus size={18} />
      Quick word
    </MotionButton>
  );
}

function QuickVocabModal({ open, onClose, apiKey, vocabWords, setVocabWords }) {
  const [word, setWord] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookup = async () => {
    if (!word.trim() || loading) return;
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const entry = await fetchVocabEntry(apiKey, word.trim());
      setVocabWords((current) => [entry, ...current]);
      setPreview({ ...entry, saved: true });
    } catch {
      setError("Could not get the meaning. Check your API key and try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetLookup = () => {
    setWord("");
    setPreview(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/25 px-4">
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className={`${cardClass} w-full max-w-xl p-5 shadow-2xl`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Quick word lookup</h3>
                <p className="mt-1 text-sm text-[#6B7280]">Type any German word. It saves to Vocab automatically after lookup.</p>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 hover:bg-[#F8F7F4]"><X size={18} /></button>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="Type any German word"
                className="flex-1 rounded-2xl border border-[#E5E7EB] px-4 py-3 text-sm outline-none focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]"
                autoFocus
              />
              <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={lookup} disabled={loading} className={primaryButton}>
                {loading ? <SkeletonText label="Looking..." /> : "Get meaning"}
              </MotionButton>
            </div>
            {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-[#F43F5E]">{error}</p>}
            {preview && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-2xl bg-[#F8F7F4] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {preview.gender && <span className="rounded-full bg-[#4F46E5]/10 px-2 py-1 text-xs font-bold text-[#4F46E5]">{preview.gender}</span>}
                  <h4 className="text-lg font-semibold">{preview.word}</h4>
                  <span className="text-sm text-[#6B7280]">{preview.meaning}</span>
                  {preview.saved && <span className="rounded-full bg-[#10B981]/10 px-2 py-1 text-xs font-bold text-[#10B981]">Saved to Vocab ✓</span>}
                </div>
                <div className="mt-4 space-y-3">
                  {(preview.examples?.length ? preview.examples : [{ sentence: preview.sentence, sentence_english: preview.sentence_english }]).slice(0, 2).map((example, index) => (
                    <div key={index} className="rounded-xl border border-[#E5E7EB] bg-white p-3 text-sm">
                      <p className="font-medium">{boldWord(example.sentence, preview.word)}</p>
                      <p className="mt-1 text-[#6B7280]">{example.sentence_english}</p>
                    </div>
                  ))}
                </div>
                <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={resetLookup} className={`${primaryButton} mt-4 w-full`}>
                  Add another word
                </MotionButton>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Chat({ apiKey, blockData, setBlockData, streakData, setStreakData, chatHistory, setChatHistory }) {
  const systemPrompt = "You are Lena, a warm, curious, and engaging German tutor having a real conversation with Gaurav, an A2-level learner targeting B1 professional German. Your main job is to keep him talking in German. Always reply in German at A2/B1 level, 2–4 short sentences. Make the conversation feel alive: react to what he said, ask one specific follow-up question every time, and often give him two simple answer options so he feels forced to respond. Do not end with generic phrases like 'Erzähl mir mehr'; ask concrete questions about his day, studies, job search, food, plans, opinions, or Germany. If his answer is too short, gently ask for one more sentence using a useful connector like weil, aber, trotzdem, deshalb, dass, obwohl, damit, nachdem, or bevor. After your reply, analyze his message for grammar mistakes, wrong word order, incorrect case usage, wrong verb conjugation, bad or missing connectors, spelling, and unnatural phrasing. Corrections must teach the full sentence, not just a word fragment. For every mistake, MISTAKE must contain the full original sentence or clause the user wrote, CORRECT must contain the full corrected sentence or clause, WHY must explain the rule in simple English, PATTERN must show the reusable sentence pattern, MEMORY_TIP must give a short way to remember it, and EXAMPLE must give one fresh German example. Return corrections in this exact format after the German reply: ---CORRECTIONS---\\nMISTAKE_1: [full original sentence or clause]\\nCORRECT_1: [full corrected sentence or clause]\\nWHY_1: [simple English rule explanation]\\nPATTERN_1: [reusable pattern, e.g. ich + verb ending -e / accusative masculine: einen + noun]\\nMEMORY_TIP_1: [short memory tip]\\nEXAMPLE_1: [fresh German example using the same rule]\\nCONNECTOR_NOTE_1: [only include if the mistake involves a connector; explain the connector and give a correct alternative example]\\n---END---. If there are multiple mistakes, include MISTAKE_2, CORRECT_2, WHY_2, PATTERN_2, MEMORY_TIP_2, EXAMPLE_2 etc. If there are no mistakes, return exactly: ---CORRECTIONS--- NONE ---END---. Be encouraging — if he used a connector correctly, say so naturally in your German reply. If he made a connector mistake specifically, explain it clearly because connector mastery is what separates A2 from B1.";
  const [messages, setMessages] = useState(chatHistory || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setMessages([]);
    setChatHistory([]);
    setError("");
    setLoading(true);
    try {
      const content = await callOpenAI(apiKey, [{ role: "system", content: systemPrompt }, { role: "user", content: "Bitte starte das Gespräch." }]);
      const opening = [{ role: "assistant", content }];
      setMessages(opening);
      setChatHistory(opening);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length === 0 && !loading) start();
  }, []);

  useEffect(() => {
    if (chatHistory?.length && messages.length === 0) setMessages(chatHistory);
  }, [chatHistory]);

  useEffect(() => {
    setChatHistory(messages);
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const next = [...messages, { role: "user", content: input.trim() }];
    setMessages(next);
    setChatHistory(next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const apiMessages = [{ role: "system", content: systemPrompt }, ...next.map((m) => ({ role: m.role, content: m.content }))];
      const content = await callOpenAI(apiKey, apiMessages);
      const updated = [...next, { role: "assistant", content }];
      setMessages(updated);
      setChatHistory(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Chat with Lena</h2>
        <div className="flex gap-2">
          <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => completeTodayBlock("chat", blockData, setBlockData, streakData, setStreakData)} className="rounded-full bg-[#10B981] px-4 py-2 text-sm font-semibold text-white">Mark Chat Done ✓</MotionButton>
          <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={start} className={secondaryButton}>Neues Gespräch</MotionButton>
        </div>
      </div>
      <div className={`${cardClass} flex-1 space-y-4 p-4`}>
        <AnimatePresence>
        {messages.map((message, i) => {
          const lena = message.role === "assistant" ? splitLena(message.content) : null;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                <div className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "user" ? "bg-[#4F46E5] text-white" : "bg-[#F8F7F4] text-[#111827]"}`}>
                  {lena ? lena.main : message.content}
                </div>
                {lena?.corrections?.length > 0 && <CorrectionCard corrections={lena.corrections} />}
              </div>
            </motion.div>
          );
        })}
        </AnimatePresence>
        {loading && <TypingDots />}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-[#F43F5E]">{error}</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Schreib auf Deutsch..." className="flex-1 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm outline-none transition focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]" />
        <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={send} disabled={loading} className={primaryButton}>Send</MotionButton>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 text-[#6B7280]">
      {[0, 1, 2].map((i) => <motion.span key={i} className="h-2 w-2 rounded-full bg-[#6B7280]" animate={{ scale: [0.7, 1.2, 0.7] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.12 }} />)}
    </div>
  );
}

function Vocab({ apiKey, vocabWords, setVocabWords }) {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const filtered = vocabWords.filter((item) => `${item.word} ${item.meaning}`.toLowerCase().includes(query.toLowerCase()));

  const addWord = async () => {
    if (!word.trim()) return;
    setLoading(true);
    setError("");
    try {
      const next = await fetchVocabEntry(apiKey, word.trim());
      setVocabWords([next, ...vocabWords]);
      setModal(false);
      setWord("");
    } catch {
      setError("Could not add the word. Check the API response and try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteWord = (id) => {
    if (confirm("Delete this vocab card?")) setVocabWords(vocabWords.filter((item) => item.id !== id));
  };

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-3 text-[#6B7280]" size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search word or meaning" className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]" />
      </div>
      <motion.div layout className="mt-6 grid gap-4 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
        {filtered.map((item) => (
          <MotionArticle layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} key={item.id} className={`${cardClass} p-5`}>
            <p className="text-sm leading-6">{boldWord(item.sentence, item.word)}</p>
            <p className="mt-2 text-sm text-[#6B7280]">{item.sentence_english}</p>
            {item.examples?.length > 1 && (
              <div className="mt-3 rounded-xl bg-[#F8F7F4] p-3 text-sm">
                <p className="font-medium">{boldWord(item.examples[1].sentence, item.word)}</p>
                <p className="mt-1 text-[#6B7280]">{item.examples[1].sentence_english}</p>
              </div>
            )}
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-[#4F46E5]/10 px-2 py-1 font-semibold text-[#4F46E5]">{item.gender}</span>
                <span>{item.meaning}</span>
                <span className="text-[#6B7280]">{item.dateAdded}</span>
              </div>
              <button onClick={() => deleteWord(item.id)} className="rounded-xl p-2 text-[#6B7280] hover:bg-red-50 hover:text-[#F43F5E]" aria-label="Delete"><Trash2 size={16} /></button>
            </div>
          </MotionArticle>
        ))}
        </AnimatePresence>
      </motion.div>
      <MotionButton whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setModal(true)} className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#4F46E5] text-white shadow-lg hover:bg-[#4338CA]" aria-label="Add word"><Plus /></MotionButton>
      {modal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 px-4">
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`${cardClass} w-full max-w-md p-5 shadow-xl`}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add vocabulary</h3>
              <button onClick={() => setModal(false)} className="rounded-xl p-1 hover:bg-neutral-100"><X size={18} /></button>
            </div>
            <input value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addWord()} placeholder="Type a German word" className="mt-4 w-full rounded-xl border border-[#E5E7EB] px-3 py-3 text-sm outline-none focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]" />
            {error && <p className="mt-3 text-sm text-[#F43F5E]">{error}</p>}
            <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={addWord} disabled={loading} className={`${primaryButton} mt-4 w-full`}>{loading ? <SkeletonText label="Einen Moment..." /> : "Add word"}</MotionButton>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function boldWord(sentence, word) {
  const index = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (index === -1) return sentence;
  return <>{sentence.slice(0, index)}<strong>{sentence.slice(index, index + word.length)}</strong>{sentence.slice(index + word.length)}</>;
}

function Phrases() {
  const [filter, setFilter] = useState("All");
  const categories = ["All", "Interview", "E-Mails", "Smalltalk", "Behörden", "Arbeitsplatz"];
  const visible = filter === "All" ? phrases : phrases.filter((p) => p.category === filter);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)} className={`relative rounded-full px-3 py-2 text-[13px] ${filter === cat ? "text-white" : "text-[#6B7280] hover:text-[#111827]"}`}>
            {filter === cat && <motion.span layoutId="activeFilter" className="absolute inset-0 rounded-full bg-[#4F46E5]" />}
            <span className="relative">{cat}</span>
          </button>
        ))}
      </div>
      <motion.div layout className="mt-6 grid gap-4 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
        {visible.map((phrase) => (
          <MotionArticle layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} key={phrase.id} className={`${cardClass} p-5`}>
            <p className="text-lg font-semibold">{phrase.german}</p>
            <p className="mt-2 text-sm text-[#6B7280]">{phrase.english}</p>
            <p className="mt-4 text-sm italic text-[#374151]">{phrase.example}</p>
            <span className="mt-4 inline-block rounded-full bg-[#F8F7F4] px-2 py-1 text-xs text-[#6B7280]">{phrase.category}</span>
          </MotionArticle>
        ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Think({ thinkState, setThinkState }) {
  const dayIndex = Math.floor((TODAY - new Date(TODAY.getFullYear(), 0, 0)) / 86400000);
  const savedThink = thinkState[todayKey] || {};
  const [thought, setThought] = useState(savedThink.thought || "");
  const [submitted, setSubmitted] = useState(savedThink.submitted || false);
  const situation = situations[dayIndex % situations.length];
  const builder = builderExercises[dayIndex % builderExercises.length];
  const [tiles, setTiles] = useState(savedThink.tiles || [...builder.words].sort(() => Math.random() - 0.5));
  const [chosen, setChosen] = useState(savedThink.chosen || []);
  const sentence = chosen.join(" ");

  useEffect(() => {
    if (!savedThink.tiles) {
      setTiles([...builder.words].sort(() => Math.random() - 0.5));
      setChosen([]);
    }
  }, [builder.answer]);

  useEffect(() => {
    setThinkState((current) => ({ ...current, [todayKey]: { thought, submitted, tiles, chosen, builderAnswer: builder.answer } }));
  }, [thought, submitted, tiles, chosen, builder.answer]);

  return (
    <div className="space-y-7">
      <motion.section initial={{ rotateX: -12, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 18 }} className={`${cardClass} p-5`}>
        <p className="text-xs font-semibold uppercase text-[#4F46E5]">Daily thought prompt</p>
        <h2 className="mt-2 text-2xl font-semibold">{thoughtPrompts[dayIndex % thoughtPrompts.length]}</h2>
      </motion.section>
      <section>
        <h3 className="text-lg font-semibold">Connectors bank</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {connectors.map(([word, sentence]) => (
            <div key={word} className={`${cardClass} p-4 text-sm`}><strong>{word}</strong><p className="mt-1 text-[#6B7280]">{sentence}</p></div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-lg font-semibold">Thinking phrases</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {thinkingPhrases.map(([de, en]) => (
            <div key={de} className={`${cardClass} p-4`}><p className="font-semibold">{de}</p><p className="text-sm text-[#6B7280]">{en}</p></div>
          ))}
        </div>
      </section>
      <section className={`${cardClass} p-5`}>
        <h3 className="text-lg font-semibold">Situation simulator</h3>
        <p className="mt-2 text-sm text-[#6B7280]">{situation.situation}</p>
        <textarea value={thought} onChange={(e) => setThought(e.target.value)} className="mt-3 min-h-24 w-full rounded-2xl border border-[#E5E7EB] p-3 text-sm outline-none focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]" placeholder="Schreib deine Gedanken auf Deutsch..." />
        <MotionButton animate={submitted ? {} : { scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} whileTap={{ scale: 0.97 }} onClick={() => setSubmitted(true)} className={`${primaryButton} mt-3`}>Submit</MotionButton>
        {submitted && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-[#F8F7F4] p-4 text-sm"><strong>Native version:</strong><p className="mt-1">{situation.native}</p></motion.div>}
      </section>
      <section className={`${cardClass} p-5`}>
        <h3 className="text-lg font-semibold">Mini phrase builder</h3>
        <div className="mt-3 min-h-14 rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F8F7F4] p-3 text-sm">{sentence || "Tap or drag words to build the sentence"}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tiles.map((tile, i) => (
            <DraggableTile key={`${tile}-${i}`} tile={tile} onPick={() => { setChosen([...chosen, tile]); setTiles(tiles.filter((_, index) => index !== i)); }} />
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setTiles([...builder.words].sort(() => Math.random() - 0.5)); setChosen([]); }} className={secondaryButton}>Reset</button>
          {chosen.length === builder.words.length && <span className={`rounded-xl px-3 py-2 text-sm font-semibold ${normalize(sentence) === normalize(builder.answer) ? "bg-[#10B981]/10 text-[#10B981]" : "bg-red-50 text-[#F43F5E]"}`}>{normalize(sentence) === normalize(builder.answer) ? "Correct ✓" : `Correct: ${builder.answer}`}</span>}
        </div>
      </section>
    </div>
  );
}

function DraggableTile({ tile, onPick }) {
  const controls = useDragControls();
  return (
    <motion.button drag dragControls={controls} dragSnapToOrigin whileDrag={{ scale: 1.08, zIndex: 10 }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onPick} className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-[#E5E7EB] hover:bg-[#F8F7F4]">
      {tile}
    </motion.button>
  );
}

function SkeletonText({ label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <motion.span className="h-3 w-24 rounded bg-white/40" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2 }} />
      {label}
    </span>
  );
}

function Stories({ apiKey, grammarProgress, vocabWords, setVocabWords, storyProgress, setStoryProgress, storedStories, setStoredStories, storySession, setStorySession }) {
  const [stories, setStories] = useState(storedStories?.length ? storedStories : staticStories);
  const [activeId, setActiveId] = useState(storySession.activeId || (storedStories?.[0]?.id || staticStories[0].id));
  const [answers, setAnswers] = useState(storySession.answers || {});
  const [tooltip, setTooltip] = useState(null);
  const [continuation, setContinuation] = useState(storySession.continuation || "");
  const [correctionText, setCorrectionText] = useState(storySession.correctionText || "");
  const [loadingStory, setLoadingStory] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const activeStory = stories.find((story) => story.id === activeId) || stories[0];
  const parsedCorrection = correctionText ? splitLena(`Danke.\n${correctionText}`).corrections : [];
  const status = storyProgress[activeStory.id] || "unread";

  const setStatus = (nextStatus) => setStoryProgress({ ...storyProgress, [activeStory.id]: nextStatus });
  const setStoryStatus = (storyId, nextStatus) => setStoryProgress({ ...storyProgress, [storyId]: nextStatus });

  useEffect(() => {
    setStoredStories(stories);
  }, [stories]);

  useEffect(() => {
    setStorySession((current) => ({
      ...current,
      activeId,
      answers,
      continuation,
      correctionText,
      byStory: {
        ...(current.byStory || {}),
        [activeId]: { answers, continuation, correctionText },
      },
    }));
  }, [activeId, answers, continuation, correctionText]);

  const generateStory = async () => {
    setLoadingStory(true);
    setError("");
    try {
      const currentGrammar = grammarTopics[grammarProgress.currentTopic || 0]?.title || "Akkusativ";
      const recentWords = vocabWords.slice(0, 5).map((item) => `${item.gender} ${item.word}`).join(", ");
      const situation = storyCategories[Math.floor(Math.random() * storyCategories.length)];
      const prompt = `Write a short German story (150-200 words) at A2/B1 level for an Indian CS student living in Darmstadt, Germany. The story must naturally include the following grammar structure: ${currentGrammar}. Include these vocabulary words naturally in the story: ${recentWords}. Set the story in this situation: ${situation}. Return JSON only with fields: id, title, category, text, words (array of {word, meaning}), questions (array of {q, options, answer}), nextPrompt, modelContinuation.`;
      const text = await callOpenAI(apiKey, [{ role: "user", content: prompt }]);
      const parsed = parseJsonResponse(text);
      const next = { ...parsed, id: parsed.id || `dynamic-${Date.now()}`, cover: "from-indigo-100 to-emerald-100" };
      const nextStories = [next, ...stories];
      setStories(nextStories);
      setStoredStories(nextStories);
      setActiveId(next.id);
      setAnswers({});
      setContinuation("");
      setCorrectionText("");
    } catch {
      setError("Could not generate a new story. Try again with a valid API key.");
    } finally {
      setLoadingStory(false);
    }
  };

  const checkContinuation = async () => {
    if (!continuation.trim()) return;
    setChecking(true);
    setError("");
    try {
      const prompt = `Correct this German continuation using the exact correction format only. Analyze grammar, word order, cases, verb conjugation, connectors, and unnatural phrasing. If no mistakes, return ---CORRECTIONS--- NONE ---END---.\nText: ${continuation}`;
      const text = await callOpenAI(apiKey, [{ role: "user", content: prompt }]);
      setCorrectionText(text);
      setStorySession((current) => ({
        ...current,
        activeId,
        answers,
        continuation,
        correctionText: text,
        byStory: { ...(current.byStory || {}), [activeId]: { answers, continuation, correctionText: text } },
      }));
      setStatus("mastered");
    } catch {
      setError("Could not correct your continuation. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const answerQuestion = (index, option) => {
    const next = { ...answers, [index]: option };
    setAnswers(next);
    setStorySession((current) => ({
      ...current,
      activeId,
      answers: next,
      continuation,
      correctionText,
      byStory: { ...(current.byStory || {}), [activeId]: { answers: next, continuation, correctionText } },
    }));
    if (Object.keys(next).length === activeStory.questions.length) setStatus("completed");
  };

  const addStoryWord = (word) => {
    const sentence = activeStory.text.split(". ").find((line) => line.toLowerCase().includes(word.word.toLowerCase())) || activeStory.text.split(". ")[0];
    const next = {
      id: `story-${activeStory.id}-${word.word}-${Date.now()}`,
      word: word.word,
      gender: "",
      meaning: word.meaning,
      sentence: sentence.endsWith(".") ? sentence : `${sentence}.`,
      sentence_english: "From story context",
      dateAdded: todayKey,
    };
    setVocabWords([next, ...vocabWords]);
    setTooltip(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={generateStory} disabled={loadingStory} className={`${primaryButton} w-full`}>
          {loadingStory ? <SkeletonText label="Generating..." /> : "Generate new story"}
        </MotionButton>
        {stories.map((story) => {
          const storyStatus = storyProgress[story.id] || "unread";
          const pct = storyStatus === "mastered" ? 100 : storyStatus === "completed" ? 70 : storyStatus === "read" ? 35 : 8;
          return (
            <button key={story.id} onClick={() => { setActiveId(story.id); setStoryStatus(story.id, storyStatus === "unread" ? "read" : storyStatus); setAnswers(storySession.byStory?.[story.id]?.answers || {}); setContinuation(storySession.byStory?.[story.id]?.continuation || ""); setCorrectionText(storySession.byStory?.[story.id]?.correctionText || ""); }} className={`${cardClass} w-full p-4 text-left transition hover:-translate-y-0.5 ${activeId === story.id ? "ring-2 ring-[#4F46E5]" : ""}`}>
              <p className="text-xs font-semibold text-[#4F46E5]">{story.category}</p>
              <p className="mt-1 font-semibold">{story.title}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]"><div className="h-full bg-[#10B981]" style={{ width: `${pct}%` }} /></div>
              <p className="mt-2 text-xs capitalize text-[#6B7280]">{storyStatus}</p>
            </button>
          );
        })}
      </aside>
      <section className="space-y-5">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-[#F43F5E]">{error}</div>}
        <div className={`${cardClass} overflow-hidden`}>
          <div className={`h-36 bg-gradient-to-br ${activeStory.cover || "from-indigo-100 to-emerald-100"} relative`}>
            <div className="absolute left-8 top-8 h-16 w-16 rounded-2xl bg-white/70 shadow-sm" />
            <div className="absolute bottom-6 right-10 h-20 w-28 rounded-t-full bg-white/60" />
          </div>
          <div className="p-6">
            <p className="text-xs font-semibold uppercase text-[#4F46E5]">{activeStory.category}</p>
            <h2 className="mt-1 text-2xl font-semibold">{activeStory.title}</h2>
            <p className="mt-5 text-sm leading-7 text-[#374151]">
              {renderStoryText(activeStory, setTooltip)}
            </p>
            {tooltip && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 inline-block rounded-2xl border border-[#E5E7EB] bg-[#F8F7F4] p-4 text-sm shadow-sm">
                <p className="font-semibold">{tooltip.word}</p>
                <p className="text-[#6B7280]">{tooltip.meaning}</p>
                <button onClick={() => addStoryWord(tooltip)} className="mt-2 text-xs font-semibold text-[#4F46E5]">Add to vocab</button>
              </motion.div>
            )}
          </div>
        </div>
        <div className={`${cardClass} p-6`}>
          <h3 className="text-lg font-semibold">Comprehension</h3>
          <div className="mt-4 space-y-4">
            {activeStory.questions.map((question, index) => (
              <div key={question.q}>
                <p className="text-sm font-semibold">{index + 1}. {question.q}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {question.options.map((option) => {
                    const picked = answers[index] === option;
                    const correct = option === question.answer;
                    return (
                      <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} key={option} onClick={() => answerQuestion(index, option)} className={`rounded-xl border px-3 py-2 text-sm ${picked ? (correct ? "border-[#10B981] bg-emerald-50 text-[#047857]" : "border-[#F43F5E] bg-rose-50 text-[#BE123C]") : "border-[#E5E7EB] bg-white text-[#111827]"}`}>
                        {option}
                      </MotionButton>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={`${cardClass} p-6`}>
          <h3 className="text-lg font-semibold">Wie geht es weiter?</h3>
          <p className="mt-2 text-sm text-[#6B7280]">{activeStory.nextPrompt}</p>
          <textarea value={continuation} onChange={(e) => setContinuation(e.target.value)} className="mt-4 min-h-28 w-full rounded-2xl border border-[#E5E7EB] p-3 text-sm outline-none focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)]" placeholder="Schreibe 3-5 Sätze auf Deutsch..." />
          <MotionButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={checkContinuation} disabled={checking} className={`${primaryButton} mt-3`}>
            {checking ? <SkeletonText label="Checking..." /> : "Correct my continuation"}
          </MotionButton>
          <CorrectionCard corrections={parsedCorrection} />
          {correctionText && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-900">
              <p className="font-semibold">Model continuation</p>
              <p className="mt-1">{activeStory.modelContinuation}</p>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}

function renderStoryText(story, setTooltip) {
  const words = story.words || [];
  let parts = [story.text];
  words.forEach((entry) => {
    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return [part];
      const regex = new RegExp(`(${entry.word})`, "gi");
      return part.split(regex).map((piece, index) => (
        piece.toLowerCase() === entry.word.toLowerCase()
          ? <button key={`${entry.word}-${index}-${piece}`} onClick={() => setTooltip(entry)} className="rounded bg-[#4F46E5]/10 px-1 font-semibold text-[#4F46E5]">{piece}</button>
          : piece
      ));
    });
  });
  return parts;
}

const rootElement = document.getElementById("root");
const root = window.__DEUTSCH_MEISTER_ROOT__ || createRoot(rootElement);
window.__DEUTSCH_MEISTER_ROOT__ = root;
root.render(<App />);
