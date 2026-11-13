/* eval/focus_eval.js — does the phrase nucleus fall on the discourse focus?
 * For each item in eval/focus_corpus.js the context and target are analysed
 * together, and the item passes when the focus word's stressed syllable is
 * the nucleus of its intonational phrase. Reports dev and held-out
 * separately for content-word and function-word focus.
 * Usage: node eval/focus_eval.js [-v] [--focus] [--split dev|held]
 *   --focus  turn on discourse focus (config.discourseFocus)
 *   --split  score one split only (develop on dev; read held-out once)                                      */
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
global.window = global.window || {};
require(path.join(ROOT, 'cmudict.js'));
const E = require(path.join(ROOT, 'rhythm-reader/engine.js'));
E.loadDictionary(global.window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);
const { FOCUS_ITEMS } = require('./focus_corpus.js');
const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
const FOCUS = process.argv.includes('--focus');
const si = process.argv.indexOf('--split');
const SPLIT = si >= 0 ? process.argv[si + 1] : null;
const cfg = { discourseFocus: FOCUS };
const res = {}, rows = [];
for (const x of FOCUS_ITEMS) {
  if (SPLIT && x.split !== SPLIT) continue;
  const nT = E.analyze(x.target, cfg).words.length;
  const d = E.analyze(x.context + ' ' + x.target, cfg);
  const tw = d.words.slice(d.words.length - nT);
  const toks = x.marked.match(WORD);
  const first = x.focus.split(' ')[0];
  const fi = first === 'A' ? toks.lastIndexOf('A') : toks.indexOf(first);
  const w = tw[fi];
  const pi = w ? Math.max(0, w.syllables.findIndex(s => s.lexicalStress === '1')) : 0;
  const ok = !!(w && w.syllables[pi].phraseProminence === 'nucleus');
  const nuc = tw.filter(v => v.syllables.some(s => s.phraseProminence === 'nucleus'))
    .map(v => v.word).join('+');
  const k = x.set + ' ' + x.split;
  res[k] = res[k] || [0, 0]; res[k][1]++; if (ok) res[k][0]++;
  rows.push(`${ok ? 'OK  ' : 'MISS'} ${x.id} ${x.split.padEnd(4)} focus ${x.focus.padEnd(12)} nucleus ${nuc.padEnd(20)} ${x.target}`);
}
if (process.argv.includes('-v')) rows.forEach(r => console.log(r));
for (const k of Object.keys(res).sort()) console.log(k.padEnd(14), `${res[k][0]}/${res[k][1]}`);
