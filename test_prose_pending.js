/* ============================================================================
 * test_prose_pending.js — known errors, tracked but not yet fixed.
 * ----------------------------------------------------------------------------
 * Each case is a single beat that is clearly wrong in Ordinary prose, taken
 * from the Nov 2026 prose set. They share one cause: prose mode charges an
 * interior run of three weak syllables (LAPSE 0.80) more than promoting a
 * function word (0.55–0.90), so it beats `to` / `it's` instead of leaving a
 * short lapse. Fixing that means retuning prose weights, which waits for the
 * owner's hand-marked prose sentences; tuning to these few by feel would
 * risk the verse corpus.
 *
 * One verse case is also tracked: Hiawatha on Let it decide is still read as
 * prose. On Verse it is fixed by metrical syncope (ev'ry), but contraction is
 * deliberately not allowed to turn prose into verse, because its gain cannot
 * tell a poem from an accidental iamb. Fixing it needs better regime
 * evidence, not looser contraction.
 *
 * Only the undisputed part of each line is checked. Neighbouring beats that
 * the source marking also claimed (STUCK REcord, THINK CLEARly) put two beats
 * side by side and are disputed, so they are not asserted here.
 *
 * Behaviour: prints each case. Exits 0 while cases are still pending, so the
 * suite stays green. If a case STARTS passing, it says so loudly: move it
 * into test_diagnostic_battery.js so it is protected from then on.
 * Run with --strict to exit non-zero while any case is still pending.
 * ========================================================================== */
'use strict';

global.window = global.window || {};
require('./cmudict.js');
require('./known-rhythms.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');
E.loadKnownReadings(window.PROSODY_KNOWN_READINGS);

const show = d => d.words.map(w => w.syllables.map(s =>
  s.rhythmicStress === 'S' ? s.text.toUpperCase() : s.text.toLowerCase()).join('')).join(' ');

// [text, word, which occurrence (0-based), expected rhythmic pattern, why, mode]
const CASES = [
  ['Listen to what is happening.', 'to', 0, 'W',
    '`to` takes the beat in LISten TO what'],
  ['It’s like a stuck record.', "it's", 0, 'W',
    'the contraction `it’s` takes the beat; `like` loses it'],
  ['To think clearly is to live deeply.', 'to', 1, 'W',
    'the second `to` takes the beat in is TO live'],
  ['Then the little Hiawatha learned of every bird its language.', 'then', 0, 'S',
    'Let it decide reads the trochaic line as prose (THEN loses its beat)', 'auto'],
  ['And today the Great Yertle, that marvelous he', 'he', 0, 'S',
    'line alone on Verse: noun use of `he` (that marvelous HE) stays weak', 'verse'],
];
// Regime cases: the passage should be read as having a regular beat.
const REGIME_CASES = [
  ['And today the Great Yertle, that marvelous he\nIs King of the Mud. That is all he can see.',
    'Let it decide calls the anapestic couplet prose, though every beat is right; ' +
    'the line break is not used as evidence of verse'],
];

let pending = 0, fixed = 0;
for (const [text, target, nth, beats, why, mode = 'prose'] of CASES) {
  const d = E.analyze(text, { textType: mode });
  const hits = d.words.filter(w => w.normalized.replace(/’/g, "'") === target);
  const w = hits[nth];
  const got = w ? w.rhythmicPattern : '(word not found)';
  if (got === beats) {
    fixed++;
    console.log(`  NOW PASSES  ${text}  →  ${show(d)}`);
    console.log('              Move this case into test_diagnostic_battery.js.');
  } else {
    pending++;
    console.log(`  pending     ${text}  →  ${show(d)}   (${why})`);
  }
}
for (const [text, why] of REGIME_CASES) {
  const d = E.analyze(text, { textType: 'auto' });
  const label = text.replace(/\n/g, ' / ');
  if (d.regime.regime === 'metrical') {
    fixed++;
    console.log(`  NOW PASSES  ${label}  →  metrical`);
    console.log('              Move this case into test_diagnostic_battery.js.');
  } else {
    pending++;
    console.log(`  pending     ${label}  →  ${d.regime.regime}   (${why})`);
  }
}
console.log(`test_prose_pending.js: ${pending} pending, ${fixed} now passing ` +
  `(of ${CASES.length + REGIME_CASES.length}). Informational unless --strict.`);
if (process.argv.includes('--strict') && pending) process.exit(1);
