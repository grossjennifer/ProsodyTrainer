/* test_meter_labels.js — engine 3.6.2.
 *
 * The label layer only: no beat is moved by anything tested here.
 *
 * A regular line that ends on a beat used to be labelled
 * "alternating (trochaic/iambic scansions near-equivalent)", because the
 * trochaic scansion (one syllable short at the end) and the iambic one
 * (first syllable set aside) cost the same. The line's opening now settles
 * that tie. Lines that open weak-STRONG and continue in triple time remain a
 * real tie between anapests (iambic opening) and amphibrachs, and say so.
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
const label = (text, opts) => E.analyze(text, opts).meterSummary;
const is = (text, want, opts) => {
  const m = label(text, opts);
  assert.strictEqual(m.label, want, `${text} → ${m.label}`); checks++;
  assert.strictEqual(m.ambiguous, false, text); checks++;
};

// Falling lines that end on a beat (catalexis).
is('Tyger Tyger burning bright', 'predominantly trochaic');
is('In the forests of the night', 'predominantly trochaic');
is('Footprints on the sands of time', 'predominantly trochaic');
is('Twinkle, twinkle, little star, how I wonder what you are', 'predominantly trochaic');
is('All in the valley of Death', 'predominantly dactylic');
is("All the king's horses and all the king's men", 'predominantly dactylic');
is('Just for a handful of silver he left us', 'predominantly dactylic');
is('This is the forest primeval the murmuring pines and the hemlocks',
   'predominantly dactylic');

// Rising lines with an extra weak syllable at the end.
is('To be, or not to be, that is the question', 'predominantly iambic');
is('The little puppy ran away before the children noticed.', 'predominantly iambic');

// Already unambiguous; must stay so.
is('Peter Peter pumpkin eater', 'predominantly trochaic');
is('There once was a man from Nantucket', 'predominantly amphibrachic');
is('On the fifteenth of May in the jungle of Nool', 'predominantly anapestic');
is('Because I could not stop for Death', 'predominantly iambic');

// A real tie is still reported, with two candidates instead of three.
for (const text of [
  'When Horton the elephant heard a small noise',
  'The stockings were hung by the chimney with care'
]) {
  const m = label(text);
  assert.strictEqual(m.ambiguous, true, text); checks++;
  assert.deepStrictEqual(m.ambiguousTypes.slice().sort(),
    ['amphibrach', 'anapest'], `${text} → ${m.ambiguousTypes}`); checks++;
}

// Prose keeps its prose label.
assert.strictEqual(label('Sam fell out of the canoe.').label,
  'prose rhythm (no regular metre)'); checks++;

// The displayed feet agree with the label.
const doc = E.analyze("All the king's horses and all the king's men");
assert.deepStrictEqual(doc.feet.map(f => f.type),
  ['dactyl', 'dactyl', 'dactyl', 'stray-S']); checks++;

console.log(`test_meter_labels.js: ${checks} checks passed.`);
