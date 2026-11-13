'use strict';
/* Cost decomposition (engine 3.5.0). For every candidate reading of every
 * phrase in the eval corpus, under every text type and clash setting:
 *   (1) explainReading() reproduces the cost the engine ranked it by, and
 *   (2) that cost equals fixed + sum(W[k] * features[k]) exactly.
 * If a weight is ever used without being counted, (2) fails. */
const assert = require('assert');
global.window = global.window || {};
require('./cmudict.js');
require('./known-rhythms.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(global.window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);
const corpus = require('./eval/corpus.js');
const texts = corpus.PASSAGES.map(p => p.text)
  .concat((corpus.PROMOTION_PROBES || []).map(p => p.text))
  .concat(['The girls conversed about school, and the birds sang.',
           'One fish two fish red fish blue fish.',
           'Researchers measured reading times for each sentence.']);
const W = E.getWeights();
const KEYS = E.featureKeys;
let n = 0, maxErr = 0;
const configs = [
  { textType: 'auto' }, { textType: 'verse' }, { textType: 'prose' },
  { textType: 'auto', strictAlternation: true },
  { textType: 'auto', clashSubordination: false }];
for (const cfg of configs) {
  for (const text of texts) {
    const doc = E.analyze(text, cfg);
    doc.phrases.forEach((ip, pi) => {
      for (const r of ip.readings || []) {
        const x = E.explainReading(doc, pi, r.beats);
        assert(x, 'explainReading returned null for ' + text);
        const lin = x.fixed + KEYS.reduce((s, k) => s + W[k] * x.features[k], 0);
        maxErr = Math.max(maxErr, Math.abs(lin - x.cost));
        assert(Math.abs(lin - x.cost) < 1e-9,
          `cost ${x.cost} != fixed+W·f ${lin} for "${text}" ${r.beats.join('')}`);
        assert(Math.abs(Math.round(x.cost * 100) / 100 - r.cost) < 0.0051,
          `explained cost ${x.cost} != ranked cost ${r.cost} for "${text}"`);
        n++;
      }
    });
  }
}
// Shape checks.
const d = E.analyze('The mouse ran up the clock.');
assert.strictEqual(E.explainReading(d, 0, 'SW'), null, 'wrong length rejected');
assert.strictEqual(E.explainReading(d, 9, 'S'), null, 'bad phrase index rejected');
assert(!JSON.stringify(d).includes('_scoring'), 'scoring context is not serialised');
console.log(`${n} candidate readings decomposed exactly (max error ${maxErr.toExponential(1)}).`);
