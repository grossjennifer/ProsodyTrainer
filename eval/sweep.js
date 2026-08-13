/* ============================================================================
 * eval/sweep.js — weight search on the DEVELOPMENT split only.
 * ----------------------------------------------------------------------------
 * The held-out split is never read by this script. Selection is on dev exact
 * match, with dev per-syllable accuracy and the promotion probes as
 * tie-breakers, so a setting cannot win by trading probe failures for a
 * marginal exact-match gain.
 * ========================================================================== */

'use strict';

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
global.window = global.window || {};
require(path.join(ROOT, 'cmudict.js'));
require(path.join(ROOT, 'known-rhythms.js'));
const E = require(path.join(ROOT, 'rhythm-reader/engine.js'));
E.loadDictionary(global.window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);

const corpus = require('./corpus.js');
const DEV = corpus.PASSAGES.filter(p => p.split === 'dev' && !p.provisional);
const PROBES = corpus.PROMOTION_PROBES.filter(p => p.split === 'dev');

const WORDISH = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+(?:['’][A-Za-z]+)*)*/g;
const letters = s => s.replace(/[^A-Za-z]/g, '');

function goldFlat(doc, marked) {
  const toks = marked.match(WORDISH) || [];
  if (toks.length !== doc.words.length) return null;
  return doc.words.map((wd, wi) => {
    const L = letters(toks[wi]);
    const ranges = []; let off = 0;
    for (const sy of wd.syllables) {
      const n = letters(sy.text).length; ranges.push([off, off + n]); off += n;
    }
    const beats = new Set();
    for (let i = 0; i < L.length; i++) {
      const up = L[i] >= 'A' && L[i] <= 'Z';
      const pup = i > 0 && L[i - 1] >= 'A' && L[i - 1] <= 'Z';
      if (up && !pup) {
        let si = ranges.findIndex(([a, b]) => i >= a && i < b);
        if (si === -1) si = ranges.length - 1;
        beats.add(si);
      }
    }
    return wd.syllables.map((_, si) => (beats.has(si) ? 'S' : 'W')).join('');
  }).join('');
}

function evaluate() {
  let exact = 0, sc = 0, st = 0;
  for (const it of DEV) {
    const doc = E.analyze(it.text);
    const g = goldFlat(doc, it.marked);
    if (!g) continue;
    const p = doc.words.map(w => w.syllables.map(s => s.rhythmicStress).join('')).join('');
    if (g === p) exact++;
    for (let i = 0; i < g.length; i++) if (g[i] === p[i]) sc++;
    st += g.length;
  }
  let probes = 0;
  for (const pr of PROBES) {
    const doc = E.analyze(pr.text);
    const ok = pr.targets.every(t => {
      const wd = doc.words.find(x => x.normalized === t.word);
      if (!wd) return false;
      const idx = wd.syllables.length === 1 ? 0
        : Math.max(0, wd.syllables.findIndex(s => s.lexicalStress === '1'));
      return wd.syllables[idx].rhythmicStress === t.beat;
    });
    if (ok) probes++;
  }
  return { exact, syll: sc / st, probes };
}

const GRID = {
  TERNARY: [0, 0.15, 0.30, 0.40, 0.55, 0.70],
  SHIFT:   [1.4, 1.9, 2.4],
  CLASH:   [1.8, 2.2, 2.6],
  GRID_MISS: [0.6, 0.75, 0.85],
  TRAIL_LAPSE: [0.30, 0.60, 1.00],
  LAPSE: [0.8]
};

const base = E.setWeights({});
let best = null;
const results = [];

for (const TERNARY of GRID.TERNARY)
for (const SHIFT of GRID.SHIFT)
for (const CLASH of GRID.CLASH)
for (const GRID_MISS of GRID.GRID_MISS)
for (const TRAIL_LAPSE of GRID.TRAIL_LAPSE)
for (const LAPSE of GRID.LAPSE) {
  E.setWeights(Object.assign({}, base, { TERNARY, SHIFT, CLASH, GRID_MISS, TRAIL_LAPSE, LAPSE }));
  const r = evaluate();
  const row = { TERNARY, SHIFT, CLASH, GRID_MISS, TRAIL_LAPSE, LAPSE, ...r };
  results.push(row);
  const better = !best ||
    r.probes > best.probes ||
    (r.probes === best.probes && r.exact > best.exact) ||
    (r.probes === best.probes && r.exact === best.exact && r.syll > best.syll);
  if (better) best = row;
}

results.sort((a, b) =>
  b.probes - a.probes || b.exact - a.exact || b.syll - a.syll);

console.log('DEV-ONLY SWEEP — top 12 of', results.length, 'settings');
console.log('probes exact  syll    TRAIL_LAPSE LAPSE');
for (const r of results.slice(0, 12))
  console.log(`  ${r.probes}/${PROBES.length}   ${String(r.exact).padStart(2)}/${DEV.length}  ` +
    `${(r.syll * 100).toFixed(1)}%  ${r.TRAIL_LAPSE.toFixed(2)}        ${r.LAPSE.toFixed(2)}`);
console.log('\nselected:', JSON.stringify(best));
