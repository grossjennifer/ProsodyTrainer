'use strict';

const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
global.window = global.window || {};
require(path.join(ROOT, 'cmudict.js'));
const E = require(path.join(ROOT, 'rhythm-reader/engine.js'));
const ITEMS = require('./rhythm_measure_candidates.js');

E.loadDictionary(global.window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]); // Generalization only: no memorized conventional lines.
const textTypeAt = process.argv.indexOf('--text-type');
const textType = textTypeAt >= 0 ? process.argv[textTypeAt + 1] : 'auto';

function locate(doc, ref) {
  const [word, occurrence, syllable] = ref;
  const matches = doc.words.filter(w => w.normalized === word);
  const wd = matches[occurrence - 1];
  return wd && wd.syllables[syllable];
}

function verdict(key, foil) {
  if (!key || !foil) return 'lookup-failed';
  if (key.rhythmicStress === 'S' && foil.rhythmicStress === 'W') return 'agree';
  if (key.rhythmicStress === 'W' && foil.rhythmicStress === 'S') return 'disagree';
  return key.rhythmicStress === 'S' ? 'both' : 'neither';
}

function wordIndexForRef(doc, ref) {
  const [word, occurrence] = ref;
  let seen = 0;
  for (let i = 0; i < doc.words.length; i++) {
    if (doc.words[i].normalized !== word) continue;
    seen++;
    if (seen === occurrence) return i;
  }
  return -1;
}

function readingSupports(doc, item, ip, reading) {
  const lookup = ref => {
    const [word, occurrence, syllable] = ref;
    const wi = wordIndexForRef(doc, [word, occurrence]);
    if (wi < ip.span[0] || wi > ip.span[1]) return null;
    let offset = 0;
    for (let i = ip.span[0]; i < wi; i++) offset += doc.words[i].syllables.length;
    return reading.beats[offset + syllable];
  };
  return lookup(item.key) === 'S' && lookup(item.foil) === 'W';
}

const rows = [];
const documents = new Map();
for (const item of ITEMS) {
  const doc = E.analyze(item.text, { textType });
  documents.set(item.id, doc);
  const key = locate(doc, item.key);
  const foil = locate(doc, item.foil);
  const primary = verdict(key, foil);
  const keyedCandidate = doc.phrases.some(ip =>
    (ip.readings || []).some(r => readingSupports(doc, item, ip, r)));
  rows.push({
    id: item.id,
    category: item.category,
    intendedMeter: item.meter,
    verdict: primary,
    keyedCandidate,
    regime: doc.regime.regime,
    label: doc.meterSummary.label,
    confidence: doc.meterSummary.parseConfidence
  });
}

const counts = rows.reduce((a, r) => {
  a[r.verdict] = (a[r.verdict] || 0) + 1;
  return a;
}, {});
const byCategory = {};
for (const r of rows) {
  byCategory[r.category] ||= { n: 0, agree: 0, disagree: 0, both: 0, neither: 0,
                               keyedCandidate: 0 };
  byCategory[r.category].n++;
  byCategory[r.category][r.verdict]++;
  if (r.keyedCandidate) byCategory[r.category].keyedCandidate++;
}

console.table(rows);
console.log('Default verdicts:', counts);
console.log('By contrast category:', byCategory);

if (process.argv.includes('--assert')) {
  assert.ok((counts.agree || 0) >= 39,
    `expected at least 39 strict agreements, got ${counts.agree || 0}`);
  assert.strictEqual(counts.disagree || 0, 0,
    'a candidate key is directly contradicted');
  assert.strictEqual(counts.neither || 0, 0,
    'a candidate contrast receives no default beat');
  assert.strictEqual(counts['lookup-failed'] || 0, 0,
    'a candidate reference could not be located');
  assert.ok(byCategory['function/function'].agree >= 10,
    'function/function contrasts regressed');
  assert.ok(byCategory['content/function'].agree >= 10,
    'content/function contrasts regressed');
  assert.ok(byCategory['function/content'].agree >= 10,
    'metrical function-word promotion regressed');
  assert.strictEqual(byCategory['function/content'].disagree, 0,
    'a function/content key is directly contradicted');
  assert.ok(byCategory['content/content'].agree >= 9,
    'content/content contrasts regressed');
  console.log('Candidate-item regression thresholds passed.');
}

const detailAt = process.argv.indexOf('--details');
if (detailAt >= 0) {
  const requested = new Set(process.argv.slice(detailAt + 1));
  for (const item of ITEMS.filter(x => !requested.size || requested.has(x.id))) {
    const doc = documents.get(item.id);
    console.log(`\n${item.id}: ${item.text}`);
    for (const [pi, ip] of doc.phrases.entries()) {
      const rendered = reading => {
        let k = 0;
        const words = [];
        for (let wi = ip.span[0]; wi <= ip.span[1]; wi++) {
          const wd = doc.words[wi];
          words.push(wd.syllables.map(sy => {
            const text = reading.beats[k++] === 'S' ? sy.text.toUpperCase() : sy.text.toLowerCase();
            return text;
          }).join(''));
        }
        return words.join(' ');
      };
      console.log(`  phrase ${pi + 1}, selected ${ip.selectedReadingIndex}`);
      for (const r of ip.readings) {
        console.log(`    #${r.rank} cost=${r.cost} margin=${r.margin} ` +
          `faith=${r.components.faithfulness} structure=${r.components.structure} ` +
          `eurhythmy=${r.components.eurhythmy} template=${JSON.stringify(r.template)} ` +
          `:: ${rendered(r)}`);
      }
    }
  }
}

module.exports = { rows, counts, byCategory };
