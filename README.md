# Deutsch Meister (German B1 Website)

A modern, interactive React web application tailored to help learners bridge the gap from A2 to B1 German, with a specific focus on professional, academic, and administrative situations in Germany.

---

## 🎯 Features

*   **Daily Learning Path**: structured dashboard with a calendar streak tracker, Anki flashcard logging, daily speaking drills, and reading goals.
*   **Structured B1 Grammar Lessons**: Includes 10 modules (Nominativ, Akkusativ, Dativ, Präteritum, Perfekt, Konjunktiv II, Passiv, Adjektivendungen, Relativsätze, and Wechselpräpositionen). Each has lessons, fill-in-the-blanks, multiple choice, and correction exercises.
*   **AI Conversational Partner (Lena)**: Converse with an AI assistant that helps correct grammar, sentence cases, word order, and connectors in real time.
*   **Interactive Stories**: Real-world scenarios (like visiting the *Ausländerbehörde*, writing applications, code reviews) with built-in vocabulary lookups, quiz questions, and written continuation prompts.
*   **Situation Templates**: Built-in flashcards for common templates used in Job Interviews, professional E-Mails, Smalltalk, Government Offices (*Behörden*), and the Workplace (*Arbeitsplatz*).
*   **Offline Storage**: Integrates custom IndexedDB handlers to save vocabulary words, logs, study histories, and API configurations securely in the browser.

---

## 🛠️ Tech Stack

*   **Framework**: React 18 (Vite-powered)
*   **Styling & Icons**: Tailwind CSS, Lucide React
*   **Animations**: Framer Motion
*   **API Integration**: OpenAI API (configured securely with local client keys)
*   **Database**: IndexedDB (for client-side persistent storage)

---

## 🚀 Getting Started

1. Navigate to the project directory:
   ```bash
   cd "german b1 website"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the local address (typically `http://localhost:5173`) in your browser. Enter your OpenAI API key in the intro screen to enable the AI Chat partner.
