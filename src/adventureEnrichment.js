/**
 * Focused additions for words that benefit from grammar, morphology, or usage
 * guidance. Source meanings, articles, and ordinary examples stay canonical in
 * frequencyWords.js; this file only overrides or enriches selected entries.
 */
export const ADVENTURE_ENRICHMENT = Object.freeze({
  "freq-34": {
    exampleDe: "Ich freue mich auf das Wochenende.",
    exampleEn: "I am looking forward to the weekend.",
    explanation: "sich marks a reflexive verb here. Its form follows the subject: ich freue mich, du freust dich, er freut sich.",
  },
  "freq-40": {
    exampleDe: "Schau mal, der Bus kommt!",
    exampleEn: "Look, the bus is coming!",
    explanation: "In conversation, mal often softens a request or draws friendly attention. It does not need a literal 'once' in the English sentence.",
  },
  "freq-47": {
    exampleDe: "Du kommst nicht? – Doch, ich komme mit!",
    exampleEn: "You're not coming? – Yes, I am coming along!",
    explanation: "doch can contradict a negative statement or question. It can also make an invitation sound warmer, as in Komm doch mit.",
  },
  "freq-137": {
    exampleDe: "Ich lerne seit einem Jahr Deutsch.",
    exampleEn: "I have been learning German for a year.",
    explanation: "German normally uses the present tense with seit when an action began in the past and is still continuing.",
  },
  "freq-198": {
    exampleDe: "Der Bus hält an der nächsten Haltestelle.",
    exampleEn: "The bus stops at the next stop.",
    explanation: "halten can mean 'hold' or, for a vehicle, 'stop.' In this sentence hält is the third-person singular form.",
  },
  "freq-343": {
    exampleDe: "Ich denke noch über den Vorschlag nach.",
    exampleEn: "I am still thinking about the suggestion.",
    breakdown: "nach + denken; in a main clause: ich denke ... nach",
    explanation: "nachdenken is separable. To name the topic, use über plus accusative: über den Vorschlag nachdenken.",
  },
  "freq-344": {
    exampleDe: "Ich lerne heute meine neuen Kollegen kennen.",
    exampleEn: "I am getting to know my new colleagues today.",
    breakdown: "kennen + lernen; in a main clause: ich lerne ... kennen",
    explanation: "kennenlernen is written as one infinitive, but its parts separate around the middle of a main clause.",
  },
  "freq-402": {
    exampleDe: "Ich rufe dich heute Abend an.",
    exampleEn: "I will call you this evening.",
    breakdown: "an + rufen; in a main clause: ich rufe ... an",
    explanation: "The person called is a direct object here: ich rufe dich an.",
  },
  "freq-450": {
    exampleDe: "Wo kann ich eine Fahrkarte nach Berlin kaufen?",
    exampleEn: "Where can I buy a ticket to Berlin?",
    breakdown: "Fahr- (from fahren, 'to travel/ride') + Karte ('card/ticket')",
    compoundParts: ["Fahr", "karte"],
    explanation: "Fahrkarte is a transport ticket. The destination commonly follows nach when it is a city or most countries.",
  },
  "freq-481": {
    exampleDe: "Mein Rücken tut seit gestern weh.",
    exampleEn: "My back has hurt since yesterday.",
    breakdown: "weh + tun; in a main clause: der Rücken tut weh",
    explanation: "The hurting body part is the subject: Mein Rücken tut weh. With a person, German often uses dative: Mir tut der Rücken weh.",
  },
  "freq-559": {
    exampleDe: "Zieh bitte deine Jacke an.",
    exampleEn: "Please put on your jacket.",
    breakdown: "an + ziehen; command: Zieh ... an",
    explanation: "anziehen is separable. With sich, it can mean getting dressed: Ich ziehe mich an.",
  },
  "freq-580": {
    exampleDe: "Unter der Woche stehe ich um sieben Uhr auf.",
    exampleEn: "On weekdays I get up at seven o'clock.",
    breakdown: "auf + stehen; in a main clause: ich stehe ... auf",
    explanation: "The prefix moves to the end in a main clause, while the infinitive remains aufstehen.",
  },
  "freq-583": {
    exampleDe: "Der Zug kommt um 18 Uhr in Köln an.",
    exampleEn: "The train arrives in Cologne at 6 p.m.",
    breakdown: "an + kommen; in a main clause: der Zug kommt ... an",
    explanation: "Use in plus dative for the place of arrival here: in Köln. The separated prefix an closes the clause.",
  },
  "freq-591": {
    exampleDe: "Darf ich mich kurz vorstellen? Ich heiße Mina.",
    exampleEn: "May I briefly introduce myself? My name is Mina.",
    breakdown: "vor + stellen; in a main clause: ich stelle mich vor",
    explanation: "sich vorstellen means 'introduce oneself.' Without the reflexive pronoun it can also mean introducing someone; with a dative reflexive it can mean imagining something: Ich stelle mir das vor.",
  },
  "freq-593": {
    exampleDe: "Ich nehme morgen an der Besprechung teil.",
    exampleEn: "I am taking part in the meeting tomorrow.",
    breakdown: "teil + nehmen; in a main clause: ich nehme ... teil",
    explanation: "teilnehmen uses an plus dative for the event: an der Besprechung teilnehmen.",
  },
  "freq-647": {
    exampleDe: "In Frankfurt steigen wir in den Zug nach Köln um.",
    exampleEn: "In Frankfurt we change to the train to Cologne.",
    breakdown: "um + steigen; in a main clause: wir steigen ... um",
    explanation: "umsteigen is used for changing trains, buses, or other transport. The connection can be introduced with in plus accusative.",
  },
  "freq-648": {
    exampleDe: "Füllen Sie bitte dieses Formular aus.",
    exampleEn: "Please fill out this form.",
    breakdown: "aus + füllen; formal request: Füllen Sie ... aus",
    explanation: "The formal command keeps Sie after the verb stem, while the separable prefix goes to the end.",
  },
  "freq-649": {
    exampleDe: "Ich melde mich heute für den Deutschkurs an.",
    exampleEn: "I am registering for the German course today.",
    breakdown: "an + melden; in a main clause: ich melde mich ... an",
    explanation: "For registering yourself, use sich anmelden. The course or event often follows für plus accusative.",
  },
  "freq-652": {
    exampleDe: "Mach bitte das Fenster auf.",
    exampleEn: "Please open the window.",
    breakdown: "auf + machen; command: Mach ... auf",
    explanation: "aufmachen is a common conversational verb for opening something. In the command, auf stands at the end; the complete infinitive is aufmachen.",
  },
  "freq-705": {
    exampleDe: "Die Milch steht im Kühlschrank.",
    exampleEn: "The milk is in the fridge.",
    breakdown: "kühl ('cool') + Schrank ('cupboard/cabinet')",
    compoundParts: ["Kühl", "schrank"],
    explanation: "The compound names the cooled cabinet used for food. German compounds take the grammatical gender of their final noun, so it is der Kühlschrank.",
    memoryTip: "Memory trick: picture a cool cupboard keeping the milk cold.",
  },
  "freq-750": {
    exampleDe: "Ich schlage das neue Wort im Wörterbuch nach.",
    exampleEn: "I look up the new word in the dictionary.",
    breakdown: "Wörter (plural of Wort) + Buch ('book')",
    compoundParts: ["Wörter", "buch"],
    explanation: "A Wörterbuch is a book of words. The common verb for looking something up is nachschlagen: ich schlage ... nach.",
  },
  "freq-850": {
    exampleDe: "Wir warten an der Bushaltestelle auf den Bus.",
    exampleEn: "We are waiting for the bus at the bus stop.",
    breakdown: "Halte- (related to halten, 'to stop') + Stelle ('place'); Bushaltestelle adds Bus in front",
    compoundParts: ["Halte", "stelle"],
    explanation: "A Haltestelle is a place where public transport stops. Bushaltestelle is the more specific compound Bus + Halte- + Stelle; it is an example here, not an extra target word.",
    memoryTip: "Memory trick: imagine a marked place where the bus hält, 'stops.'",
  },
  "freq-903": {
    exampleDe: "Welche Behandlung bezahlt meine Krankenkasse?",
    exampleEn: "Which treatment does my health insurance pay for?",
    breakdown: "Kranken- ('sick people/patients') + Kasse ('fund')",
    compoundParts: ["Kranken", "kasse"],
    explanation: "Krankenkasse names a statutory or private health insurer. The compound takes the gender of Kasse, so it is die Krankenkasse.",
  },
  "freq-973": {
    exampleDe: "Ich freue mich auf den Urlaub, und ich freue mich über die gute Nachricht.",
    exampleEn: "I am looking forward to the vacation, and I am happy about the good news.",
    explanation: "sich freuen auf plus accusative looks forward to something; sich freuen über plus accusative expresses happiness about something present or received.",
  },
  "freq-979": {
    exampleDe: "Ich bewerbe mich bei der Firma um ein Praktikum.",
    exampleEn: "I am applying to the company for an internship.",
    explanation: "Use sich bewerben bei plus dative for the organization and um plus accusative for the position: bei der Firma um ein Praktikum.",
  },
});
