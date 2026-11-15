/* test_text_handling.js — engine 3.6.4.
 *
 * Text the engine used to mishandle before any rhythm was computed:
 *   - accented letters split a word (`café` → `caf` + a stray `é`);
 *   - a hyphenated word listed whole in the dictionary lost its hyphen and
 *     was divided across it (`wel·lknown`, `moth·e·rin·law`);
 *   - a stressed final -lle was divided as a syllabic l (`Miche·lle`);
 *   - `song` was a separate text type that never gave a different reading.
 * 3.6.5 adds: every silent -lle ending (`Nashvi·lle`), and Mc- names, which
 * were split evenly by length (`mcd·ona·ld`).
 */
'use strict';
const assert = require('assert');
global.window = global.window || {};
require('./cmudict.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);

let checks = 0;
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };
const word = (text, w) => E.analyze(text, { textType: 'prose' }).words
  .find(x => x.word.toLowerCase() === w.toLowerCase());
const sylls = (text, w) => word(text, w).syllables.map(s => s.text);
const primary = (text, w) => word(text, w).syllables
  .findIndex(s => String(s.lexicalStress) === '1');

// Accented letters: one word, the typed letters shown, the dictionary used.
eq(sylls('The café was open.', 'café'), ['ca', 'fé']);
eq(primary('The café was open.', 'café'), 1);
eq(word('The café was open.', 'café').lexicalSource, 'CMU');
eq(sylls('A naïve question.', 'naïve'), ['naï', 've']);
eq(sylls('She saw the façade.', 'façade'), ['fa', 'çade']);
eq(sylls('He sent a résumé.', 'résumé').length, 3, 'a final é is sounded');
eq(primary('He sent a résumé.', 'résumé'), 0);
eq(sylls('They will resume work.', 'resume').length, 2, 'unaccented verb unchanged');
eq(primary('They will resume work.', 'resume'), 1);

// The tokenizer stays lossless with accented text.
const text = 'The café served a naïve résumé writer — über-cool!\nNew line.';
eq(E.analyze(text).tokens.map(t => t.text).join(''), text);

// Hyphenated words: divided part by part, hyphen kept, dictionary stress kept.
eq(sylls('Her well-known friend.', 'well-known'), ['well-', 'known']);
eq(sylls('His mother-in-law called.', 'mother-in-law'), ['moth', 'er-', 'in-', 'law']);
eq(sylls('She is twenty-one.', 'twenty-one'), ['twen', 'ty-', 'one']);
eq(primary('His mother-in-law called.', 'mother-in-law'), 0);

// A stressed final -lle is a silent e, not a syllabic l.
eq(sylls('Michelle called.', 'Michelle'), ['mi', 'chelle']);
eq(sylls('A gazelle ran.', 'gazelle'), ['ga', 'zelle']);
// ...and the ordinary consonant + le ending is untouched.
eq(sylls('The little table.', 'little'), ['lit', 'tle']);
eq(sylls('The little table.', 'table'), ['ta', 'ble']);
eq(sylls('It is possible.', 'possible'), ['pos', 'si', 'ble']);

// 3.6.5 — a final -lle with a silent e is never a syllable of its own.
eq(sylls('We drove to Nashville.', 'Nashville'), ['nash', 'ville']);
eq(sylls('A vaudeville act.', 'vaudeville'), ['vaude', 'ville']);
eq(sylls('We drove to Crossville.', 'Crossville'), ['cross', 'ville']);
eq(sylls('We drove to Belleville.', 'Belleville'), ['belle', 'ville']);
eq(sylls('We drove to Jacksonville.', 'Jacksonville'), ['jack', 'son', 'ville']);
eq(sylls('Danielle called.', 'Danielle'), ['dan', 'i', 'elle']);
eq(sylls('Gabrielle called.', 'Gabrielle'), ['gab', 'ri', 'elle']);
eq(sylls('The Bastille fell.', 'Bastille'), ['bas', 'tille']);
// A sounded ending is not treated as silent.
eq(sylls('They played reveille.', 'reveille').length, 3);
// Stress is untouched by any of this: only the division moved.
eq(primary('We drove to Nashville.', 'Nashville'), 0);
eq(primary('Danielle called.', 'Danielle'), 2);

// 3.6.5 — Mc- is a syllable with no vowel letter.
eq(sylls('Ask McDonald.', 'McDonald'), ['mc', 'do', 'nald']);
eq(sylls('Ask McCarthy.', 'McCarthy'), ['mc', 'car', 'thy']);
eq(sylls('Ask McIntosh.', 'McIntosh'), ['mc', 'in', 'tosh']);
eq(sylls('Ask McKinley.', 'McKinley'), ['mc', 'kin', 'ley']);
eq(primary('Ask McDonald.', 'McDonald'), 1);

// Song is accepted and analysed as verse.
const line = 'Mary had a little lamb.';
const beats = d => d.words.map(w => w.syllables.map(s => s.rhythmicStress).join('')).join(' ');
const asSong = E.analyze(line, { textType: 'song' });
eq(asSong.config.textType, 'verse');
eq(beats(asSong), beats(E.analyze(line, { textType: 'verse' })));

console.log(`test_text_handling.js: ${checks} checks passed.`);
