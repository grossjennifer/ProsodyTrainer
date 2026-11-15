/* test_pro_session.js — Rhythm Reader Pro never loses or fails to record
 * what a reader did (3.6.6).
 *
 *   1. A change that re-runs the analysis asks before discarding hand edits,
 *      and keeps both the edits and the setting when the reader declines.
 *   2. The research log records setting changes, the settings in force on
 *      every row, and beats that moved as a consequence of an edit.
 *   3. Every export states the settings it was produced under.
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
  console.log('         PRO SESSION HANDLING WAS NOT VERIFIED.');
  process.exit(0);
}
let checks = 0;
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };
const ok = (c, m) => { assert.ok(c, m); checks++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, 'rhythm-reader-pro/index.html'),
    { runScripts: 'dangerously', resources: 'usable' });
  await sleep(3000);
  const w = dom.window, d = w.document;
  const asked = []; let answer = false;
  w.confirm = msg => { asked.push(msg); return answer; };
  let csvText = null;
  w.URL.createObjectURL = blob => { csvText = blob; return 'blob:x'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};

  const $ = id => d.getElementById(id);
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const beats = () => Array.from(d.querySelectorAll('#surface button'))
    .map(b => b.getAttribute('aria-label') || '')
    .filter(a => /syllable \d+, (beat|no beat)/.test(a))
    .map(a => (/, beat/.test(a) ? 'S' : 'W')).join('');
  const syl = prefix => Array.from(d.querySelectorAll('#surface button'))
    .find(b => (b.getAttribute('aria-label') || '').startsWith(prefix));
  const exportText = async v => {
    $('exportSel').value = v; fire($('exportSel'), 'change');
    csvText = null; $('exportBtn').click();
    return csvText ? await csvText.text() : null;
  };

  $('researchMode').checked = true; fire($('researchMode'), 'change');
  $('input').value = 'Her friend left early, she said.';
  $('analyzeBtn').click(); await sleep(100);
  const start = beats();

  // --- 1. edits are never discarded silently ---------------------------
  syl('said syllable 1').click(); await sleep(50);
  const edited = beats();
  ok(edited !== start, 'the hand edit changed the reading');

  $('textType').value = 'verse'; fire($('textType'), 'change'); await sleep(50);
  eq(asked.length, 1, 'changing the text type with edits asks first');
  ok(/discards your 1 hand edit\./.test(asked[0]), asked[0]);
  eq(beats(), edited, 'declining keeps the edits');
  eq($('textType').value, 'auto', 'declining keeps the setting');

  $('analyzeBtn').click(); await sleep(50);
  eq(asked.length, 2, 'analysing the same text again with edits asks first');
  eq(beats(), edited, 'declining keeps the edits');

  $('clashSub').click(); await sleep(50);
  eq(asked.length, 2, 'a rule checkbox keeps edits and does not ask');
  ok(/W$/.test(beats()), 'the edit on `said` survives the rule change');

  answer = true;
  $('textType').value = 'verse'; fire($('textType'), 'change'); await sleep(50);
  eq(asked.length, 3);
  eq($('textType').value, 'verse', 'accepting applies the setting');

  $('textType').value = 'prose'; fire($('textType'), 'change'); await sleep(50);
  eq(asked.length, 3, 'no question when there is nothing to lose');

  // --- 2. the research log ---------------------------------------------
  const log = await exportText('research');
  const rows = log.split('\n').map(r => r.split(','));
  const col = name => rows[0].indexOf(name);
  for (const name of ['text_type', 'strict_alternation', 'clash_subordination'])
    ok(col(name) >= 0, 'log has a ' + name + ' column');
  const actions = rows.slice(1).map(r => r[col('action')]);
  ok(actions.includes('setting-change'), 'setting changes are logged');
  ok(actions.includes('edits-discarded'), 'discarded edits are logged');
  ok(actions.includes('beat-reflow'), 'beats moved by an edit or setting are logged');
  const settings = rows.slice(1).filter(r => r[col('action')] === 'setting-change')
    .map(r => r[col('word')]);
  eq(settings, ['clash_subordination', 'text_type', 'text_type']);
  eq(new Set(rows.slice(1).map(r => r[col('passage_index')])).size, 1,
    'a changed setting is the same passage, not a new one');
  eq(rows[rows.length - 1][col('text_type')], 'prose',
    'each row carries the settings in force');

  // --- 3. every export states its settings -------------------------------
  const table = await exportText('csv');
  ok(table.split('\n')[0].endsWith(
    'text_type,regime,strict_alternation,clash_subordination,analysis_source'));
  ok(table.split('\n')[1].endsWith('prose,prose,false,false,general-inference'));
  ok(/\ntext_type,prose\nregime,prose\n/.test(await exportText('profile')));
  ok(/text_type,regime,strict_alternation,clash_subordination$/
    .test((await exportText('lexicon')).split('\n')[0]));
  for (const v of ['txt', 'stimuli', 'training']) {
    const out = await exportText(v);
    ok(/Text type: prose \(read as prose\)/.test(out), v + ' states the text type');
    ok(/Strict alternation: off; clash subordination: off/.test(out), v + ' states the rules');
    ok(/Hand-edited words: \d+/.test(out), v + ' states the hand edits');
  }

  // --- 4. the cue-fading levels say what they are ------------------------
  const fading = await exportText('training');
  ok(/\nONE MARK PER PUNCTUATED PHRASE:\n/.test(fading), 'third level is named for what it does');
  ok(!/PER SENTENCE|transfer level/.test(fading), 'no claim of one mark per sentence');
  ok(/do not reproduce that manipulation/.test(fading), 'the 2026 design is cited, not claimed');
  ok(Array.from($('density').options).some(o => o.text === 'one per punctuated phrase'),
    'the on-screen cue menu uses the same name');

  console.log(`test_pro_session.js: ${checks} checks passed.`);
  w.close();
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
