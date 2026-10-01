# Rhythm Reader 3.3.0 — amphibrachic rhythm

Prepared in the local clone. This is a review candidate, not a deployed release.

## Changes

- Add the amphibrach (weak-STRONG-weak, `WSW`) as a fifth PHRASE-level foot in `RHYTHM_FEET`, alongside trochee, iamb, anapest and dactyl. It is the third phase of the ternary grid (`PERIOD_FOOT['3-1']`), so a period-3 reading that opens one weak syllable before the beat is now labelled amphibrachic instead of carrying no foot name.
- Word-level templates are unchanged. `FOOT_NAMES`, `CLASSICAL` and `FOOT_INVENTORY` still hold four feet; a word such as banana is still parsed across a foot boundary and is never given an amphibrach template. `proportion_amphibrachic` in the profile export therefore stays 0 (it is a word-template share, like the other four proportion fields); phrase-level amphibrachs are reported in `meterSummary.footCounts`.
- The amphibrach carries a 0.01 tie-break surcharge in the phrase fitter, the meter parser and the grid probe. Because WSW starts and ends weak it can re-bracket stretches the other feet already cover at equal cost (SWW+SW = SW+WSW for `HALF a league ONward`); the surcharge sends exact ties to the established reading and is far below any mismatch or residue cost, so it never changes a beat.
- Meter labels, local runs, forced scansion and the ambiguity notice all accept `amphibrach` / `amphibrachic`.
- Rhythm Reader Pro: new example chip "Amphibrachic — weak-STRONG-weak" (There once was a man from Nantucket.), plain-language gloss, Choose-amphibrachic button text, foot styling, and the five-pattern help text.
- Rhythm Reader: verse help text lists weak–strong–weak.
- Learn: the rhythm page now presents five shapes, adds the limerick exemplar, states that the fifth was NOT part of the 2026 training materials, and says participants learned "the first four patterns above". Hub card and How the tools decide updated to match; the latter keeps the word-level inventory at four.
- Bump both identical engines from 3.2.1 to 3.3.0.

## Behaviour change to expect

- Beats are unchanged. The eval harness gives identical exact-match and per-syllable results before and after (held-out 16/16, all 41/46, 0 clashes); `meterOk` is unchanged for every item.
- Labels change on ternary verse. Lines that were already reported as `alternating (anapestic/dactylic scansions near-equivalent)` now list amphibrachic as a third near-equivalent reading (the three ternary feet are rotations of one beat grid); psalm-6 moves from `mixed` to `alternating (anapestic/amphibrachic ...)`. Pro shows a third Choose button on those lines.
- The unscored probe `this IS a test SENtence` moves from `alternating (trochaic/anapestic/dactylic ...)` to `predominantly amphibrachic`, because its beats are exactly WSW WSW.
- Limerick and Browning (I sprang to the stirrup) lines now read `predominantly amphibrachic`.

## Validation

Passed: `npm test` (engine, pages, diagnostics, rhythm candidates, all acceptance criteria), plus both per-folder feet and nuclear-stress suites. `test_rhythm_feet*.js` now asserts the five-foot phrase inventory, keeps the word-level guard, and adds the limerick (beats and label). `test_learn.js` asserts the five feet, the limerick exemplar, and that the page does not claim participants learned the amphibrach.

## Suggested review checks before publishing

1. In Pro, click the Amphibrachic chip: expect there ONCE was a MAN from nanTUCKet, labelled amphibrachic.
2. Confirm an anapestic and a dactylic exemplar still label as before.
3. Download a Pro export and verify build 3.3.0.
4. Publish both engine files, both tool pages and the three Learn pages together.
