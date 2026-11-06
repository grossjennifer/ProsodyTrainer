# Rhythm Reader 3.3.2 — stranded function words keep their beat; inflected forms take their base word's stress

Prepared in the local clone. This is a review candidate, not a deployed release.

## Changes

- Engine: stranded function words. A one-syllable auxiliary, copula, modal, preposition or particle that ends its intonation phrase now defaults to a beat, given up cheaply (`POLY_FN_DEMOTE`, 0.50, the same cost 3.3.1 introduced for two-syllable function words) when a neighbouring beat needs the slot. Such a word cannot take its reduced form (`I wonder what you ARE`, not *what you're), but under Ordinary prose the Twinkle line ended `HOW i WONder what you are`: a phrase-final run of weak syllables was charged only 0.3 per extra syllable (`TRAIL_LAPSE`), less than the 0.8 to promote `are`. In verse the beat grid already forced `ARE`, so only prose showed it.
- New `markStranded()` sets `word.stranded` from phrase position and POS tag (`AUX`, `MODAL`, `PREP`, `INF`, `PART`). It runs in `analyze()` and in `resetWord()`, so resetting an edited word restores the flag. Pronouns are excluded on purpose: `i SAW him` keeps the object pronoun weak.
- Engine: inflection fallback in `lookupCMU()`. A regular -s/-es or -ed form missing from CMU now takes its base word's pronunciation plus the regular ending (a new syllable after a sibilant, or after t/d for -ed; voiceless after a voiceless consonant; voiced otherwise), so stress stays where the base has it. Previously these fell to the spelling heuristic: `exhales` came out `EX·ha·les`, three syllables with the stress on the prefix, instead of `ex·HALES`; `inhales` and `reshapes` failed the same way. Words already in CMU are never re-derived, and bases shorter than three letters are never used. Such words are tagged `lexicalRule: 'inflection-of-base'`. Same mechanism as the existing possessive fallback (`puppy's`). -ing forms are not covered.
- New `test_prose_pending.js`, run inside `npm test`: tracks three clearly wrong prose beats on function words (`LISten TO what`, `IT'S like`, `is TO live`). It reports them without failing the suite, flags any that start passing so they can move into the protected tests, and fails under `--strict`.
- Bump both identical engines from 3.3.1 to 3.3.2.

## Behaviour change to expect

- Gain a beat in prose: `WONder what you ARE`, `i know WHERE he IS`, `LOOKing AT`, `WHERE are you FROM`.
- Unchanged, because an adjacent beat takes the slot: `who did you GO with`, `i WANT to`. Unchanged pronouns: `i SAW him`, `he GAVE it to her`. Unchanged everywhere a function word is phrase-internal.
- `The kettle clicks off and the kitchen exhales.` now has eleven syllables and ends `exHALES`.
- Eval harness: the full report is byte-for-byte identical to 3.3.1 (held-out 16/16, all 41/46, 0 clashes). Nothing in the existing corpus exercises a stranded word in prose or an inflected word missing from CMU, so the new behaviour rests on the new tests below.

## Known issue (not fixed here)

- `She is taller than I am.` (prose) now reads `she is TALler THAN i AM`. Making `am` a beat turns `-ler than I` into an interior run of three weak syllables; prose charges that 0.8 (`LAPSE`), more than the 0.7 to promote `than`. The same weighting, already present in 3.3.1, gives `i know WHERE he` (the verb `know` unstressed) and `the CAT sat ON the MAT`. The three cases in `test_prose_pending.js` are the same weighting. These are prose lapse-versus-promotion weights. They should be retuned against a hand-marked set of prose sentences rather than by feel, so no test encodes the current output for them.

## Validation

Passed: `npm test` (engine, pages, diagnostics, rhythm candidates, all acceptance criteria), plus both per-folder feet and nuclear-stress suites. `test_diagnostic_battery.js` adds ten stranded-word cases (section G). The four prose "takes a beat" cases (are, is, at, from) fail on 3.3.1; the yield, pronoun and phrase-internal cases pass on both. Section H covers the inflection fallback (exhales, inhales, reshapes, fringed, unicorns, the kettle line, and dictionary words left untouched) and fails on the engine without it.

## Suggested review checks before publishing

1. Rhythm Reader, Ordinary prose: `Twinkle, twinkle, little star, how I wonder what you are.` should end `WONder what you ARE`.
2. Rhythm Reader, Ordinary prose: `I saw him.` should still read `i SAW him`.
3. Type `The kettle clicks off and the kitchen exhales.` and confirm the last word reads `exHALES`.
4. Download a Pro export and verify build 3.3.2.
5. Publish both engine files together.
