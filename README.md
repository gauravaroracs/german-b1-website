# Deutsch Meister (German B1 Website)

A modern, interactive React web application tailored to help learners bridge the gap from A2 to B1 German, with a specific focus on professional, academic, and administrative situations in Germany.

---

## 🎯 Features

*   **Daily Learning Path**: structured dashboard with a calendar streak tracker, Anki flashcard logging, daily speaking drills, and reading goals.
*   **Structured B1 Grammar Lessons**: Includes 10 modules (Nominativ, Akkusativ, Dativ, Präteritum, Perfekt, Konjunktiv II, Passiv, Adjektivendungen, Relativsätze, and Wechselpräpositionen). Each has lessons, fill-in-the-blanks, multiple choice, and correction exercises.
*   **AI Conversational Partner (Lena)**: Converse with an AI assistant that helps correct grammar, sentence cases, word order, and connectors in real time.
*   **Interactive Stories**: Real-world scenarios (like visiting the *Ausländerbehörde*, writing applications, code reviews) with built-in vocabulary lookups, quiz questions, and written continuation prompts.
*   **Situation Templates**: Built-in flashcards for common templates used in Job Interviews, professional E-Mails, Smalltalk, Government Offices (*Behörden*), and the Workplace (*Arbeitsplatz*).
*   **Persistent Storage**: Uses Supabase cloud sync when configured, with browser-local SQLite as an offline fallback. SQLite and JSON backups can be exported and imported from the Dashboard.

---

## 🛠️ Tech Stack

*   **Framework**: React 18 (Vite-powered)
*   **Styling & Icons**: Tailwind CSS, Lucide React
*   **Animations**: Framer Motion
*   **API Integration**: OpenAI API (configured with local client keys)
*   **Database**: Supabase Postgres for cloud sync, IndexedDB + SQLite WASM for local/offline persistence

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

## Supabase Persistence

The app works without Supabase, but data stays browser-local in that mode. To persist progress across browsers/devices:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and fill in:
   ```bash
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
4. In Supabase Auth settings, enable email/password signups.
5. Add the same env vars in Vercel for production and redeploy.

After Supabase is configured, the app shows a sign-in screen first. Existing browser-local data is uploaded to Supabase the first time each saved key is loaded and no cloud copy exists yet. Local SQLite remains as an offline mirror.

# Secure hosted AI

All tutor features use the shared `callOpenAI` dispatcher. Signed-in users can choose **Use secure hosted AI**; personal API keys continue to work as a browser-only option, and local/offline mode remains available.

To enable hosted AI in a Supabase project:

1. Apply `supabase/schema.sql` so the per-user monthly request counter and reservation function exist.
2. Set the Edge Function secrets `OPENAI_API_KEY` and (optionally) `AI_MONTHLY_REQUEST_LIMIT` (default `120`) and `OPENAI_MODEL` (default `gpt-4o-mini`). Supabase provides its project URL, anon key, and service-role key to deployed functions.
3. Deploy `supabase/functions/ai` as the `ai` function.

The function validates the signed-in user, bounds request size, reserves each request atomically against the monthly limit, and returns only generated text plus usage totals. It does not persist prompts or responses. AI provider billing is controlled by the Supabase project owner’s OpenAI account.
