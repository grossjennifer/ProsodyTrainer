# Rhythm Reader 3.6.5 — syllable division: -lle and Mc-

Prepared on top of 3.6.4. Engine change, both tools (engines identical). **Display division only**: no stress and no beat changes. Across 360 analyses of 120 unrelated texts, no reading changed.

## The problem

The dictionary supplies sounds, not letters, so the engine decides which letters belong to which syllable. Two rules went wrong for whole classes of words, and the capitals follow the division, so the error showed in the default display (`NASHVIlle`).

1. **Words ending in -lle.** The consonant + le rule (`ta·ble`, `lit·tle`) cut `lle` off as the final syllable: `nashvi·lle`, `vaudevi·lle`, `basti·lle`. In these words the e is silent and the l belongs to the syllable before it.
2. **Mc- names.** `Mc` is a syllable with no vowel letter, so the word had fewer vowel groups than syllables and was split evenly by length: `mcd·ona·ld`, `mcc·art·hy`, `mci·nto·sh`.

## What changed

1. A final -lle whose last syllable ends in a consonant sound has a silent e. The e is no longer counted as a syllable, and the consonant + le rule does not apply. A sounded ending (`reveille`) is left to the general rules. `ie` before such an ending now splits where the dictionary has two vowels: `dan·i·elle`, `gab·ri·elle`.
2. `-ville` is kept whole whatever precedes it: `cross·ville`, `belle·ville`, `col·lege·ville`.
3. `Mc` is set off as its own syllable when the rest of the name then divides cleanly: `mc·do·nald`, `mc·car·thy`, `mc·in·tosh`.

## Measured against the whole dictionary (124,926 words)

| | Words | Changed |
|---|---|---|
| Ending in -lle (not Mc-) | 344 | 106 |
| Beginning with Mc- | 1,009 | 976 |
| All other words | 123,573 | 0 |

- 162 of 164 `-ville` words now end in `·ville`; the other two are Mc- names, now `mc·car·ville` and `mc·con·ville`.
- 1,004 of 1,009 Mc- names now begin `mc·`.

## Known remainders

- `Louisville` is `lo·uis·ville` (the `ou` is split one letter early); `Louis` has the same division.
- Five Mc- names still divide badly: `McBryar`, `McCarthyism`, `McDyess`, `McNicholas`, and the bare `Mc`.
- Fourteen -lle words with a sounded final vowel are unchanged, among them `ratatouille` (`rat·ta·toui·lle`).

## Validation

`npm test` passes; `test_text_handling.js` grows from 21 to 37 checks. Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out). Rhythm-measure candidates under Verse: 40 of 40.
