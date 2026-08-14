/* ============================================================================
 * eval/review_cases.js — the specific failures named in
 * Rhythm_Fix_review_for_advanced_AI.md (13 August 2026).
 * ----------------------------------------------------------------------------
 * PROVENANCE WARNING — READ BEFORE TRUSTING THESE
 *
 * The original 39-item corpus (`rhythm_expectations.txt`) was NOT supplied.
 * These expectations are reconstructed from prose descriptions in the review,
 * not transcribed from the owner's annotation file. Where the review says a
 * beat was placed "on the experimental foil `great`", the gold below assumes
 * `great` is unbeaten — a reading of the reviewer's sentence, not a reading of
 * the annotation.
 *
 * They are therefore REGRESSION PROBES, not authoritative gold. They must not
 * be quoted as an original-corpus score, and if the real file arrives these
 * should be replaced by it rather than kept alongside it.
 *
 * Five of thirty-nine items is also not a sample from which to tune. Changes
 * made to satisfy these were checked against the 46-item verse corpus for
 * regressions; that is the only guard available.
 * ========================================================================== */

'use strict';

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
global.window = global.window || {};
require(path.join(ROOT, 'cmudict.js'));
require(path.join(ROOT, 'known-rhythms.js'));
const E = require(path.join(ROOT, 'rhythm-reader/engine.js'));
E.loadDictionary(global.window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);          // generalization condition throughout

const render = doc => doc.words.map(w => w.syllables.map(s =>
  s.rhythmicStress === 'S' ? s.text.toUpperCase() : s.text.toLowerCase()
).join('')).join(' ');

const beatOf = (doc, word) => {
  const wd = doc.words.find(w => w.normalized === word);
  if (!wd) return null;
  const i = wd.syllables.length === 1 ? 0
    : Math.max(0, wd.syllables.findIndex(s => s.lexicalStress === '1'));
  return wd.syllables[i].rhythmicStress;
};

const CASES = [
  {
    id: 'seuss-one-fish',
    why: 'Review: expected `ONE fish TWO fish RED fish BLUE fish`, produced ' +
         '`one FISH two FISH red FISH blue FISH`.',
    text: 'One fish two fish, red fish blue fish.',
    expect: d => ['one', 'two', 'red', 'blue'].every(w => beatOf(d, w) === 'S') &&
                 beatOf(d, 'fish') === 'W'
  },
  {
    id: 'humpty-great-foil',
    why: 'Review: `had` is correctly promoted but a beat is also placed on ' +
         'the experimental foil `great`.',
    text: 'Humpty Dumpty had a great fall',
    expect: d => beatOf(d, 'had') === 'S' && beatOf(d, 'great') === 'W'
  },
  {
    id: 'brigade-league',
    why: 'Review: `HALF a league HALF a league` incorrectly places beats on ' +
         '`league`. Presented as the full stanza, which is how a reader ' +
         'encounters it and what supplies the dactylic context.',
    text: 'Half a league, half a league, half a league onward, ' +
          'all in the valley of Death rode the six hundred.',
    expect: d => {
      const leagues = d.words.filter(w => w.normalized === 'league');
      return leagues.length >= 2 &&
             leagues.slice(1).every(w => w.syllables[0].rhythmicStress === 'W');
    }
  },
  {
    id: 'converse-heteronym',
    why: 'Review: `Tanner and Madison conVERSE about school` became ' +
         '`CONverse` — `converse` was missing from the gated heteronym list.',
    text: 'Tanner and Madison converse about school',
    expect: d => {
      const wd = d.words.find(w => w.normalized === 'converse');
      return wd && wd.syllables.findIndex(s => s.lexicalStress === '1') === 1;
    }
  },
  {
    id: 'spider-climbed-up',
    why: 'Review: the itsy-bitsy-spider item favours `CLIMBED` rather than ' +
         'the supplied `climbed UP` pattern.',
    text: 'The itsy bitsy spider climbed up the water spout',
    expect: d => beatOf(d, 'up') === 'S'
  }
];

/* --------------------------------------------------------------------------
 * Cases reported from the live interface (screenshots, 13 August).
 * Unlike the block above these are directly observable, so they are ordinary
 * regression tests rather than reconstructions.
 * ------------------------------------------------------------------------ */
CASES.push(
  {
    id: 'ui-imagine-intraword-clash',
    why: 'Reported: `imagine an app...`. CMU gives IH2 M AE1 — secondary and ' +
         'primary on adjacent syllables — and the engine beat BOTH, printing ' +
         '`IMAGine`. An intra-word clash is not a possible English reading.',
    text: 'imagine an app that marks the rhythm of text',
    expect: d => {
      const wd = d.words.find(w => w.normalized === 'imagine');
      const beats = wd.syllables.map(s => s.rhythmicStress).join('');
      return beats === 'WSW';                    // i-MAG-ine
    }
  },
  {
    id: 'ui-converse-beat',
    why: 'Reported: `tanner and madison converse` printed `CONverse`. The ' +
         'lexical variant was already correct (verb, primary on -verse); the ' +
         'Rhythm Rule was relocating the BEAT to fill a lapse.',
    text: 'tanner and madison converse',
    expect: d => {
      const wd = d.words.find(w => w.normalized === 'converse');
      return wd.syllables.findIndex(s => s.lexicalStress === '1') === 1 &&
             wd.syllables[1].rhythmicStress === 'S' &&
             wd.syllables[0].rhythmicStress === 'W';
    }
  },
  {
    id: 'doc-tennessee-retraction',
    why: 'The Learn page uses `Tennessee air` as its worked example of stress ' +
         'retraction. The engine produced `tenNESsee AIR` — a beat on the ' +
         'schwa (`T EH2 N AH0 S IY1`), while the secondary-stressed first ' +
         'syllable stayed weak. Retraction must land on a full vowel.',
    text: 'Tennessee air',
    expect: d => {
      const wd = d.words.find(w => w.normalized === 'tennessee');
      return wd.syllables.map(s => s.rhythmicStress).join('') === 'SWW';
    }
  },
  {
    id: 'doc-no-beat-on-schwa',
    why: 'General form of the same constraint: no metrical beat may land on a ' +
         'reduced (AH0) syllable, in any word.',
    text: 'the Tennessee valley and a banana',
    expect: d => d.words.every(w => w.syllables.every(s =>
      !(s.rhythmicStress === 'S' && s.lexicalStress === '0' &&
        (s.phonemes || []).includes('AH0'))))
  },
  {
    id: 'doc-fifteenth-retraction-preserved',
    why: 'The schwa constraint must not block legitimate retraction onto an ' +
         'unstressed but FULL vowel: `fifteenth` is `F IH0 F T IY1 N TH`.',
    text: 'on the fifteenth of May in the jungle of Nool',
    expect: d => {
      const wd = d.words.find(w => w.normalized === 'fifteenth');
      return wd.syllables[0].rhythmicStress === 'S';
    }
  },
  {
    id: 'ui-nucleus-outranks-preposition',
    why: 'Reported: `the girls conversed about school` printed ' +
         '`aBOUT school` — a preposition took a beat while the phrase\'s own ' +
         'nucleus (marked with the teal triangle) did not. FUNCTION_WORDS ' +
         'holds only monosyllables, so `about` was treated as a content word: ' +
         'its second syllable was strong by default, free to beat, and cost ' +
         '6.0 to demote. The output contradicted the prominence marker beside ' +
         'it.',
    text: 'the girls conversed about school',
    expect: d => beatOf(d, 'school') === 'S' && beatOf(d, 'about') === 'W' &&
                 beatOf(d, 'conversed') === 'S' &&
                 d.words.find(w => w.normalized === 'conversed')
                   .syllables[0].rhythmicStress === 'W'
  },
  {
    id: 'ui-forced-dactyl-starts-on-beat',
    why: 'Reported indirectly: choosing a foot did not produce that foot. ' +
         '`forceScansion(dactyl)` on `half a league half a league` chose ' +
         'offset 2 and printed `HALF a LEAGUE half a LEAGUE`, which is not ' +
         'dactylic. A forced scansion must begin on the requested foot.',
    text: 'half a league half a league',
    force: 'dactyl',
    expect: d => d.words.map(w => w.syllables.map(s => s.rhythmicStress)
      .join('')).join('') === 'SWWSWW'
  }
);

let pass = 0;
const rows = [];
for (const c of CASES) {
  let doc = E.analyze(c.text);
  if (c.force) doc = E.forceScansion(doc, c.force);
  let ok = false;
  try { ok = !!c.expect(doc); } catch (e) { ok = false; }
  if (ok) pass++;
  rows.push({ id: c.id, ok, out: render(doc),
              regime: doc.regime && doc.regime.regime, why: c.why });
}

console.log('REVIEW-NAMED CASES (reconstructed — see header)\n' + '='.repeat(70));
for (const r of rows) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  [${r.regime}]`);
  console.log(`        ${r.out}`);
  if (!r.ok) console.log(`        ${r.why}`);
}
console.log('='.repeat(70));
console.log(`${pass}/${CASES.length} reconstructed review cases pass`);
console.log('NOT an original-corpus score. The original 39 items were not supplied.');
