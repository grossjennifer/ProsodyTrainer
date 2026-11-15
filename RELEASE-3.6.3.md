# Rhythm Reader 3.6.3 — homographs after a modifier

Prepared on top of 3.6.2. Engine change, both tools (engines identical). Confined to the listed stress-shifting noun/verb pairs, and reached only when no determiner, cue word or pronoun has already decided the word.

## The problem

Determiner contexts worked (`a RECord`, `his PERmit`), but a homograph after an adjective or a noun modifier fell back on the dictionary's default: `FRESH proDUCE is expensive` (the debriefing's own exemplar for noun stress) and `vaNILla exTRACT`.

## What changed

Two facts about English decide the word, read from the surface form because the tagger is unreliable about the neighbouring word:

1. **An adjective is followed by a noun**, never by a finite verb: `fresh PROduce`, `public TRANSport`, `steady PROgress`.
2. **A bare verb agrees with a plural subject.** After a singular noun the bare form heads a compound (`vanilla EXtract`, `lemon EXtract`); after a plural or coordinated subject it is the verb (`workers proDUCE widgets`, `Sam and Lee conDUCT the choir`). For -s forms, a clause has one finite verb: if another follows, the word is the noun (`wheat EXports doubled`); if none does, it is the verb (`Maria perMITS no excuses`).

Forms in -ed and -ing keep the dictionary's choice.

## Measured (sentences not used to build the rule)

| Set | 3.6.2 | 3.6.3 |
|---|---|---|
| Held-out set A (40) | 26 | 39 |
| Held-out set B (24) | 18 | 23 |
| Held-out set C (32, written after the rule was frozen) | 23 | 30 |
| Existing contextual suite (34 checks) | pass | pass |
| Existing novel-context suite (25) | 25 | 25 |

Across 360 analyses of 120 unrelated texts, only the two reported sentences changed.

## Known misses

- `Our neighbors import furniture.` — a possessive determiner before a plural subject, with a bare noun object, is still read as a noun phrase.
- `The company exports grain.` and `Anna exports wine to Canada.` — a singular subject with an -s verb.
- `Heat and pressure compress the gas.` — `compress` is not on the stress-shifting list, so the rule is never consulted.

The first three are recorded as pending cases in `test_modifier_heteronyms.js`.

## Validation

`npm test` passes, including the new `test_modifier_heteronyms.js` (28 checks, 3 pending). Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out). Rhythm-measure candidates under Verse: 40 of 40.
