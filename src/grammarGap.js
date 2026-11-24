// Original short exercises; levels are not certified.
export const GRAMMAR_GAPS = [
  { id: "city", prompt: "Ich wohne ___ Berlin.", options: ["in", "nach", "zu"], answer: "in", rule: "Use ‘in’ to say where someone lives." },
  { id: "appointment", prompt: "Ich habe morgen ___ Termin beim Arzt.", options: ["ein", "einen", "eine"], answer: "einen", rule: "The masculine direct object takes ‘einen’ in the accusative." },
  { id: "because", prompt: "Ich bleibe zu Hause, weil ich krank ___.", options: ["bin", "habe", "ist"], answer: "bin", rule: "After ‘weil’, the conjugated verb stands at the end of the clause." },
  { id: "yesterday", prompt: "Gestern ___ ich zu Hause.", options: ["bin", "war", "ist"], answer: "war", rule: "‘War’ is the past form of ‘sein’ for ‘ich’." },
  { id: "help", prompt: "Kannst du mir bitte ___?", options: ["helfen", "hilft", "geholfen"], answer: "helfen", rule: "After a conjugated modal verb, use the infinitive at the end." },
  { id: "train", prompt: "Ich fahre ___ dem Zug zur Arbeit.", options: ["mit", "für", "ohne"], answer: "mit", rule: "‘Mit’ takes the dative: ‘mit dem Zug’." },
  { id: "woman", prompt: "Das ist die Frau, ___ im Büro arbeitet.", options: ["die", "den", "dem"], answer: "die", rule: "The relative pronoun is ‘die’ for a feminine subject in this clause." },
  { id: "letter", prompt: "Ich habe gestern einen Brief ___.", options: ["geschrieben", "schreiben", "schrieb"], answer: "geschrieben", rule: "The Perfekt uses ‘haben’ plus the past participle ‘geschrieben’." },
  { id: "if", prompt: "Wenn ich Zeit habe, ___ ich Deutsch.", options: ["lerne", "lernen", "lernst"], answer: "lerne", rule: "After the introductory ‘wenn’ clause, the conjugated verb comes before the subject." },
  { id: "chair", prompt: "Der Stuhl steht ___ Fenster.", options: ["am", "ans", "zum"], answer: "am", rule: "For a fixed position, ‘an’ takes the dative: ‘an dem’ contracts to ‘am’." },
];

export function advanceGrammarGap(queue, correct) {
  if (!queue.length) return [];
  return correct ? queue.slice(1) : [...queue.slice(1), queue[0]];
}
