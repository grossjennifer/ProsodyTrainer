/* test_sentence_layout.js — engine 3.6.1.
 *
 * Two linked rules:
 *   1. Let it decide: a lone punctuated sentence is read as verse only when
 *      the grid is corroborated (its own stresses already alternate, or two
 *      phrases agree). A grid bought by promoting function words is not
 *      evidence of metre.
 *   2. Verse / Song: the chosen text type fixes the regime but still receives
 *      the metre prior that auto derives, so a chosen Verse reading is never
 *      worse than the automatic one. The rhythm-measure candidates rely on
 *      this: they are verse lines laid out as sentences and are analysed with
 *      the text type set explicitly.
 */
'use strict';
const assert = require('assert');
global.window = global.window || {};
require('./cmudict.js');
require('./known-rhythms.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);

let checks = 0;
const eq = (a, b, m) => { assert.strictEqual(a, b, m); checks++; };
const beat = (d, word, nth = 0) =>
  d.words.filter(w => w.normalized === word)[nth].syllables[0].rhythmicStress;
const show = d => d.words.map(w => w.syllables.map(s =>
  s.rhythmicStress === 'S' ? s.text.toUpperCase() : s.text.toLowerCase()).join('')).join(' ');

// 1a. Ordinary sentences are prose under Let it decide.
for (const text of [
  'Sam fell out of the canoe.',
  'She ran away before the children could find her.',
  'We went to the store to buy some milk and bread.',
  'I told him that the parcel had arrived before lunch.',
  'The committee has not yet decided whether to approve the proposal.',
  'This is a test sentence.',
  'Can you tell me where the library is?'
]) {
  const d = E.analyze(text);
  eq(d.regime.regime, 'prose', `${text} → ${show(d)}`);
  eq(d.regime.sentenceLayout, true, text);
  eq(d.regime.corroborated, false, text);
}
let d = E.analyze('Sam fell out of the canoe.');
eq(beat(d, 'the'), 'W', 'no beat on the article: ' + show(d));
d = E.analyze('She ran away before the children could find her.');
eq(beat(d, 'could'), 'W', show(d));
eq(beat(d, 'her'), 'W', show(d));
eq(beat(d, 'find'), 'S', show(d));
d = E.analyze('We went to the store to buy some milk and bread.');
eq(beat(d, 'we'), 'W', show(d));
eq(beat(d, 'went'), 'S', show(d));

// 1b. A sentence whose own stresses already alternate keeps its regular beat.
d = E.analyze('The little puppy ran away before the children noticed.');
eq(d.regime.regime, 'metrical', 'strain-free sentence');
eq(d.regime.corroborated, true);

// 1c. Two agreeing phrases corroborate a punctuated line.
d = E.analyze('Twinkle, twinkle, little star, how I wonder what you are.');
eq(d.regime.regime, 'metrical');
eq(beat(d, 'what'), 'S', show(d));

// 1d. Layout that says "line of verse" is untouched: no full stop, or a
// line break between words.
d = E.analyze('Do not go gentle into that good night');
eq(d.regime.regime, 'metrical');
eq(d.regime.sentenceLayout, undefined);
eq(beat(d, 'not'), 'S', show(d));
d = E.analyze('Shall I compare thee to a summer\'s day?\nThou art more lovely and more temperate.');
eq(d.config.sentenceLayout, false, 'a line break means lines, not sentences');
eq(d.regime.regime, 'metrical');

// 1e. A registered verse text is verse however it is punctuated.
E.loadKnownReadings(window.PROSODY_KNOWN_READINGS);
d = E.analyze('When Horton the elephant heard a small noise.');
eq(d.config.sentenceLayout, false);
eq(d.regime.regime, 'metrical');
E.loadKnownReadings([]);

// 1f. The caller cannot set the layout flag.
d = E.analyze('Sam fell out of the canoe.', { sentenceLayout: false });
eq(d.config.sentenceLayout, true);

// 2a. Verse fixes the regime and still gets the metre prior.
d = E.analyze('She can carry baskets after breakfast.', { textType: 'verse' });
eq(d.regime.regime, 'metrical');
eq(d.regime.reason, 'user:verse');
eq(beat(d, 'she'), 'S', show(d));
eq(beat(d, 'can'), 'W', show(d));
d = E.analyze('They will return the book before the dawn.', { textType: 'song' });
eq(d.regime.reason, 'user:verse', 'song is accepted and analysed as verse');
eq(d.config.textType, 'verse');
eq(beat(d, 'will'), 'S', show(d));
eq(beat(d, 'they'), 'W', show(d));
// The same line under Let it decide is now prose.
eq(E.analyze('She can carry baskets after breakfast.').regime.regime, 'prose');

// 2b. Moved here from test_prose_pending.js, where it started passing.
d = E.analyze('And today the Great Yertle, that marvelous he', { textType: 'verse' });
eq(beat(d, 'he'), 'S', 'that marvelous HE: ' + show(d));

// 2c. A grid found across one comma-linked run is not imposed on a phrase
// outside that run.
d = E.analyze('The mouse ran up the clock. Not a creature was stirring, not even a mouse.',
  { textType: 'verse' });
eq(beat(d, 'mouse'), 'S', show(d));
eq(beat(d, 'ran'), 'W', show(d));
eq(beat(d, 'up'), 'S', show(d));
eq(beat(d, 'creature'), 'S', show(d));

console.log(`test_sentence_layout.js: ${checks} checks passed.`);
