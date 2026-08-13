/* ============================================================================
 * eval/harness.js — scoring harness for the ProsodyTrainer rhythm engine.
 * ----------------------------------------------------------------------------
 * Reports, per the handoff §"Validate correctly":
 *   - exact passage match (dev / held-out, separately)
 *   - per-syllable beat accuracy
 *   - lexical-stress accuracy (Appendix B heteronyms)
 *   - congruent-over-incongruent preference rate
 *   - phrase-prominence accuracy
 *   - meter-label accuracy
 *   - clash count
 *   - results with known-reading lookup DISABLED (the generalization number)
 *
 * Usage:
 *   node eval/harness.js [--engine <path>] [--verbose] [--json <out>]
 *                        [--split dev|held|all]
 * ========================================================================== */

'use strict';

const path = require('path');
const fs = require('fs');
const corpus = require('./corpus.js');

/* ---- CLI ---------------------------------------------------------------- */
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? dflt : argv[i + 1];
};
const flag = (name) => argv.includes('--' + name);

const ROOT = path.resolve(__dirname, '..');
const ENGINE_PATH = path.resolve(ROOT, opt('engine', 'rhythm-reader/engine.js'));
const SPLIT = opt('split', 'all');
const VERBOSE = flag('verbose');
const JSON_OUT = opt('json', null);

/* ---- Engine bootstrap --------------------------------------------------- */
global.window = global.window || {};
require(path.join(ROOT, 'cmudict.js'));
require(path.join(ROOT, 'known-rhythms.js'));
const E = require(ENGINE_PATH);
E.loadDictionary(global.window.CMUDICT_FULL, 'full');

const ALL_KNOWN = global.window.PROSODY_KNOWN_READINGS;

function setKnownReadings(enabled) {
  E.loadKnownReadings(enabled ? ALL_KNOWN : []);
}

/* ==========================================================================
 * Gold-pattern extraction
 *
 * `marked` capitalises the letters of beat-bearing syllables. To turn that
 * into a per-syllable S/W string we need the engine's own syllabification of
 * each word — so we analyse the plain text first, then walk each word's
 * syllable spans against the corresponding marked token.
 *
 * A naive "syllable contains an uppercase letter" rule is wrong: the human
 * annotator's capitalisation boundary need not coincide with the engine's
 * syllable boundary, so `SEEing` (engine: se|eing) would be scored SS and
 * `aCHIEVing` (engine: a|chie|ving) would be scored WSS.
 *
 * The correct rule is that each maximal uppercase RUN marks exactly one beat,
 * located at the syllable containing the run's FIRST letter. This is robust to
 * boundary disagreement and still supports genuinely multi-beat words, which
 * appear as two separate runs.
 * ======================================================================== */

const WORDISH = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+(?:['’][A-Za-z]+)*)*/g;

function letters(s) { return s.replace(/[^A-Za-z]/g, ''); }

function goldPattern(doc, marked) {
  const tokens = marked.match(WORDISH) || [];
  if (tokens.length !== doc.words.length) {
    return { error: `token count mismatch: marked=${tokens.length} ` +
                    `analysed=${doc.words.length}` };
  }
  const perWord = doc.words.map((wd, wi) => {
    const tokLetters = letters(tokens[wi]);

    // Letter-index ranges of each engine syllable within the word.
    const ranges = [];
    let off = 0;
    for (const sy of wd.syllables) {
      const len = letters(sy.text).length;
      ranges.push([off, off + len]);
      off += len;
    }

    // Start index of each maximal uppercase run = one intended beat.
    const beats = new Set();
    for (let i = 0; i < tokLetters.length; i++) {
      const isUpper = tokLetters[i] >= 'A' && tokLetters[i] <= 'Z';
      const prevUpper = i > 0 && tokLetters[i - 1] >= 'A' && tokLetters[i - 1] <= 'Z';
      if (isUpper && !prevUpper) {
        let si = ranges.findIndex(([a, b]) => i >= a && i < b);
        if (si === -1) si = ranges.length - 1;   // run past the last span
        beats.add(si);
      }
    }
    return wd.syllables.map((_, si) => (beats.has(si) ? 'S' : 'W')).join('');
  });
  return { perWord, flat: perWord.join('') };
}

function predPattern(doc) {
  const perWord = doc.words.map(w =>
    w.syllables.map(s => s.rhythmicStress).join(''));
  return { perWord, flat: perWord.join('') };
}

function render(doc) {
  return doc.words.map(w => w.syllables.map(s =>
    s.rhythmicStress === 'S' ? s.text.toUpperCase() : s.text.toLowerCase()
  ).join('')).join(' ');
}

function renderPattern(doc, perWord) {
  return doc.words.map((w, wi) => w.syllables.map((s, si) =>
    perWord[wi][si] === 'S' ? s.text.toUpperCase() : s.text.toLowerCase()
  ).join('')).join(' ');
}

/* Count adjacent SS pairs, not crossing an intonational-phrase boundary. */
function countClashes(doc, flatOverride) {
  const flat = flatOverride || predPattern(doc).flat;
  // Build syllable -> IP index map.
  const ipOf = [];
  doc.phrases.forEach((ip, ipi) => {
    for (let w = ip.span[0]; w <= ip.span[1]; w++) {
      const wd = doc.words[w];
      if (!wd) continue;
      wd.syllables.forEach(() => ipOf.push(ipi));
    }
  });
  let n = 0;
  for (let i = 0; i + 1 < flat.length; i++) {
    if (flat[i] === 'S' && flat[i + 1] === 'S' &&
        (ipOf[i] === undefined || ipOf[i] === ipOf[i + 1])) n++;
  }
  return n;
}

/* ==========================================================================
 * Passage scoring
 * ======================================================================== */

function scorePassages(items, { knownEnabled }) {
  setKnownReadings(knownEnabled);
  const rows = [];
  for (const item of items) {
    const doc = E.analyze(item.text);
    const gold = goldPattern(doc, item.marked);
    if (gold.error) {
      rows.push({ id: item.id, split: item.split, provisional: !!item.provisional,
                  error: gold.error });
      continue;
    }
    const pred = predPattern(doc);
    const syllTotal = gold.flat.length;
    let syllCorrect = 0;
    for (let i = 0; i < syllTotal; i++)
      if (gold.flat[i] === pred.flat[i]) syllCorrect++;

    // Meter label: does the summary name the gold foot type?
    const adj = { iamb: 'iambic', trochee: 'trochaic',
                  anapest: 'anapestic', dactyl: 'dactylic' }[item.meter];
    const label = (doc.meterSummary && doc.meterSummary.label) || '';
    const meterOk = adj ? label.toLowerCase().includes(adj) : null;

    // Phrase prominence: if the item names a prominence-bearing word, check it
    // carries phraseProminence even when it is not a beat.
    let promOk = null;
    if (item.prominence) {
      const wd = doc.words.find(w => w.normalized === item.prominence);
      promOk = !!(wd && wd.syllables.some(s => s.phraseProminence));
    }

    rows.push({
      id: item.id, group: item.group, split: item.split,
      provisional: !!item.provisional,
      inKnownRegistry: !!item.inKnownRegistry,
      headline: !!item.headline,
      exact: gold.flat === pred.flat,
      syllCorrect, syllTotal,
      clashes: countClashes(doc, pred.flat),
      goldClashes: countClashes(doc, gold.flat),
      meterOk, meterLabel: label, promOk,
      gold: gold.flat, pred: pred.flat,
      goldText: renderPattern(doc, gold.perWord),
      predText: render(doc)
    });
  }
  return rows;
}

/* ==========================================================================
 * Promotion probes — scored only on named target words.
 * ======================================================================== */

function scoreProbes(probes, { knownEnabled }) {
  setKnownReadings(knownEnabled);
  return probes.map(p => {
    const doc = E.analyze(p.text);
    const targets = p.targets.map(t => {
      const wd = doc.words.find(w => w.normalized === t.word);
      if (!wd) return { ...t, found: false, ok: false };
      // Target is satisfied if ANY syllable of the word carries the beat value
      // for monosyllables; for polysyllables, the primary-stress syllable.
      const idx = wd.syllables.length === 1
        ? 0
        : Math.max(0, wd.syllables.findIndex(s => s.lexicalStress === '1'));
      return { ...t, found: true, got: wd.syllables[idx].rhythmicStress,
               ok: wd.syllables[idx].rhythmicStress === t.beat };
    });
    return { id: p.id, split: p.split, targets,
             ok: targets.every(t => t.ok), predText: render(doc) };
  });
}

/* ==========================================================================
 * Appendix B heteronyms — lexical stress, not beat.
 * ======================================================================== */

function scoreHeteronyms() {
  setKnownReadings(false);
  return corpus.HETERONYMS.map(h => {
    const doc = E.analyze(h.text);
    const wd = doc.words.find(w => w.normalized === h.target);
    if (!wd) return { ...h, found: false, ok: false };
    const got = wd.syllables.findIndex(s => s.lexicalStress === '1');
    return { ...h, found: true, got, ok: got === h.primary,
             pattern: wd.lexicalPattern };
  });
}

/* ==========================================================================
 * Congruent-over-incongruent discrimination.
 * The engine should score its own reading closer to the congruent annotation
 * than to the deliberately shifted one.
 * ======================================================================== */

function scoreDiscrimination() {
  setKnownReadings(false);
  return corpus.DISCRIMINATION.map(d => {
    const doc = E.analyze(d.text);
    const pred = predPattern(doc).flat;
    const con = goldPattern(doc, d.congruent);
    const inc = goldPattern(doc, d.incongruent);
    if (con.error || inc.error)
      return { id: d.id, error: con.error || inc.error };
    const agree = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] === b[i]) n++;
      return n / a.length;
    };
    const cAgree = agree(pred, con.flat);
    const iAgree = agree(pred, inc.flat);
    return { id: d.id, congruentAgreement: cAgree, incongruentAgreement: iAgree,
             ok: cAgree > iAgree };
  });
}

/* ==========================================================================
 * Reporting
 * ======================================================================== */

function pct(a, b) { return b ? (100 * a / b).toFixed(1) + '%' : 'n/a'; }

function summarise(rows, label) {
  const scored = rows.filter(r => !r.error && !r.provisional);
  const exact = scored.filter(r => r.exact).length;
  const syllC = scored.reduce((a, r) => a + r.syllCorrect, 0);
  const syllT = scored.reduce((a, r) => a + r.syllTotal, 0);
  const clashes = scored.reduce((a, r) => a + r.clashes, 0);
  const goldClashes = scored.reduce((a, r) => a + r.goldClashes, 0);
  const meterScored = scored.filter(r => r.meterOk !== null);
  const meterOk = meterScored.filter(r => r.meterOk).length;
  return {
    label, n: scored.length,
    exact, exactPct: pct(exact, scored.length),
    syllAcc: pct(syllC, syllT), syllCorrect: syllC, syllTotal: syllT,
    clashes, goldClashes,
    meterOk, meterN: meterScored.length, meterPct: pct(meterOk, meterScored.length),
    provisional: rows.filter(r => r.provisional).length,
    errors: rows.filter(r => r.error).length
  };
}

function printSummary(s) {
  console.log(`  ${s.label.padEnd(34)} ` +
    `exact ${String(s.exact).padStart(2)}/${String(s.n).padEnd(2)} (${s.exactPct.padStart(6)})  ` +
    `syll ${s.syllAcc.padStart(6)}  ` +
    `clash ${String(s.clashes).padStart(3)} (gold ${s.goldClashes})  ` +
    `meter ${s.meterOk}/${s.meterN}`);
}

function main() {
  const all = corpus.PASSAGES;
  const filt = SPLIT === 'all' ? all : all.filter(p => p.split === SPLIT);

  console.log('='.repeat(78));
  console.log('ProsodyTrainer rhythm engine — evaluation');
  console.log('engine:', path.relative(ROOT, ENGINE_PATH));
  console.log('='.repeat(78));

  const result = { engine: path.relative(ROOT, ENGINE_PATH), sections: {} };

  /* --- Generalization condition: known-reading registry DISABLED --------- */
  console.log('\n[1] GENERALIZATION  (known-reading lookup DISABLED)');
  console.log('    This is the number that matters. Memorised scansions cannot');
  console.log('    inflate it.\n');
  const genRows = scorePassages(filt, { knownEnabled: false });
  const genDev = summarise(genRows.filter(r => r.split === 'dev'), 'dev');
  const genHeld = summarise(genRows.filter(r => r.split === 'held'), 'HELD-OUT');
  const genAll = summarise(genRows, 'all');
  printSummary(genDev); printSummary(genHeld); printSummary(genAll);
  result.sections.generalization = { dev: genDev, held: genHeld, all: genAll, rows: genRows };

  /* --- Product condition: registry enabled ------------------------------ */
  console.log('\n[2] PRODUCT BEHAVIOUR  (known-reading lookup ENABLED)');
  console.log('    Not a generalization claim — reported for interface checking.\n');
  const prodRows = scorePassages(filt, { knownEnabled: true });
  const prodAll = summarise(prodRows, 'all');
  printSummary(prodAll);
  result.sections.product = { all: prodAll, rows: prodRows };

  /* --- Promotion probes -------------------------------------------------- */
  console.log('\n[3] PROMOTION PROBES  (known lookup disabled)\n');
  const probeRows = scoreProbes(corpus.PROMOTION_PROBES, { knownEnabled: false });
  const probeOk = probeRows.filter(r => r.ok).length;
  console.log(`  passed ${probeOk}/${probeRows.length}`);
  for (const r of probeRows) {
    const bad = r.targets.filter(t => !t.ok)
      .map(t => `${t.word}: want ${t.beat} got ${t.got || '?'}`).join('; ');
    console.log(`    ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(20)} ${r.predText}` +
                (bad ? `\n            → ${bad}` : ''));
  }
  result.sections.probes = { passed: probeOk, total: probeRows.length, rows: probeRows };

  /* --- Heteronyms -------------------------------------------------------- */
  console.log('\n[4] LEXICAL STRESS — Appendix B heteronyms\n');
  const hetRows = scoreHeteronyms();
  const hetOk = hetRows.filter(r => r.ok).length;
  console.log(`  passed ${hetOk}/${hetRows.length} (${pct(hetOk, hetRows.length)})`);
  for (const r of hetRows.filter(x => !x.ok))
    console.log(`    FAIL  "${r.text}" → ${r.target}: want primary@${r.primary} ` +
                `got @${r.got} (${r.pattern})`);
  result.sections.heteronyms = { passed: hetOk, total: hetRows.length, rows: hetRows };

  /* --- Discrimination ---------------------------------------------------- */
  console.log('\n[5] CONGRUENT-OVER-INCONGRUENT PREFERENCE\n');
  const discRows = scoreDiscrimination();
  const discOk = discRows.filter(r => r.ok).length;
  console.log(`  passed ${discOk}/${discRows.length}`);
  for (const r of discRows)
    console.log(`    ${r.ok ? 'PASS' : 'FAIL'}  ${r.id}: congruent ` +
      `${(r.congruentAgreement * 100).toFixed(0)}% vs incongruent ` +
      `${(r.incongruentAgreement * 100).toFixed(0)}%`);
  result.sections.discrimination = { passed: discOk, total: discRows.length, rows: discRows };

  /* --- Phrase prominence ------------------------------------------------- */
  const promRows = genRows.filter(r => r.promOk !== null);
  if (promRows.length) {
    console.log('\n[6] PHRASE PROMINENCE (independent of beat)\n');
    for (const r of promRows)
      console.log(`    ${r.promOk ? 'PASS' : 'FAIL'}  ${r.id}`);
    result.sections.prominence = { rows: promRows };
  }

  /* --- Provisional items, reported but not counted ----------------------- */
  const prov = genRows.filter(r => r.provisional);
  if (prov.length) {
    console.log('\n[7] PROVISIONAL ITEMS (gold unconfirmed — NOT counted above)\n');
    for (const r of prov)
      console.log(`    ${r.exact ? 'match ' : 'differ'}  ${r.id}`);
  }

  /* --- Ambiguity probes -------------------------------------------------- */
  console.log('\n[8] UNSCORED AMBIGUITY PROBES\n');
  setKnownReadings(false);
  for (const p of corpus.AMBIGUITY_PROBES) {
    const doc = E.analyze(p.text);
    const alts = (doc.alternativeReadings || []).length;
    console.log(`    ${p.id}: ${render(doc)}   [clashes ${countClashes(doc)}, ` +
                `${alts} reading(s), meter: ${doc.meterSummary.label}]`);
  }

  /* --- Regime classification: prose vs verse ----------------------------- */
  console.log('\n[9] REGIME CLASSIFICATION (prose vs verse)\n');
  setKnownReadings(false);
  const regimeRows = (corpus.REGIME_CASES || []).map(c => {
    const doc = E.analyze(c.text);
    const got = doc.regime && doc.regime.regime;
    return { text: c.text, want: c.regime, got, ok: got === c.regime,
             evidence: doc.regime && doc.regime.evidence,
             label: doc.meterSummary.label, note: c.note };
  });
  const rOk = regimeRows.filter(r => r.ok).length;
  const proseRows = regimeRows.filter(r => r.want === 'prose');
  const verseRows = regimeRows.filter(r => r.want === 'metrical');
  console.log(`  overall ${rOk}/${regimeRows.length}   ` +
    `prose ${proseRows.filter(r => r.ok).length}/${proseRows.length}   ` +
    `verse ${verseRows.filter(r => r.ok).length}/${verseRows.length}`);
  for (const r of regimeRows) {
    if (r.ok && !VERBOSE) continue;
    console.log(`    ${r.ok ? 'PASS' : 'FAIL'}  want ${r.want.padEnd(9)} got ` +
      `${String(r.got).padEnd(9)} ${r.text.slice(0, 52)}`);
    if (!r.ok) console.log(`          label: ${r.label}`);
  }
  result.sections.regime = { passed: rOk, total: regimeRows.length,
                             rows: regimeRows };

  /* --- Per-item detail --------------------------------------------------- */
  if (VERBOSE) {
    console.log('\n' + '='.repeat(78));
    console.log('PER-ITEM DETAIL (generalization condition)');
    console.log('='.repeat(78));
    for (const r of genRows) {
      if (r.error) { console.log(`\n  !! ${r.id}: ${r.error}`); continue; }
      const tag = r.provisional ? ' [provisional]' : '';
      console.log(`\n  ${r.exact ? '✓' : '✗'} ${r.id} (${r.split})${tag}` +
                  `  ${r.syllCorrect}/${r.syllTotal} syll, ${r.clashes} clash`);
      if (!r.exact) {
        console.log(`      gold: ${r.goldText}`);
        console.log(`      pred: ${r.predText}`);
      }
    }
  }

  console.log('\n' + '='.repeat(78));
  console.log('HEADLINE (generalization, held-out): ' +
    `${genHeld.exact}/${genHeld.n} exact, ${genHeld.syllAcc} per-syllable`);
  console.log('HEADLINE (generalization, all):      ' +
    `${genAll.exact}/${genAll.n} exact, ${genAll.syllAcc} per-syllable, ` +
    `${genAll.clashes} clashes`);
  console.log('='.repeat(78));

  if (JSON_OUT) {
    fs.writeFileSync(path.resolve(ROOT, JSON_OUT), JSON.stringify(result, null, 2));
    console.log('\nwrote', JSON_OUT);
  }
}

main();
