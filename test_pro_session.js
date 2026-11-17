/* test_pro_session.js — Rhythm Reader Pro never loses or fails to record
 * what a reader did (3.6.6), and a typed ID cannot become a formula (3.6.7).
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
    .filter(a => /, (beat|no beat)(, phrase nucleus)?\. Activate/.test(a))
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
  syl('said, ').click(); await sleep(50);
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

  // --- 5. a typed ID can never become a spreadsheet formula (3.6.7) ------
  {
    const E = w.RhythmEngine;
    eq(E.csvEscape('=2+3'), "'=2+3", 'a cell beginning with = is written as text');
    eq(E.csvEscape('+SUM(A1)'), "'+SUM(A1)", 'likewise +');
    eq(E.csvEscape('-cmd'), "'-cmd", 'likewise -');
    eq(E.csvEscape('@x'), "'@x", 'likewise @');
    eq(E.csvEscape('=HYPERLINK("http://x","y")'), '"\'=HYPERLINK(""http://x"",""y"")"', 'guarded first, then quoted');
    eq(E.csvEscape(-12.5), '-12.5', 'a negative number is a number');
    eq(E.csvEscape('-12.5'), '-12.5', 'and so is one that arrives as text');
    eq(E.csvEscape('+3'), '+3', 'a signed number is left alone');
    eq(E.csvEscape('P-07'), 'P-07', 'a hyphen inside an ID is untouched');
    eq(E.csvEscape('a,b'), '"a,b"', 'commas are quoted as before');
    eq(E.csvEscape('a\rb'), '"a\rb"', 'a carriage return now forces quoting');
    eq(E.csvEscape(''), '', 'an empty cell stays empty');
    eq(E.csvEscape(true), 'true', 'booleans are unchanged');

    // Through the real page: IDs typed by an experimenter.
    $('participantId').value = '=2+3'; fire($('participantId'), 'input');
    $('studyId').value = '@pilot, wave 1'; fire($('studyId'), 'input');
    $('input').value = 'Her friend left early, she said.';
    answer = true; $('analyzeBtn').click(); await sleep(100);
    syl('said, ').click(); await sleep(50);
    const csv = await exportText('research');
    const lines = csv.split('\n');
    const head = lines[0].split(',');
    const last = lines[lines.length - 1];
    ok(last.includes(",'=2+3,"), 'research log: the participant ID is guarded');
    ok(last.includes(',"\'@pilot, wave 1",'), 'research log: the study label is guarded and quoted');
    ok(!/(^|,)[=@+]/m.test(csv.split('\n').slice(1).join('\n')), 'research log: no cell begins with a formula character');
    eq(head.indexOf('participant'), 1, 'research log: column order unchanged');
    eq(w.session ? w.session.participant : '=2+3', '=2+3', 'the ID itself is stored as typed');
    const json = JSON.parse(await exportText('json'));
    eq(json.researchSession.participant, '=2+3', 'the JSON export keeps the ID exactly as typed');
    for (const v of ['csv', 'profile', 'lexicon']) {
      const t = await exportText(v);
      ok(t && !/(^|,)[=@]/m.test(t), v + ' export: no cell begins with a formula character');
    }
  }

  // --- 6. exports say what they hold (3.6.8) -----------------------------
  {
    let name = null;
    const click = w.HTMLAnchorElement.prototype.click;
    w.HTMLAnchorElement.prototype.click = function () { name = this.download; };
    $('participantId').value = '../P 07/=x'; fire($('participantId'), 'input');
    await exportText('research');
    eq(name, 'research_session_P_07_x.csv', 'the file name keeps only characters safe in a file name');
    syl('said, ').click(); await sleep(50);      // a new event, logged under the new ID
    const csv = await exportText('research');
    ok(csv.split('\n').pop().includes(',../P 07/=x,'), 'the ID inside the file is exactly as typed');
    $('participantId').value = 'P-07'; fire($('participantId'), 'input');
    await exportText('research');
    eq(name, 'research_session_P-07.csv', 'an ordinary ID is used as it is');
    w.HTMLAnchorElement.prototype.click = click;

    $('textType').value = 'verse'; fire($('textType'), 'change'); await sleep(50);
    $('input').value = 'With a heart for any fate'; $('analyzeBtn').click(); await sleep(100);
    const tight = await exportText('stimuli');
    ok(/CONGRUENT \(4 marks\)/.test(tight) && /INCONGRUENT \(3 marks\)/.test(tight), 'stimulus pair: the counts are stated');
    ok(/UNEQUAL MARK COUNTS: the incongruent version has 1 fewer mark\./.test(tight), 'stimulus pair: an impossible case carries a warning');
    $('input').value = 'Still achieving still pursuing'; $('analyzeBtn').click(); await sleep(100);
    const even = await exportText('stimuli');
    ok(/CONGRUENT \(4 marks\)/.test(even) && /INCONGRUENT \(4 marks\)/.test(even), 'stimulus pair: equal counts where the line has room');
    ok(!/UNEQUAL/.test(even), 'stimulus pair: no warning when the counts are equal');

    $('input').value = 'Sam went to Paris on Tuesday.'; $('analyzeBtn').click(); await sleep(100);
    const txt = await exportText('txt');
    ok(/Capitals mark beats\./.test(txt), 'annotated text: the convention is stated');
    ok(/\bPAR·is\b/.test(txt) && !/\bsam\b/.test(txt), 'annotated text: letters are as typed, not lowercased');
  }

  console.log(`test_pro_session.js: ${checks} checks passed.`);
  w.close();
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
