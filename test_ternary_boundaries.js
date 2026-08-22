'use strict';

const assert = require('assert');
global.window = {};
require('./cmudict.js');
require('./known-rhythms.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');
E.loadKnownReadings(window.PROSODY_KNOWN_READINGS);

const render = doc => doc.words.map(w => w.syllables.map(s =>
  s.rhythmicStress === 'S' ? s.text.toUpperCase() : s.text.toLowerCase()
).join('')).join(' ');

let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

// A comma ends an intonational phrase but not necessarily the metrical line.
// This must work without the registered Seuss reading.
let doc = E.analyze('On the fifteenth of May, in the jungle of Nool.',
  { useKnownReadings: false });
assert.strictEqual(doc.analysisSource, 'general-inference'); checks++;
assert.strictEqual(doc.regime.regime, 'metrical'); checks++;
assert.strictEqual(doc.regime.evidence, 'weak-boundary-grid'); checks++;
check(/anapestic/.test(doc.meterSummary.label), doc.meterSummary.label);
assert.strictEqual(render(doc),
  'on the FIFteenth of MAY in the JUNgle of NOOL'); checks++;

// Repeated comma-separated dactylic groups accumulate evidence and then
// inform the short phrases that could not determine their own metre.
doc = E.analyze('Half a league, half a league, half a league onward.',
  { useKnownReadings: false });
assert.strictEqual(doc.regime.evidence, 'weak-boundary-grid'); checks++;
check(/dactylic/.test(doc.meterSummary.label), doc.meterSummary.label);
assert.strictEqual(render(doc),
  'HALF a league HALF a league HALF a league ONward'); checks++;

// Strong punctuation really resets the grid.
doc = E.analyze('Half a league. Half a league. Half a league onward.',
  { useKnownReadings: false });
assert.notStrictEqual(doc.regime.evidence, 'weak-boundary-grid'); checks++;
check(doc.phrases.every(ip => ip.boundaryAfter === 'strong'),
  'periods must remain strong boundaries');

// Exact repetition can establish two short ternary cycles. The phrase-final
// nucleus remains visible, but it does not become an extra metrical beat.
doc = E.analyze('Waltz two three, waltz two three.',
  { useKnownReadings: false });
assert.strictEqual(doc.regime.evidence, 'repeated-ternary'); checks++;
check(/dactylic/.test(doc.meterSummary.label), doc.meterSummary.label);
assert.strictEqual(render(doc), 'WALTZ two three WALTZ two three'); checks++;
const finalThree = doc.words[5].syllables[0];
assert.strictEqual(finalThree.rhythmicStress, 'W'); checks++;
assert.strictEqual(finalThree.phraseProminence, 'nucleus'); checks++;
assert.notStrictEqual(doc.meterSummary.regularityConfidence, undefined); checks++;
assert.strictEqual(doc.meterSummary.meterChoiceStatus, 'selected'); checks++;

// Two short prose clauses that happen to alternate are the hard negative:
// binary aggregation requires more evidence than a single comma.
doc = E.analyze('The sun arose, and the birds sang.',
  { useKnownReadings: false });
assert.strictEqual(doc.regime.regime, 'prose'); checks++;
assert.strictEqual(doc.regime.evidence, 'none'); checks++;

// Known readings are explicitly optional and their provenance is inspectable.
const registered = E.analyze('The mouse ran up the clock.');
assert.strictEqual(registered.analysisSource, 'registered-known-reading'); checks++;
assert.strictEqual(registered.knownReading.applied, true); checks++;
const inferred = E.analyze('The mouse ran up the clock.',
  { useKnownReadings: false });
assert.strictEqual(inferred.analysisSource, 'general-inference'); checks++;
assert.strictEqual(inferred.knownReading.applied, false); checks++;

// Literal grid probes stay available for research diagnostics but do not
// appear as reader-facing alternatives.
doc = E.analyze('The sun arose, and the birds sang.',
  { useKnownReadings: false });
const internalLiteral = doc.phrases.some(ip => ip.readings.some(r =>
  r.rank > 0 && r.provenance.split('+').every(s => /^grid-\d-\d:literal$/.test(s))));
const exposedLiteral = doc.phrases.some(ip =>
  (ip.userFacingReadings || []).some(r => r.rank > 0 &&
    r.provenance.split('+').every(s => /^grid-\d-\d:literal$/.test(s))));
check(internalLiteral, 'a literal grid probe should remain in the debug list');
assert.strictEqual(exposedLiteral, false); checks++;

console.log(`${checks} ternary-boundary and provenance checks passed.`);
