# KorrektWort add-flow research — Phase 1

Checked 24 November 2026. Status: **Phase 1 research completed within the available account credits; untested cases are explicitly marked below**. No implementation or deployment was made.

## Where I looked

- Opened <https://korrektwort.com/words?add=1> in an unsigned-in in-app browser. It landed on the public homepage; choosing Start free led through `/signin` to a Google sign-in screen. The add interface became accessible after the user signed in during the next session.
- Opened <https://korrektwort.com/> and its FAQ. These are the provider's descriptions, not observations of the add flow.
- Read this project's `AGENTS.md`, `README.md`, `src/DeutschMeister.jsx`, `src/sqliteStorage.js`, `src/cloudStorage.js`, and AI function and package scripts. Local behavior below is source inspection, not a runtime test.

## What is actually known

The public homepage describes saving words with article, meaning, grammar and examples, and describes explaining text sentence by sentence. Its FAQ currently says the free plan permits five brand-new words a day, shared-dictionary words do not count, and text explanations use AI credits. Exact credits, remaining allowance, and whether an individual test is chargeable must be checked in the signed-in UI. Public marketing is not proof of the actual output schema, sequence, consistency, or implementation.

The homepage also exposes a free, no-account word explanation field. It was not submitted: the project instructions and this goal require review before submitting online forms.

## Test matrix — signed-in results

Use synthetic text only. Save no sensitive content. Before each case inspect any displayed cost or limit, and stop if a purchase, upgrade, or unexpected charge is required. Repeat only when possible within visible free allowances; keep track of any credits used. Test cases may need to be adapted to available UI controls, without claiming unrun tests succeeded.

| Case | Proposed input | What to record | Status |
|---|---|---|---|
| Noun | `Frist` | article, plural, translation, examples, other generated fields | Submitted; existing duplicate, see observations below |
| Noun with article and duplicate | `die Frist`, after first case | normalization, warning or merge, saved count | Submitted; existing duplicate, see below |
| Verb / inflection | `beworben` | lemma, forms, meaning, examples | Submitted; mapped to an existing verb and persisted, see below |
| Phrase | `sich bewerben` | classification and phrase-specific output | Existing-entry card: B1 verb, meaning, example, link |
| Several words | `Termin, Bewerbung, zuverlässig` | whether split, rejected, or treated as one entry; per-item results | Saved one entry, `der Termin`; count 58 → 59; no other item results shown |
| One sentence | `Ich bewerbe mich um eine Stelle.` | route, translation, grammar, examples, saving | Sentence choice → 2-credit Explain; generated and kept; present after reload |
| Several sentences | `Ich suche eine Wohnung. Morgen habe ich einen Termin.` | segmentation, responses, saving individual pieces | Sentence choice → 2-credit Explain; two analyses; first kept and present after reload |
| Punctuation | `Hallo, wie geht es dir?` | classification and punctuation treatment | Sentence choice displayed; explanation not run |
| Empty input | empty/whitespace | disabled controls or validation | Add button disabled for empty and whitespace |
| Invalid text | `xyzq123` | rejection, fallback, possible consumption of quota | Rejected as non-dictionary; UI said nothing saved and no credit used |
| Repetition | repeat a representative supported input | output consistency and duplicate handling | Reloaded auto-run sentence URL inadvertently reran analysis; wording varied and balance decreased; see cost note |

For every executed case record timestamp, account mode, exact input and action, visible outputs and errors, cost/allowance before and after if shown, loading, edits, duplicate handling, reload persistence, and supporting screenshots or notes. Do not expose account identifiers. Distinguish actual output from inference. Record inaccessible or unsupported cases rather than guessing. Avoid destructive cleanup; test entries may remain in the account.

## Signed-in observations, 24 November 2026

The signed-in Words page had a single German-word input, an Add word button (disabled when empty), search, sort and filters; it showed 58 saved words before the tests. The homepage displayed six credits before testing; consumption from the tests was not checked and should not be inferred.

- `Frist` produced an **already in your words** card for the existing entry with article, a level/type label, an English meaning, one German example with translation, pronunciation, and an Open word link. The add button temporarily changed to an adding state. The displayed card labeled it B1, while the list displayed A2: this inconsistency was visible and its cause is unknown.
- `die Frist` produced the same already-saved entry and link. This shows normalization for this particular article and word, not for all variants. Input cleared after each result.
- `beworben` returned **noted**, identifying it as the past participle of the already-saved `sich bewerben`; it linked to that existing word. Its detail page now displays the encountered form, and it remained visible after reload. This test changed an existing entry by adding or noting a form; whether it had already been recorded before the test was not established. Cross-device persistence was not tested.
- That detail page shows level, type, irregularity, meaning, encountered form, forms, example and memory tip. It has Overview, Grammar, Examples, Related, AI, Notes and Progress tabs. Grammar displays present, past and perfect, separability and irregularity. Examples showed three examples, translations, level labels, word-by-word buttons and pronunciation. Related offered generation for one credit; the AI tab listed four actions at one credit each. Those actions were not run.
- The user explicitly approved the remaining test inputs and use of credits after an earlier automatic-review rejection; subsequent tests are documented below.

Additional read-only inspection on 24 November: the account homepage still displayed six credits and 58 words after the earlier tests; this does not establish the cost of future tests. The word Notes tab has an editable note and save, archive and delete controls; none were activated. Progress shows mastery, due status, review/forgetting counts, example count and a review timeline.

The signed-in Explain page has a text/expression field, a sample button, a disabled-when-empty Analyse button labeled **2 credits**, and a history of prior analyses. Opening one existing saved analysis showed a sentence type and level, two English renderings, usage explanation, labeled structural chunks, a word-order note, an original and another example with translations, pronunciation, and individual keep controls. Existing kept sentences linked to the sentences page; follow-up questions were labeled one credit. Clicking a word in the analysis opened a lookup card with article, level, translation, pronunciation, and a visible already-in-stash status. These are observations of one previously saved analysis, not a newly generated response or proof that all inputs produce the same sections. No existing sentence or note was edited or deleted.

These initial observations concern one account and selected inputs; the later tests and their limits are recorded separately below.

## New submission evidence and limits

All following tests were performed on 24 November 2026 in the authorized signed-in account. Exact timestamps were not recorded. Evidence is the observed interface and the persisted records, not an API schema or server implementation.

- Multiple words: after submitting `Termin, Bewerbung, zuverlässig`, the interface displayed an adding state and rotating grammar/article messages, then **added to your words** for only `der Termin`. The count increased by one, from 58 to 59. The card presented a B1 noun label, meaning and one translated example; the list and noun detail displayed A1. On reopening, detail showed plural `Termine`, English and German meanings, three examples, a memory cue, and seven tabs. This single result does not prove whether the other inputs were ignored internally, but no additional save or per-item result was shown. The saved word remained in the list on a later visit.
- Single sentence: the word field did not immediately save the input; it displayed a sentence-detection message, **Explain this sentence · 2 credits**, and **Add it as a word anyway**. Explain generated a level, a meaning and natural translation, usage, labeled chunks, a grammar note, two translated examples and pronunciation, plus keep and follow-up controls. The original was explicitly kept, and both original text and grammar note appeared in the saved-sentences list after reload. The result asserted that `sich bewerben` *always* takes `um`; its own existing verb example uses `auf die Stelle`. Treat generated grammar as potentially overgeneralized, not verified linguistic truth.
- Two sentences: the same choice appeared for both sentences together. Explain separated them into individual cards with translations, chunk roles, specific grammar explanations, pronunciation, save-to-lesson, follow-up and keep controls. A vocabulary section listed four words, one marked new with a Save button and three marked saved. Keeping the first sentence added it to the sentence list and it remained after that list was reloaded. Saving the second sentence, individual extracted words, lessons, and editing were not tested.
- Punctuation: the proposed question produced the sentence-choice message, but no separate paid explanation was run. Empty and whitespace-only input left Add disabled. `xyzq123` produced a visible non-dictionary message saying nothing was saved and no credit used, retained input, and offered an Explain link labeled two credits.
- Repetition and credits: the balance displayed six credits before these tests, two after the first sentence and an inadvertent reload of its `auto=1` URL, and zero after the multi-sentence explanation. Reloading that auto-run URL unexpectedly launched a second generation; the output wording changed and the combined two-credit-per-run labels and observed balance are consistent with four credits being consumed. The reload was my error. There was no purchase or upgrade. Avoid reloading auto-run URLs when checking persistence; reopen the saved record or saved-sentences list instead.
- Untested: direct standalone new noun/verb addition separate from the comma input, creating a new phrase, forced add-as-word option, arbitrary bulk/import submissions, per-field edits, actual failure/retry under network errors, cross-device sync, and additional repeats. The account displayed zero remaining credits after the tests. The public FAQ and in-app text showed different free new-word limits (five versus ten per day); neither was independently verified by exhausting the limit.

## Pack and editing inspection

A follow-up read-only check on 24 November opened Explore. The UI offers starter packs with a count of already-saved words and a button to add the missing words, plus level-based exam batches whose buttons or unlock messages depend on progress. Opening a pack showed its saved count, the corresponding existing words and a review link. No pack was added, so actual batch results, failure handling and duplicate behavior remain untested; this is not evidence of an arbitrary user-supplied bulk importer.

On the newly saved `Termin` entry, Examples displayed three examples and audio controls; no example-edit control was visible in that tab. Notes provided a text area and Save note, plus archive and delete actions. No note was submitted and no save, archive or deletion behavior was tested. Field editability outside these visible controls remains unverified.

## Existing project: source-based comparison

- `src/DeutschMeister.jsx:282` classifies input with punctuation including commas as sentence-like; therefore comma-separated word lists take the sentence-choice path rather than a verified bulk-add flow.
- `src/DeutschMeister.jsx:3415` handles empty input, sentence choice, duplicate opening, offline dictionary lookup, AI generation, and a manual draft on unknown offline input or AI failure. The quick-add flow should also be checked when implementing changes.
- `src/DeutschMeister.jsx:2797` asks the AI for a German lemma, article/plural, type, translation, CEFR, pronunciation, forms, memory cue, contexts, collocations, and word family. A requested field is not proof of its quality or presence in every response.
- `src/DeutschMeister.jsx:4221` generates a sentence analysis, including translation, chunks, word order, and tokens; `:4258` saves an original sentence for review. There is an offline preview as well.
- `src/sqliteStorage.js` implements SQLite in IndexedDB, and `src/cloudStorage.js` supports cloud-backed state with local fallback; actual persistence across reloads/devices has not been tested here. The app also supports hosted AI and user-key modes in source.
- `package.json` provides build/dev/preview scripts; no test script is declared. Existing QA documentation is historical and does not establish this run's behavior.

## Observed behavior compared with current source

| Behavior | KorrektWort observation | Deutsch Meister source | Follow-up |
|---|---|---|---|
| Empty and loading | Empty Add button was disabled; during submission it displayed an adding state. Whitespace also left the button disabled. | Main add handler returns for trimmed empty input and uses a loading state (`src/DeutschMeister.jsx:3415`). | Check disabled appearance and keyboard behavior at runtime. |
| Exact/article duplicate | `Frist` and `die Frist` opened the same already-saved-result card. | `vocabKey` strips an initial German article; duplicate handling opens an existing entry (`:204`, `:3425`). | Test capitalization, whitespace and plural/inflected variants rather than assuming identical behavior. |
| Inflection | `beworben` linked to existing `sich bewerben` and displayed a form with grammatical label after reload. | The AI schema requests one `formYouMet` and label (`:2797`); a merge retains one nonempty form (`:204`). Existing duplicate lookup is based on the input key before AI normalization. | Verify whether an inflection merges correctly into an existing lemma, and whether multiple encountered forms need a list. |
| Word details | Seven tabs, grammatical forms, three examples, pronunciation and optional AI actions were visible for the existing verb. | `WordDetail` implements tabs, AI actions, related words and editable examples (`:3995`). Requested fields come from AI or offline data. | Compare interactions and output field by field with runtime evidence; do not infer equal content quality. |
| Multiple words | The comma-separated sample produced one saved word, not three visible results. | Commas trigger the sentence heuristic; sentence-like input first presents a choice. The extraction helper can request several items, but the add handler saves its first returned entry (`:282`, `:2853`, `:3443`). | Design splitting, preview, partial saves, and duplicate behavior deliberately; more reference cases remain untested. |
| Sentence | New single and multi-sentence inputs showed explicit routing, generated analysis and individual save controls. | Sentence explanation is a separate path with analysis and an explicit keep-for-review action (`:4202`, `:4258`). | Use the observed paths to draft criteria, and test editing and failures separately. |

The local comparison is based on code, not a browser execution. The reference observations include one newly saved noun and selected existing entries, but do not establish internal generation mechanisms. The reference mnemonic shown for the verb is a learner cue; its wording does not establish a factual etymology.

## Prioritized implementation plan and acceptance criteria

This is a proposed independent implementation, not a claim of exact parity or authorization to build it. Local behaviors below must still be runtime tested.

1. **Reliable input routing and data preservation.** Reuse the existing explicit sentence choice, but do not classify commas alone as proof that a word list is a sentence. Give a learner an unambiguous preview for multiple word inputs and distinguish phrase, list and sentence where possible. Acceptance: the supplied three-item sample can be reviewed as three proposed items; users can choose a single phrase or sentence; no items silently disappear; empty input cannot submit; sentence text survives navigation or errors.
2. **Per-item word processing.** Reuse normalized duplicate keys and the existing vocabulary schema. For each item show success, duplicate, invalid or failure; retain successful saves if another item fails, and preserve retryable input. Acceptance: `Frist` and `die Frist` resolve to one item, rejected nonsense is not saved, and a successful new item exposes article, plural where applicable, meaning, examples and source context without overwriting user notes or review progress. Define and test lemma/inflection merge and multiple encountered forms separately; current source stores one form.
3. **Sentence explanation and selective saving.** Reuse sentence explanation, `savedSentences` and review flows. For multiple sentences show independent translations, structural chunks and explanation, with explicit per-sentence keep actions and optional word selection. Acceptance: the two-sentence example produces two identifiable results; either can be saved without the other; saved text, translation and grammar survive reload; duplicate saves are idempotent. Preserve clear loading, cost/availability and actionable failure states.
4. **AI accuracy, safety and budgets.** Validate response structure and missing fields before presenting/saving; mark uncertain generated grammar and do not assert unverified absolute rules. Keep retry and editing paths available. Do not automatically repeat billable analysis on page reload; require a deliberate new action and show the available budget or provider error. Verify offline, personal-key and hosted paths, plus existing monthly limits, before any rollout.
5. **Verification before implementation is accepted.** Exercise both Words and quick-add paths, local and signed-in persistence, keyboard and mobile flows, duplicates, malformed output, partial failures and reloads. Run the project's prescribed build/checks, and have a German educator assess representative generated explanations. Do not claim cross-device sync until tested.

## Evidence limits and next step

The reference observations are from one account and a small sample; generated text and limits may change. The report does not establish private architecture, exact prompts, or full product parity. Complete the remaining credit-dependent and editing tests if needed after the allowance replenishes; do not purchase credits without authorization. A developer can use the plan above to scope the subsequent implementation, but the user has not requested implementation as part of Phase 1.
