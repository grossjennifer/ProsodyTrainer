'use strict';
const assert = require('assert');
const crypto = require('crypto');
global.window = {};
require('./cmudict.js');
require('./cmudict-subset.js');
require('./known-rhythms.js');
const word = (d, text) => d.words.find(w => w.normalized === text);
const nuclei = d => d.words.filter(w => w.syllables.some(s => s.phraseProminence === 'nucleus')).map(w => w.normalized);

for (const engine of ['./rhythm-reader/engine.js', './rhythm-reader-pro/engine.js']) {
  const E = require(engine);
  E.loadDictionary(window.CMUDICT_FULL, 'full');
  E.loadKnownReadings(window.PROSODY_KNOWN_READINGS);
  const analyze = (text, textType = 'prose', extra = {}) => E.analyze(text, { textType, ...extra });
  // A: dictionary information and realized beats are different assertions.
  for (const [text, lexical, beats] of [
    ['before', '01', 'WW'], ['unopened', '010', 'WSW'],
    ['machine', '01', 'WS'], ['afternoon', '201', 'WWS'], ['banana', '010', 'WSW']
  ]) {
    const w = word(analyze(text), text);
    assert.strictEqual(w.lexicalPattern, lexical, text + ' lexical');
    assert.strictEqual(w.rhythmicPattern, beats, text + ' beats');
  }
  assert.deepStrictEqual(word(analyze('unopened'), 'unopened').syllables.map(s => s.text), ['un', 'o', 'pened']);
  // B: preserve licensed retraction and content-word demotion.
  for (const [text, target, beats] of [
    ['Tennessee air', 'tennessee', 'SWW'], ['thirteen men', 'thirteen', 'SW'],
    ['the wide lake', 'wide', 'W']
  ]) assert.strictEqual(word(analyze(text), target).rhythmicPattern, beats, text);
  for (const [text, target] of [['Tennessee air', 'air'], ['thirteen men', 'men'], ['the wide lake', 'lake']])
    assert.strictEqual(word(analyze(text), target).rhythmicPattern, 'S');
  // C: retain positional nuclei; do not silently install adjunct deaccenting.
  assert.deepStrictEqual(nuclei(analyze('The researcher checked the final page before lunch.')), ['lunch']);
  assert.deepStrictEqual(nuclei(analyze('The teacher placed the books beside the window.')), ['window']);
  // D: also test without registered readings so lookup cannot hide a failure.
  for (const [text, target] of [
    ['There are four seasons in the mind of man.', 'in'],
    ['In the forests of the night', 'of'],
    ["Will be a totter'd weed of small worth held.", 'be']
  ]) for (const useKnownReadings of [true, false]) {
    const d = analyze(text, 'verse', { useKnownReadings });
    assert.strictEqual(word(d, target).rhythmicPattern, 'S', text);
  }
  // E: lexical selection must survive the rhythm pass, with clash on AND off.
  for (const [text, target, lexical, beats] of [
    ['Alicia will permit John to borrow her car.', 'permit', '01', 'WS'],
    ['Joaquin must have a permit to drive.', 'permit', '12', 'SW'],
    ['The converse of sad is happy.', 'converse', '10', 'SW']
  ]) for (const clashSubordination of [true, false]) {
    const w = word(analyze(text, 'prose', { clashSubordination }), target);
    assert.strictEqual(w.lexicalPattern, lexical, text + ' lexical');
    assert.strictEqual(w.rhythmicPattern, beats, text + ' beats');
  }
  // Fingerprints identify the exact payload; metadata must not become a word.
  for (const [dict, kind] of [[window.CMUDICT_FULL, 'full'], [window.CMUDICT_SUBSET, 'subset']]) {
    const entries = Object.keys(dict).sort().map(key => [key, dict[key]]);
    const hash = crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
    E.loadDictionary(dict, kind);
    const d = analyze('machine');
    assert.strictEqual(d.dictionaryMetadata.sha256, hash);
    assert.strictEqual(d.dictionaryMetadata.entries, entries.length);
    assert.strictEqual(d.dictionaryMetadata.upstreamRelease, null);
    assert(E.toCSV(d).includes(hash));
    assert(E.profileCSV(d).includes(hash));
    assert.strictEqual(JSON.parse(JSON.stringify(d)).dictionaryMetadata.sha256, hash);
    assert.strictEqual(d.engineBuild, '3.2.1');
  }
  E.loadDictionary({ MACHINE: 'M AH0 SH IY1 N' }, 'custom');
  assert.strictEqual(analyze('machine').dictionaryMetadata, null, 'custom dictionaries must not inherit bundled provenance');
  console.log(engine + ': all 16 diagnostic cases and export provenance checks passed');
}
