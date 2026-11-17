# Rhythm engine handoff

Written 16 November 2026, at engine build **3.6.11**, for whoever works on the
engine next: a person, or an AI model with no memory of the work so far. Read
this before changing `engine.js`. It records how the engine decides, what
protects each decision, what is known to be wrong, and how to change things
without breaking the research instrument.

The owner is Prof. Jennifer Gross (Grand Valley State University). The site is
prosodytrainer.com, served by GitHub Pages from the `main` branch of
`grossjennifer/ProsodyTrainer`.

---

## 1. Ground rules

1. **Two engine files, always identical.** `rhythm-reader/engine.js` and
   `rhythm-reader-pro/engine.js` must be byte-identical. Edit one, then
   `cp rhythm-reader/engine.js rhythm-reader-pro/engine.js`, and confirm with
   `cmp rhythm-reader/engine.js rhythm-reader-pro/engine.js`. Several suites
   run against the Pro copy, so a forgotten copy shows up as a confusing
   failure there.
2. **Run everything after every change.** `npm test` (about two minutes). It
   must end with exit status 0. Then run the four per-folder suites listed in
   section 6.
3. **Measure before and after.** For any engine change, compare readings on a
   wide set of texts before and after, and report what moved. "No test failed"
   is not the same as "nothing changed". The release notes show the form:
   "across 360 analyses of 120 texts, only these readings changed".
4. **Never tune on held-out items.** `eval/corpus.js` splits items into `dev`
   and `held` by source work. The split was fixed before any tuning. Fit on
   dev, score held-out once at the end.
5. **Do not tune prose by feel.** The prose readings are frozen at 3.6.6 until
   the two human markings of the 40 prose sentences arrive (section 7). The
   owner asked for this explicitly. (Since 3.6.5 the only beat changes are in 3.6.8, which
   touches text containing quotation marks and nothing else; 3.6.9
   changed labels and one regime decision for short comma lines.)
6. **The owner rules on disputed readings.** Do not change a stored gold
   reading. Ask. Open rulings are in section 9.
7. **Bump the build** (`ENGINE_BUILD` in `engine.js`) when a reading or an
   export format changes, write a `RELEASE-x.y.z.md`, and update the build
   string asserted in `test_diagnostic_battery.js`.
8. **Minimal edits.** The owner prefers surgical changes that preserve
   behaviour elsewhere, frank assessment over agreement, and no contractions
   in anything written for her. She is "Prof. Gross", not "Dr."

---

## 2. What the engine does

`E.analyze(text, options)` returns a document: words, each with syllables,
each syllable with a `lexicalStress` (`'1'`, `'2'`, `'0'`) and a
`rhythmicStress` (`'S'` beat, `'W'` no beat). The header of `engine.js` gives
the pipeline. In brief:

| Stage | Section in `engine.js` | What it decides |
|---|---|---|
| Tokenizer | 1 | Words, spaces, punctuation. Lossless. |
| Dictionary lookup | 2 | Sounds and stress from the CMU dictionary (`cmudict.js`, 124,926 words). |
| Syllabifier and orthographic aligner | 3, 4 | Which letters belong to which syllable. Display only. |
| Fallback analyzer | 5 | Words not in the dictionary. |
| Template assigner | 6 | Tier 2: the word's metrical template. |
| Word-class tagger | 7b | A light, heuristic tagger. It is unreliable; rules that need a word class read surface cues where they can. |
| Chunker | 8 | Phrases: intonational phrases (IP) at punctuation, smaller phrases (φ) inside them. |
| Rhythmic projector | 9, 9b | Tier 3: the beats. Candidate readings, each with a cost; the cheapest wins. |
| Meter detector | 10 | The label ("trochaic", "prose rhythm"). Follows the beats; never changes them. |
| Edit API, exports | 13, 14 | Hand edits, CSV and text exports, stimulus generators for the research paradigms. |

Three tiers are shown to the reader: Tier 1 word stress, Tier 2 template,
Tier 3 rhythm. Rhythm Reader shows Tier 3 in plain words. Rhythm Reader Pro
shows all three, with foot names, and logs a research session.

**Cost model.** A reading's cost is a fixed part plus the sum of weights times
features (`E.explainReading` decomposes it exactly; `test_reading_features.js`
checks that). The weight table `W` (near line 1900):

```
CLASH 2.2   LAPSE 0.8   TRAIL_LAPSE 0.3   GRID_MISS 0.75   GRID_TAIL_MISS 1.0
GRID_EXTRA 0.7   TERNARY 0.4   SHIFT 1.9   NO_BEAT 3.0   NUCLEUS 0.25
NUCLEUS_PROSE 1.0   PROSE 1.8   METRE_PRIOR 0.9   GRID_COHERENCE 1.5
AGGREGATE_COHERENCE 0.4   GIVEN 0.45
```

Two further tables set what it costs to take a beat off a content word
(`MONO_DEMOTE`, by word class) and to put one on a function word
(`FN_PROMOTE`, by word class). These are engineering weights fitted on the dev
split. They are not measured psycholinguistic quantities.

Initialising the engine in Node:

```js
global.window = {};
require('./cmudict.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);   // [] = stored readings off; the site loads known-rhythms.js
```

---

## 3. The decisions, and why they are as they are

### 3.1 Prose or verse (`classifyRegime`, near line 2369)

The most consequential decision. Under "Let it decide" (`textType: 'auto'`)
the engine must decide whether to fit the text to a metrical grid (verse) or
leave it as prose. The text type is a prior, not a switch
(`TEXT_TYPES = { auto 1.00, prose 0.45, verse 2.10 }` scales `W.PROSE`).

Evidence routes: a single long phrase that fits a grid (`byLength`), several
phrases agreeing on a template (`byAgreement`), a grid running across
comma-linked phrases (`byAggregate`), and repeated ternary phrases
(`byRepeatedTernary`).

**The 3.6.1 sentence rule.** Almost any sentence fits some grid once function
words are promoted, so ordinary sentences were being read as verse
(`SAM fell OUT of THE caNOE.`). Now: text with no line break between words
that ends in `.`, `?` or `!` is "sentence layout". For such text, one phrase
fitting a grid counts as evidence only when corroborated: its own stresses
already alternate (strain ≤ `REGIME_SENTENCE_MAX_STRAIN` 0.05), or at least
two phrases agree. `doc.regime` reports `sentenceLayout`, `strain`,
`corroborated`.

**A finding to keep in mind.** No property of the text separates verse laid
out as a sentence (`She can carry baskets after breakfast.`) from prose
(`We went to the store to buy some milk and bread.`). The difference is
whether the reader promotes function words, which is a fact about the
reading, not the text. This is why:

- the rhythm-measure diagnostic sets `textType: 'verse'` explicitly and does
  not rely on detection (a research instrument should not depend on
  auto-detection for its own stimuli);
- choosing Verse fixes the regime but still gathers the same evidence, so the
  metre prior is available (before 3.6.1, Verse scored 24 of 40 where auto
  scored 40 of 40);
- a known cost was accepted by the owner on 14 November 2026: a single verse
  line typed with a full stop, not on the stored list, reads as prose under
  auto. Choosing Verse restores it.

Protected by `test_sentence_layout.js`, `eval/rhythm_measure_diagnostic.js
--assert`, and the regime block of `eval/harness.js` (12 of 12).

### 3.2 Meter labels (`gridProbe`, `detectMeter`, near lines 3409 and 3509)

The label never changes a beat. 3.6.2 fixed hedged labels
("alternating (trochaic/iambic …)"): when two pure scansions cost the same
within `PROBE_TIE` 0.05, the one that sets fewer syllables aside before its
first foot wins, so a line that starts on its beat is trochaic or dactylic. An
anapestic line that opens weak-STRONG counts as opening with an iamb. When one
pure scansion fits cleanly (cost per syllable ≤ `PURE_FIT` 0.15) it names the
line and supplies the feet shown.

Rhythm Reader does not show foot names. It uses taught vocabulary
("Read as having a regular beat: STRONG-weak.") from `TAUGHT_RHYTHM` and
`plainRhythmLine` in `rhythm-reader/index.html`. Pro keeps foot names.

Protected by `test_meter_labels.js`, `test_reader_wording.js`.

### 3.3 Homographs (near lines 1238 to 1470)

Stress-shifting noun and verb pairs (`REcord` / `reCORD`) on the
`SHIFTING_HETERONYMS` list. Priority: owner-validated lexical cues, then
determiners, verb cues and pronouns, then (3.6.3) two surface facts used only
when nothing above decided: an adjective is followed by a noun
(`fresh PROduce`); a bare verb agrees with a plural subject
(`workers proDUCE`, but `vanilla EXtract`). Forms in -ed and -ing keep the
dictionary's choice.

Protected by `test_contextual_heteronyms.js`, `eval/novel_heteronyms.js`,
`test_modifier_heteronyms.js` (three cases recorded as pending).

### 3.4 Syllable division (`orthoSyllabify`, near line 440)

The dictionary gives sounds, not letters, so the engine decides which letters
form each syllable. This affects display only (the capitals follow the
division), never stress. 3.6.4 and 3.6.5 added: accented letters, hyphenated
words divided part by part, silent-e `-lle` (`mi·chelle`), `-ville` kept
whole, and `Mc` as its own syllable.

When changing a division rule, dump the division of the whole dictionary
before and after and report how many words changed in each class. Protected
by `test_text_handling.js`.

### 3.5 Stored readings (`known-rhythms.js`)

Twenty-one texts carry an owner-approved reading that overrides the engine
when the text matches. Tests and evaluation that measure what the engine
works out for itself switch these off (`E.loadKnownReadings([])`). A text
with a stored reading is never treated as sentence layout.

### 3.6 Discourse focus (3.6.0)

`E.analyze(text, { discourseFocus: true })` moves the phrase accent to follow
the discourse (answer focus, function-word focus, givenness). Off by default
and not exposed in either interface. It moves the nucleus; it does not yet
give a focused function word a beat. Protected by `test_discourse_focus.js`;
scored by `npm run focus`.

### 3.7 Text type "song"

Accepted for saved settings and old scripts, recorded and analysed as
`verse`. The interface offers one choice, "Verse, song or rhyme".

---

## 4. "Hear the beat" (`rhythm-audio.js`)

Shared by both tools. `schedule(doc, opts)` builds a timetable: beats exactly
evenly spaced, a stressed syllable taking a longer share of its interval
(`stressWeight` 1.5 to 1). `player(hooks)` plays it.

Since 16 November 2026 the player speaks recordings of Prof. Gross's voice:
"DUM" on a beat and "da" on a weak syllable. Since 17 November there are three
tokens of each, taken in turn (so no two beats in a row are the identical
recording), and each token comes in shorter versions (DUM about 330, 237 and
150 ms; da about 155 and 98 ms). The player plays the longest version that
fits the syllable's slot; the shortest fit even a three-beat pattern at 180
per minute (143 ms for a beat, 95 ms for a weak syllable), so nothing is cut
off. The tempo slider runs from 60 to 140 (default 120) since 17 November:
Prof. Gross found that at 180 a three-beat line is too fast to hear the beat. The shorter versions were
made from the same recordings by removing whole pitch periods from the middle
of the syllable: pitch and voice are unchanged, and the onset and release are
untouched. All clips are embedded in the file as base64 WAV (WAV, not MP3,
because MP3 decodes with a variable lead-in and here the onset is the beat)
and decoded once at page load with an `OfflineAudioContext`. If decoding is
unavailable the player falls back to a tone and a tick. The clips were cut
from the uploads `DUMda.wav` (tokens at 1.38, 2.68 and 3.92 s) and
`daDUM_take_two.wav` (3.13, 4.23 and 5.26 s).

Protected by `test_rhythm_audio.js` (timing, fallback tones) and
`test_beat_voice.js` (recordings, routing, fade, decode path).

---

## 5. Rhythm Reader Pro as a research instrument

`rhythm-reader-pro/index.html`. Since 3.6.6:

- Hand edits are never discarded silently. Changing the text type or pressing
  Analyze again asks first.
- The session log records setting changes (`setting-change`), beats that move
  as a consequence of an edit (`beat-reflow`), and discarded edits. Every row
  carries `text_type`, `strict_alternation`, `clash_subordination`.
- Every export states the settings it was produced under.
- Since 3.6.7 every CSV cell goes through `E.csvEscape`, which writes text
  beginning with `=`, `+`, `-` or `@` with a leading apostrophe so a
  spreadsheet cannot run it as a formula. Numbers are left alone. Analysis
  scripts should strip one leading apostrophe from the participant and study
  columns. The JSON export keeps values as typed.
- New columns are appended. Existing columns keep their names and order; do
  not reorder them, because analysis scripts read them by position.

The cue-fading levels are a general fading aid. The single-marker condition
in Gross, Roldan, Kiessel, Esselink, & Dunlap (2026) was an experimental
manipulation to test transfer; the tool must not restrict readers to one
pulse, and its wording says so.

Protected by `test_pro_session.js` (drives the real page), `test_pro_polish.js`,
`test_export_provenance.js`, `test_diagnostic_battery.js`.

---

## 6. Tests and evaluation: what each protects

`npm test` runs five groups. All must pass.

| Group | Files | Protects |
|---|---|---|
| `test:engine` | `test_quotes_stimuli`, `test_known_readings`, `test_contextual_heteronyms`, `test_phrase_prominence`, `test_ternary_boundaries`, `test_engine_edits`, `eval/novel_heteronyms`, `test_learned_words`, `test_reading_features`, `test_discourse_focus`, `test_sentence_layout`, `test_meter_labels`, `test_modifier_heteronyms`, `test_text_handling` | Engine readings and labels |
| `test:pages` | `test_asset_paths`, `test_exhibit`, `test_learn`, `test_interface`, `test_pro_polish`, `test_rhythm_audio`, `sound-spelling/test_onset_rime`, `test_remembered_words_page`, `test_reader_wording`, `test_contact_page`, `test_pro_session`, `test_audio_clips`, `test_unpunct_hint`, `test_beat_voice` | The pages, audio, wording |
| `test:diagnostics` | `test_diagnostic_battery`, `test_export_provenance`, `test_prose_pending`, `test_prose_score` | The 16-case battery, exports, known pending errors, the prose scoring pipeline |
| `test:rhythm-candidates` | `eval/rhythm_measure_diagnostic.js --assert` | The 40 rhythm-measure candidates under Verse (40 of 40) |
| `test:acceptance` | `eval/acceptance.js` | Release gates |

Per-folder suites, run separately (four commands):

```
node rhythm-reader/test_nuclear_stressrhythm.js
node rhythm-reader/test_rhythm_feetrhythm.js
node rhythm-reader-pro/test_nuclear_stresspro.js
node rhythm-reader-pro/test_rhythm_feetpro.js
```

Evaluation (not pass/fail, but report the numbers in every release note):

| Command | Current result |
|---|---|
| `node eval/harness.js` | 45 of 47 exact, 17 of 17 held-out, 99.1% of syllables, regime 12 of 12 |
| `node eval/rhythm_measure_diagnostic.js` | 40 of 40 under Verse |
| `npm run focus` | discourse-focus corpus |
| `npm run fit` | fits `W` on dev; writes a file, never edits the engine |
| `npm run prose:score` | the 40 prose sentences (section 7) |

The two harness misses are both on dev: `psalm-6` (`WE can MAKE our LIVES
suBLIME`; the engine leaves `we` weak) and `byron-1` (`the asSYRian came DOWN
like the WOLF`; the engine reads `CAME down LIKE`).

**Things that have caught me out**

- Page scripts are not global. A test that needs a page function must drive
  the page (jsdom or a real browser) or lift the function's source.
- jsdom has no `confirm`; tests that reach a confirmation set
  `window.confirm = () => true`.
- A test that asserts the build string, a CSV header, or "this page carries no
  script" will fail on a legitimate change. Update it deliberately and say so.
- `test_prose_pending.js` passes while its cases are still wrong. If a case
  starts passing it says so: move that case into a protected suite.
- The browser checks need a local server (`python3 -m http.server`) because
  the pages load scripts by relative path.

---

## 7. The prose retuning (waiting on human markings)

**State.** Forty ordinary sentences, weighted toward patterns the engine gets
wrong, are in `eval/prose_gold_candidates.js` (`P01` to `P40`, each with the
pattern it probes and the engine's 3.6.3 reading; `gold: null`). Two people
are marking them independently in the sheet "Prose Stress Marking: 40
Sentences" (capitals on each stressed syllable). ChatGPT's markings were
tried and rejected as gold: they mark phrase accents, not beats.

**The suspected cause** of most prose errors, from `test_prose_pending.js`:
prose charges an interior run of three weak syllables (`LAPSE` 0.80 per
syllable beyond two) more than promoting a function word (`FN_PROMOTE`
0.40 to 1.15), so the engine puts a beat on `to`, `with` or `it's` where a
reader leaves a short lapse. `W` is shared with verse, so lowering `LAPSE`
outright would damage verse. The likely remedy is a prose-specific term, as
`NUCLEUS_PROSE` already is for the nucleus. This is a hypothesis; the
markings will confirm or refute it.

**When the markings arrive**

```
node eval/prose_score.js --a <marker A file> --b <marker B file>
```

Files may be `.xlsx`, `.csv`, `.tsv`, or pasted text (`P01 he forGOT …`). The
script reports agreement (percent and Cohen's kappa), lists disagreements,
writes `eval/prose_rulings.csv`, writes `eval/prose_gold.json`, and scores
the engine. Then:

1. Give Prof. Gross `eval/prose_rulings.csv`. She types the reading she
   accepts in the Ruling column of each row. The engine's reading is
   deliberately not on that sheet.
2. Rebuild with `--rulings eval/prose_rulings.csv`. Agreed and ruled
   sentences become gold; unruled disagreements stay out.
3. Take a snapshot before touching the engine:
   `node eval/prose_score.js --score-only --json eval/prose_before.json`
4. Change the engine. After each change:
   `node eval/prose_score.js --score-only --baseline eval/prose_before.json`
   It exits 1 if a sentence that matched the gold no longer does.
5. Also run `npm test`, `node eval/harness.js` and the rhythm-measure
   diagnostic. Verse must not move. Report what did.

Read the kappa before tuning. If the two markers agree only moderately, the
sentences they disagree on are telling you prose stress is not determinate
there, and the engine should not be tuned to either marker on those items.
The script prints the engine's agreement with each marker beside the markers'
agreement with each other; the engine cannot be expected to exceed that.

Three limits of marking by capitals, handled in the script and stated in its
report: the pronoun "I" cannot be marked and is left out of every count; a
single capital that is only spelling (`He`, `Sam`) is not a beat; a word
typed all in capitals takes its dictionary stress and is flagged.

Forty sentences is a small set. Do not fit weights to it with `eval/fit.js`
and call the result general. Split it, or treat it as a check on a change
motivated by the mechanism above.

---

## 8. Known wrong, not yet fixed

**Regime and labels**
- A sentence typed without closing punctuation is still read as verse
  (`Sam fell out of the canoe`). **Deliberately left in the engine.**
  Measured 17 November 2026 on 107 unpunctuated verse lines and 71
  unpunctuated prose sentences under auto: today's rule gets 104 verse and 20
  prose right; treating an unpunctuated line as a sentence gets 47 and 56;
  gating that by length (11+ syllables, 13+, 9+ words) trades about one verse
  line per prose sentence gained. Both tools instead show a hint when a single
  line with no closing punctuation is read as verse under auto and is not a
  stored reading: "Read as verse. If this is an ordinary sentence, end it with
  a full stop or choose Ordinary prose." (`unpunctuatedVerse` in each page;
  `test_unpunct_hint.js`). Do not change this without a cue that separates
  the two, measured the same way.
- A punctuated single verse line not on the stored list reads as prose under
  auto (accepted cost, section 3.1).
- Since 3.6.9 a whole line of three or more comma-separated phrases may
  establish a beat with seven syllables (eight otherwise), and a single beat
  closing a line does not count against its metre (`markLineEdges`,
  `ip.lineStart`, `ip.lineEnd`). `Higgledy, piggledy, my black hen` is still
  "mixed"; `Tyger! Tyger! burning bright` is still prose under auto because
  exclamation marks are strong boundaries.
- A line whose meter runs across a comma is labelled phrase by phrase.
- Hiawatha under auto is read as prose (`test_prose_pending.js`).
- A line break is not used as evidence of verse (the Yertle couplet).

**Prose beats** (frozen; section 7)
- `LISten TO what is happening`, `IT'S like a stuck record`,
  `is TO live deeply`.

**Homographs**
- `Our neighbors import furniture.`, `The company exports grain.`,
  `Anna exports wine to Canada.`; `compress` is not on the list.

**Syllable division** (display only)
- Words ending in `-ism` / `-asm` have a syllable with no vowel letter and
  are divided `ra·ci·sm`, `pri·sm`. Fixed in 3.6.10: vowel pairs inside
  longer vowel groups (`Lou·is·ville`), sounded `-lle` (`La·val·le`), and the
  Mc- names, via `VOWEL_DIGRAPHS` and `HYPHEN_EXCEPTIONS`.

**Text handling**
- Numerals are not expanded. A note tells the reader to spell them out.

**Rhythm Reader Pro**
- Where a phrase has more beats than syllables without one, a stimulus pair
  cannot have equal mark counts. Since 3.6.8 the export says so.
- Quoted speech with no comma before it (`She said "I will go."`) is not
  split at the quotation mark.

**Accessibility** (both tools reviewed 17 November 2026 with axe-core in
Chrome, plus keyboard, screen-reader, contrast, motion and 320 px checks)
- Fixed: Pro's text-type menu had no name in the simple view; syllable
  buttons' names did not begin with the letters shown (2.5.3); Pro's amber
  confidence colour fell short on striped rows; an empty table heading;
  Rhythm Reader had one heading. Protected by `test_a11y_labels.js`.
- Open: Pro's one-letter syllables are smaller than 24 px (axe flags 2.5.8).
  They sit inside running text, which the criterion's inline exception
  covers; widening them breaks words apart visibly. Prof. Gross decided on
  17 November to leave them as they are.
- Since 17 November the passage is one Tab stop in both tools (roving
  tabindex, `rovingFocus` in each page): the arrow keys move between
  syllables, Home and End jump to the ends, Tab leaves for Play.
- The Learn pages have not had this review.

---

## 9. Decisions by Prof. Gross

All answered 17 November 2026.

1. Raven: `SUDdenLY there CAME a TAPping` (stored reading changed in 3.6.11;
   matches measure item M08).
2. Longfellow: `subLIME and dePARTing`, with "and" weak (stored reading
   changed in 3.6.11). The ruling was given for the passage, where "and"
   follows a beat. The corpus line `And departing leave behind us` stands
   alone and keeps its gold `AND dePARTing` until she says otherwise.
3. A triple-time line that opens weak-STRONG is labelled anapestic (3.6.11).
4. `fresh PROduce` is correct (one beat, on the noun; no spondee). The engine
   already reads it so. P32 of the 40 prose items.
5. No office address or telephone number on the contact page.

---

## 10. Working on the site

- **Repository on her Mac:** `~/Documents/GitHub/ProsodyTrainer`, branch
  `main`. There was a second copy on branch
  `fix/rhythm-diagnostic-regressions`; that branch is fully contained in
  `main` (0 commits ahead) and can be deleted.
- **Publishing:** commit and push in GitHub Desktop. GitHub Pages rebuilds in
  a minute or two. Ask before every push.
- **Verify on the live site**, not only in the test copy: fetch the page with
  the cache off and check for the change.
- **Releases:** `RELEASE-x.y.z.md` in the repository root, one per build.
  `REVISION_NOTES.md` holds the longer design history (revisions 3 and 4:
  prose and verse regimes, weak-boundary metre).
- **Other files:** `known-rhythms.js` (stored readings and research
  examples), `cmudict.js` and `cmudict-subset.js` (dictionary),
  `stamp_dictionary_metadata.js`, `server.js` (local server, `npm start`).

Release history for this period: 3.6.0 discourse focus; 3.6.1 sentence rule
and Verse metre prior; 3.6.2 meter labels; 3.6.3 homographs after a modifier;
3.6.4 accents, hyphens, one verse choice, contact page; 3.6.5 `-lle` and
`Mc-`; 3.6.6 Pro session integrity and export provenance; 3.6.7 CSV cells cannot
become formulas; 3.6.8 quotation marks are not phrase boundaries, equal
stimulus counts, annotated text as typed; 3.6.9 short comma lines; 3.6.10 syllable division; 3.6.11 owner rulings (Raven, Longfellow, anapestic label). Also in this period, with no engine change: recorded DUM and da in "Hear the beat", Play buttons on the
Learn pages, larger welcome-page type, and the prose scoring pipeline.
