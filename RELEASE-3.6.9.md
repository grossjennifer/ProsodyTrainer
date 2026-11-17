# Rhythm Reader 3.6.9 — short comma lines

Prepared on top of 3.6.8. Engine only, in both tools (engines identical). **No beat moves anywhere.** Two labels and one prose/verse decision change, all for short lines made of comma-separated phrases.

## The problem

`Hickory, dickory, dock` was labelled prose under "Let it decide" and "mixed" under Verse, although the same line without commas was labelled dactylic. Two separate causes:

1. **Too short to count as evidence.** A run of comma-separated phrases can establish a beat for the whole line, but only with at least eight syllables. `Hickory, dickory, dock` and `Twinkle, twinkle, little star` have seven.
2. **The closing beat counted against the metre.** The line scans as dactyl, dactyl, and a single closing beat (catalexis). The label needs one foot type to make up 70% of the feet; with the closing beat counted as a foot, two of three fell short.

## What changed

1. A run of **three or more comma-separated phrases that is a whole line on its own** may establish a beat with seven syllables. A shorter comma run inside a longer line still needs eight: `"Well, what are you doing, then?" John asked.` stays prose.
2. **A single beat that closes a line** no longer counts against the line's metre. A single-word phrase at the start of a line (`No, I read this book.`) is not affected.
3. Each phrase now records whether it begins and ends a line (`lineStart`, `lineEnd` in the JSON export). These are new fields; nothing existing was renamed.

| Text | Text type | Before | After |
|---|---|---|---|
| Hickory, dickory, dock | Let it decide | prose | predominantly dactylic |
| Hickory, dickory, dock | Verse | mixed | predominantly dactylic |
| Twinkle, twinkle, little star | Let it decide | prose | predominantly trochaic |

## What did not change

Across 846 analyses of 282 texts (all evaluation texts and stored readings, under all three text types), no beat and no phrase boundary changed, and one other label changed: an ordinary sentence forced into Verse (`"This goes here," Jack replied, pointing to the model.`) went from "mixed with local trochaic sequences" to "predominantly trochaic". Of 106 prose sentences, 85 are read as prose under "Let it decide", as before.

Still labelled "mixed": `Higgledy, piggledy, my black hen` and `Pussycat, pussycat, where have you been`. Their second halves change rhythm, so "mixed" is defensible. Under "Let it decide", `Tyger! Tyger! burning bright` is still read as prose: exclamation marks end phrases strongly, so the run is not treated as one line.

## Validation

`npm test` passes; `test_meter_labels.js` grows from 34 to 48 checks. Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out). Rhythm-measure candidates under Verse: 40 of 40. Corpus labels: 42 of 50, unchanged.
