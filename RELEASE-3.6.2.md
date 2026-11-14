# Rhythm Reader 3.6.2 — meter labels: the line's opening settles a tie

Prepared on top of 3.6.1. Label layer only, both tools (engines identical). **No beat changes**: across 360 analyses of 120 texts (auto, Verse, Prose) not one beat moved.

## The problem

A regular line that ends on a beat was labelled `alternating (trochaic/iambic scansions near-equivalent)`. `TYger TYger BURNing BRIGHT` fits trochees from its first syllable with one syllable short at the end, and fits iambs only by setting its first syllable aside; the probe cost those two the same. The same tie turned dactylic lines into `alternating (anapestic/dactylic/amphibrachic …)`.

## What changed

1. **Tie-break by opening.** A pure scansion is dropped when another costs no more and sets fewer syllables aside before its first foot. A line that starts on its beat is trochaic or dactylic; a line that starts weak and ends with an extra weak syllable is iambic.
2. **Iambic opening counts as a foot.** An anapestic line that opens weak-STRONG (`the STOCKings were HUNG by the CHIMney with CARE`) has opened with an iamb, the standard substitution. Such lines remain a real tie with the amphibrachic reading of the same beats and are reported as `alternating (anapestic/amphibrachic …)`: two candidates, where there were three.
3. **A clean pure scansion names the line.** When one pure scansion fits a metrical phrase cleanly (cost per syllable ≤ 0.15), its feet are the feet shown and it names the label. The free foot parse described `ALL the king's HORses and ALL the king's MEN` as trochee + iamb + anapest + anapest.

## Measured (stored readings off)

| Set | Correct label before | After | Hedged before | After |
|---|---|---|---|---|
| Evaluation corpus lines (50) | 31 | 42 | 15 | 4 |
| Rhythm-measure candidates, Verse (40) | 39 | 40 | 1 | 0 |
| Stored verse texts (21) | 9 | 14 | 6 | 0 |

The four corpus lines still hedged are all weak-STRONG openings in triple time (item 2). Six of the seven stored texts still mislabelled carry a full stop and are read as prose by the 3.6.1 sentence rule when the stored reading is switched off; on the site the stored reading applies.

## Not addressed

- A line whose meter runs across a comma (`Down to the shores of the water, the path by the swamp in the dimness`) is labelled phrase by phrase and comes out `mixed with local amphibrachic sequences`.
- Lines too short to establish any meter (`Hickory, dickory, dock`, `Half a league onward`) are still labelled prose.
- The label follows the beats. Where the beats differ from the gold (`we can MAKE our LIVES suBLIME`), so does the label.

## Validation

`npm test` passes, including the new `test_meter_labels.js` (34 checks). Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out, regime 12/12).
