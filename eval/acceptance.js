/* ============================================================================
 * eval/acceptance.js — the eight acceptance criteria from the handoff,
 * checked directly. Exit code is non-zero if any criterion fails.
 * ========================================================================== */

'use strict';

const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
global.window = global.window || {};
require(path.join(ROOT, 'cmudict.js'));
require(path.join(ROOT, 'known-rhythms.js'));
const E = require(path.join(ROOT, 'rhythm-reader/engine.js'));
E.loadDictionary(global.window.CMUDICT_FULL, 'full');

const render = doc => doc.words.map(w => w.syllables.map(s =>
  s.rhythmicStress === 'S' ? s.text.toUpperCase() : s.text.toLowerCase()
).join('')).join(' ');

const results = [];
function check(n, name, fn) {
  try { fn(); results.push({ n, name, ok: true }); }
  catch (e) { results.push({ n, name, ok: false, why: e.message }); }
}

/* 1 — exceeds the 23/39 general exact-match baseline on a held-out set.
 * NOTE ON COMPARABILITY: the original 39-item corpus was not supplied, so
 * this compares against the re-measured baseline of the SAME (reconstructed)
 * corpus, not against the historical 23/39. Both numbers come from
 * eval/baseline.json vs the current engine. */
check(1, 'held-out exact match exceeds the measured baseline', () => {
  const base = require('./baseline.json');
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath,
    [path.join(__dirname, 'harness.js'), '--json', 'eval/current.json'],
    { cwd: ROOT, stdio: 'ignore' });
  const cur = require('./current.json');
  const b = base.sections.generalization, c = cur.sections.generalization;
  assert.ok(c.held.exact > b.held.exact,
    `held-out ${c.held.exact}/${c.held.n} vs baseline ${b.held.exact}/${b.held.n}`);
  assert.ok(c.all.exact > b.all.exact,
    `all ${c.all.exact} vs baseline ${b.all.exact}`);
});

/* 2 — analyses `the MOUSE ran UP the CLOCK` WITHOUT known-text lookup. */
check(2, 'mouse/clock derived without known-text lookup', () => {
  E.loadKnownReadings([]);
  const doc = E.analyze('The mouse ran up the clock.');
  assert.strictEqual(render(doc), 'the MOUSE ran UP the CLOCK');
  assert.strictEqual(doc.knownReading, null);
});

/* 3 — improves the failing promotion probes. */
check(3, 'all six promotion probes pass', () => {
  E.loadKnownReadings([]);
  const probes = [
    ['The mouse ran up the clock', 'up', 'S'],
    ['In the forests of the night', 'of', 'S'],
    ['Trying to escape', 'to', 'S'],
    ['Did gyre and gimble in the wabe', 'in', 'S'],
    ['Humpty Dumpty had a great fall', 'had', 'S'],
    ['Do not go gentle into that good night', 'not', 'S'],
    ['Do not go gentle into that good night', 'that', 'S']
  ];
  for (const [text, word, want] of probes) {
    const doc = E.analyze(text);
    const wd = doc.words.find(w => w.normalized === word);
    assert.ok(wd, `${word} not found in "${text}"`);
    assert.strictEqual(wd.syllables[0].rhythmicStress, want,
      `"${text}": ${word} should be ${want} — got ${render(doc)}`);
  }
});

/* 4 — preserves the contextual heteronym result. */
check(4, 'contextual heteronym suite still passes', () => {
  const { execFileSync } = require('child_process');
  const out = execFileSync(process.execPath, ['test_contextual_heteronyms.js'],
    { cwd: ROOT, encoding: 'utf8' });
  assert.ok(/27 contextual heteronym checks passed/.test(out), out);
});

/* 5 — does not erase phrase prominence when a syllable is extrametrical. */
check(5, 'prominence survives extrametricality', () => {
  E.loadKnownReadings(global.window.PROSODY_KNOWN_READINGS);
  const doc = E.analyze('All in the valley of Death');
  const death = doc.words.find(w => w.normalized === 'death').syllables[0];
  assert.strictEqual(death.rhythmicStress, 'W', 'Death should carry no beat');
  assert.strictEqual(death.phraseProminence, 'nucleus',
    'Death should still carry phrase prominence');
});

/* 6 — contrastive adjacent prominence remains available. */
check(6, 'licensed adjacent prominence remains reachable', () => {
  E.loadKnownReadings([]);
  const off = E.analyze('The mouse ran up the clock.', { clashSubordination: false });
  const flat = off.words.map(w => w.syllables.map(s => s.rhythmicStress).join('')).join('');
  const anyClash = /SS/.test(flat) ||
    off.phrases[0].readings.some(r => /SS/.test(r.beats.join('')));
  assert.ok(anyClash,
    'with clash pressure disabled a clashing reading must be reachable');
  // ...and it must NOT be the default when clash pressure is on.
  const on = E.analyze('The mouse ran up the clock.');
  const onFlat = on.words.map(w => w.syllables.map(s => s.rhythmicStress).join('')).join('');
  assert.ok(!/SS/.test(onFlat), 'default reading should not clash');
});

/* 7 — both public tools behave consistently. */
check(7, 'both tools behave identically', () => {
  const fs = require('fs');
  const a = fs.readFileSync(path.join(ROOT, 'rhythm-reader/engine.js'));
  const b = fs.readFileSync(path.join(ROOT, 'rhythm-reader-pro/engine.js'));
  assert.ok(a.equals(b), 'engine.js differs between the two tools');
});

/* 8 — existing suites still pass. */
check(8, 'existing known-reading suite passes', () => {
  const { execFileSync } = require('child_process');
  const out = execFileSync(process.execPath, ['test_known_readings.js'],
    { cwd: ROOT, encoding: 'utf8' });
  assert.ok(/passed/.test(out), out);
});

/* --- Criteria added by the 13 August review ----------------------------- */

/* R5 — distinguishes unmetered prose from verse well enough not to assign
 * poetic foot labels indiscriminately to normal sentences. */
check('R5', 'prose is distinguished from verse', () => {
  const corpus = require('./corpus.js');
  E.loadKnownReadings([]);
  const rows = corpus.REGIME_CASES.map(c => {
    const doc = E.analyze(c.text);
    return { want: c.regime, got: doc.regime && doc.regime.regime,
             label: doc.meterSummary.label, text: c.text };
  });
  const bad = rows.filter(r => r.want !== r.got);
  assert.ok(bad.length <= 1,
    'regime misclassifications: ' +
    bad.map(b => `"${b.text.slice(0, 40)}" want ${b.want} got ${b.got}`).join('; '));
  // No prose passage may be handed a foot label.
  const labelled = rows.filter(r => r.want === 'prose' && r.got === 'prose' &&
    /iambic|trochaic|anapestic|dactylic/.test(r.label));
  assert.strictEqual(labelled.length, 0,
    'prose passages must not receive foot labels: ' +
    labelled.map(l => l.label).join('; '));
});

/* R6 — phrase prominence displayed independently of beat. */
check('R6', 'phrase-prominence suite passes', () => {
  const { execFileSync } = require('child_process');
  const out = execFileSync(process.execPath, ['test_phrase_prominence.js'],
    { cwd: ROOT, encoding: 'utf8' });
  assert.ok(/passed/.test(out), out);
});

/* R8 — a user-selected reading survives reanalysis. */
check('R8', 'selected reading is preserved across reanalysis', () => {
  E.loadKnownReadings([]);
  const doc = E.analyze('This is a test sentence.');
  if (!doc.phrases[0].readings || doc.phrases[0].readings.length < 2) return;
  E.selectIPReading(doc, 0, 1);
  const chosen = render(doc);
  E.reanalyze(doc, {});                       // forces a full reflow
  assert.strictEqual(render(doc), chosen,
    'the reader\'s chosen candidate must survive reanalysis');
});

/* R-heteronym — novel contexts, not the phrases the rules were built from. */
check('R4', 'heteronyms generalize to novel contexts', () => {
  const { execFileSync } = require('child_process');
  const out = execFileSync(process.execPath, ['eval/novel_heteronyms.js'],
    { cwd: ROOT, encoding: 'utf8' });
  const m = out.match(/Novel-context heteronyms: (\d+)\/(\d+)/);
  assert.ok(m, out);
  const [, got, total] = m.map(Number);
  assert.ok(got / total >= 0.9,
    `novel-context heteronyms ${got}/${total}\n${out}`);
});

/* R7 + R10 — the reader can SEE and TOGGLE inferred alternatives in the
 * actual interfaces, and the text-type control is a real analysis prior.
 * This is a browser-level check by necessity: the engine side of this was
 * complete and passing for a whole revision while no interface called it. */
check('R7', 'interfaces expose text type, regime and inferred alternatives', () => {
  const { execFileSync } = require('child_process');
  const out = execFileSync(process.execPath, ['test_interface.js'],
    { cwd: ROOT, encoding: 'utf8' });
  assert.ok(!/SKIPPED/.test(out),
    'interface wiring was not verified — install jsdom:\n' + out);
  assert.ok(/Interface suite passed/.test(out), out);
});

/* Extra: coherence invariant the handoff calls out explicitly —
 * beats and meter label must come from the same candidate. */
check('X', 'no hybrid readings: beats and template are from one candidate', () => {
  E.loadKnownReadings([]);
  for (const t of ['In the forests of the night', 'The mouse ran up the clock',
                   'On the fifteenth of May in the jungle of Nool',
                   'This is a test sentence.']) {
    const doc = E.analyze(t);
    for (const ip of doc.phrases) {
      if (!ip.readings || !ip.readings.length) continue;
      const sel = ip.readings[ip.selectedReadingIndex];
      const actual = [];
      for (let w = ip.span[0]; w <= ip.span[1]; w++)
        doc.words[w].syllables.forEach(s => actual.push(s.rhythmicStress));
      assert.strictEqual(actual.join(''), sel.beats.join(''),
        `displayed beats differ from the selected candidate in "${t}"`);
      assert.ok(sel.template !== undefined && sel.components !== undefined,
        'candidate lacks its own template/cost description');
    }
  }
});

console.log('ACCEPTANCE CRITERIA\n' + '='.repeat(70));
for (const r of results)
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${String(r.n).padStart(2)}. ${r.name}` +
              (r.ok ? '' : `\n          ${r.why}`));
const failed = results.filter(r => !r.ok).length;
console.log('='.repeat(70));
console.log(failed ? `${failed} criterion/criteria FAILED` : 'all criteria met');
process.exit(failed ? 1 : 0);
