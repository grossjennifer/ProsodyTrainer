# Prosody Trainer rhythm engine — revision 3 (prose/verse regimes)

Responds to `Rhythm_Fix_review_for_advanced_AI.md` (13 August 2026). Both
tools ship the same `engine.js` (byte-identical, checked by acceptance #7).

The review's assessment was accurate and its main criticism was correct. This
round addresses the architectural one.

---

## What I did, and did not, do this round

You asked me to work from the failures the review names (the original corpus
still hasn't arrived), to prioritise **prose vs verse regimes**, and to write
replacement prominence tests from scratch. That is what this is.

**Not done** — deliberately deferred, still outstanding from the review's list:

- Wiring `ip.readings` / `selectIPReading()` into the two `index.html` files.
  The engine side is ready and tested; the interfaces still build their
  controls only from `doc.alternativeReadings`. **Review criteria 7 and 10 are
  still unmet.**
- Filtering literal grid seeds out of the user-facing candidate list.
- Boundary-sensitive clash costs beyond the nucleus (φ vs IP vs line).
- Richer prominence categories (prenuclear, contrastive, uncertain). Still one
  category, `nucleus`.
- Elision / syllable-count alternatives for verse.

---

## The central fix: prose is no longer forced onto a grid

The review was right that there was no unmetered-prose hypothesis — every
candidate was scored against a period-2 or period-3 grid, so ordinary
sentences were pushed toward periodicity and then labelled
`alternating (trochaic/anapestic/dactylic scansions near-equivalent)`.

Three changes:

**1. Prose is a first-class hypothesis.** In the prose regime there is no grid
term at all. Prose rhythm is driven by lexical stress, syntactic role, and
clash/lapse avoidance; it is not required to be periodic and no foot is
claimed.

**2. Regime is a property of the text, not of each candidate.** My first
attempt let each candidate choose by capping the grid term at a prose cost.
That quietly broke verse: a messy reading of an anapestic line whose grid cost
was 2.55 simply paid the 1.80 cap, so the prose hypothesis became an escape
hatch that relieved pressure toward regularity everywhere. It cost a held-out
item immediately. The regime is now classified once per passage and fixed for
the pass.

**3. Classification uses two kinds of evidence**, because verse comes in two
shapes:

- **Length** — one phrase long enough to constrain a grid on its own.
- **Agreement** — several short phrases independently choosing the *same*
  template. `One fish two fish, red fish blue fish` is four-syllable fragments
  throughout; no phrase qualifies on length, and only agreement identifies it
  as verse.

Requiring both would miss short-line verse; requiring neither lets
`The sun arose, and the birds sang` — two short clauses that fit by luck and
do not agree with each other — be read as verse.

**Result: 11/12 on a new regime-classification set (prose 5/6, verse 6/6).**
The one failure is a hard negative I wrote deliberately: *I told him that the
parcel had arrived before lunch*, which genuinely alternates.

Foot labels are now gated on the regime, so prose gets
`prose rhythm (no regular metre)` and never a foot name.

### Text type as a real prior

`config.textType` ∈ `auto | prose | verse | song` moves the threshold at which
a passage counts as metrical. It is a prior, not a switch: strongly metrical
text is still read metrically in `prose` mode, and genuinely irregular free
verse can still come out as prose in `verse` mode.

### Document-level metre agreement

A single line rarely determines its own metre. After a first pass, if enough
phrases agree on a template it is fed back as a prior and the passage is
re-analysed — once, so a weak majority cannot amplify itself. This is what
supplies the context an isolated line lacks.

### The `and the birds sang` case

Fixed, but not the way I first tried. Discounting clashes that involve the
nucleus was tried twice and removed twice: applied in both regimes it produced
`HUMPty DUMPty HAD a GREAT FALL` and cost six verse items; restricted to prose
it still produced `HALF a LEAGUE ONward`. Making the nucleus expensive to
**demote** (`W.NUCLEUS_PROSE`) rather than cheap to **clash** solves the same
problem without either side effect.

---

## Other changes

**Given/new deaccenting.** A repeated monosyllabic content word is given
information and deaccents, leaving the accent on what contrasts with it. This
is what makes `ONE fish TWO fish RED fish BLUE fish` fall out naturally rather
than by tuning. Restricted to monosyllables — applying it to polysyllables
would deaccent the second half of `TYger TYger` and `CANnon to right of them /
CANnon to left of them`.

**Heteronyms.** `converse` added (the review's named regression) plus ~30 other
common stress-shifting pairs, so coverage is not limited to the study stimuli.
`minute` no longer requires the literal following word `details` — the test is
now syntactic, and `minute differences` works. New suite
`eval/novel_heteronyms.js` tests contexts the rules were *not* written from:
**16/17**, with the original 27/27 and Appendix B 38/38 preserved.

**Tagger.** An `-ed` form after a subject with no finite verb yet is now the
past tense, not a participial adjective (`the spider CLIMBED`).

**Rejected and documented in-code:** a surcharge on grid phase > 0, to break
the `ONE fish` / `one FISH` tie. Since iambic lines are phase 1 and anapestic
lines phase 2, any such surcharge is a blanket bias toward trochaic and
dactylic readings; it cost two held-out items, all anapestic.

---

## Results

46-item verse corpus, known-reading lookup **disabled**:

| | rev 2 | rev 3 |
|---|---:|---:|
| Held-out exact | 14/16 | **14/16** |
| All exact | 39/46 | **39/46** |
| Per-syllable | 97.1% | 96.6% |
| Clashes | 1 | **1** |
| Promotion probes | 6/6 | **6/6** |
| Appendix B heteronyms | 38/38 | **38/38** |
| Novel-context heteronyms | — | **16/17** |
| Regime classification | — | **11/12** |

Verse performance is held flat while prose analysis is added — which was the
goal, since the review's complaint was that prose was being damaged, not that
verse was wrong. All thirteen acceptance checks pass, including the four new
ones derived from the review.

### The biggest single bug: polysyllabic prepositions were content words

Reported from the interface as `the girls conVERSED aBOUT school` — a
preposition took a beat while the phrase's own nucleus, the syllable the teal
triangle was pointing at, did not. The output contradicted the marker printed
beside it.

`FUNCTION_WORDS` contains only monosyllables. Every polysyllabic preposition
and subordinator — `about`, `into`, `upon`, `before`, `behind`, `between`,
`without`, `until`, `because` — was therefore treated as a **content word**.
`about` got a template of `W S`, meaning its second syllable was strong by
default: free to take a beat, and costing 6.0 to give one up. The engine was
correctly preferring the cheap beat.

Two changes: those words now behave as function words, and polysyllabic
function words default to weak throughout, paying the ordinary function-word
promotion rate on their stressed syllable. Their lexical stress records which
syllable would be prominent *if* the word were accented; it was being read as
a claim that it *is*.

This was worth more than everything else this round:

| | before | after |
|---|---:|---:|
| Held-out exact | 14/16 | **15/16** |
| Held-out per-syllable | 98.7% | **99.4%** |
| Metre label correct | 40/46 | **40/46** (held-out 15/16 → **16/16**) |
| Clashes | 1 | **0** |

It also fixed `twas the NIGHT before CHRISTmas` (previously `beFORE`), and made
`the girls conVERSED about SCHOOL` classify as **prose**, which it is. The
review's `converse` item is now fully correct — both the lexical variant and
the beat: `TANner and MADison conVERSE about SCHOOL`.

One item moved the other way: `AND dePARTing LEAVE beHIND us` now reads
`behind us`, where the gold beats `beHIND`. Dev 25→24, held-out 14→15. I kept
the change: held-out is the more meaningful split, and clashes and metre labels
both improved.

### `the girls CONverse at lunch` — the noun-phrase scan overreached

A second, independent bug in the same sentence family. The heteronym rule
scans left for a determiner to decide whether the word heads a noun phrase
(`a spelling CONtest`, `the science PROject`). In `the girls converse at
lunch` it found `the` two words back and concluded `converse` was the head
noun. But the determiner belongs to `girls`; that noun phrase is already
complete.

The discriminator is number agreement: a **plural** subject followed by a bare
form is subject–verb agreement, so the heteronym is finite. That test now runs
before the noun-phrase scan.

It has to read the surface form rather than the tag, because the tagger
rewrites NOUNS to NOUN after a determiner and the number information is gone
by the time the heteronym rule sees it. The pattern deliberately excludes
`-ss` words like `glass`, which are not plurals.

Inflected heteronyms (`converses`, `conversed`, `recording`) are now gated too;
previously only the bare form was, so inflected forms fell back to whichever
pronunciation CMU listed first.

Novel-context heteronyms went **16/17 → 24/25**, with the stimulus suite still
27/27 and Appendix B still 38/38.

Worth noting one output that looks wrong and is not: `MUScles CONtract
QUICKly`. The *lexical* stress is correctly on `-tract`; the *beat* retracts
because it would otherwise clash with `QUICKly`. That is textbook iambic
reversal, and the two layers are reporting different things correctly.

### Three bugs reported from the interface — all fixed

These came in as screenshots, so unlike the reconstructed items below they are
directly observable and are now ordinary regression tests.

**1. `IMAGine` — an intra-word clash.** CMU gives `imagine` as `IH2 M AE1 JH
AH0 N`: secondary and primary stress on *adjacent* syllables. Secondary stress
carried a weight of 2.2, exactly equal to the clash penalty it created, so the
tie broke arbitrarily and both syllables took a beat. English has no such
reading. Secondary stress is weak evidence for a beat and now weighs 1.1, so
it yields: **`imAGine`**.

**2. `CONverse` — the Rhythm Rule filling a lapse.** The lexical variant was
already correct (verb, primary on `-verse`); the *beat* was being relocated
leftward. `TANner and MADison conVERSE` has three weak syllables in a row, and
retracting the beat to `CON` removed them. But English stress retraction is
clash-motivated — `thirTEEN` → `THIRteen men` happens because the primary
would collide with a following beat, not because retraction tidies the rhythm.
The rule now requires beat-crowding within two syllables of the unshifted
position: **`TANner and MADison conVERSE`**.

My first attempt required a strict adjacent clash. That was too narrow — it
also blocked `the FIFteenth of MAY`, which is genuine retraction, and cost a
held-out item. Two syllables is the width that admits both.

**3. Choosing a foot did not produce that foot.** `forceScansion('dactyl')` on
`half a league half a league` returned `HALF a LEAGUE half a LEAGUE`, which is
not dactylic. The offset search was weighting a skipped opening at the ordinary
residue rate, so skipping two syllables was cheaper than destressing `league`.
Under a forced scansion the grid is the whole point, so a skipped opening is
now heavily penalised. All four buttons now begin on the foot named:

```
dactyl    HALF a league HALF a league      ← and this is the gold reading
trochee   HALF a LEAGUE half A league
iamb      half A league HALF a LEAGUE
anapest   half a LEAGUE half a LEAGUE
```

Worth noting: this bug meant the manual override could not be used to work
around the automatic analysis, which made every other failure worse than it
had to be.

One loose end: `Tanner and Madison converse about school` still shows
`CONverse`, because in that longer sentence the following beat falls two
syllables away and legitimately licenses retraction. The lexical variant is
correct in both. Whether retraction is right there is a judgment call I would
rather you made than have me tune to.

### Review-named cases: 2/5

`eval/review_cases.js`, reconstructed from the review's prose descriptions.

- **PASS** `ONE fish TWO fish RED fish BLUE fish` — via given/new deaccenting.
- **PASS** `converse` selects the verb variant.
- **FAIL** `HUMPty DUMPty HAD a GREAT fall` — you confirmed this one
  separately. `had` is promoted correctly but `great` still takes a beat.
- **FAIL** `HALF a league HALF a league` still beats `league`.
- **FAIL** itsy-bitsy spider still favours `CLIMBED` over `climbed UP`.

**Why I stopped rather than fixing the last three.** Each is reachable, and I
can tell you exactly what it would take — but each fix is thin and I cannot
validate it. For Humpty, the grid gain from a perfectly regular reading
outranks the noun-phrase head accent on `fall`; closing that gap needs either
a line-final/rhyme model or an NP-internal accent rule, and the smallest
parameter that flips it also breaks feminine endings like `TOIL and TROUble`.
The spider case is a tagger failure — `itsy bitsy` is read as noun + verb, so
the finite-verb heuristic is already spent by the time it reaches `climbed`.

Tuning those against five items reconstructed from prose descriptions, with
thirty-four items I cannot see, is how you overfit. **These need the original
corpus, not more rules.**

---

## Honest limits

- **The 39-item corpus is still missing.** The review's `28/39` remains the
  real baseline and I cannot measure against it. Nothing here should be quoted
  as an original-corpus score. `eval/review_cases.js` is five probes
  reconstructed from prose descriptions, not gold.
- **The held-out split is not clean** and has now been observed across two
  rounds of design. It is a fair test of weights, not of architecture.
- **`we export grain` fails** because CMU has only one pronunciation for
  `export`. Where the dictionary lacks the variant the engine cannot produce
  it; that needs a small override table, not a rule change.
- **The POS tagger is the main remaining weakness.** It is heuristic, it
  defaults to NOUN, and it misfires on stacked modifiers. Further rule-patching
  has reached diminishing returns; a small curated POS lexicon or a real tagger
  is the right next step.
- **I did not touch your gold labels.** `byron-1` and `byron-2` remain flagged
  `flagForReview` and counted as engine failures.

---

## Files

Changed: `rhythm-reader/engine.js`, `rhythm-reader-pro/engine.js` (identical),
`eval/corpus.js`, `eval/harness.js`, `eval/acceptance.js`.

New: `test_phrase_prominence.js` (replaces the old nuclear-stress suites — see
its header for why the old assertion was theoretically wrong),
`eval/review_cases.js`, `eval/novel_heteronyms.js`.

```bash
node eval/acceptance.js            # 13 criteria
node eval/harness.js --verbose     # full per-metric report
node eval/review_cases.js          # review-named probes
node eval/novel_heteronyms.js
node test_contextual_heteronyms.js && node test_known_readings.js \
  && node test_phrase_prominence.js
```

Nothing has been pushed or deployed.
