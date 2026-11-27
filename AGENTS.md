# Project agent instructions

<!-- BEGIN PERSONAL PROJECTS MASTER INDEX -->
## Personal projects overview

The shared master index is `/Users/gauravarora/Documents/Personal_Projects/Master Projects.md`.
When you make a change to a project under `/Users/gauravarora/Documents/Personal_Projects`, update the matching entry and add a concise dated change-log line in that master file before finishing. Record what changed, its verification, and material remaining work; preserve earlier entries and existing instructions. Update status, technology, dates and commercial assessment only when supported by evidence; mark assumptions and unknowns explicitly. Never copy secrets, personal records, private customer data, or sensitive document contents into the index.

When creating a new project within Personal_Projects, create an `AGENTS.md` in its project root with this maintenance instruction, add its own entry to the master index, and record its creation date if known. For nested independent projects, maintain the relevant entry; do not create extra project instructions inside dependencies or generated directories. If the master file is inaccessible, do not silently claim it was updated: report the limitation and the intended update. These instructions guide participating agents; they are not a filesystem watcher and do not track manual edits automatically.
<!-- END PERSONAL PROJECTS MASTER INDEX -->

## Learning flow map

- App state, storage, daily story selection, story reading and the main route live in `src/DeutschMeister.jsx`.
- Daily story selection and prompt construction are in `src/dailyStory.js`; AI response validation is in `src/storyValidation.js`.
- Talk UI and saved lessons are in `src/Practice.jsx`; bounded conversation context and turn validation are in `src/practiceConversation.js`.
- Today and the primary navigation are in `src/Home.jsx`, `src/StudioNavigation.jsx` and `src/BottomNavBar.jsx`.
- Focused learning checks are in `tests/dailyStory.test.js`, `tests/practiceConversation.test.js` and `tests/storyValidation.test.js`.

## Local checks and safety

- Run `npm run test:learning` for the core story and Talk checks, `npm test` for all Node tests, `npm run build` for the production bundle and `git diff --check` before review.
- `npm run daily-checks` repeats those local checks, writes an ignored Markdown report under `reports/daily/`, and retries a failed local command once. It blanks AI and Supabase build variables; it does not access learner accounts, make provider calls, edit source, or publish.
- Browser walkthroughs must use isolated synthetic data and mocked AI responses. Never treat a mock, local build or preview as live-provider or production verification.
- Production publication, live verification and rollback remain separate from data recovery. Do not deploy or change learner data as part of daily checks.
