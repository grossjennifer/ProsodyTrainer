/* test_unpunct_hint.js — the hint shown when a single line with no closing
 * punctuation is read as verse under "Let it decide" (17 November 2026).
 * No text-only rule separates such a line from an ordinary sentence typed
 * without its full stop, so the engine is unchanged and the reader is told how
 * to settle it. Page change only, in both tools.
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
  console.log('         THE UNPUNCTUATED-LINE HINT WAS NOT VERIFIED.');
  process.exit(0);
}

let checks = 0;
const eq = (a, b, m) => { assert.strictEqual(a, b, m); checks++; };
const ok = (c, m) => { assert.ok(c, m); checks++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CASES = [
  // [text, text type, hint expected, why]
  ['Sam fell out of the canoe', 'auto', true, 'a sentence without its full stop, read as verse'],
  ['Seeing fishes in the water', 'auto', true, 'a verse line without punctuation: the hint is shown, and the reading stands'],
  ['Sam fell out of the canoe.', 'auto', false, 'with its full stop it is read as prose'],
  ['Sam fell out of the canoe', 'prose', false, 'the reader chose prose'],
  ['Seeing fishes in the water', 'verse', false, 'the reader chose verse'],
  ['Seeing fishes in the water\nPlaying in the pool with family', 'auto', false, 'two lines are laid out as verse'],
  ['Half a league, half a league,', 'auto', false, 'a line ending in a comma is punctuated'],
  ['All in the valley of Death', 'auto', false, 'a stored, approved reading needs no hint'],
  ['She called it a "stuck record"', 'auto', null, 'a closing quotation mark does not count as punctuation'],
  ['Researchers measured reading times for each sentence in the experiment', 'auto', null, 'whatever the reading, the hint follows it'],
];

async function page(file, setType, go, input) {
  const dom = await JSDOM.fromFile(path.join(__dirname, file), { runScripts: 'dangerously', resources: 'usable' });
  await sleep(2500);
  const w = dom.window, d = w.document;
  w.confirm = () => true;   // jsdom has no confirm; Pro asks before re-analysing
  return async (text, type) => {
    setType(d, type);
    d.getElementById(input).value = text;
    go(d);
    await sleep(150);
    const prose = d.getElementById('regimeNote')
      ? /^Read as ordinary prose/.test(d.getElementById('regimeNote').textContent)
      : /prose/i.test(d.getElementById('meterLine').textContent);
    return { hint: !d.getElementById('unpunctNote').hidden,
             text: d.getElementById('unpunctNote').textContent,
             prose,
             live: d.getElementById('live').textContent };
  };
}

(async () => {
  const readerType = (d, t) => d.querySelector(`#textType button[data-type="${t}"]`).click();
  const proType = (d, t) => {
    const s = d.getElementById('textType');
    if (s.value !== t) { s.value = t; s.dispatchEvent(new d.defaultView.Event('change', { bubbles: true })); }
  };
  const tools = [
    ['Rhythm Reader', 'rhythm-reader/index.html', readerType, d => d.getElementById('go').click(),
      'Read as verse. If this is an ordinary sentence, end it with a full stop or choose Ordinary prose.'],
    ['Rhythm Reader Pro', 'rhythm-reader-pro/index.html', proType, d => d.getElementById('analyzeBtn').click(),
      'Read as verse. If this is an ordinary sentence, end it with a full stop or choose prose.'],
  ];
  for (const [name, file, setType, go, wording] of tools) {
    const run = await page(file, setType, go, 'input');
    for (const [text, type, want, why] of CASES) {
      const r = await run(text, type);
      // Where the reading may go either way, the hint must follow it exactly.
      eq(r.hint, want === null ? !r.prose : want, `${name}: ${why} — "${text}" (${type})`);
      if (want === true) ok(!r.prose, `${name}: the reading itself is unchanged (verse) — "${text}"`);
      if (r.hint) {
        eq(r.text, wording, `${name}: wording`);
        ok(r.live.endsWith(wording), `${name}: the hint is announced to screen readers`);
      } else {
        ok(!r.live.includes('end it with a full stop'), `${name}: no stale hint is announced`);
      }
    }
  }
  console.log(`test_unpunct_hint.js: ${checks} checks passed.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
