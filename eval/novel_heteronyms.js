/* eval/novel_heteronyms.js — heteronyms in contexts NOT used to build the
 * rules. The review's point: strong scores on the stimulus phrases prove
 * little if `minute` only works before the literal word `details`. */
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
global.window = global.window || {};
require(path.join(ROOT, 'cmudict.js'));
require(path.join(ROOT, 'known-rhythms.js'));
const E = require(path.join(ROOT, 'rhythm-reader/engine.js'));
E.loadDictionary(global.window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);

const CASES = [
  // `minute` away from the stimulus phrase
  ['minute differences in timing', 'minute', 1],
  ['minute quantities of the drug', 'minute', 1],
  ['down to the minute', 'minute', 0],
  ['wait a minute', 'minute', 0],
  // `converse` — missing entirely before review; named in the review
  ['Tanner and Madison converse about school', 'converse', 1],
  ['the converse is also true', 'converse', 0],
  // other pairs in frames the rules were not written from
  ['they protest the decision', 'protest', 1],
  ['a loud protest outside', 'protest', 0],
  ['prices increase sharply', 'increase', 1],
  ['a sharp increase in prices', 'increase', 0],
  ['a terrible insult', 'insult', 0],
  ['we export grain', 'export', 1],
  ['the export market', 'export', 0],
  ['she will present the findings', 'present', 1],
  ['a lovely present', 'present', 0],
  ['they subject him to tests', 'subject', 1],
  ['the subject of the study', 'subject', 0]
];

let ok = 0;
const fails = [];
for (const [text, word, want] of CASES) {
  const doc = E.analyze(text);
  const wd = doc.words.find(w => w.normalized === word);
  const got = wd ? wd.syllables.findIndex(s => s.lexicalStress === '1') : -1;
  if (got === want) ok++;
  else fails.push(`    FAIL  "${text}" → ${word}: want primary@${want} got @${got}`);
}
console.log(`Novel-context heteronyms: ${ok}/${CASES.length}`);
fails.forEach(f => console.log(f));
if (ok < CASES.length) process.exitCode = 0;   // reported, not fatal yet
