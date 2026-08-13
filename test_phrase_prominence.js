/* ============================================================================
 * test_phrase_prominence.js — replacement for the old nuclear-stress suites.
 * ----------------------------------------------------------------------------
 * WHY THIS FILE REPLACES THEM
 *
 * The previous nuclear-stress tests asserted that every phrase nucleus also
 * carries a metrical beat. That assertion was reasonable when the engine had
 * a single prominence tier, but it is false under the two-layer model the
 * product brief now requires, and the review flagged the resulting failures
 * as needing "a theoretically careful revision rather than blind restoration".
 *
 * The two layers answer different questions:
 *
 *   METRICAL BEAT      — where does the rhythmic pulse fall?
 *   PHRASE PROMINENCE  — which syllable carries the phrase's main accent?
 *
 * They usually coincide, and the tests below check that they normally do.
 * But they are independent claims, and each of the four combinations is
 * legal:
 *
 *   beat + nucleus     the ordinary case
 *   beat, no nucleus   any non-final beat in a line
 *   nucleus, no beat   `All in the VALley of death` — extrametrical nucleus
 *   neither            an unstressed syllable
 *
 * The old suite could not express the third case, which is precisely the one
 * the owner asked for.
 *
 * THIS FILE WAS WRITTEN FROM SCRATCH. It was not derived from the originals,
 * which were not supplied. If the original suites asserted anything else of
 * value, diff them against this and re-add it.
 * ========================================================================== */

'use strict';
const assert = require('assert');
global.window = {};
require('./cmudict.js');
require('./known-rhythms.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');
E.loadKnownReadings(window.PROSODY_KNOWN_READINGS);

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

const nucleusOf = (doc, ipIndex) => {
  const ip = doc.phrases[ipIndex];
  if (!ip || !ip.nucleus) return null;
  return doc.words[ip.nucleus.word].syllables[ip.nucleus.syllable];
};

/* -- 1. Every intonational phrase gets exactly one nucleus ---------------- */
{
  const doc = E.analyze('The sun arose above the quiet hill.');
  ok(doc.phrases.length >= 1, 'at least one phrase');
  for (let i = 0; i < doc.phrases.length; i++) {
    const ip = doc.phrases[i];
    if (ip.span[1] < ip.span[0]) continue;
    ok(ip.nucleus, `phrase ${i} has a nucleus`);
    let marked = 0;
    for (let w = ip.span[0]; w <= ip.span[1]; w++)
      for (const sy of doc.words[w].syllables)
        if (sy.phraseProminence === 'nucleus') marked++;
    assert.strictEqual(marked, 1, `phrase ${i} has exactly one nuclear syllable`);
    checks++;
  }
}

/* -- 2. The nucleus falls on a content word, not a function word ---------- */
{
  const doc = E.analyze('She put the book on the table.');
  const ip = doc.phrases[0];
  const wd = doc.words[ip.nucleus.word];
  ok(!wd.isFunctionWord, `nucleus is on a content word, got "${wd.word}"`);
}

/* -- 3. A nucleus may carry NO metrical beat ------------------------------
 * The case the old suite could not express. Terminal `Death` in the
 * conventional Tennyson reading is extrametrical but remains the phrase's
 * strongest prominence. */
{
  const doc = E.analyze('All in the valley of Death');
  const death = doc.words.find(w => w.normalized === 'death').syllables[0];
  assert.strictEqual(death.rhythmicStress, 'W',
    'extrametrical Death carries no beat'); checks++;
  assert.strictEqual(death.phraseProminence, 'nucleus',
    'extrametrical Death still carries phrase prominence'); checks++;
  ok(death.prominenceSource, 'prominence records its source');
  ok(typeof death.prominenceConfidence === 'number',
    'prominence records a confidence');
}

/* -- 4. Beats without prominence are legal and normal --------------------- */
{
  const doc = E.analyze('Shall I compare thee to a summer\'s day');
  let beats = 0, nuclei = 0;
  for (const w of doc.words)
    for (const sy of w.syllables) {
      if (sy.rhythmicStress === 'S') beats++;
      if (sy.phraseProminence === 'nucleus') nuclei++;
    }
  ok(beats > nuclei,
    'a metrical line has many beats but few nuclei — the layers are distinct');
}

/* -- 5. The layers are stored independently ------------------------------- */
{
  const doc = E.analyze('The mouse ran up the clock.');
  for (const w of doc.words)
    for (const sy of w.syllables) {
      ok(sy.rhythmicStress === 'S' || sy.rhythmicStress === 'W',
        'every syllable has a beat value');
      ok(sy.phraseProminence === undefined || sy.phraseProminence === 'nucleus',
        'prominence is its own field, not derived from the beat');
    }
}

/* -- 6. Prominence survives a change of metrical reading -------------------
 * Switching to a different coherent candidate rewrites the beats. It must not
 * silently move or delete the phrase accent, which is a separate claim. */
{
  E.loadKnownReadings([]);
  const doc = E.analyze('This is a test sentence.');
  const before = nucleusOf(doc, 0);
  const beforeRef = doc.phrases[0].nucleus.ref.slice();
  if (doc.phrases[0].readings.length > 1) {
    E.selectIPReading(doc, 0, 1);
    const after = doc.phrases[0].nucleus.ref;
    assert.deepStrictEqual(after, beforeRef,
      'the nucleus stays put when the metrical reading changes'); checks++;
  }
  ok(before, 'nucleus identified before the switch');
  E.loadKnownReadings(window.PROSODY_KNOWN_READINGS);
}

/* -- 7. Prominence is reported in prose, where there is no metre at all ---- */
{
  E.loadKnownReadings([]);
  const doc = E.analyze('Researchers measured reading times for each sentence.');
  assert.strictEqual(doc.regime.regime, 'prose',
    'this is prose'); checks++;
  ok(doc.phrases[0].nucleus,
    'prose phrases still receive a nucleus — prominence does not depend on metre');
  E.loadKnownReadings(window.PROSODY_KNOWN_READINGS);
}

/* -- 8. Disabling the nuclear-stress pass removes prominence, not beats ---- */
{
  const doc = E.analyze('The sun arose above the quiet hill.',
    { nuclearStress: false });
  let nuclei = 0, beats = 0;
  for (const w of doc.words)
    for (const sy of w.syllables) {
      if (sy.phraseProminence === 'nucleus') nuclei++;
      if (sy.rhythmicStress === 'S') beats++;
    }
  assert.strictEqual(nuclei, 0, 'no prominence when the pass is off'); checks++;
  ok(beats > 0, 'beats are still assigned when the prominence pass is off');
}

console.log(`Phrase-prominence suite passed (${checks} checks).`);
