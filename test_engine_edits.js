'use strict';
/* Regressions for document edits and plain-text renderers:
 *  - applyNuclearStress clears the previous nucleus of an IP on reflow
 *  - resetWord restores the automatic, context-aware analysis
 *  - trainingSet / stimulusPair preserve hyphenated tokens present in CMU */
const assert = require('assert');
global.window = {};
require('./cmudict.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');

// Nuclear-stress flags are re-assigned, not accumulated, after a lexical edit.
{
  const doc = E.analyze('the big record');
  const i = doc.words.findIndex(w => w.normalized === 'record');
  E.editLexicalStress(doc, i, '01');
  const nuclear = doc.words[i].syllables.map(sy => !!sy.nuclear);
  assert.deepStrictEqual(nuclear, [false, true],
    'only the new primary carries the nucleus after re-stressing');
  const nuclei = doc.words.flatMap(w => w.syllables)
    .filter(sy => sy.phraseProminence === 'nucleus').length;
  assert.strictEqual(nuclei, 1, 'one nucleus per IP');
  assert.strictEqual((E.toCSV(doc).match(/nucleus/g) || []).length, 1,
    'CSV exports a single nucleus');
  assert.deepStrictEqual(doc.phrases[0].nucleus.ref, [i, 1]);
}

// resetWord re-runs the same pipeline analyze() used for that word.
{
  const doc = E.analyze('the cat and the record and the cat');
  const rec = doc.words.findIndex(w => w.normalized === 'record');
  const auto = { pattern: doc.words[rec].lexicalPattern,
                 posTag: doc.words[rec].posTag };
  assert.strictEqual(auto.pattern, '10', 'automatic reading is the noun');
  E.editLexicalStress(doc, rec, '01');
  E.resetWord(doc, rec);
  assert.strictEqual(doc.words[rec].lexicalPattern, auto.pattern,
    'reset restores the contextual reading');
  assert.strictEqual(doc.words[rec].posTag, auto.posTag,
    'reset restores the POS tag');
  assert.strictEqual(doc.words[rec].lexicalSource, 'CMU');
  assert.deepStrictEqual(doc.words[rec].userEdited,
    { lexical: false, template: false, rhythmic: false });
  const cat2 = 7;
  assert.strictEqual(doc.words[cat2].normalized, 'cat');
  E.editLexicalStress(doc, cat2, '1');
  E.resetWord(doc, cat2);
  assert.strictEqual(doc.words[cat2].given, true,
    'reset re-runs givenness marking');
}

// Hyphenated tokens that CMU lists keep every character in stimulus output.
{
  const doc = E.analyze('my mother-in-law sings');
  assert.strictEqual(E.trainingSet(doc).plain, 'my mother-in-law sings');
  const pair = E.stimulusPair(doc);
  assert.strictEqual(pair.congruent.toLowerCase(), 'my mother-in-law sings');
  assert.strictEqual(pair.incongruent.toLowerCase(), 'my mother-in-law sings');
  // Case and curly apostrophes survive too.
  const doc2 = E.analyze('Don’t stop, O’Brien!');
  assert.strictEqual(E.trainingSet(doc2).plain, 'Don’t stop, O’Brien!');
  // Hyphenated compounds analysed part by part are unaffected.
  const doc3 = E.analyze('the myriad-wear coat');
  assert.strictEqual(E.trainingSet(doc3).plain, 'the myriad-wear coat');
}

console.log('Engine edit and renderer regressions passed.');
