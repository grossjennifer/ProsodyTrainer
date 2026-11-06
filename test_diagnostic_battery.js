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
  // `before` alone was WW until Nov 2026; a two-syllable function word with
  // nothing competing now keeps its stressed syllable as a beat (see F below).
  for (const [text, lexical, beats] of [
    ['before', '01', 'WS'], ['unopened', '010', 'WSW'],
    ['machine', '01', 'WS'], ['afternoon', '201', 'WWS'], ['banana', '010', 'WSW']
  ]) {
    const w = word(analyze(text), text);
    assert.strictEqual(w.lexicalPattern, lexical, text + ' lexical');
    assert.strictEqual(w.rhythmicPattern, beats, text + ' beats');
  }
  assert.deepStrictEqual(word(analyze('unopened'), 'unopened').syllables.map(s => s.text), ['un', 'o', 'pened']);
  // F: polysyllabic function words keep their stressed syllable as a beat
  // when nothing competes for it, and give it up when an adjacent beat or the
  // meter needs the slot. Owner's report: in prose, `ran away before the
  // children` came out `aWAY before the` — a lapse over a full-vowel `fore`.
  for (const [text, type, target, beats] of [
    ['The little puppy ran away before the children noticed.', 'prose', 'before', 'WS'],
    ['The little puppy ran away before the children noticed.', 'auto', 'before', 'WS'],
    ['She left before the party ended.', 'prose', 'before', 'WS'],
    ['He walked along the river until dark.', 'prose', 'along', 'WS'],
    // ...and still yields where it must:
    ['Twas the night before Christmas when all through the house', 'verse', 'before', 'WW'],
    ['The girls conversed about school.', 'prose', 'about', 'WW'],
    ['I told him that the parcel had arrived before lunch.', 'prose', 'before', 'WW'],
    ['He walked along the river until dark.', 'prose', 'until', 'WW'],
    ['Wondering, wandering, amateur science is fun, although answers are tricky to find', 'verse', 'although', 'WW']
  ]) {
    assert.strictEqual(word(analyze(text, type), target).rhythmicPattern, beats,
      `${target} in "${text}" (${type})`);
  }
  // G: stranded function words. A phrase-final auxiliary, copula,
  // preposition or particle cannot reduce (`what you ARE`, not *what you're),
  // so it takes a beat unless a neighbouring beat needs the slot. Owner's
  // report: Twinkle under Ordinary prose ended `WONder what you are`.
  // Object pronouns are excluded and stay weak.
  for (const [text, type, target, beats] of [
    ['Twinkle, twinkle, little star, how I wonder what you are.', 'prose', 'are', 'S'],
    ['Twinkle, twinkle, little star, how I wonder what you are.', 'auto', 'are', 'S'],
    ['I know where he is.', 'prose', 'is', 'S'],
    ['What are you looking at?', 'prose', 'at', 'S'],
    ['Where are you from?', 'prose', 'from', 'S'],
    // ...yields to an adjacent beat, and pronouns stay weak:
    ['Who did you go with?', 'prose', 'with', 'W'],
    ['I want to.', 'prose', 'to', 'W'],
    ['I saw him.', 'prose', 'him', 'W'],
    ['He gave it to her.', 'prose', 'her', 'W'],
    // ...and a phrase-INTERNAL function word is untouched:
    ['What are you looking at?', 'prose', 'are', 'W']
  ]) {
    const d = analyze(text, type);
    const w = d.words.filter(x => x.normalized === target).pop();
    assert.strictEqual(w.rhythmicPattern, beats, `${target} in "${text}" (${type})`);
  }
  // H: inflected forms missing from CMU take the base word's pronunciation
  // plus the regular ending, so stress stays where the base has it. Before
  // this, `exhales` fell to the spelling heuristic as EX·ha·les (three
  // syllables, wrong stress). Only the word-level fix is asserted for the
  // kettle line; whether `clicks` also beats is a disputed reading.
  for (const [w, lexical, nSyl] of [
    ['exhales', '01', 2], ['inhales', '21', 2], ['reshapes', '01', 2],
    ['fringed', '1', 1], ['unicorns', '102', 3]
  ]) {
    const a = E.analyzeWord(w);
    assert.strictEqual(a.lexicalPattern, lexical, w + ' lexical (inflection of base)');
    assert.strictEqual(a.syllables.length, nSyl, w + ' syllable count');
    assert.strictEqual(a.lexicalSource, 'CMU', w + ' derived from the dictionary, not guessed');
  }
  for (const w of ['bus', 'yes', 'species', 'Texas'])   // listed words: untouched
    assert.notStrictEqual(E.analyzeWord(w).lexicalRule, 'inflection-of-base', w);
  {
    const d = analyze('The kettle clicks off and the kitchen exhales.', 'prose');
    assert.strictEqual(d.words.reduce((n, x) => n + x.syllables.length, 0), 11,
      'kettle line has eleven syllables');
    assert.strictEqual(word(d, 'exhales').rhythmicPattern, 'WS', 'kettle line ends exHALES');
  }
  // I: regime detection on deliberately metrical prose (A. J. Hartley's
  // iambic paragraph): Let it decide finds the beat, Ordinary prose does not
  // impose one, and the three regular lines scan as clean iambs.
  {
    const hartley = 'The finest writing seems to have a way of catching both the ' +
      'reader’s eyes and ears, so that the natural resonance of words ' +
      'constructs a rhythm in the reader’s mind.';
    assert.strictEqual(analyze(hartley, 'auto').regime.regime, 'metrical', 'Hartley: auto finds a beat');
    assert.strictEqual(analyze(hartley, 'prose').regime.regime, 'prose', 'Hartley: prose stays prose');
    const iambs = d => d.words.map(w => w.syllables.map(s => s.rhythmicStress).join('')).join('');
    for (const line of ['The finest writing seems to have a way',
                        'Of catching both the reader’s eyes and ears,',
                        'Constructs a rhythm in the reader’s mind.'])
      assert.strictEqual(iambs(analyze(line, 'auto')), 'WSWSWSWSWS', 'Hartley iambic: ' + line);
  }
  // J: metrical syncope. In verse the dictionary's contracted variant is
  // used when it fits the beat (ev'ry), displayed with the stressed
  // syllable's spelling intact (EV·ery); prose and prose-like text keep the
  // full form, and contraction never turns prose into verse.
  {
    const hia = 'Then the little Hiawatha learned of every bird its language.';
    const v = analyze(hia, 'verse');
    assert.strictEqual(v.words.map(w => w.syllables.map(s => s.rhythmicStress).join('')).join(''),
      'SWSWSWSWSWSWSWSW', 'Hiawatha (verse) is trochaic');
    assert.deepStrictEqual(word(v, 'every').syllables.map(s => s.text), ['ev', 'ery'], 'ev·ery display');
    assert.strictEqual(word(v, 'every').lexicalRule, 'metrical-syncope');
    assert.strictEqual(word(analyze(hia, 'prose'), 'every').syllables.length, 3, 'prose keeps ev·er·y');
    const cam = analyze('I bought a camera and some chocolate for the general.', 'auto');
    assert.strictEqual(cam.regime.regime, 'prose', 'contraction cannot turn prose into verse');
    assert.strictEqual(word(cam, 'camera').syllables.length, 3, 'camera keeps three syllables in prose');
  }
  // K: Horton (Seuss), line 1 — anapestic, matches the owner's marking.
  assert.strictEqual(analyze('I meant what I said and I said what I meant.', 'auto').words
    .map(w => w.syllables.map(s => s.rhythmicStress).join('')).join(''),
    'WSWWSWWSWWS', 'Horton line 1 anapestic (headless first foot: i MEANT)');
  // L: Yertle (Seuss), the owner's own marking, as one couplet:
  //   and toDAY the great YERtle, that MARvelous HE
  //   is KING of the MUD. That is ALL he can SEE.
  // Must hold in every mode.
  for (const mode of ['auto', 'verse', 'prose']) {
    const d = analyze('And today the Great Yertle, that marvelous he\n' +
      'Is King of the Mud. That is all he can see.', mode);
    assert.strictEqual(d.words.map(w => w.syllables.map(s => s.rhythmicStress).join('')).join(''),
      'WWSWWSWWSWWS' + 'WSWWSWWSWWS', 'Yertle couplet, owner marking (' + mode + ')');
  }
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
    assert.strictEqual(d.engineBuild, '3.3.3');
  }
  E.loadDictionary({ MACHINE: 'M AH0 SH IY1 N' }, 'custom');
  assert.strictEqual(analyze('machine').dictionaryMetadata, null, 'custom dictionaries must not inherit bundled provenance');
  console.log(engine + ': all 16 diagnostic cases and export provenance checks passed');
}
