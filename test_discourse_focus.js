'use strict';
/* Discourse focus (engine 3.6.0, opt-in via config.discourseFocus).
 * Uses the owner's original canoe pair (12 Nov 2026), which is worded
 * differently from the focus corpus items, plus guards: focus is off by
 * default, a phrase whose content is all given keeps the ordinary nucleus,
 * and the rules leave beats/nucleus untouched when the option is off. */
const assert = require('assert');
global.window = global.window || {};
require('./cmudict.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(global.window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);
let checks = 0;
const ON = { discourseFocus: true };
function lastNucleus(text, cfg) {
  const d = E.analyze(text, cfg);
  const ip = d.phrases[d.phrases.length - 1];
  return { word: d.words[ip.nucleus.word].normalized, source: ip.nucleus.source };
}
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };

const A = 'Susan and Sam went for a canoe ride. The river was turbulent. Susan stood up ' +
  'to change positions, hoping to steady the canoe. It rocked, and someone fell out. ' +
  'Sam fell out of the canoe.';
const B = 'Susan and Sam went for a canoe ride. The river was turbulent and the canoe ' +
  'rocked. Hoping to steady it, Sam stood up to change positions, and lost his ' +
  'balance. Sam fell out of the canoe.';

// Off by default: the ordinary last-content-word nucleus, in both stories.
eq(lastNucleus(A).word, 'canoe', 'default: nucleus on canoe (A)');
eq(lastNucleus(B).word, 'canoe', 'default: nucleus on canoe (B)');
eq(E.analyze(A).config.discourseFocus, false, 'discourseFocus defaults to false');

// On: SAM fell out (answers "someone fell out"); Sam FELL out (only "fell" is new).
eq(lastNucleus(A, ON), { word: 'sam', source: 'rule:answer-focus' }, 'A: SAM fell out');
eq(lastNucleus(B, ON), { word: 'fell', source: 'rule:givenness' }, 'B: Sam FELL out');

// No context: nothing is given, so the ordinary nucleus stands.
eq(lastNucleus('Sam fell out of the canoe.', ON).word, 'canoe', 'no context: CANOE');

// All content given and no question raised: keep the default, do not guess.
eq(lastNucleus('The dog chased the cat. Then the cat chased the dog.', ON),
  { word: 'dog', source: 'rule:nuclear-stress' }, 'all given: default stands');

// Function-word focus.
eq(lastNucleus('Can either of you swim? He can.', ON).word, 'he', 'which-question: HE can');
eq(lastNucleus('She told him to eat. He can.', ON),
  { word: 'can', source: 'rule:ellipsis-polarity' }, 'ellipsis: He CAN');
eq(lastNucleus('Did you read that book? No, I read this book.', ON),
  { word: 'this', source: 'rule:demonstrative-contrast' }, 'I read THIS book');

// Light nouns are given: the BEST kind.
eq(lastNucleus('Sue said orange jelly beans tasted funny. Steve said orange jelly beans are the best kind.', ON).word,
  'best', 'the BEST kind');

// Off is byte-identical to not passing the option at all.
eq(JSON.stringify(E.analyze(A, { discourseFocus: false }).words),
   JSON.stringify(E.analyze(A).words), 'explicit off == default');
console.log(checks + ' discourse-focus checks passed.');
