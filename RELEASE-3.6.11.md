# Rhythm Reader 3.6.11 — three owner rulings

Prepared on top of 3.6.10. Engine (both tools, identical) and the stored readings in `known-rhythms.js`. Rulings by Prof. Gross, 17 November 2026.

## 1. The Raven: `SUDdenLY there CAME a TAPping`

The stored reading of the Raven's opening stanza marked `SUDdenly THERE came A TAPping`: beats on "there" and "a", "came" weak, and two beats side by side (`A TAP`). It contradicted rhythm-measure item M08, whose key is "came" and whose foil is "there". It now reads `SUDdenLY there CAME a TAPping`, the clean trochaic reading the engine gives on its own.

This needed one engine change: a stored reading could give a word only one beat (the first capital counted). **Each run of capitals is now a beat**, so `SUDdenLY` is two. No other stored reading has a word with two capital runs, so no other stored reading changed.

## 2. Longfellow, and a rule: "and" is weak at the start of a line

The stored reading of "A Psalm of Life" marked `subLIME AND dePARTing`, promoting "and" and placing two beats side by side. "and" is now weak: `subLIME and dePARTing`. The evaluation corpus line `And departing leave behind us` follows the same ruling; its gold is now `and dePARTing LEAVE beHIND us`.

Prof. Gross then ruled the general case: **a coordinating conjunction (and, but, or, nor) that opens a line stays weak, the Raven included, while a preposition there may still take the metre's beat** (`IN the FORests OF the NIGHT` is unchanged). The engine now gives a line-initial and/but/or/nor a high cost to promote (3.0; the metre does not take it), and records whether each word opens a line (`lineInitial`, not enumerable, so no export changes). Subordinating words are not affected (`WHILE I PONdered`, `when HORton`), nor is "and" in the middle of a line (`to LAbor AND to WAIT`).

Measured: across the 846 analyses compared for every release, this rule changed only `And departing leave behind us` (auto and Verse), which now matches its gold, so the harness stays at 45 of 47. Outside that set it changes Raven lines that open "And the…": `and the RAven NEVer FLITting` (still trochaic), and `and the ONly WORD there SPOken WAS the WHISpered word` (now labelled **iambic**, as accepted in the ruling). The Appendix A draft marking for that line (appA-08) was changed from `AND the ONly` to `and the ONly` to match.

## 3. Triple-time lines that open weak-STRONG are anapestic

`the STOCKings were HUNG by the CHIMney with CARE` divides equally well into anapests with a short first foot or into amphibrachs, and was labelled `alternating (anapestic/amphibrachic scansions near-equivalent)`. That exact tie is now settled as **predominantly anapestic**, as such lines are taught. Any other tie is still reported (`The Assyrian came down like the wolf on the fold` remains an iambic/anapestic tie under Verse). A line that ends on a weak syllable is unaffected (`There once was a man from Nantucket` stays amphibrachic). Rhythm Reader now says "Read as having a regular beat: weak-weak-STRONG." for these lines.

## What changed, measured

Across 846 analyses of 282 texts under all three text types: 16 changed. Ten are the anapestic label (Horton twice, "Oh solitude", the two Night Before Christmas lines, under auto and Verse); six are the two stored readings above (under each text type). No other beat or label moved.

## Validation

`npm test` passes. Updated to the rulings: `test_known_readings.js` (Horton is no longer reported as a tie; Raven and Longfellow readings asserted; line-initial and weak, IN and WHILE unchanged, mid-line AND unchanged), `test_quotes_stimuli.js` (`And departing leave behind us` now has three beats), `test_meter_labels.js` (four tie lines now anapestic; a different tie still reported), `test_reader_wording.js`. Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out): one gold reading changed (section 2) and the engine now matches it. Rhythm-measure candidates under Verse: 40 of 40.
