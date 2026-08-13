/* ============================================================================
 * eval/corpus.js — scored rhythm corpus reconstructed from
 * ProsodyTrainer_advanced_model_handoff.md (12 August 2026).
 * ----------------------------------------------------------------------------
 * PROVENANCE WARNING
 * Every gold annotation here was transcribed from the handoff document, which
 * itself records annotations recovered from (a) the supplemental .docx used in
 * Jennifer Gross's experiment, (b) web sources, and (c) screenshots. Items
 * whose gold the handoff explicitly flags as unconfirmed carry
 * `provisional: true` and are EXCLUDED from headline metrics. They are still
 * scored and reported separately so that regressions are visible.
 *
 * SPLIT DISCIPLINE
 * Items are grouped by source work (`group`). Whole groups — never individual
 * lines — are assigned to `dev` or `held`, so that lines from the same poem
 * cannot leak across the split. The split was fixed BEFORE any tuning and is
 * not to be re-drawn to improve a number.
 *
 * MARKUP NORMALISATION
 * The handoff records some annotations with whole-word capitalisation taken
 * from web bolding (e.g. `GLEAMING`, `NIGHTLY`, `PURPLE`). The handoff warns
 * that whole-word bolding is not syllable-level scansion. Those tokens are
 * normalised here to mark only the primary-stress syllable (`GLEAMing`,
 * `NIGHTly`, `PURple`) and are annotated with `normalisedFrom`.
 * ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
 * Passage items: full beat annotations.
 * `marked` capitalises the letters of every syllable that carries a metrical
 * beat. Unmarked words are entirely weak.
 * ------------------------------------------------------------------------ */

const PASSAGES = [
  /* ---- Appendix C, "summer" stimulus — trochaic ------------------ dev -- */
  { id: 'appC-summer-1', group: 'appC-summer', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'Seeing fishes in the water',
    marked: 'SEEing FISHes IN the WAter' },
  { id: 'appC-summer-2', group: 'appC-summer', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'Walking through the woods of summer',
    marked: 'WALKing THROUGH the WOODS of SUMmer' },
  { id: 'appC-summer-3', group: 'appC-summer', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'Playing in the pool with family',
    marked: 'PLAYing IN the POOL with FAMily' },
  { id: 'appC-summer-4', group: 'appC-summer', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'Summer is so fine and dandy',
    marked: 'SUMmer IS so FINE and DANdy' },

  /* ---- Longfellow, "A Psalm of Life" — trochaic ------------------ dev --
   * NOTE: both the "Let us then be up and doing" quatrain and the "Lives of
   * great men" quatrain are from this same poem, so they share one group. */
  { id: 'psalm-1', group: 'longfellow-psalm', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'Let us then be up and doing',
    marked: 'LET us THEN be UP and DOing' },
  { id: 'psalm-2', group: 'longfellow-psalm', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'With a heart for any fate',
    marked: 'WITH a HEART for ANy FATE' },
  { id: 'psalm-3', group: 'longfellow-psalm', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'Still achieving still pursuing',
    marked: 'STILL aCHIEVing STILL purSUing' },
  { id: 'psalm-4', group: 'longfellow-psalm', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'Learn to labor and to wait',
    marked: 'LEARN to LAbor AND to WAIT' },
  { id: 'psalm-5', group: 'longfellow-psalm', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'Lives of great men all remind us',
    marked: 'LIVES of GREAT men ALL reMIND us' },
  { id: 'psalm-6', group: 'longfellow-psalm', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'We can make our lives sublime',
    marked: 'WE can MAKE our LIVES subLIME' },
  { id: 'psalm-7', group: 'longfellow-psalm', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'And departing leave behind us',
    marked: 'AND dePARTing LEAVE beHIND us' },
  { id: 'psalm-8', group: 'longfellow-psalm', split: 'dev', meter: 'trochee',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'Footprints on the sands of time',
    marked: 'FOOTprints ON the SANDS of TIME' },

  /* ---- Seuss, "Horton Hatches the Egg" — anapestic --------------- held -- */
  { id: 'horton-1', group: 'horton', split: 'held', meter: 'anapest',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'On the fifteenth of May in the jungle of Nool',
    marked: 'on the FIFteenth of MAY in the JUNgle of NOOL' },
  { id: 'horton-2', group: 'horton', split: 'held', meter: 'anapest',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'In the heat of the day in the cool of the pool',
    marked: 'in the HEAT of the DAY in the COOL of the POOL' },
  { id: 'horton-3', group: 'horton', split: 'held', meter: 'anapest',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: "He was splashing enjoying the jungle's great joys",
    marked: "he was SPLASHing enJOYing the JUNgle's great JOYS" },
  { id: 'horton-4', group: 'horton', split: 'held', meter: 'anapest',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'When Horton the elephant heard a small noise',
    marked: 'when HORton the ELephant HEARD a small NOISE' },

  /* ---- Cowper, "Verses Supposed to be Written by Alexander Selkirk"
   *      — anapestic ------------------------------------------------ held -- */
  { id: 'cowper-1', group: 'cowper-solitude', split: 'held', meter: 'anapest',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'From the centre all round to the sea',
    marked: 'from the CENtre all ROUND to the SEA' },
  { id: 'cowper-2', group: 'cowper-solitude', split: 'held', meter: 'anapest',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'I am lord of the fowl and the brute',
    marked: 'i am LORD of the FOWL and the BRUTE' },
  { id: 'cowper-3', group: 'cowper-solitude', split: 'held', meter: 'anapest',
    source: 'Supplemental materials, Appendix C (congruent)',
    text: 'Oh solitude where are the charms',
    marked: 'oh SOLitude WHERE are the CHARMS' },

  /* ---- Byron, "The Destruction of Sennacherib" — anapestic -------- dev -- */
  { id: 'byron-1', group: 'byron-sennacherib', split: 'dev', meter: 'anapest',
    source: 'Owner-supplied web example',
    text: 'The Assyrian came down like the wolf on the fold',
    marked: 'the asSYRian came DOWN like the WOLF on the FOLD',
    flagForReview: true,
    note: 'FLAGGED FOR OWNER REVIEW — gold NOT changed. The handoff leaves ' +
          '"Assyrian" unmarked while marking every other content word in the ' +
          'line, and warns that "whole-word bolding from web pages is not ' +
          'always a complete syllable-level scansion". Standard scansion of ' +
          'this anapestic tetrameter would put a beat on as-SYR-ian. The ' +
          'engine currently disagrees with this gold and IS COUNTED AS WRONG. ' +
          'Only Jennifer Gross should decide whether to revise it.' },
  { id: 'byron-2', group: 'byron-sennacherib', split: 'dev', meter: 'anapest',
    source: 'Owner-supplied web example',
    text: 'And his cohorts were gleaming in purple and gold',
    marked: 'and his cohorts were GLEAMing in PURple and GOLD',
    normalisedFrom: 'and his cohorts were GLEAMING in PURPLE and GOLD',
    flagForReview: true,
    note: 'FLAGGED FOR OWNER REVIEW — gold NOT changed. Same pattern as ' +
          'byron-1: "cohorts" is the only unmarked content word in an ' +
          'otherwise fully marked anapestic line. The engine reads CO-horts ' +
          'and IS COUNTED AS WRONG against this gold.' },
  { id: 'byron-3', group: 'byron-sennacherib', split: 'dev', meter: 'anapest',
    source: 'Owner-supplied web example',
    text: 'And the sheen of their spears was like stars on the sea',
    marked: 'and the SHEEN of their SPEARS was like STARS on the SEA' },
  { id: 'byron-4', group: 'byron-sennacherib', split: 'dev', meter: 'anapest',
    provisional: true,
    source: 'Owner-supplied web example',
    text: 'When the blue wave rolls nightly on deep Galilee',
    marked: 'when the BLUE wave rolls NIGHTly on DEEP Galilee',
    normalisedFrom: 'when the BLUE wave rolls NIGHTLY on DEEP Galilee',
    note: 'Handoff: "The final stress in Galilee needs explicit confirmation ' +
          'before becoming a hard test."' },

  /* ---- Moore, "A Visit from St. Nicholas" — anapestic ------------ held -- */
  { id: 'stnick-1', group: 'st-nicholas', split: 'held', meter: 'anapest',
    source: 'Owner-supplied screenshot',
    text: 'Twas the night before Christmas when all through the house',
    marked: 'twas the NIGHT before CHRISTmas when ALL through the HOUSE' },
  { id: 'stnick-2', group: 'st-nicholas', split: 'held', meter: 'anapest',
    provisional: true,
    source: 'Owner-supplied screenshot',
    text: 'Not a creature was stirring not even a mouse',
    marked: 'not a CREAture was STIRring not even a MOUSE',
    note: 'Handoff: unbeaten "EVen" should be treated literally only if ' +
          'confirmed intentional.' },
  { id: 'stnick-3', group: 'st-nicholas', split: 'held', meter: 'anapest',
    provisional: true,
    source: 'Owner-supplied screenshot',
    text: 'The stockings were hung by the chimney with care',
    marked: 'the stockings were HUNG by the CHIMney with CARE',
    note: 'Handoff: unbeaten "STOCKings" should be treated literally only if ' +
          'confirmed intentional.' },
  { id: 'stnick-4', group: 'st-nicholas', split: 'held', meter: 'anapest',
    source: 'Owner-supplied screenshot',
    text: 'In hopes that Saint Nicholas soon would be there',
    marked: 'in HOPES that saint NICHolas SOON would be THERE' },

  /* ---- Longfellow, "Evangeline" — dactylic ----------------------- dev -- */
  { id: 'evangeline-1', group: 'evangeline', split: 'dev', meter: 'dactyl',
    provisional: true,
    source: 'Owner-supplied web example',
    text: 'This is the forest primeval the murmuring pines and the hemlocks',
    marked: 'THIS is the FORest priMEval the MURmuring PINES and the HEMlocks',
    note: 'Handoff: treatment of "primeval" should be checked against an ' +
          'authoritative scansion before hard-coding.' },

  /* ---- Tennyson, "The Charge of the Light Brigade" — dactylic ----- dev --
   * These lines are ALSO in known-rhythms.js. They are therefore only
   * meaningful when the known-reading registry is disabled; the harness
   * reports both conditions. */
  { id: 'brigade-1', group: 'light-brigade', split: 'dev', meter: 'dactyl',
    inKnownRegistry: true,
    source: 'Owner-supplied web example',
    text: 'Cannon to right of them',
    marked: 'CANnon to RIGHT of them' },
  { id: 'brigade-2', group: 'light-brigade', split: 'dev', meter: 'dactyl',
    inKnownRegistry: true,
    source: 'Owner-supplied web example',
    text: 'Cannon to left of them',
    marked: 'CANnon to LEFT of them' },
  { id: 'brigade-3', group: 'light-brigade', split: 'dev', meter: 'dactyl',
    inKnownRegistry: true,
    source: 'Owner-supplied web example',
    text: 'Cannon in front of them',
    marked: 'CANnon in FRONT of them' },
  { id: 'brigade-4', group: 'light-brigade', split: 'dev', meter: 'dactyl',
    source: 'Owner-supplied web example',
    text: 'Half a league half a league',
    marked: 'HALF a league HALF a league' },
  { id: 'brigade-5', group: 'light-brigade', split: 'dev', meter: 'dactyl',
    source: 'Owner-supplied web example',
    text: 'Half a league onward',
    marked: 'HALF a league ONward' },
  { id: 'brigade-6', group: 'light-brigade', split: 'dev', meter: 'dactyl',
    inKnownRegistry: true,
    source: 'Owner-supplied web example',
    text: 'All in the valley of Death',
    marked: 'ALL in the VALley of death',
    prominence: 'death',
    note: 'Terminal "Death" is extrametrical (no beat) but retains phrase ' +
          'prominence. This is the key beats-vs-prominence interface case.' },
  { id: 'brigade-7', group: 'light-brigade', split: 'dev', meter: 'dactyl',
    source: 'Owner-supplied web example',
    text: 'Rode the six hundred',
    marked: 'RODE the six HUNdred' },

  /* ---- Browning, "The Lost Leader" — dactylic -------------------- held -- */
  { id: 'browning-1', group: 'browning-lost-leader', split: 'held', meter: 'dactyl',
    inKnownRegistry: true,
    source: 'Owner-supplied web example',
    text: 'Just for a handful of silver he left us',
    marked: 'JUST for a HANDful of SILver he LEFT us' },
  { id: 'browning-2', group: 'browning-lost-leader', split: 'held', meter: 'dactyl',
    inKnownRegistry: true,
    source: 'Owner-supplied web example',
    text: 'Just for a riband to stick in his coat',
    marked: 'JUST for a RIBand to STICK in his COAT' },

  /* ---- Whitman — dactylic ---------------------------------------- dev -- */
  { id: 'whitman-1', group: 'whitman', split: 'dev', meter: 'dactyl',
    inKnownRegistry: true,
    source: 'Owner-supplied web example',
    text: 'Down to the shores of the water the path by the swamp in the dimness',
    marked: 'DOWN to the SHORES of the WAter the PATH by the SWAMP in the DIMness' },

  /* ---- Iambic set (each line from a different poem; grouped individually) - */
  { id: 'iamb-shakespeare', group: 'iamb-shakespeare', split: 'dev', meter: 'iamb',
    source: 'Owner-supplied web example',
    text: "Shall I compare thee to a summer's day",
    marked: "shall I comPARE thee TO a SUMmer's DAY" },
  { id: 'iamb-ulysses', group: 'iamb-ulysses', split: 'dev', meter: 'iamb',
    source: 'Owner-supplied web example',
    text: 'To strive to seek to find and not to yield',
    marked: 'to STRIVE to SEEK to FIND and NOT to YIELD' },
  { id: 'iamb-gray', group: 'iamb-gray', split: 'held', meter: 'iamb',
    source: 'Owner-supplied web example',
    text: 'The curfew tolls the knell of parting day',
    marked: 'the CURfew TOLLS the KNELL of PARTing DAY' },
  { id: 'iamb-wordsworth', group: 'iamb-wordsworth', split: 'dev', meter: 'iamb',
    source: 'Owner-supplied web example',
    text: 'I wandered lonely as a cloud',
    marked: 'i WANdered LONEly AS a CLOUD' },
  { id: 'iamb-marvell', group: 'iamb-marvell', split: 'held', meter: 'iamb',
    source: 'Owner-supplied web example',
    text: "The grave's a fine and private place",
    marked: "the GRAVE'S a FINE and PRIvate PLACE" },
  { id: 'iamb-frost', group: 'iamb-frost', split: 'held', meter: 'iamb',
    source: 'Owner-supplied web example',
    text: 'Whose woods these are I think I know',
    marked: 'whose WOODS these ARE i THINK i KNOW' },

  /* ---- Trochaic set ---------------------------------------------------- */
  { id: 'troch-macbeth', group: 'macbeth', split: 'dev', meter: 'trochee',
    source: 'Owner-supplied web example',
    text: 'Double double toil and trouble',
    marked: 'DOUble DOUble TOIL and TROUble' },
  { id: 'troch-tyger-1', group: 'blake-tyger', split: 'held', meter: 'trochee',
    source: 'Owner-supplied web example',
    text: 'Tyger Tyger burning bright',
    marked: 'TYger TYger BURNing BRIGHT' },
  { id: 'troch-tyger-2', group: 'blake-tyger', split: 'held', meter: 'trochee',
    source: 'Owner-supplied web example',
    text: 'In the forests of the night',
    marked: 'IN the FORests OF the NIGHT',
    note: 'Handoff: "The function word OF is an important metrical-promotion ' +
          'case."' },

  /* ---- Poe, "The Raven" — trochaic ------------------------------- dev -- */
  { id: 'poe-raven', group: 'poe-raven', split: 'dev', meter: 'trochee',
    inKnownRegistry: true,
    source: 'Owner-supplied web example (conventional reading)',
    text: 'Once upon a midnight dreary while I pondered weak and weary',
    marked: 'ONCE upON a MIDnight DREARy WHILE i PONdered WEAK and WEARy' },

  /* ---- Nursery rhymes — the original reported failures ----------- dev -- */
  { id: 'nursery-mouse', group: 'nursery', split: 'dev', meter: 'iamb',
    inKnownRegistry: true, headline: true,
    source: "Owner's intended reading (handoff §Original reported failures)",
    text: 'The mouse ran up the clock',
    marked: 'the MOUSE ran UP the CLOCK',
    note: 'ACCEPTANCE CRITERION 2: must be analysed correctly WITHOUT ' +
          'known-text lookup.' },
  { id: 'nursery-kings-horses', group: 'nursery', split: 'dev', meter: 'dactyl',
    inKnownRegistry: true,
    source: 'Handoff §Supplied files and original handoff',
    text: "All the king's horses and all the king's men",
    marked: "ALL the king's HORses and ALL the king's MEN" }
];

/* --------------------------------------------------------------------------
 * Promotion probes (handoff §2 "Critical promotion probes").
 * Scored ONLY on the named target words, because the handoff supplies a
 * promotion claim rather than a complete vetted scansion for each.
 * ------------------------------------------------------------------------ */

const PROMOTION_PROBES = [
  { id: 'probe-mouse-up', split: 'dev',
    text: 'The mouse ran up the clock',
    targets: [{ word: 'up', beat: 'S' }, { word: 'ran', beat: 'W' },
              { word: 'mouse', beat: 'S' }] },
  { id: 'probe-forests-of', split: 'held',
    text: 'In the forests of the night',
    targets: [{ word: 'of', beat: 'S' }] },
  { id: 'probe-trying-to', split: 'dev',
    text: 'Trying to escape',
    targets: [{ word: 'to', beat: 'S' }] },
  { id: 'probe-gimble-in', split: 'dev',
    text: 'Did gyre and gimble in the wabe',
    targets: [{ word: 'in', beat: 'S' }] },
  { id: 'probe-humpty-had', split: 'dev',
    text: 'Humpty Dumpty had a great fall',
    targets: [{ word: 'had', beat: 'S' }] },
  { id: 'probe-thomas-not', split: 'held',
    text: 'Do not go gentle into that good night',
    targets: [{ word: 'not', beat: 'S' }, { word: 'that', beat: 'S' }] }
];

/* --------------------------------------------------------------------------
 * Appendix B — lexical-stress heteronym items.
 * These test `lexicalStress`, NOT metrical beat. `target` names the word whose
 * primary-stress syllable index is asserted.
 * ------------------------------------------------------------------------ */

const HETERONYMS = [
  { text: 'minute details',            target: 'minute',   primary: 1 },
  { text: 'down to the minute',        target: 'minute',   primary: 0 },
  { text: 'produce steam',             target: 'produce',  primary: 1 },
  { text: 'an assortment of produce',  target: 'produce',  primary: 0 },
  { text: 'maintain the record',       target: 'record',   primary: 0 },
  { text: 'to record her voice',       target: 'record',   primary: 1 },
  { text: "a learner's permit",        target: 'permit',   primary: 0 },
  { text: 'decided to permit her',     target: 'permit',   primary: 1 },
  { text: 'a violent conflict',        target: 'conflict', primary: 0 },
  { text: 'they conflict with us',     target: 'conflict', primary: 1 },
  { text: 'convert the file',          target: 'convert',  primary: 1 },
  { text: 'a recent convert',          target: 'convert',  primary: 0 },
  { text: 'the rebel forces',          target: 'rebel',    primary: 0 },
  { text: 'they rebel against it',     target: 'rebel',    primary: 1 },
  { text: 'the content of the book',   target: 'content',  primary: 0 },
  { text: 'she was content to wait',   target: 'content',  primary: 1 },
  { text: 'a spelling contest',        target: 'contest',  primary: 0 },
  { text: 'they contest the ruling',   target: 'contest',  primary: 1 },
  { text: 'the science project',       target: 'project',  primary: 0 },
  { text: 'project the image',         target: 'project',  primary: 1 },
  { text: 'a polite refuse',           target: 'refuse',   primary: 0 },
  { text: 'they refuse to leave',      target: 'refuse',   primary: 1 },
  { text: 'the subject of study',      target: 'subject',  primary: 0 },
  { text: 'to subject herself to it',  target: 'subject',  primary: 1 },
  { text: 'sign the contract',         target: 'contract', primary: 0 },
  { text: 'muscles contract quickly',  target: 'contract', primary: 1 },
  { text: 'good conduct is required',  target: 'conduct',  primary: 0 },
  { text: 'to conduct the study',      target: 'conduct',  primary: 1 },
  { text: 'a perfect circle',          target: 'perfect',  primary: 0 },
  { text: 'to perfect the method',     target: 'perfect',  primary: 1 },
  { text: 'the object on the table',   target: 'object',   primary: 0 },
  { text: 'they object to the plan',   target: 'object',   primary: 1 },
  { text: 'across the desert',         target: 'desert',   primary: 0 },
  { text: 'they desert their posts',   target: 'desert',   primary: 1 },
  { text: 'a lovely present',          target: 'present',  primary: 0 },
  { text: 'to present the findings',   target: 'present',  primary: 1 },
  { text: 'an escaped convict',        target: 'convict',  primary: 0 },
  { text: 'to convict the accused',    target: 'convict',  primary: 1 }
];

/* --------------------------------------------------------------------------
 * Unscored ambiguity probes. The handoff explicitly declines to supply gold.
 * Reported for inspection only; never counted.
 * ------------------------------------------------------------------------ */

const AMBIGUITY_PROBES = [
  { id: 'ambig-test-sentence', text: 'This is a test sentence.',
    note: 'Handoff: "The owner did not provide a definitive gold reading for ' +
          'this sentence, so it must remain an ambiguity probe rather than a ' +
          'hard regression case." Original engine showed TEST SENtence (clash).' }
];

/* --------------------------------------------------------------------------
 * Negative / discrimination items: deliberately incongruent displays shown to
 * participants. The goal is to RANK the conventional reading above the
 * experimentally shifted one — never to reproduce the shifted display.
 * ------------------------------------------------------------------------ */

const DISCRIMINATION = [
  { id: 'poe-incongruent', text: 'Once upon a midnight dreary while I pondered weak and weary',
    congruent:   'ONCE upON a MIDnight DREARy WHILE i PONdered WEAK and WEARy',
    incongruent: 'once UPon A midNIGHT drearY while I ponDERED weak AND wearY',
    source: 'Supplemental materials, Appendix C (incongruent)' }
];

/* --------------------------------------------------------------------------
 * Regime classification set.
 *
 * The review's central architectural criticism was that every passage was
 * scored against a periodic grid, so ordinary prose was coerced into metre
 * and handed a foot label. These items test the prose/verse decision itself,
 * which is a classification question and is scored separately from beat
 * placement — a passage can be correctly classified and still get its beats
 * wrong, and the two failures need different fixes.
 *
 * The prose items are ordinary sentences, including some written to be
 * awkward for a grid-based analyser: a long nominal subject, a sentence that
 * happens to alternate, and short two-clause sentences of the kind the review
 * used as its example.
 * ------------------------------------------------------------------------ */

const REGIME_CASES = [
  // --- ordinary prose -----------------------------------------------------
  { text: 'Researchers measured reading times for each sentence in the experiment.',
    regime: 'prose', note: 'academic prose' },
  { text: 'She put the book on the table and walked out of the room.',
    regime: 'prose', note: 'plain narrative prose' },
  { text: 'The sun arose, and the birds sang.',
    regime: 'prose',
    note: "the review's own example; two short clauses that each fit a grid " +
          'by luck but do not agree with one another' },
  { text: 'The committee will reconvene on Thursday to discuss the proposal.',
    regime: 'prose', note: 'long words, irregular stress spacing' },
  { text: 'I told him that the parcel had arrived before lunch.',
    regime: 'prose', note: 'alternating-ish prose — a hard negative' },
  { text: 'Participants read each sentence silently and then answered a question.',
    regime: 'prose', note: 'methods-section prose' },

  // --- verse and rhyme ----------------------------------------------------
  { text: 'Shall I compare thee to a summer\'s day',
    regime: 'metrical', note: 'iambic pentameter, single line' },
  { text: 'On the fifteenth of May in the jungle of Nool',
    regime: 'metrical', note: 'anapestic tetrameter, single line' },
  { text: 'Double double toil and trouble',
    regime: 'metrical', note: 'trochaic' },
  { text: 'One fish two fish, red fish blue fish, black fish blue fish.',
    regime: 'metrical',
    note: 'short comma-separated fragments; only phrase AGREEMENT identifies ' +
          'this as verse, since no single fragment is long enough' },
  { text: 'Twas the night before Christmas when all through the house, ' +
          'not a creature was stirring not even a mouse',
    regime: 'metrical', note: 'anapestic couplet' },
  { text: 'Tyger Tyger burning bright, in the forests of the night',
    regime: 'metrical', note: 'trochaic couplet' }
];

module.exports = {
  PASSAGES, PROMOTION_PROBES, HETERONYMS, AMBIGUITY_PROBES, DISCRIMINATION,
  REGIME_CASES
};
