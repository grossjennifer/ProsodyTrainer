# Rhythm Reader 3.3.1 — two-syllable function words keep their beat; Hear the beat

Prepared in the local clone. This is a review candidate, not a deployed release.

## Changes

- Engine: the stressed syllable of a polysyllabic function word (before, about, after, along, until, although…, the `EXTRA_FUNCTION_WORDS` list) now defaults to a beat with a low demotion cost (`POLY_FN_DEMOTE = 0.50`) instead of defaulting to weak. Previously these words were weak by default, which fixed `about SCHOOL` but overcorrected in prose: `The little puppy ran away before the children noticed` read `aWAY before the CHILdren` under Ordinary prose, a three-syllable lapse over a full-vowel, primary-stressed `fore` that nothing competed with. The word still yields wherever an adjacent beat or the meter needs the slot.
- Rhythm Reader and Pro: new "Hear the beat" tap track (shared `rhythm-audio.js`). A click on every beat, a softer tick on every weak syllable, each syllable highlighted as it sounds, tempo 60–180 bpm. Plays the displayed rhythmic beats, including the reader's edits; anything that changes the beats stops playback. Pro logs each play as `play-beat@<tempo>bpm` in the research session log, with no change to the export columns.
- Bump both identical engines from 3.3.0 to 3.3.1.

## Behaviour change to expect

- Gains a beat when nothing competes: `aWAY beFORE the CHILdren` (prose), `she LEFT beFORE the PARty`, `WALKED aLONG the RIVer`, `WEATHer AFTer DINner`. A two-syllable function word typed alone now shows its beat (`beFORE`).
- Unchanged, because a neighbouring beat or the meter takes the slot: `conVERSED about SCHOOL`, `arRIVED before LUNCH`, `twas the NIGHT before CHRISTmas`, `RIVer until DARK`, and verse `FUN although ANswers`.
- Eval harness: beats identical before and after (held-out 16/16, all 41/46, 0 clashes). The single difference in the full report is the meter label of `I told him that the parcel had arrived before lunch.`, which was already misclassified as verse in 3.3.0 and still is; its label moves from `predominantly iambic` to `alternating (trochaic/iambic scansions near-equivalent)`.

## Validation

Passed: `npm test` (engine, pages including the new `test_rhythm_audio.js`, diagnostics, rhythm candidates, all acceptance criteria), plus both per-folder feet and nuclear-stress suites. `test_diagnostic_battery.js` changes the isolated-`before` expectation from `WW` to `WS` and adds nine cases covering both directions. The three prose "keeps the beat" cases (puppy/before, left/before, walked/along) fail against the 3.3.0 engine; the five "still yields" cases pass on both engines and guard against overcorrecting (verified: all five fail if the demotion cost is raised so the word never yields). The ninth, the puppy sentence under Let it decide, already passed in 3.3.0 and keeps it that way.

## Suggested review checks before publishing

1. Rhythm Reader, Ordinary prose: `The little puppy ran away before the children noticed.` should read `aWAY beFORE the CHILdren`.
2. Pro: `The girls conversed about school.` should still read `conVERSED about SCHOOL`.
3. Press Hear the beat on both tools and listen; check that the click and tick sounds and the default tempo of 120 suit you.
4. Download a Pro export and verify build 3.3.1.
5. Publish both engine files, both tool pages, and `rhythm-audio.js` together.
