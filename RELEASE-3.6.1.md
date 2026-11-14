# Rhythm Reader 3.6.1 — a lone sentence is not a line of verse; Verse gets the metre prior

Prepared on top of 3.6.0. Engine change, both tools (engines identical). No interface change.

## The problem

With "Let it decide", an ordinary sentence was read as verse whenever it was long enough (six syllables) to fit a grid, and almost any sentence fits some grid once function words are promoted. The grid cost measures how regular the beats are, not what it cost to put them there. Result: `SAM fell OUT of THE caNOE.`, `she RAN aWAY beFORE the CHILdren COULD find HER.`

Separately, choosing Verse or Song returned before the metre prior was derived, so a chosen Verse reading scanned single lines worse than the automatic one: 24 of 40 rhythm-measure candidates under Verse against 40 of 40 under auto.

## What changed

1. **Verse / Song fix the regime, not the metre.** The same evidence auto gathers is gathered either way, and its metre prior is used. Verse and Song now score 40 of 40 on the rhythm-measure candidates.
2. **The rhythm-measure diagnostic sets its text type explicitly** (`verse` by default; `--text-type auto` shows what auto makes of the items). The candidates are verse lines laid out as sentences, and no property of the text separates `She can carry baskets after breakfast.` from `We went to the store to buy some milk and bread.` The instrument therefore states the text type instead of relying on detection.
3. **Let it decide: sentence layout.** Text with no line break between words that ends in `.`, `?` or `!` is laid out as sentences. For such text, one phrase fitting a grid counts as evidence of metre only when corroborated: its own stresses already alternate (faithfulness cost per syllable ≤ 0.05), or at least two phrases agree on the template (agreement ≥ 0.75). Unpunctuated lines, text with line breaks, the comma-spanning and repetition routes, and any text with a registered known reading are unaffected. `doc.regime` reports `sentenceLayout`, `strain` and `corroborated` when the rule was consulted.
4. **An aggregate metre prior stays inside its span.** A grid established across one run of comma-linked phrases is no longer imposed on a phrase outside that run (`The mouse ran up the clock. Not a creature was stirring, not even a mouse.` kept the anapest off the first sentence).

## Measured

- 48 ordinary sentences, auto: read as prose 18 → 37.
- 72 verse lines as stored (mostly unpunctuated), auto: 66 metrical before and after; no beat changed.
- Verse mode on those 72 lines: two readings changed (`HALF a league, HALF a league,` now matches the gold; `Row, row, row your boat` now matches what auto already gave).
- Prose mode: no reading changed.
- `eval/harness.js`: unchanged (45/47 exact, 17/17 held-out, regime 12/12).

## Known cost (owner accepted, 14 Nov 2026)

A single verse line typed with a full stop and not on the known-readings list is now read as prose under Let it decide. Of 66 verse lines, 36 fall back to prose when a full stop is added, and 18 of those lose a promoted beat (`MARy had a LITtle LAMB.`, `do NOT go GENtle INto that GOOD NIGHT.`). Choosing Verse restores them.

Still read as verse under auto: sentences typed without closing punctuation (`Sam fell out of the canoe`), and punctuated sentences whose stresses already alternate (`The little puppy ran away before the children noticed.`), where the beats are the same either way.

## Validation

`npm test` passes, including the new `test_sentence_layout.js` (52 checks). Both per-folder suites pass in both tools. `test_prose_pending.js`: the Yertle `that marvelous HE` case began passing and moved to `test_sentence_layout.js`; five cases remain pending.
