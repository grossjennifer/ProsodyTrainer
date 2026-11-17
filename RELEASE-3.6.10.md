# Rhythm Reader 3.6.10 — syllable division

Prepared on top of 3.6.9. Engine only, in both tools (engines identical). **Display only: no stress, beat, phrase or label changes.** Across 846 analyses of 282 texts under all three text types, the readings are identical to 3.6.9. What changes is where the dots fall between syllables: 333 of the 124,926 dictionary words (0.27%).

## 1. Vowel pairs kept together (316 words)

When a word has fewer vowel-letter groups than syllables, a group has to be split. Groups of three or more vowel letters were always split after the first letter, which broke a pair that spells one vowel: `lo·uis·ville`, `ha·wa·ii`, `sight·se·eing`, `a·gre·ea·ble`, `par·a·no·ia`.

A group of three or more letters that opens with `ou`, `oo`, `ee`, `ai`, `au`, `oi`, `ei` or `eu` is now split after the pair: `Lou·is·ville`, `Lou·i·si·an·a`, `Ha·wai·i`, `sight·see·ing`, `a·gree·a·ble`, `par·a·noi·a`, `se·quoi·a`, `ple·bei·an`, `Bau·er`. The pairs `ea`, `oa`, `ue` and `ui` are left out because they often straddle a prefix or a syllable boundary (`co·au·thor`, `re·au·thor·ize`, `e·vac·u·ees` are unchanged). Most of the 316 are surnames (Meier, Bauer).

## 2. Sounded -lle endings (13 words)

Where the final e is sounded, the C+le rule took `lle` as the last syllable: `a·chi·lle`, `la·va·lle`, `de·mi·lle`. The double l is now split as any double is: `A·chil·le`, `La·val·le`, `De·Mil·le`. An `-ouille` ending is `ou·ille`: `rat·ta·tou·ille`, `gre·nou·ille`. Silent -lle (`Mi·chelle`, `Nash·ville`) and C+le (`lit·tle`, `ta·ble`) are unchanged.

`ratatouille` (one t) is listed in the dictionary with three syllables and stays `rat·a·touille`.

## 3. Names the rules cannot divide (5 words)

Added to the exception table: `Mc·Bry·ar`, `Mc·Dy·ess`, `Mc·Nich·olas` (three syllables in the dictionary), `Mc·Car·thy·i·sm` and `Lou·ise`. Every Mc- word in the dictionary now begins `Mc·`.

## Found, not fixed

Words ending in `-ism` and `-asm` have a syllable with no vowel letter (the "zum" sound), so they are divided `ra·ci·sm`, `pri·sm`, `ac·ti·vi·sm`. No division of those letters looks natural. This is a display matter only; it is listed in the handoff document.

## Validation

`npm test` passes; `test_text_handling.js` grows from 37 to 64 checks. Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out). Rhythm-measure candidates under Verse: 40 of 40. A dictionary-wide division dump before and after was compared word by word.
