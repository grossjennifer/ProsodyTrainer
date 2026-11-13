# Rhythm Reader 3.5.0 — cost decomposition and a weight fitter

Prepared on top of 3.4.0. This is a review candidate, not a deployed release. No weight changes; analyses are unchanged.

## Changes

- Engine: every reading's cost now decomposes exactly as `fixed + sum(W[k] * features[k])`. `features` counts each use of a W entry (clashes, lapses, grid misses, the Rhythm Rule, nucleus and coherence discounts as negatives). `fixed` is the faithfulness paid at the rhythm-preference tag weights, which are not in W. The counts are taken by the same code that computes the cost (an optional accumulator threaded through `readingCost`), so the two cannot drift.
- New API: `explainReading(doc, ipIndex, beats)` scores ANY beat string for a phrase in the engine's own context (regime, metre prior, nucleus) and returns `{ cost, fixed, features, faithfulnessBySource }`. Also `getWeights()` and `featureKeys`.
- The scoring context is stored on each phrase as a non-enumerable property, so exported JSON is unchanged.
- `eval/fit.js` (`npm run fit`): averaged structured perceptron over the 14 W terms, development split only, epoch chosen on dev (promotion probes first, then exact match, then per-syllable accuracy, then the smallest move from the shipped weights). The held-out split is read once, at the end, as a release gate. It writes `eval/fitted-weights.json` (git-ignored) and never edits the engine.
- `eval/fit.js --diagnose` (`npm run fit:diagnose`): for each failing dev phrase, the gold and engine readings with their costs, whether the failure is the cost model or the search, and which terms differ.
- Not fitted, by design: PROSE (sets the regime threshold rather than scoring a reading), GIVEN (scales a preference weight), and the rhythm-preference tag tables (too many parameters for the current corpus).
- Bump both identical engines from 3.4.0 to 3.5.0.

## First run on the current corpus

- Shipped weights kept: no fitted set passed the gates.
- The best dev result (26/30, from 25/30) fixed `psalm-6` (`WE can MAKE our LIVES subLIME`) by cutting LAPSE from 0.80 to 0.10. That broke the probe `TRYing TO eSCAPE`, because lapse avoidance is what promotes `to`. Both are function-word promotions; the model has no term that tells a line-initial promotion from an interior one, so the two items pull LAPSE in opposite directions.
- Diagnosis of the 5 dev failures: all 5 are the cost model, none the search. Of the 5, `brigade-6` (`ALL in the VALley of death`) is a deliberate extrametricality case; `byron-1` is already flagged for owner review; `byron-2` leaves `cohorts` unbeaten (likely the same whole-word-bolding transcription issue); `brigade-4` leaves the second `league` unbeaten by dactylic convention. Fitting weights to those golds would distort the model.

## Validation

Passed: `npm test` and both per-folder feet and nuclear-stress suites. Eval harness report byte-for-byte identical to 3.3.3. New `test_reading_features.js` (in `test:engine`): over 1,270 candidate readings (corpus passages, probes and three extra texts, under auto, verse, prose, strict alternation and clash subordination off), `explainReading` reproduces the ranked cost and `fixed + W·features` equals the cost to within 1e-9. Verified to fail if any one counter is removed.

## Corpus corrections (owner rulings, 12 Nov 2026)

- `byron-2`: gold revised to `and his COhorts were GLEAMing in PURple and GOLD` (four beats). The review flag is removed.
- `brigade-4`: gold `HALF a league HALF a league` confirmed. The text regains the poem's commas (`Half a league, half a league,`), lost in transcription; with them the engine's existing repeated-ternary rule produces the gold reading.
- Harness: dev exact 25/30 → 27/30, per-syllable 96.5% → 98.0%; all 41/46 → 43/46. Held-out unchanged at 16/16. No engine or weight change. `eval/current.json` regenerated; `eval/baseline.json` left as the frozen reference.
- Remaining dev failures after these two rulings: `psalm-6`, `byron-1` (both engine errors) and `brigade-6` (then a deliberate extrametricality case; see below).

## Fitter correction

- After the corpus corrections, a fit passed every gate on a dev per-syllable gain of 98.0% → 98.1% with no reading improved. The gain came from a changed denominator: the fitted weights split `our` into `o·ur` (syncope chooses between dictionary variants by cost). Selection and the "improves dev" gate now count a per-syllable gain only when both runs have the same number of syllables, and a new gate requires identical syllabification on dev and held-out. With that fix the shipped weights are kept.

## brigade-6 ruling (owner, 12 Nov 2026)

- `All in the valley of Death` is now `ALL in the VALley of DEATH`: `Death` carries a beat as well as the phrase nucleus. Changed in the corpus gold and in the known-readings registry (`known-rhythms.js`), which is what the live site displays.
- The prominence-without-beat example moves to the owner-confirmed `HALF a league HALF a league`, where the second `league` is the phrase nucleus but carries no beat. `test_phrase_prominence.js` (section 3) and acceptance criterion 5 (renamed "prominence survives without a beat") now use it; `test_known_readings.js` and `test_phrase_prominence.js` assert the beat on `Death`. One engine comment updated. No engine logic changed.
- Harness: dev exact 27/30 → 28/30; all 43/46 → 44/46. Held-out unchanged at 16/16.

## Rulings of 12 Nov 2026 (later)

- `stnick-2`: `not EVen a MOUSE` (EVen carries a beat, as in the Experiment 1 stimulus). No longer provisional, so it is now scored (held-out); the engine produces it. Held-out 17/17, all 45/47.
- `In the forests of the night`: OF carries a beat. The corpus item and promotion probe already say so; no change.
