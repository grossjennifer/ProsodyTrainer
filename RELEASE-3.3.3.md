# Rhythm Reader 3.3.3 — verse may use contracted pronunciations (ev'ry)

Prepared in the local clone. This is a review candidate, not a deployed release.

## Changes

- Engine: metrical syncope (`applyMetricalSyncope()`). In text already read as metrical, a word whose CMU entry lists a contracted variant (`ev'ry` beside `every`, `nat'ral`, `fam'ly`) uses it when it fits the beat better by more than the ambiguity band (`SYNCOPE_MARGIN` = `AMBIGUITY_BAND`, 0.75). The variant must drop exactly one unstressed syllable and keep every consonant and every other stress. Previously the engine always used the full form, so `Then the little Hiawatha learned of every bird its language` carried an extra weak syllable and lost its trochaic grid.
- Contraction never applies under Ordinary prose, never to a word the reader has edited, and never decides the regime. Measured: the contraction gain cannot tell a poem from an accidental iamb (`I bought a cam'ra and some choc'late for the gen'ral` gains more than Hiawatha does), so it is applied only once the full-form text is already read as metrical.
- The full form stays in `alternates`, so Pro's word inspector can switch back; such words carry `lexicalRule: 'metrical-syncope'`. The display keeps the stressed syllable's spelling (`EV·ery`, `CAM·era`), not the `EVE·ry` / `CAME·ra` a fresh spelling split would give.
- Bump both identical engines from 3.3.2 to 3.3.3.

## Behaviour change to expect

- Verse: Hiawatha scans `THEN the LIT·tle HI·a·WA·tha LEARNED of EV·ery BIRD its LAN·guage`. In a longer verse sample the contraction also corrected `MUseum` to `muSEum`.
- Let it decide: Hiawatha is still read as prose, because contraction is not allowed to turn prose into verse. Tracked in `test_prose_pending.js`.
- Across 124 texts (the eval corpus plus the recent prose sets) in Let it decide and Verse, no regime verdict changed. Ordinary prose is untouched.
- Eval harness: the full report is byte-for-byte identical to 3.3.2 (held-out 16/16, all 41/46, 0 clashes).

## Validation

Passed: `npm test` (engine, pages, diagnostics, rhythm candidates, all acceptance criteria), plus both per-folder feet and nuclear-stress suites. `test_diagnostic_battery.js` adds:

- Section I: regime detection on A. J. Hartley's deliberately iambic paragraph (Let it decide finds the beat, Ordinary prose does not, three of its lines scan as clean iambs). Passes on 3.3.2 too; guards against regressions.
- Section J: metrical syncope (Hiawatha trochaic on Verse, `ev·ery` display, prose keeps `ev·er·y`, the camera sentence stays prose). Fails on 3.3.2.
- Section K: Horton line 1, `i MEANT what i SAID and i SAID what i MEANT` (headless first foot). Passes on 3.3.2 too. Line 2 is not yet a test: the circulating marking contradicts the dictionary (`faithful`, `hundred`, `percent`), and the standard reading awaits the owner's confirmation.

`test_prose_pending.js` now also tracks Hiawatha on Let it decide (4 pending).

## Suggested review checks before publishing

1. Rhythm Reader, Verse: the Hiawatha line should read `THEN the LIT·tle … EV·ery BIRD its LAN·guage`.
2. Rhythm Reader, Ordinary prose: the same line should keep `EV·er·y`.
3. Download a Pro export and verify build 3.3.3.
4. Publish both engine files together.
