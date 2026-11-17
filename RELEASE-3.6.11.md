# Rhythm Reader 3.6.11 — three owner rulings

Prepared on top of 3.6.10. Engine (both tools, identical) and the stored readings in `known-rhythms.js`. Rulings by Prof. Gross, 17 November 2026.

## 1. The Raven: `SUDdenLY there CAME a TAPping`

The stored reading of the Raven's opening stanza marked `SUDdenly THERE came A TAPping`: beats on "there" and "a", "came" weak, and two beats side by side (`A TAP`). It contradicted rhythm-measure item M08, whose key is "came" and whose foil is "there". It now reads `SUDdenLY there CAME a TAPping`, the clean trochaic reading the engine gives on its own.

This needed one engine change: a stored reading could give a word only one beat (the first capital counted). **Each run of capitals is now a beat**, so `SUDdenLY` is two. No other stored reading has a word with two capital runs, so no other stored reading changed.

## 2. Longfellow: `subLIME and dePARTing`

The stored reading of "A Psalm of Life" marked `subLIME AND dePARTing`, promoting "and" and placing two beats side by side. "and" is now weak: `subLIME and dePARTing`. The evaluation corpus line `And departing leave behind us`, which stands alone with nothing before it, keeps its gold `AND dePARTing` for now; see the handoff document.

## 3. Triple-time lines that open weak-STRONG are anapestic

`the STOCKings were HUNG by the CHIMney with CARE` divides equally well into anapests with a short first foot or into amphibrachs, and was labelled `alternating (anapestic/amphibrachic scansions near-equivalent)`. That exact tie is now settled as **predominantly anapestic**, as such lines are taught. Any other tie is still reported (`The Assyrian came down like the wolf on the fold` remains an iambic/anapestic tie under Verse). A line that ends on a weak syllable is unaffected (`There once was a man from Nantucket` stays amphibrachic). Rhythm Reader now says "Read as having a regular beat: weak-weak-STRONG." for these lines.

## What changed, measured

Across 846 analyses of 282 texts under all three text types: 16 changed. Ten are the anapestic label (Horton twice, "Oh solitude", the two Night Before Christmas lines, under auto and Verse); six are the two stored readings above (under each text type). No other beat or label moved.

## Validation

`npm test` passes. Updated to the rulings: `test_known_readings.js` (Horton is no longer reported as a tie; Raven and Longfellow readings asserted), `test_meter_labels.js` (four tie lines now anapestic; a different tie still reported), `test_reader_wording.js`. Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out). Rhythm-measure candidates under Verse: 40 of 40.
