'use strict';
/* Rhythm Reader Pro: the remembered-words workflow end to end in jsdom.
 * Served from http://localhost/ through a file-backed resource loader so
 * that localStorage has a real origin (file:// origins are opaque). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let jsdom;
try { jsdom = require('jsdom'); }
catch (e) {
  console.log('SKIPPED: jsdom not installed (npm install --no-save jsdom).');
  console.log('         REMEMBERED-WORDS PAGE WIRING WAS NOT VERIFIED.');
  process.exit(0);
}
const { JSDOM, requestInterceptor } = jsdom;
const ROOT = __dirname;
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Serve http://localhost/... from the repository on disk.
const serveFiles = requestInterceptor(async (request) => {
  const u = new URL(request.url);
  if (u.hostname !== 'localhost') return undefined;
  try {
    const body = await fs.promises.readFile(path.join(ROOT, decodeURIComponent(u.pathname)));
    return new Response(body, { status: 200,
      headers: { 'content-type': u.pathname.endsWith('.js')
        ? 'text/javascript' : 'text/html' } });
  } catch (e) { return new Response('', { status: 404 }); }
});
async function open(storage) {
  const html = fs.readFileSync(path.join(ROOT, 'rhythm-reader-pro', 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/rhythm-reader-pro/index.html',
    runScripts: 'dangerously', resources: { interceptors: [serveFiles] },
    beforeParse(win) {
      if (storage) for (const [k, v] of Object.entries(storage)) win.localStorage.setItem(k, v);
      // jsdom has no modal dialogs; give the inspector a minimal one.
      win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      win.HTMLDialogElement.prototype.close = function () { this.open = false; };
      win.confirm = () => true;
    }
  });
  await sleep(3000);
  return dom;
}
const $ = (d, id) => d.getElementById(id);
async function analyzeText(d, text) {
  $(d, 'input').value = text; $(d, 'analyzeBtn').click(); await sleep(120);
}
function tableRow(d, word) {
  return Array.from(d.querySelectorAll('#debugTableWrap tbody tr'))
    .find(tr => tr.cells[0].textContent.toLowerCase() === word);
}
const KEY = 'prosodyTrainer.rememberedWords.v1';

(async () => {
  let dom = await open();
  let d = dom.window.document;
  await analyzeText(d, 'We flew to Jaen in May.');
  let row = tableRow(d, 'jaen');
  ok(row && row.cells[5].textContent.startsWith('heuristic'), 'Jaen starts as a rule estimate');

  // Open the inspector, split ja|en, set stress 01.
  row.querySelector('button').click(); await sleep(50);
  const dlg = $(d, 'inspector');
  ok(dlg.open, 'inspector opens');
  ok(!dlg.querySelector('[data-key="remember"]'), 'no Remember control before an edit');
  dlg.querySelector('[data-key="gap:0:1"]').click(); await sleep(50);
  // cycle second syllable 0 -> 1, first 1 -> 2 -> 0
  dlg.querySelector('[data-key="digit:1"]').click(); await sleep(30);
  dlg.querySelector('[data-key="digit:0"]').click(); await sleep(30);
  dlg.querySelector('[data-key="digit:0"]').click(); await sleep(30);
  const rem = dlg.querySelector('[data-key="remember"]');
  ok(rem, 'Remember control offered after a word-stress edit');
  rem.click(); await sleep(50);
  const stored = JSON.parse(dom.window.localStorage.getItem(KEY));
  ok(stored.jaen && stored.jaen.pattern === '01', 'correction saved to localStorage');
  ok(/1 remembered word/.test($(d, 'rememberedStatus').textContent), 'panel counts it');
  ok($(d, 'rememberedList').textContent.includes('ja·en'), 'panel lists it');

  // Function word: explanation instead of a button.
  await analyzeText(d, 'the cat');
  tableRow(d, 'the').querySelector('button').click(); await sleep(30);
  dlg.querySelector('[data-key="digit:0"]').click(); await sleep(30);
  ok(!dlg.querySelector('[data-key="remember"]'), 'function word gets no Remember control');
  ok(/Function words/.test(dlg.textContent), 'function word refusal is explained');
  dlg.close();
  dom.window.close();

  // A fresh page in the same browser applies it.
  dom = await open({ [KEY]: JSON.stringify(stored) });
  d = dom.window.document;
  await analyzeText(d, 'Jaen is far.');
  row = tableRow(d, 'jaen');
  ok(row.cells[1].textContent === 'ja·en' && row.cells[2].textContent === '01',
    'remembered word applied after reload');
  ok(row.cells[5].textContent.startsWith('learned'), 'table shows the learned source');
  ok(/from remembered words/.test($(d, 'statGrid').textContent), 'stats show the remembered share');

  // Research mode suspends it.
  const rm = $(d, 'researchMode');
  rm.checked = true; rm.dispatchEvent(new dom.window.Event('change')); await sleep(120);
  row = tableRow(d, 'jaen');
  ok(!row.cells[5].textContent.startsWith('learned'), 'research mode uses the automatic analysis');
  row.querySelector('button').click(); await sleep(30);
  ok(!/Remember for future/.test($(d, 'inspector').textContent), 'no Remember controls in research mode');
  $(d, 'inspector').close();
  ok(/Paused while research mode is on/.test($(d, 'rememberedStatus').textContent), 'panel says it is paused');
  rm.checked = false; rm.dispatchEvent(new dom.window.Event('change')); await sleep(120);
  ok(!tableRow(d, 'jaen').cells[5].textContent.startsWith('learned'),
    'leaving research mode does not re-analyze the passage on screen');
  ok(/from the next analysis/.test($(d, 'rememberedStatus').textContent), 'panel says when it resumes');
  await analyzeText(d, 'Jaen is far.');
  ok(tableRow(d, 'jaen').cells[5].textContent.startsWith('learned'), 'applied again at the next analysis');

  // Forget from the panel.
  $(d, 'rememberedList').querySelector('button').click(); await sleep(80);
  ok(JSON.parse(dom.window.localStorage.getItem(KEY)).jaen === undefined, 'forget removes it from storage');
  ok(tableRow(d, 'jaen').cells[5].textContent.startsWith('heuristic'), 'forget reverts the current passage');
  dom.window.close();

  // Storage with a rejected entry is cleaned on load.
  dom = await open({ [KEY]: JSON.stringify({ record: { syllables: [
    { text: 're', stress: '1' }, { text: 'cord', stress: '0' }] } }) });
  d = dom.window.document;
  ok(/No remembered words/.test($(d, 'rememberedStatus').textContent),
    'a heteronym in storage is not applied');
  dom.window.close();

  console.log(checks + ' remembered-words page checks passed.');
})().catch(e => { console.error(e); process.exit(1); });
