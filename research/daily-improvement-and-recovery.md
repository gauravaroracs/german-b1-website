# Daily improvement and recovery boundaries

Updated 2026-11-27.

## Local daily loop

- `npm run daily-checks` runs focused story/Talk tests, the full Node test suite, a production build and `git diff --check`. Each local command can be retried once; the report records recovered failures rather than hiding them.
- The runner blanks AI and Supabase build variables, does not read learner accounts or cloud data, and writes ignored reports to `reports/daily/`.
- A Codex local project automation is configured as active for 09:00 Europe/Berlin daily checks. It must not edit a dirty checkout. On a clean checkout it may prepare at most one evidence-backed, uncommitted fix, then must rerun checks. It cannot commit, push, deploy, access production data or spend money.
- The local runner passed manually on 2026-11-27. The first scheduled run is due 2026-11-28; its execution has not yet been observed.

## Publication and code rollback design

1. Prepare changes in a clean candidate and require the focused tests, full suite, build and diff check to pass.
2. Keep publication behind a separate user-reviewed push/merge and deployment approval. A local pass is not deployment approval.
3. After an authorized release, record the deployment URL and commit identity; wait for the provider's ready state, then smoke-test the public page and one read-only learner path in an isolated browser profile. Do not enter production learner data or send a real AI request as a smoke test.
4. If the deployed code fails that smoke test, restore the last verified code deployment or revert the release, then verify the restored deployment. Record which deployed commit was checked.

Automatic publication and live verification are not enabled. They remain blocked on an explicit release boundary and a verified non-destructive production smoke path. Do not infer live health from this checkout or the daily report.

## Learner-data recovery is separate

Code rollback does not restore browser-local SQLite/JSON data or Supabase records. Before any schema or data operation, separately verify an export/backup and a restore path for the affected store. Keep cloud migration rollback/forward-fix decisions independent from static-site code rollback. Daily checks and browser smoke tests use synthetic local data only.

## Performance observation

The 2026-11-27 Vite build produced a 1,075.86 kB minified app entry (317.39 kB gzip) and a 659.73 kB SQL WASM asset (326.10 kB gzip); Vite warns about the app entry exceeding 500 kB. Practice and Vocabulary Adventure already build as separate lazy chunks. No additional split was made because the measured entry includes the core learning route; capture real-device first-load timing before moving more shared vocabulary or story code.
