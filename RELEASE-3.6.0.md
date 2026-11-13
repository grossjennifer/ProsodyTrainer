# Rhythm Reader 3.6.0 — discourse focus (engine only, opt-in)

Prepared on top of 3.5.0. Review candidate. **Off by default**: with `discourseFocus` unset, every analysis is byte-identical to 3.5.0 (eval harness and focus baseline unchanged). Not yet exposed in either tool's interface.

## What it does

With `E.analyze(text, { discourseFocus: true })`, the phrase nucleus (main accent) follows the discourse instead of always falling on the last content word. Rules, in priority order; when none applies, the ordinary nucleus stands:

1. **Answer focus.** An earlier placeholder (`someone`, `somebody`, `something`, `one car`, `one of the students`) or a question (`who`, `which`, `what`, `either of`, `where`) raises a question; the phrase that answers it puts the focus on the answer: `SAM fell out of the canoe`, `I am`, `HE can`, `This goes HERE`.
2. **Function-word focus.** VP ellipsis accents the auxiliary (`He CAN`); a demonstrative before a given noun carries the contrast (`I read THIS book`); a preposition or temporal conjunction contrasts with one of the same scale that governed the same word shortly before (`out of their beds` / `IN bed`, `before I leave` / `AS you leave`), only when nothing else in the phrase is new.
3. **Givenness.** The nucleus goes to the rightmost content word not mentioned earlier in the passage (rough stemming; prepositions and particles excluded; an argument outranks a verb when both are new; light nouns such as `kind`, `thing`, `one` count as given): `Sam FELL out of the canoe`, `the BEST kind`.

Each nucleus records its rule as `source` (`rule:answer-focus`, `rule:givenness`, and so on).

## Results on the owner's focus corpus (`npm run focus -- --focus`)

Developed on the dev split only; held-out scored once, after the rules were frozen. A context-blind engine can get at most half of each pair right.

| | Baseline | 3.6.0, dev | Baseline | 3.6.0, held-out |
|---|---|---|---|---|
| Content-word focus | 8/28 | 25/28 | 5/12 | 11/12 |
| Function-word focus | 2/16 | 11/16 | 2/8 | 4/8 |

Not handled: emphasis on truth (`What ARE you doing, then?`, `do we HAVE a mop?`), surprise (`WHAT are you doing?`), contrasts that need meaning (`ran away` ~ `escaped`; `a basket of cookies` / `A cookie`), and deixis (`pointed ... to the lady` / `SHE read that book`).

## Known limits

- The word-class tagger is heuristic; a small guard treats words followed by an object or ending in -ed as verbs for focus purposes.
- Reporting clauses (`a fellow worker sighed`) can receive odd nuclei; they are not scored.
- Focus moves the nucleus; it does not yet promote a focused function word to a beat. That is the planned next step, together with a focus mark in the display and an interface toggle.

## Validation

`npm test` passes, including the new `test_discourse_focus.js` (12 checks), which uses the owner's original canoe pair (worded differently from the corpus items): `SAM fell out` and `Sam FELL out`. Both per-folder suites pass; both engines identical.

## Hear the beat: stress is louder and longer (owner request, 13 Nov 2026)

- `rhythm-audio.js`: every syllable now sounds at one pitch (660 Hz). A beat is louder (peak 0.9 vs 0.22) and audibly longer: a sustained tone filling about half its slot (90–280 ms), versus a 40 ms tick. Before, beats were mainly distinguished by a higher pitch (880 vs 520 Hz) and both sounds were short clicks (70 vs 35 ms). Pitch is now left free to mark the phrase accent.
- Timing: within each beat interval the stressed syllable takes a longer share than each weak syllable (`stressWeight`, 1.5 : 1), so `TWIN-kle` is now 300 + 200 ms instead of 250 + 250 ms. Beats remain exactly isochronous. `stressWeight: 1` restores equal shares.
- Screen-reader help text in both tools updated to describe the new sound. `test_rhythm_audio.js` now checks one pitch, louder beats, longer beats, and the longer share (60 checks).
