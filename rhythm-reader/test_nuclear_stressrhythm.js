/* Regression checks for the Nuclear Stress Rule (phrase-final prominence).
 * Run with: node test_nuclear_stress.js
 *
 * Principle under test: in neutral prosody the main (nuclear) accent of an
 * intonational phrase falls on its LAST content word, so "the final word tends
 * to be stressed" [Chomsky & Halle 1968; Liberman 1975; Liberman & Prince 1977].
 */
'use strict';

const assert = require('assert');
const path = require('path');
const E = require(path.join(__dirname, 'engine.js'));

E.loadDictionary({
  THE: 'DH AH0', BAND: 'B AE1 N D', WILL: 'W IH1 L', PLAY: 'P L EY1',
  AT: 'AE1 T', SCHOOL: 'S K UW1 L', GIVE: 'G IH1 V', IT: 'IH1 T',
  TO: 'T UW1', CHILDREN: 'CH IH1 L D R AH0 N', SUN: 'S AH1 N',
  AROSE: 'ER0 OW1 Z', AND: 'AH0 N D', BIRDS: 'B ER1 D Z', SANG: 'S AE1 NG',
  BANANA: 'B AH0 N AE1 N AH0', FELL: 'F EH1 L'
}, 'test');

function nucleusWordText(doc, ipIndex) {
  const ip = doc.phrases[ipIndex];
  assert(ip.nucleus, `IP ${ipIndex} should carry a nucleus`);
  return doc.words[ip.nucleus.word].word;
}
function nucleusIsStrong(doc, ipIndex) {
  const ip = doc.phrases[ipIndex];
  return doc.words[ip.nucleus.word].syllables[ip.nucleus.syllable].rhythmicStress === 'S';
}
function nuclearFlagCount(doc) {
  let n = 0;
  for (const wd of doc.words)
    for (const sy of wd.syllables) if (sy.nuclear) n++;
  return n;
}

let passed = 0;
function check(label, cond) {
  assert(cond, 'FAILED: ' + label);
  passed++; console.log('  \u2713 ' + label);
}

console.log('Nuclear Stress Rule checks');

// 1. Nucleus lands on the last content word, not a trailing function word.
{
  const d = E.analyze('The band will play at school.');
  check('nucleus is the last content word ("school")', nucleusWordText(d, 0) === 'school');
  check('nucleus syllable is strong', nucleusIsStrong(d, 0));
  check('exactly one nucleus flag in a single-IP sentence', nuclearFlagCount(d) === 1);
}

// 2. Trailing function words ("it to the") do not steal the nucleus.
{
  const d = E.analyze('Give it to the children.');
  check('nucleus skips trailing function words to "children"',
        nucleusWordText(d, 0) === 'children');
  check('nucleus falls on the word\u2019s primary-stress syllable',
        d.phrases[0].nucleus.syllable ===
        d.words[d.phrases[0].nucleus.word].syllables.findIndex(s => s.lexicalStress === '1'));
}

// 3. Each intonational phrase gets its own nucleus.
{
  const d = E.analyze('The sun arose, and the birds sang.');
  check('two intonational phrases', d.phrases.length === 2);
  check('first IP nucleus is "arose"', nucleusWordText(d, 0) === 'arose');
  check('second IP nucleus is "sang"', nucleusWordText(d, 1) === 'sang');
  check('one nucleus flag per IP (two total)', nuclearFlagCount(d) === 2);
  check('both nuclei are strong', nucleusIsStrong(d, 0) && nucleusIsStrong(d, 1));
}

// 4. The rule is a gated tendency: it can be switched off.
{
  const d = E.analyze('The band will play at school.', { nuclearStress: false });
  check('no nucleus when nuclearStress is disabled', !d.phrases[0].nucleus);
  check('no nuclear flags when disabled', nuclearFlagCount(d) === 0);
}

// 5. A phrase that would otherwise end weak is still anchored by the nucleus.
//    "banana" ends W-S-W; the nucleus must sit on its strong middle syllable.
{
  const d = E.analyze('A banana.');
  const ip = d.phrases[0];
  check('nucleus on "banana"', d.words[ip.nucleus.word].word.toLowerCase() === 'banana');
  check('nucleus is the strong syllable of banana (index 1)', ip.nucleus.syllable === 1);
  check('nuclear syllable realized as strong', nucleusIsStrong(d, 0));
}

console.log(`\n${passed} nuclear-stress checks passed.`);
