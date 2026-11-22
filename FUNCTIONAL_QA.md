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

## Integrated Home / Words / Review / Practice Pass (2026-11-22)

### Verified

- `npm run build` completed successfully after the integrated changes. The large JavaScript chunk warning remains.
- `git diff --check` completed without whitespace errors.
- Home rendered four daily tasks and showed daily activity separately from the longer-term B1 plan.
- Words showed the existing six saved items, word detail/forms, saved-word filters, and the five-word next-story queue.
- A tap on **beworben** resolved to the existing **bewerben** entry, showed its meaning, B1 level, forms, and sentence context, and displayed **Already saved**.
- Practice interview demo produced a specific follow-up, the full corrected sentence, and separate explanations for Perfekt and verb-final order after *weil*.
- The tutor reply bookmark saved a complete reply with its translation and scenario label; the saved-sentence count showed one item. Grammar lessons showed two distinct saved notes.
- Review displayed a due saved-sentence card alongside due vocabulary, completed a six-card session, and applied a rating. The one-card follow-up verified keyboard key `3` applies Good and moves to the next review state.
- Mobile navigation remained visible at a 390 px viewport; measured document width was 375 px, with no horizontal overflow. Quick word was available under More tools, and navigation returned to the top of the page.
- JSON and SQLite export controls displayed their success messages. Browser console error check returned no errors after the latest app changes.

### Backup Serializer Regression Check (2026-11-22)

- The current SQLite serializer/importer round-tripped vocabulary forms and review history, saved sentences, grammar lessons, practice turns/scenario/draft, and existing grammar, timer, story, streak, and daily-block data.
- A pre-change SQLite schema without the `forms` column or new practice metadata imported successfully; existing vocabulary review history and story progress were preserved, and absent new fields remained absent.
- This check calls the current SQLite serialization functions with isolated fixtures. Downloading and importing the files through the browser UI remains open, as does the equivalent full JSON UI round-trip.

### Still Open

- New saved-sentence, grammar-lesson, practice-conversation, and verb-form fields have not been verified through JSON and SQLite import/export round trips in this pass. The earlier checks recorded above were against the older app state and do not establish compatibility for these new fields. Browser download/file-picker automation did not complete, so no claim is made that current backup files were downloaded or re-imported.
- Live AI response quality, malformed-response retry, and failed-request draft recovery were not exercised; the checked Practice turn used the deterministic offline demo.
- The required before/after local screenshot artifacts were not produced: the design-skill screenshot script could not start Chrome, and CUA screenshots were visible in the session but not saved as project files.
- Visual review was performed at the checked desktop and mobile states; full page-by-page accessibility and contrast review remains open.
