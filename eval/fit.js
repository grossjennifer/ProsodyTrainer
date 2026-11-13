/* ============================================================================
 * eval/fit.js — fit the engine's W weight table to gold readings.
 * ----------------------------------------------------------------------------
 * Uses the cost decomposition added in engine 3.5.0 (explainReading): every
 * reading's cost is fixed + sum(W[k] * features[k]), so a gold reading and
 * the engine's preferred reading can be compared term by term.
 *
 * Method: averaged structured perceptron with a margin. For each phrase of
 * each DEVELOPMENT passage whose gold reading is not ranked first by at
 * least MARGIN, the weights move so that the gold reading becomes cheaper
 * than its best competitor:  W[k] -= RATE * (gold[k] - competitor[k]).
 * Weights are kept within [MIN_W, MAX_W]. The epoch is chosen on DEV ONLY
 * (promotion probes, then exact match, then per-syllable accuracy, then the
 * smallest move away from the shipped weights).
 *
 * The held-out split is never read during fitting. It is scored once, at
 * the end, for both weight sets, as a release gate.
 *
 * This script NEVER changes engine.js. It writes eval/fitted-weights.json
 * and prints the gates. Adopting a fitted set is a separate, deliberate
 * edit of the W table, followed by `npm test`.
 *
 * Not fitted: PROSE (the regime threshold, not a per-reading term), GIVEN
 * (scales a preference weight) and the rhythm-preference tag tables (the
 * `fixed` part of the cost). See RELEASE-3.5.0.md.
 *
 * Usage: node eval/fit.js [--epochs N] [--rate R] [--margin M] [--quiet]
 *        node eval/fit.js --diagnose   (dev failures, term by term; no fitting)
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
global.window = global.window || {};
require(path.join(ROOT, 'cmudict.js'));
require(path.join(ROOT, 'known-rhythms.js'));
const E = require(path.join(ROOT, 'rhythm-reader/engine.js'));
E.loadDictionary(global.window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);
const corpus = require('./corpus.js');

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? Number(process.argv[i + 1]) : dflt;
};
const EPOCHS = arg('epochs', 30), RATE = arg('rate', 0.05), MARGIN = arg('margin', 0.25);
const MIN_W = 0, MAX_W = 6;
const QUIET = process.argv.includes('--quiet');

const scored = p => !p.provisional;
const DEV = corpus.PASSAGES.filter(p => p.split === 'dev' && scored(p));
const HELD = corpus.PASSAGES.filter(p => p.split === 'held' && scored(p));
const PROBES_DEV = corpus.PROMOTION_PROBES.filter(p => p.split === 'dev');
const PROBES_ALL = corpus.PROMOTION_PROBES;
const LEARN = E.featureKeys.slice();
const SHIPPED = E.getWeights();

/* Gold beat string for a document, in the document's own syllabification.
 * Same rule as eval/sweep.js: a beat on the syllable where an upper-case run
 * starts. */
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
// Syllable offset of each phrase within the document's flat beat string.
function phraseSlices(doc) {
  const start = []; let off = 0;
  doc.words.forEach((wd, i) => { start[i] = off; off += wd.syllables.length; });
  return doc.phrases.map(ip => {
    const a = start[ip.span[0]];
    const b = start[ip.span[1]] + doc.words[ip.span[1]].syllables.length;
    return [a, b];
  });
}
const flatBeats = doc => doc.words.map(w =>
  w.syllables.map(s => s.rhythmicStress).join('')).join('');
function clashCount(p) { let n = 0; for (let i = 1; i < p.length; i++) if (p[i] === 'S' && p[i - 1] === 'S') n++; return n; }

function evaluate(items, probes) {
  let exact = 0, sc = 0, st = 0, clashes = 0, n = 0;
  for (const it of items) {
    const doc = E.analyze(it.text);
    const g = goldFlat(doc, it.marked);
    if (!g) continue;
    n++;
    const p = flatBeats(doc);
    if (g === p) exact++;
    for (let i = 0; i < g.length; i++) if (g[i] === p[i]) sc++;
    st += g.length;
    clashes += clashCount(p);
  }
  let pr = 0;
  for (const probe of probes) {
    const doc = E.analyze(probe.text);
    const ok = probe.targets.every(t => {
      const wd = doc.words.find(x => x.normalized === t.word);
      if (!wd) return false;
      const idx = wd.syllables.length === 1 ? 0
        : Math.max(0, wd.syllables.findIndex(s => s.lexicalStress === '1'));
      return wd.syllables[idx].rhythmicStress === t.beat;
    });
    if (ok) pr++;
  }
  return { n, exact, syll: st ? sc / st : 0, syllTotal: st, clashes, probes: pr,
           probeTotal: probes.length };
}
const distance = w => LEARN.reduce((s, k) => s + Math.abs(w[k] - SHIPPED[k]), 0);
/* Per-syllable accuracy is only comparable when both runs divide the text
 * into the same number of syllables. Weights can change syllabification
 * (metrical syncope chooses between dictionary variants by cost), and a
 * changed denominator can raise the percentage with no reading improving:
 * the first gate-passing fit did exactly that, splitting `our` into o·ur. */
const syllGain = (a, b) => a.syllTotal === b.syllTotal && a.syll > b.syll + 1e-9;
const better = (a, b) => a.probes !== b.probes ? a.probes > b.probes
  : a.exact !== b.exact ? a.exact > b.exact
  : syllGain(a, b) ? true : syllGain(b, a) ? false
  : a.dist < b.dist;

/* ---- diagnosis (dev only): why each failing phrase fails -------------- */
if (process.argv.includes('--diagnose')) {
  E.setWeights(SHIPPED);
  let model = 0, search = 0;
  for (const it of DEV) {
    const doc = E.analyze(it.text);
    const g = goldFlat(doc, it.marked);
    const p = flatBeats(doc);
    if (!g || g === p) continue;
    console.log(`\n${it.id}: ${it.text}   [${doc.regime.regime}]`);
    phraseSlices(doc).forEach(([a, b], pi) => {
      const gs = g.slice(a, b), ps = p.slice(a, b);
      if (gs === ps) return;
      const gx = E.explainReading(doc, pi, gs), px = E.explainReading(doc, pi, ps);
      const missed = gx.cost < px.cost - 1e-9;
      if (missed) search++; else model++;
      console.log(`  gold   ${gs}  cost ${gx.cost.toFixed(2)}`);
      console.log(`  engine ${ps}  cost ${px.cost.toFixed(2)}  ` + (missed
        ? '<- SEARCH: gold is cheaper but was not found'
        : '<- MODEL: the weights prefer the engine reading'));
      const terms = LEARN.filter(k => gx.features[k] !== px.features[k])
        .map(k => `${k} ${gx.features[k]} vs ${px.features[k]}`);
      const srcs = new Set(Object.keys(gx.faithfulnessBySource)
        .concat(Object.keys(px.faithfulnessBySource)));
      const faith = [...srcs].filter(k => (gx.faithfulnessBySource[k] || 0) !==
        (px.faithfulnessBySource[k] || 0)).map(k => `${k} ${(gx.faithfulnessBySource[k] || 0)
        .toFixed(2)} vs ${(px.faithfulnessBySource[k] || 0).toFixed(2)}`);
      console.log('    W terms (gold vs engine): ' + (terms.join('; ') || 'none'));
      console.log('    preference costs (gold vs engine): ' + (faith.join('; ') || 'none'));
    });
  }
  console.log(`\n${model} phrase(s) fail because of the cost model, ${search} because of the search.`);
  process.exit(0);
}

/* ---- fitting -------------------------------------------------------- */
let w = Object.assign({}, SHIPPED);
const sum = {}; LEARN.forEach(k => { sum[k] = 0; });
let steps = 0;
E.setWeights(SHIPPED);
let best = Object.assign({ epoch: 0, weights: Object.assign({}, SHIPPED),
  dist: 0 }, evaluate(DEV, PROBES_DEV));
const log = [];
for (let epoch = 1; epoch <= EPOCHS; epoch++) {
  let updates = 0, unreachable = 0;
  for (const it of DEV) {
    E.setWeights(w);
    const doc = E.analyze(it.text);
    const g = goldFlat(doc, it.marked);
    if (!g) continue;
    phraseSlices(doc).forEach(([a, b], pi) => {
      const gold = g.slice(a, b);
      const gx = E.explainReading(doc, pi, gold);
      if (!gx) { unreachable++; return; }
      // Best competitor: the cheapest listed reading that is not gold.
      let comp = null;
      for (const r of doc.phrases[pi].readings || []) {
        if (r.beats.join('') === gold) continue;
        const rx = E.explainReading(doc, pi, r.beats);
        if (rx && (!comp || rx.cost < comp.cost)) comp = rx;
      }
      if (!comp || gx.cost + MARGIN <= comp.cost) return;
      for (const k of LEARN) {
        w[k] = Math.min(MAX_W, Math.max(MIN_W,
          w[k] - RATE * (gx.features[k] - comp.features[k])));
      }
      updates++;
    });
    LEARN.forEach(k => { sum[k] += w[k]; });
    steps++;
  }
  const avg = Object.assign({}, SHIPPED);
  LEARN.forEach(k => { avg[k] = Math.round(sum[k] / steps * 1000) / 1000; });
  E.setWeights(avg);
  const r = Object.assign({ epoch, weights: avg, dist: distance(avg) }, evaluate(DEV, PROBES_DEV));
  log.push({ epoch, updates, unreachable, exact: r.exact, syll: r.syll, probes: r.probes });
  if (!QUIET) console.log(`epoch ${String(epoch).padStart(2)}  updates ${String(updates).padStart(3)}  ` +
    `dev exact ${r.exact}/${r.n}  syll ${(r.syll * 100).toFixed(1)}%  probes ${r.probes}/${r.probeTotal}`);
  if (better(r, best)) best = r;
  if (!updates) break;
}

/* ---- gates (held-out read here for the first time) -------------------- */
E.setWeights(SHIPPED);
const shipDev = evaluate(DEV, PROBES_DEV), shipHeld = evaluate(HELD, []),
      shipProbes = evaluate([], PROBES_ALL);
E.setWeights(best.weights);
const fitDev = evaluate(DEV, PROBES_DEV), fitHeld = evaluate(HELD, []),
      fitProbes = evaluate([], PROBES_ALL);
E.setWeights(SHIPPED);

const pct = x => (x * 100).toFixed(1) + '%';
const row = (label, a, b) => console.log(label.padEnd(26) + String(a).padEnd(16) + String(b));
console.log('\nselected epoch:', best.epoch, best.epoch === 0 ? '(shipped weights kept)' : '');
console.log('\n' + 'weight'.padEnd(26) + 'shipped'.padEnd(16) + 'fitted');
for (const k of LEARN) row(k, SHIPPED[k], best.weights[k]);
console.log('\n' + 'measure'.padEnd(26) + 'shipped'.padEnd(16) + 'fitted');
row('dev exact', `${shipDev.exact}/${shipDev.n}`, `${fitDev.exact}/${fitDev.n}`);
row('dev per-syllable', pct(shipDev.syll), pct(fitDev.syll));
row('HELD-OUT exact', `${shipHeld.exact}/${shipHeld.n}`, `${fitHeld.exact}/${fitHeld.n}`);
row('HELD-OUT per-syllable', pct(shipHeld.syll), pct(fitHeld.syll));
row('promotion probes (all)', `${shipProbes.probes}/${shipProbes.probeTotal}`, `${fitProbes.probes}/${fitProbes.probeTotal}`);
row('clashes (dev+held)', shipDev.clashes + shipHeld.clashes, fitDev.clashes + fitHeld.clashes);

const gates = [
  ['held-out exact not lower', fitHeld.exact >= shipHeld.exact],
  ['held-out per-syllable not lower', fitHeld.syll >= shipHeld.syll - 1e-9],
  ['same syllabification (dev+held)', fitDev.syllTotal === shipDev.syllTotal &&
    fitHeld.syllTotal === shipHeld.syllTotal],
  ['promotion probes not fewer', fitProbes.probes >= shipProbes.probes],
  ['clash census not higher', fitDev.clashes + fitHeld.clashes <= shipDev.clashes + shipHeld.clashes],
  ['improves dev', fitDev.exact > shipDev.exact ||
    (fitDev.exact === shipDev.exact && syllGain(fitDev, shipDev))]
];
console.log('\nGATES');
for (const [name, ok] of gates) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
const allPass = gates.every(([, ok]) => ok);
console.log(allPass
  ? '\nAll gates pass. If adopted, edit the W table by hand and run npm test (acceptance suite included).'
  : '\nNot a candidate for adoption. The shipped weights stay.');

fs.writeFileSync(path.join(__dirname, 'fitted-weights.json'), JSON.stringify({
  engineBuild: E.build, createdAt: new Date().toISOString(),
  settings: { epochs: EPOCHS, rate: RATE, margin: MARGIN, minW: MIN_W, maxW: MAX_W },
  devItems: DEV.length, selectedEpoch: best.epoch,
  shipped: Object.fromEntries(LEARN.map(k => [k, SHIPPED[k]])),
  fitted: Object.fromEntries(LEARN.map(k => [k, best.weights[k]])),
  results: { shipped: { dev: shipDev, held: shipHeld, probes: shipProbes },
             fitted: { dev: fitDev, held: fitHeld, probes: fitProbes } },
  gates: Object.fromEntries(gates), allGatesPass: allPass, epochs: log
}, null, 1));
