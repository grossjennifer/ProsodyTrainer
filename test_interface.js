/* ============================================================================
 * test_interface.js — browser-level tests for both public tools.
 * ----------------------------------------------------------------------------
 * The review asked for tests "proving that the user can see and toggle
 * inferred alternatives, not merely known-text alternatives". Engine-level
 * tests cannot show that: `ip.readings` and `selectIPReading()` were fully
 * implemented and covered by their own passing suite for an entire revision
 * while NO interface called them. The feature did not exist as far as any
 * reader was concerned, and every engine test still passed.
 *
 * These tests load the real index.html files, let their own scripts run, and
 * then drive the DOM the way a person would — setting text, clicking buttons,
 * reading what is displayed. Nothing here reaches inside the page: its script
 * is wrapped in an IIFE and none of its state is reachable, which is exactly
 * the constraint a user is under. If the wiring is removed these fail, even
 * though the engine suites would not notice.
 *
 * Requires jsdom. Skips loudly rather than silently passing if it is absent.
 * ========================================================================== */

'use strict';

const path = require('path');
const assert = require('assert');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.log('SKIPPED: jsdom not installed (npm install --no-save jsdom).');
  console.log('         INTERFACE WIRING WAS NOT VERIFIED.');
  process.exit(0);
}

const ROOT = __dirname;
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* The pages fetch the dictionary with a dynamically inserted <script>, so the
 * DOM must be given a real file URL and allowed to load local resources. */
async function open(relPath) {
  const dom = await JSDOM.fromFile(path.join(ROOT, relPath),
    { runScripts: 'dangerously', resources: 'usable' });
  await sleep(2500);                       // dictionary load + first analyse
  return dom;
}

const $ = (d, id) => d.getElementById(id);

async function setText(dom, text, goId) {
  const d = dom.window.document;
  $(d, 'input').value = text;
  $(d, goId).click();
  await sleep(120);
  return d;
}

(async () => {

/* ==========================================================================
 * Rhythm Reader (basic)
 * ======================================================================== */
{
  const dom = await open('rhythm-reader/index.html');
  let d = await setText(dom, 'Researchers measured reading times for each sentence.', 'go');

  // 1. A real text-type control exists — not an example-inserting chip.
  const tt = $(d, 'textType');
  ok(tt, 'basic tool exposes a text-type control');
  const types = Array.from(tt.querySelectorAll('button[data-type]'))
    .map(b => b.dataset.type);
  ok(['auto', 'prose', 'verse'].every(t => types.includes(t)),
    `text-type offers auto/prose/verse — got ${types.join(',')}`);

  // 2. The prose verdict is shown to the reader.
  ok(/prose/i.test($(d, 'regimeNote').textContent),
    `prose verdict is displayed — got "${$(d, 'regimeNote').textContent}"`);

  // 3. The help text must not claim feet are fitted when they are not. This is
  //    the sentence that shipped saying rhythm is ALWAYS fitted with the four
  //    feet, which stopped being true when the prose regime was added.
  const proseHelp = $(d, 'rhythmNote').textContent;
  ok(/does not fit a repeating foot/i.test(proseHelp),
    `prose help text must not claim a repeating foot — got "${proseHelp}"`);

  // 4. Choosing a text type changes the ANALYSIS, not merely a caption.
  const proseOut = $(d, 'out').innerHTML;
  d.querySelector('#textType button[data-type="verse"]').click();
  await sleep(120);
  const verseNote = $(d, 'regimeNote').textContent;
  ok(/regular beat/i.test(verseNote),
    `choosing verse changes the analysis — got "${verseNote}"`);
  ok(/your choice|you chose/i.test(verseNote),
    'the tool says the reader chose the text type rather than implying it inferred it');
  const verseHelp = $(d, 'rhythmNote').textContent;
  ok(/fits a repeating beat/i.test(verseHelp),
    'help text follows the regime');
  ok(proseOut !== $(d, 'out').innerHTML || proseHelp !== verseHelp,
    'the displayed analysis or its description actually changes');

  dom.window.close();
}

/* Inferred alternatives — visible, labelled readably, and switchable. */
{
  const dom = await open('rhythm-reader/index.html');
  /* A sentence the analyser genuinely finds ambiguous. Verified against the
   * engine rather than assumed: many sentences have a clear winner, and a
   * probe with no close rival would silently skip the very path being
   * tested. */
  const d = await setText(dom,
    'With a heart for any fate', 'go');

  const wrap = $(d, 'phraseChoices');
  ok(wrap, 'basic tool has a region for inferred alternatives');

  if (!wrap.hidden) {
    const buttons = Array.from(wrap.querySelectorAll('button'));
    ok(buttons.length >= 2, 'more than one inferred reading is offered');

    // Buttons must show the reading itself, not "candidate 2".
    ok(/[A-Z]{2,}/.test(buttons[0].textContent),
      `choices show the reading — got "${buttons[0].textContent}"`);

    /* Compare markup, not text. The CAPS display is applied with CSS, so the
     * rendered textContent is identical whichever beats are chosen; only the
     * per-syllable classes and labels change. Asserting on textContent would
     * pass whether or not the toggle did anything. */
    const before = $(d, 'out').innerHTML;
    const target = buttons.find(b => b.getAttribute('aria-pressed') === 'false');
    ok(target, 'an unselected alternative is available');
    target.click();
    await sleep(120);
    ok($(d, 'out').innerHTML !== before,
      'clicking an inferred alternative changes the displayed reading');

    // The choice must stick. The engine pins the chosen BEAT STRING rather
    // than a list index, so it survives the re-analysis that any later render
    // triggers. Tested by changing an unrelated display option — clicking
    // "Show the beat" again is a request for a fresh analysis of new text and
    // is expected to clear the pin.
    /* Re-query after every click: renderPhraseChoices() rebuilds the buttons,
     * so the node that was clicked is detached and its attributes are stale. */
    const pressedIdx = buttons.indexOf(target);
    const afterClick = Array.from(
      $(d, 'phraseChoices').querySelectorAll('button'));
    ok(afterClick[pressedIdx] &&
       afterClick[pressedIdx].getAttribute('aria-pressed') === 'true',
      'the chosen alternative is marked as selected');
    d.querySelector('#modes button[data-mode="bold"]').click();
    await sleep(120);
    const after = Array.from(
      $(d, 'phraseChoices').querySelectorAll('button'));
    ok(after[pressedIdx] &&
       after[pressedIdx].getAttribute('aria-pressed') === 'true',
      'the chosen reading is still selected after the view re-renders');
  } else {
    assert.fail('the probe sentence should produce close alternatives; ' +
      'if the ranking changed, pick a new probe rather than skipping the test');
  }
  dom.window.close();
}

/* ==========================================================================
 * Rhythm Reader Pro
 * ======================================================================== */
{
  const dom = await open('rhythm-reader-pro/index.html');
  const d = await setText(dom,
    'Researchers measured reading times for each sentence.', 'analyzeBtn');

  const tt = $(d, 'textType');
  ok(tt && tt.tagName === 'SELECT', 'Pro exposes a text-type control');
  ok(Array.from(tt.options).map(o => o.value).includes('verse'),
    'Pro text-type offers verse');

  const meterLine = $(d, 'meterLine').textContent;
  ok(/prose/i.test(meterLine),
    `Pro reports the prose verdict — got "${meterLine}"`);
  ok(/no repeating foot/i.test(meterLine),
    'Pro says plainly that no foot is being fitted');

  tt.value = 'verse';
  $(d, 'analyzeBtn').click();
  await sleep(150);
  const verseLine = $(d, 'meterLine').textContent;
  ok(!/no repeating foot/i.test(verseLine),
    `Pro text type reaches the analysis — got "${verseLine}"`);
  ok(/your choice|you chose/i.test(verseLine),
    'Pro discloses that the reader chose the text type');

  dom.window.close();
}

console.log(`Interface suite passed (${checks} checks).`);
})().catch(e => { console.error(e.message); process.exit(1); });
