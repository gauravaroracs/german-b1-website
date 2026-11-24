// Original practice scenarios; learners write their own answers.
export const WRITING_EXERCISES = [
  {
    id: "repair-request",
    title: "Request a repair",
    register: "formal",
    brief: "Write to your landlord about a broken heater in your flat.",
    points: [
      "Describe what is broken.",
      "Explain when the problem started.",
      "Ask when someone can inspect it.",
      "Say when you are available at home.",
    ],
    patterns: [
      { german: "Seit gestern funktioniert die Heizung nicht mehr.", english: "The heating has not worked since yesterday.", purpose: "Describe the problem and when it began." },
      { german: "Könnten Sie bitte jemanden schicken?", english: "Could you please send someone?", purpose: "Politely ask for someone to come." },
      { german: "Wann wäre eine Reparatur möglich?", english: "When would a repair be possible?", purpose: "Ask when a repair could happen." },
      { german: "Am Donnerstag bin ich ab 16 Uhr zu Hause.", english: "I am at home from 4 p.m. on Thursday.", purpose: "Say when you are home." },
    ],
  },
  {
    id: "change-appointment",
    title: "Change an appointment",
    register: "formal",
    brief: "Write to an office because you cannot attend your appointment.",
    points: [
      "Refer to the appointment you have.",
      "Explain briefly why you cannot attend.",
      "Ask for a different date.",
      "Suggest when you are available.",
    ],
    patterns: [
      { german: "Ich habe am Dienstag einen Termin bei Ihnen.", english: "I have an appointment with you on Tuesday.", purpose: "Mention your existing appointment." },
      { german: "Leider kann ich nicht kommen, weil ich krank bin.", english: "Unfortunately, I cannot come because I am ill.", purpose: "Explain why you cannot attend." },
      { german: "Könnten wir einen neuen Termin vereinbaren?", english: "Could we arrange a new appointment?", purpose: "Ask to arrange another appointment." },
      { german: "Nächste Woche hätte ich am Freitag Zeit.", english: "I would be available next Friday.", purpose: "Suggest when you are available." },
    ],
  },
  {
    id: "invite-friend",
    title: "Invite a friend",
    register: "informal",
    brief: "Write to a friend and invite them to spend an afternoon together.",
    points: [
      "Suggest an activity.",
      "Say when and where you could meet.",
      "Explain why you chose the activity.",
      "Ask your friend to reply.",
    ],
    patterns: [
      { german: "Hast du Lust, am Samstag ins Museum zu gehen?", english: "Would you like to go to the museum on Saturday?", purpose: "Invite your friend to an activity." },
      { german: "Wir könnten uns um zwei Uhr vor dem Eingang treffen.", english: "We could meet in front of the entrance at two o'clock.", purpose: "Suggest a meeting place and time." },
      { german: "Ich möchte die Ausstellung sehen, weil ich mich für Fotografie interessiere.", english: "I would like to see the exhibition because I am interested in photography.", purpose: "Explain why you want to see the exhibition." },
      { german: "Sag mir bitte, ob du Zeit hast.", english: "Please let me know whether you have time.", purpose: "Ask your friend to let you know if they are free." },
    ],
  },
  {
    id: "course-information",
    title: "Ask about a course",
    register: "formal",
    brief: "Write to a language school about a German course you are interested in.",
    points: [
      "Say which course interests you.",
      "Ask when it starts.",
      "Ask about the price and materials.",
      "Explain when you can attend.",
    ],
    patterns: [
      { german: "Ich interessiere mich für Ihren B1-Deutschkurs.", english: "I am interested in your B1 German course.", purpose: "Say which course interests you." },
      { german: "Wann beginnt der nächste Kurs?", english: "When does the next course start?", purpose: "Ask when the course starts." },
      { german: "Wie viel kostet der Kurs, und sind die Materialien im Preis enthalten?", english: "How much does the course cost, and are the materials included?", purpose: "Ask about the price and materials." },
      { german: "Ich kann nur am Abend am Unterricht teilnehmen.", english: "I can only attend classes in the evening.", purpose: "Explain when you can attend." },
    ],
  },
];

// Rotate the correct answer among four translations without changing on reload.
export function writingPatternQuestions(exercise) {
  return exercise.patterns.map((pattern) => ({
    german: pattern.german,
    options: Array.from({ length: exercise.patterns.length }, (_, offset) => exercise.patterns[(offset + 1) % exercise.patterns.length].english),
    answer: pattern.english,
  }));
}

export function writingPurposeQuestions(exercise) {
  return exercise.patterns.map((pattern) => ({
    purpose: pattern.purpose,
    options: exercise.patterns.map((_, index) => exercise.patterns[(index + 1) % exercise.patterns.length].german),
    answer: pattern.german,
  }));
}

export function validateWritingFeedback(result, expectedPoints = 4) {
  if (!result || typeof result.corrected !== "string" || !result.corrected.trim() || !Array.isArray(result.changes) || !Array.isArray(result.coverage) || result.coverage.length !== expectedPoints || result.coverage.some((item) => typeof item !== "string" || !item.trim()) || result.changes.some((item) => typeof item !== "string")) return null;
  return { corrected: result.corrected, changes: result.changes.slice(0, 10), coverage: result.coverage.slice(0, expectedPoints) };
}
