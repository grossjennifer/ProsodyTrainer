/* Regression checks for the four-foot phrase-level rhythm model.
 * Run with: node test_rhythm_feet.js
 */
'use strict';

const assert = require('assert');
const path = require('path');
const E = require(path.join(__dirname, 'engine_rhythm_fixed.js'));

E.loadDictionary({
  A: 'AH0',
  BANANA: 'B AH0 N AE1 N AH0',
  FELL: 'F EH1 L',
  HAPPY: 'HH AE1 P IY0',
  CHILDREN: 'CH IH1 L D R AH0 N',
  RUNNING: 'R AH1 N IH0 NG',
  QUICKLY: 'K W IH1 K L IY0',
  THE: 'DH AH0',
  SUN: 'S AH1 N',
  AROSE: 'ER0 OW1 Z',
  ABOVE: 'AH0 B AH1 V',
  QUIET: 'K W AY1 AH0 T',
  HILL: 'HH IH1 L'
}, 'test');

const ALLOWED = new Set(['SW', 'WS', 'WWS', 'SWW']);

function projectedUnits(doc) {
  return doc.phrases.flatMap(ip =>
    ip.children.flatMap(phi => phi.rhythmicFeet || []));
}

function checkFeet(doc) {
  for (const unit of projectedUnits(doc)) {
    if (['pickup', 'trailing', 'isolated'].includes(unit.type)) {
      assert.strictEqual(unit.pattern.length, 1, 'edge residue must be one syllable');
    } else {
      assert(ALLOWED.has(unit.pattern), `unexpected foot ${unit.pattern}`);
    }
  }
}

assert.deepStrictEqual(
  E.constants.RHYTHM_FEET.map(f => f.pattern).sort(),
  [...ALLOWED].sort(),
  'engine must expose exactly the four requested feet'
);
assert.strictEqual(E.constants.FOOT_NAMES.WSW, undefined,
  'WSW must not be named as an amphibrach');

{
  const d = E.analyze('Banana.');
  assert(!/amphibrach/i.test(d.words[0].template.traditionalName),
    'banana must not receive an amphibrach label');
  assert.deepStrictEqual(projectedUnits(d).map(u => u.pattern), ['W', 'SW'],
    'banana should be a pickup plus a trochee');
  checkFeet(d);
}

{
  const d = E.analyze('A banana fell.');
  assert.deepStrictEqual(projectedUnits(d).map(u => u.pattern), ['WWS', 'WS'],
    'phrase should scan as anapest plus iamb');
  assert.strictEqual(d.words[1].rhythmicPattern, 'WSW',
    'lexical stress remains intact while feet cross word boundaries');
  checkFeet(d);
}

for (const text of [
  'Happy children running quickly.',
  'The sun arose above the quiet hill.',
  'A banana.',
  'A banana fell.'
]) {
  const d = E.analyze(text);
  checkFeet(d);
  for (const wd of d.words) {
    assert(!wd.syllables.some(s => !['S', 'W'].includes(s.rhythmicStress)),
      `all syllables need rhythmic stress in: ${text}`);
  }
}

console.log('All four-foot rhythm tests passed.');
