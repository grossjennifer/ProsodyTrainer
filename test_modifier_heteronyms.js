/* test_modifier_heteronyms.js — engine 3.6.3.
 *
 * Stress-shifting noun/verb pairs with no determiner, cue word or pronoun to
 * decide them. Two facts do the work:
 *   - an adjective is followed by a noun (`fresh PROduce`);
 *   - a bare verb agrees with a plural subject, so after a singular noun the
 *     word heads a compound (`vanilla EXtract`) and after a plural one it is
 *     the verb (`workers proDUCE widgets`).
 * None of these sentences was used to develop the rule except the first
 * three, which are the reported failures and the study's own exemplars.
 */
'use strict';
const assert = require('assert');
global.window = global.window || {};
require('./cmudict.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);

const NOUN = 0, VERB = 1;
const CASES = [
  ['Fresh produce is expensive.', 'produce', NOUN],
  ['Michelle added vanilla extract to her homemade ice cream.', 'extract', NOUN],
  ['Workers produce widgets.', 'produce', VERB],

  ['Local produce tastes better.', 'produce', NOUN],
  ['Lemon extract adds flavor.', 'extract', NOUN],
  ['Fishing permits cost ten dollars.', 'permits', NOUN],
  ['Wheat exports doubled last year.', 'exports', NOUN],
  ['Student protests spread quickly.', 'protests', NOUN],
  ['Birthday presents covered the table.', 'presents', NOUN],
  ['Public transport runs all night.', 'transport', NOUN],
  ['Steady progress pleased the coach.', 'progress', NOUN],
  ['Good conduct earns praise.', 'conduct', NOUN],
  ['The store sells organic produce.', 'produce', NOUN],
  ['Research subjects signed a form.', 'subjects', NOUN],
  ['Crime suspects waited outside.', 'suspects', NOUN],
  ['Music records sold well.', 'records', NOUN],

  ['Farmers produce corn every summer.', 'produce', VERB],
  ['Teachers present new material daily.', 'present', VERB],
  ['Engineers construct bridges.', 'construct', VERB],
  ['Companies import oil from abroad.', 'import', VERB],
  ['Nurses record each dose.', 'record', VERB],
  ['Children often rebel against rules.', 'rebel', VERB],
  ['Sam and Lee conduct the choir.', 'conduct', VERB],
  ['Maria permits no excuses.', 'permits', VERB],
  ['Trucks transport goods overnight.', 'transport', VERB],
  ['Officials suspect fraud.', 'suspect', VERB],
  ['Dentists extract teeth gently.', 'extract', VERB],
  ['Critics object to the cost.', 'object', VERB]
];

/* Known misses, recorded so that nobody mistakes the rule for complete.
 * They are reported, not asserted; move one up when it starts passing. */
const PENDING = [
  ['Our neighbors import furniture.', 'import', VERB,
    'possessive determiner + plural subject + bare object noun'],
  ['The company exports grain.', 'exports', VERB,
    'determiner + singular subject + -s verb'],
  ['Anna exports wine to Canada.', 'exports', VERB,
    'proper-noun subject + -s verb, with a later `to`']
];

const stressed = (text, word) => {
  const d = E.analyze(text, { textType: 'prose' });
  const w = d.words.find(x => x.normalized === word);
  return w.syllables.findIndex(s => String(s.lexicalStress) === '1');
};

let checks = 0;
for (const [text, word, want] of CASES) {
  assert.strictEqual(stressed(text, word), want,
    `${text} — ${word} should be the ${want === NOUN ? 'noun' : 'verb'}`);
  checks++;
}
let stillPending = 0;
for (const [text, word, want, why] of PENDING) {
  if (stressed(text, word) === want) console.log(`  NOW PASSES  ${text}`);
  else { stillPending++; console.log(`  pending     ${text}  (${why})`); }
}
console.log(`test_modifier_heteronyms.js: ${checks} checks passed, ` +
  `${stillPending} pending.`);
