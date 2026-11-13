# Rhythm Reader 3.4.0 — remembered words (Pro)

Prepared against commit 5923d02. This is a review candidate, not a deployed release.

## Changes

- Engine: a remembered-words layer. After a reader corrects a word's stress or syllable division (digits, split/merge, or a dictionary pronunciation), the word can be remembered, and every later analysis starts from that correction. New API: `learnWord(doc, i)`, `forgetWord(word)`, `loadLearnedWords(obj)`, `getLearnedWords()`, `learnableWord(word)`, `refreshWord(doc, word)`.
- A remembered word reports `lexicalSource: 'learned'` and `lexicalRule: 'remembered-word'`. It is not a user edit in the new document, so PDI is measured against an automatic analysis that already includes it. The dictionary pronunciations stay available as alternates, and Reset returns to the remembered analysis.
- Never remembered, because context decides them: function words (they gain or lose a beat by meter, not by lexical stress) and the stress-shifting heteronyms (`REcord` / `reCORD`). An imported list containing either is rejected entry by entry.
- Metrical syncope never contracts a remembered word.
- Stats: `learnedRate` appears only when a remembered word was used; `heuristicRate` no longer counts remembered words as rule estimates.
- Each entry stores the automatic pattern it replaced (`defaultPattern`), the date and the engine build, so an exported list is usable as data later.
- Pro page: a "Remember this word stress" control in the word inspector (or an explanation when the word cannot be remembered), a "Remembered words" section under the Metrical lexicon tab (list, Forget, Forget all, Export, Import), a learned source in the analysis table, a "from remembered words" figure in the statistics, and a provenance line in plain-text exports when remembered words were applied.
- Storage is this browser's localStorage only. Nothing is sent anywhere.
- Research mode: remembered words are not applied, and the controls are hidden, so every participant starts from the same automatic analysis. Turning research mode on re-analyzes a passage that used remembered words. Turning it off does not re-analyze (that would discard the annotation on screen); remembered words apply from the next analysis.
- Rhythm Reader (basic) does not load or offer remembered words. Its only edit is the beat tier, which is context-dependent.
- Bump both identical engines from 3.3.3 to 3.4.0.

## Behaviour change to expect

- None unless a remembered-words list is loaded. With an empty list the eval harness report is byte-for-byte identical to 3.3.3 (held-out 16/16, all 41/46, 0 clashes).

## Validation

Passed: `npm test` (engine, pages, diagnostics, rhythm candidates, all acceptance criteria), plus both per-folder feet and nuclear-stress suites. New:

- `test_learned_words.js` (36 checks, in `test:engine`): empty list changes nothing; edit, remember and reuse in a new sentence; split syllables kept; reset returns to the remembered reading; heteronym and function-word refusals, including inside an imported list; a chosen CMU variant (`adult`) is remembered with its phonemes; no-op corrections refused; only unedited instances are refreshed; corrupt entries rejected; syncope leaves a remembered word alone (with a control showing syncope does fire otherwise, and verified to fail if the guard is removed).
- `test_remembered_words_page.js` (21 checks, in `test:pages`): the Pro workflow end to end in jsdom, served from `http://localhost` so localStorage has a real origin: inspector control, saving, reload, research-mode suspension and resumption, Forget, and cleaning of a rejected stored entry.

## Suggested review checks before publishing

1. Pro: type `We flew to Jaen in May.`, inspect Jaen, split it `ja|en`, set stress `01`, choose Remember. Reload the page and analyze `Jaen is far.`; it should read `ja·EN` with source `learned`.
2. Pro: inspect `the` or `record`; the inspector should explain why it cannot be remembered.
3. Pro: turn research mode on; Jaen should return to its automatic analysis and the Remember controls should disappear.
4. Publish both engine files together.
