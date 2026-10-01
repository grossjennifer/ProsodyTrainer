/* Regression checks for the five-foot phrase-level rhythm model
 * (four word-level templates; the amphibrach is phrase-level only).
 * Run with: node test_rhythm_feet.js
 */
'use strict';

const assert = require('assert');
const path = require('path');
const E = require(path.join(__dirname, 'engine.js'));

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

const ALLOWED = new Set(['SW', 'WS', 'WWS', 'SWW', 'WSW']);

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
  'engine must expose exactly the five phrase-level feet'
);
assert.strictEqual(
  E.constants.RHYTHM_FEET.find(f => f.pattern === 'WSW').name, 'amphibrach',
  'phrase-level WSW is the amphibrach');
assert.strictEqual(E.constants.FOOT_NAMES.WSW, undefined,
  'WSW must not be a WORD-level template name');

{
  const d = E.analyze('Banana.');
  assert(!/amphibrach/i.test(d.words[0].template.traditionalName),
    'banana must not receive an amphibrach label');
  // Alone, the one-word phrase is exactly one phrase-level amphibrach; the
  // word's own template is still not called one (checked just above).
  assert.deepStrictEqual(projectedUnits(d).map(u => u.pattern), ['WSW'],
    'a one-word phrase "banana" scans as one phrase-level amphibrach');
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

// Amphibrachic verse: the limerick opening is the taught exemplar.
{
  E.loadDictionary({
    THERE: 'DH EH1 R', ONCE: 'W AH1 N S', WAS: 'W AA1 Z', A: 'AH0',
    MAN: 'M AE1 N', FROM: 'F R AH1 M', NANTUCKET: 'N AE0 N T AH1 K AH0 T'
  }, 'test-limerick');
  const d = E.analyze('There once was a man from Nantucket.');
  const beats = d.words.map(w => w.syllables.map(s => s.rhythmicStress).join(''));
  assert.deepStrictEqual(beats, ['W', 'S', 'W', 'W', 'S', 'W', 'WSW'],
    'limerick beats: there ONCE was a MAN from nanTUCKet');
  assert.strictEqual(d.meterSummary.label, 'predominantly amphibrachic',
    'limerick line is labelled amphibrachic, got ' + d.meterSummary.label);
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

console.log('All five-foot rhythm tests passed.');
