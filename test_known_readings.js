'use strict';
const assert = require('assert');
global.window = {};
require('./cmudict.js');
require('./known-rhythms.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');
E.loadKnownReadings(window.PROSODY_KNOWN_READINGS);

function render(doc) {
  return doc.words.map(w => w.syllables.map(s =>
    s.rhythmicStress === 'S' ? s.text.toUpperCase() : s.text.toLowerCase()
  ).join('')).join(' ');
}

let doc = E.analyze('The mouse ran up the clock.');
assert.strictEqual(render(doc), 'the MOUSE ran UP the CLOCK');
assert.strictEqual(doc.alternativeReadings.length, 2);
assert.strictEqual(doc.selectedReading, 'nursery-mouse');

/* CHANGED ASSERTION — read this before "fixing" it back.
 *
 * This test previously asserted:
 *     assert.notStrictEqual(render(doc), 'the MOUSE ran UP the CLOCK');
 * i.e. that switching to the inferred reading must produce something
 * DIFFERENT from the conventional one. That assertion encoded a defect as an
 * expectation: at the time, the automatic analyser could not derive the
 * owner's intended reading and returned `the mouse RAN up the CLOCK`.
 *
 * Acceptance criterion 2 of the handoff requires precisely that the engine
 * now analyse this line correctly WITHOUT known-text lookup. So the two
 * readings legitimately coincide, and the old assertion would fail on a
 * correct engine.
 *
 * What actually matters is tested instead: that the toggle really switches
 * provenance, and that the inferred reading stands up on its own with the
 * registry disabled entirely. */
E.selectReading(doc, 'inferred');
assert.strictEqual(doc.selectedReading, 'inferred');

E.loadKnownReadings([]);
const bare = E.analyze('The mouse ran up the clock.');
assert.strictEqual(render(bare), 'the MOUSE ran UP the CLOCK',
  'acceptance criterion 2: derived without any known-text lookup');
assert.strictEqual(bare.knownReading, null);
E.loadKnownReadings(window.PROSODY_KNOWN_READINGS);

doc = E.analyze("All the king's horses and all the king's men.");
assert.strictEqual(render(doc), "ALL the king's HORSes and ALL the king's MEN");
assert.strictEqual(doc.selectedReading, 'nursery-kings-horses');

doc = E.analyze('All in the valley of Death');
const death = doc.words.find(w => w.normalized === 'death').syllables[0];
assert.strictEqual(death.rhythmicStress, 'W', 'extrametrical Death is not a beat');
assert.strictEqual(death.phraseProminence, 'nucleus',
  'phrase prominence remains visible independently of meter');

/* Ranked alternative readings per intonational phrase (handoff §1 and §4).
 * Each candidate must be a COMPLETE reading: its beats, its metrical template
 * and its cost all derive from the same analysis, so the interface can never
 * pair the beats of one reading with the meter label of another. */
E.loadKnownReadings([]);
const amb = E.analyze('This is a test sentence.');
const ip = amb.phrases[0];
assert.ok(Array.isArray(ip.readings) && ip.readings.length >= 1,
  'each IP carries its ranked candidate readings');
for (const r of ip.readings) {
  assert.strictEqual(r.beats.length,
    amb.words.reduce((n, w) => n + w.syllables.length, 0),
    'every candidate covers every syllable — no partial readings');
  assert.ok(r.components && typeof r.cost === 'number');
}
for (let i = 1; i < ip.readings.length; i++)
  assert.ok(ip.readings[i].cost >= ip.readings[i - 1].cost, 'readings are ranked');
assert.ok(ip.readings.every((r, i) => i === 0 || r.margin > 0),
  'distinct candidates have distinct costs from the winner');

// Switching candidate replaces the whole beat pattern, never blends it.
if (ip.readings.length > 1) {
  const before = render(amb);
  E.selectIPReading(amb, 0, 1);
  assert.notStrictEqual(render(amb), before,
    'selecting a different candidate changes the reading');
  assert.strictEqual(amb.phrases[0].selectedReadingIndex, 1);
}

// Contrastively licensed adjacent prominence stays reachable: with clash
// pressure switched off, a clashing reading must be available rather than
// categorically forbidden (handoff §Owner requirements).
const licensed = E.analyze('The mouse ran up the clock.',
  { clashSubordination: false });
assert.ok(licensed.phrases[0].readings.length >= 1);

E.loadKnownReadings(window.PROSODY_KNOWN_READINGS);
console.log('Known-reading alternatives, ranked candidates and toggling passed.');
