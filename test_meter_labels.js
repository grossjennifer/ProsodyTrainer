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

// Owner ruling, 17 November 2026 (3.6.11): the anapestic/amphibrachic tie of
// a triple-time line that opens weak-STRONG is settled as anapestic.
for (const text of [
  'When Horton the elephant heard a small noise',
  'The stockings were hung by the chimney with care',
  'In hopes that Saint Nicholas soon would be there',
  'Oh solitude where are the charms'
]) {
  const m = label(text);
  assert.strictEqual(m.ambiguous, false, text); checks++;
  assert.strictEqual(m.label, 'predominantly anapestic', text); checks++;
}
// Other ties are still reported.
{
  const m = label('The Assyrian came down like the wolf on the fold', { textType: 'verse' });
  assert.strictEqual(m.ambiguous, true, 'a different tie is not settled by the ruling'); checks++;
}

// Prose keeps its prose label.
assert.strictEqual(label('Sam fell out of the canoe.').label,
  'prose rhythm (no regular metre)'); checks++;

// The displayed feet agree with the label.
const doc = E.analyze("All the king's horses and all the king's men");
assert.deepStrictEqual(doc.feet.map(f => f.type),
  ['dactyl', 'dactyl', 'dactyl', 'stray-S']); checks++;

// 3.6.9: short lines made of comma-separated phrases.
// A beat closing a line is catalexis, not a foot of another kind.
is('Hickory, dickory, dock', 'predominantly dactylic', { textType: 'verse' });
is('Hickory, dickory, dock.', 'predominantly dactylic', { textType: 'verse' });
is('Hickory, dickory, dock', 'predominantly dactylic');          // auto: was prose
is('Twinkle, twinkle, little star', 'predominantly trochaic');   // auto: was prose
is('Hickory dickory dock', 'predominantly dactylic');            // unchanged without commas
{
  // The beats themselves do not move.
  const b = t => E.analyze(t, { textType: 'auto' }).words.map(w => w.rhythmicPattern).join(' ');
  assert.strictEqual(b('Hickory, dickory, dock'), 'SWW SWW S'); checks++;
  // A seven-syllable comma run inside a longer line still needs eight.
  const d = E.analyze('"Well, what are you doing, then?" John asked.', { textType: 'auto' });
  assert.strictEqual(d.regime.regime, 'prose', 'a comma run inside a sentence is not a line'); checks++;
  // A single-word phrase at the start of a line is not catalexis.
  assert.strictEqual(E.analyze('No, I read this book.', { textType: 'verse' }).meterSummary.label, 'mixed'); checks++;
  // Line edges are recorded on each phrase.
  const p = E.analyze('Hickory, dickory, dock,\nThe mouse ran up the clock.', {}).phrases;
  assert.deepStrictEqual(p.map(x => [x.lineStart, x.lineEnd]),
    [[true, false], [false, false], [false, true], [true, true]]); checks++;
}

console.log(`test_meter_labels.js: ${checks} checks passed.`);
