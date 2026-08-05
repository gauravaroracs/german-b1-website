# Deutsch Meister Functional QA

## Fixed in this pass

- Stories comprehension no longer contains the misplaced guided-session minimized overlay code inside answer rendering. Story answer buttons render normally and do not crash the page.
- Guided session minimization now works when opening a task tab from the overlay. The lesson page remains usable with a small "Tap to return" control instead of a full-screen overlay.
- Stored state loading now falls back to the initial value if SQLite/IndexedDB read fails, so the app does not stay on a blank loading screen.
- OpenAI key loading now falls back to the API-key screen if storage read fails.
- SQLite operation queue now recovers after a failed operation instead of permanently rejecting all later storage reads/writes.
- SQLite export/import now includes `storyProgress` and `grammarSession`, in addition to the existing vocab, dashboard, chat, story, timer, and think state.
- Sentence Lab, Think feedback, and Story continuation now have explicit offline behavior when the app is in browser-only/no-OpenAI mode.
- Browser-only mode is now remembered across reloads when Supabase env vars exist, with a Dashboard control to switch back to Supabase sign-in.

## Validation Commands

- `npm run build`
- `npm run preview -- --port 4173` (Vite used `http://localhost:4174/` in this run because 4173 was occupied)

## Browser Smoke Checks

Run against `http://localhost:4174/` in headless Chrome through CDP.

- Supabase auth gate loaded when local Supabase env vars were present.
- "Continue with browser-only storage" opened the OpenAI key screen.
- "Continue without AI" opened the main dashboard.
- Dashboard rendered without the error boundary.
- Grammar rendered without the error boundary.
- Chat rendered the offline API-key message without the error boundary.
- Vocab rendered Vault/Sentence Lab/Top 1000 without the error boundary.
- Phrases rendered and filtered content was visible.
- Think rendered and offline submit saved the thought with a clear no-key message.
- Stories rendered without the error boundary.
- Stories comprehension answer click did not crash.
- Stories offline continuation saved with a clear no-key message.
- Guided session opened, advanced to Grammar, minimized correctly, and left Grammar usable.
- Sentence Lab offline analysis produced vocabulary candidates and a clear no-key grammar-analysis message.
- Grammar first-topic exercises reached 5/5 and exposed "Mark Topic Complete".
- Vocab manual add, search, word detail, SRS review, and delete completed without the error boundary.
- Top 1000 "Add next 20 unknown" completed without the error boundary.
- Speech buttons on phrase/vocab controls did not crash the page.
- JSON export downloaded a non-empty `.json` backup.
- JSON import loaded a test vocabulary backup through the UI.
- SQLite export downloaded a non-empty `.sqlite` backup.
- SQLite import loaded a generated test database through the UI.
- SQLite-imported vocabulary survived a full page reload in browser-only mode.
- Daily Anki checklist logging saved today's reviewed-card count.
- Dashboard showed the local-mode Supabase status and "Use Supabase sign-in" recovery button.

## Remaining Credential-Dependent Checks

- Real Supabase sign-in and cross-device cloud sync require a valid Supabase project, auth setup, and user credentials.
- OpenAI-backed Chat, generated vocab enrichment, generated custom examples, generated stories, Think correction, and Story continuation correction require a valid OpenAI API key.
- Production deployment and live production verification were not performed in this pass.

## Known Notes

- The production bundle still warns that the main JavaScript chunk is larger than 500 kB. This is not a functional failure.
- Chrome headless logs a macOS allocator warning unrelated to the app; the React UI still renders and workflow checks completed.
