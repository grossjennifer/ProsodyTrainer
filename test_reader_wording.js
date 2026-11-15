/* test_reader_wording.js — Rhythm Reader names rhythms the way the training
 * teaches them (STRONG-weak, weak-weak-STRONG) and never by foot name.
 * Rhythm Reader Pro keeps the technical label. Wording approved by the
 * project owner, 14 November 2026. Page change only; the engine is untouched.
 *
 * Requires jsdom. Skips loudly rather than silently passing if it is absent.
 */
'use strict';
const path = require('path');
const assert = require('assert');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.log('SKIPPED: jsdom not installed (npm install --no-save jsdom).');
  console.log('         READER WORDING WAS NOT VERIFIED.');
  process.exit(0);
}

let checks = 0;
const eq = (a, b, m) => { assert.strictEqual(a, b, m); checks++; };
const ok = (c, m) => { assert.ok(c, m); checks++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FOOT_NAMES = /troch|iamb|anap|dactyl|amphibrach|scansion|predominantly|near-equivalent/i;

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, 'rhythm-reader/index.html'),
    { runScripts: 'dangerously', resources: 'usable' });
  await sleep(2500);
  const w = dom.window, d = w.document;
  const note = async text => {
    d.getElementById('input').value = text;
    d.getElementById('go').click();
    await sleep(120);
    return d.getElementById('regimeNote').textContent;
  };

  // The five taught rhythms, on the live page.
  const LINES = [
    ['Peter Peter pumpkin eater', 'STRONG-weak'],
    ['Because I could not stop for Death', 'weak-STRONG'],
    ['On the fifteenth of May in the jungle of Nool', 'weak-weak-STRONG'],
    ['All in the valley of Death', 'STRONG-weak-weak'],
    ['There once was a man from Nantucket', 'weak-STRONG-weak']
  ];
  for (const [text, rhythm] of LINES) {
    const got = await note(text);
    eq(got, `Read as having a regular beat: ${rhythm}.`, text);
    ok(!FOOT_NAMES.test(got), `no foot name: ${got}`);
  }

  // A real tie names both patterns.
  let got = await note('The stockings were hung by the chimney with care');
  eq(got, 'Read as having a regular beat. It fits two patterns about equally ' +
    'well: weak-weak-STRONG and weak-STRONG-weak.');

  // Prose wording is unchanged.
  got = await note('Researchers measured reading times for each sentence.');
  ok(/^Read as ordinary prose — no regular beat found\./.test(got), got);

  // The reader's own choice is still acknowledged.
  d.querySelector('#textType button[data-type="verse"]').click();
  await sleep(120);
  got = await note('Peter Peter pumpkin eater');
  eq(got, 'Read as having a regular beat (your choice): STRONG-weak.');

  // The wording function, for labels that are hard to elicit on demand.
  // The page script is not global, so the function is lifted from its source.
  const html = require('fs').readFileSync(
    path.join(__dirname, 'rhythm-reader/index.html'), 'utf8');
  const src = /const TAUGHT_RHYTHM = [\s\S]*?\nfunction plainRhythmLine[\s\S]*?\n}\n/.exec(html);
  ok(src, 'plainRhythmLine is defined on the page');
  const line = new Function(src[0] + '; return plainRhythmLine;')();
  eq(line({ label: 'mixed with local iambic and trochaic sequences' }, false),
    'Read as having a regular beat that changes pattern along the way.');
  eq(line({ label: 'mixed' }, false),
    'Read as having a beat, but no single repeating pattern.');
  eq(line({ label: 'conventional dactylic reading' }, false),
    'Read as having a regular beat: STRONG-weak-weak.');
  eq(line({ label: 'alternating (…)', ambiguous: true,
            ambiguousTypes: ['trochee', 'iamb', 'amphibrach'] }, false),
    'Read as having a regular beat. It fits three patterns about equally well: ' +
    'STRONG-weak, weak-STRONG and weak-STRONG-weak.');
  for (const label of ['predominantly trochaic', 'predominantly iambic',
    'predominantly anapestic', 'predominantly dactylic',
    'predominantly amphibrachic', 'mixed', 'mixed with local anapestic sequences'])
    ok(!FOOT_NAMES.test(line({ label }, false)), `no foot name for "${label}"`);

  // Pro keeps the technical label.
  const pro = require('fs').readFileSync(
    path.join(__dirname, 'rhythm-reader-pro/index.html'), 'utf8');
  ok(/technical label: /.test(pro), 'Pro still shows the technical label');

  console.log(`test_reader_wording.js: ${checks} checks passed.`);
  w.close();
})().catch(e => { console.error(e.message); process.exit(1); });
