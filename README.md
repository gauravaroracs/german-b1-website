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

After Supabase is configured, the app shows a sign-in screen first. In the current local development version, account data uses a separate browser-local namespace; older browser-only data remains in its original location and is not automatically uploaded. Personal API keys remain browser-local.

**Current limitations:** The deployed version may still use the earlier shared storage behavior. The development version keeps unsuccessful cloud changes locally across reloads and offers a preview, account comparison and export of recognized older browser records. A loopback-only experimental versioned-sync path also offers selective import, but has not been verified against a local backend. Ordinary account-mode backup restore remains temporarily disabled; browser-only restore remains available. Cross-device conflicts, backup restores and concurrent tabs are not fully resolved; export a backup before switching accounts or restoring. Live cloud behavior has not been verified for this change.

# Secure hosted AI

All tutor features use the shared `callOpenAI` dispatcher. Signed-in users can choose **Use secure hosted AI**; personal API keys continue to work as a browser-only option, and local/offline mode remains available.

To enable hosted AI in this Supabase project:

1. Authenticate with `supabase login`, then link the project with `supabase link --project-ref udflpqslpowdxmonkrsp`.
2. Preview the incremental migration with `supabase db push --dry-run --remote`; apply it with `supabase db push --remote` after reviewing the plan.
3. Configure the Edge Function secrets `OPENAI_API_KEY` and (optionally) `AI_MONTHLY_REQUEST_LIMIT` (default `120`) and `OPENAI_MODEL` (default `gpt-6-luna`). Supabase provides its project URL, anon key, and service-role key to deployed functions.
4. Deploy `supabase/functions/ai` with `supabase functions deploy ai --project-ref udflpqslpowdxmonkrsp`.
5. After the schema and function are live, set the Vite build variable `VITE_HOSTED_AI_ENABLED=true` in the app deployment and rebuild. It defaults to `false` so the app cannot route signed-in learners to an undeployed backend.

The function validates the signed-in user, bounds request size, reserves each request atomically against the monthly limit, and returns only generated text plus usage totals. It does not persist prompts or responses. AI provider billing is controlled by the Supabase project owner’s OpenAI account.
