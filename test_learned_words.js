'use strict';
/* Remembered words (engine 3.4.0): a reader's corrected word stress or
 * syllable division, kept so the next analysis starts from it.
 * Guards: nothing changes with an empty list; heteronyms and function words
 * are never remembered; corrupt entries are rejected; remembered words are
 * immune to metrical syncope; forgetting restores the automatic analysis. */
const assert = require('assert');
const E = require('./rhythm-reader/engine.js');
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };

const SMALL = {
  WE: 'W IY1', FLEW: 'F L UW1', TO: 'T UW1|T AH0', IN: 'IH0 N|IH1 N', MAY: 'M EY1',
  PLEASE: 'P L IY1 Z', IT: 'IH1 T', THE: 'DH AH0|DH IY0', CAT: 'K AE1 T',
  RECORD: 'R EH1 K ER0 D|R IH0 K AO1 R D', ADULT: 'AH0 D AH1 L T|AE1 D AH0 L T',
  EVERY: 'EH1 V ER0 IY0|EH1 V R IY0', BIRD: 'B ER1 D'
};
E.loadDictionary(SMALL, 'test');
const words = d => d.words.map(w => w.syllables.map(s => s.text).join('·') + ':' + w.lexicalPattern);
const strip = d => JSON.stringify(d.words.map(w => [w.lexicalPattern, w.lexicalSource,
  w.syllables.map(s => s.text + s.rhythmicStress).join('.')]));

// 1. Empty list = previous behaviour, and the engine starts empty.
eq(E.getLearnedWords(), {}, 'engine starts with no remembered words');
const text = 'We flew to Jaen in May.';
const before = strip(E.analyze(text));
eq(E.loadLearnedWords({}), { loaded: 0, rejected: 0 }, 'empty load');
eq(strip(E.analyze(text)), before, 'an empty list changes nothing');

// 2. Unedited word cannot be remembered.
let d = E.analyze(text);
const ji = d.words.findIndex(w => w.normalized === 'jaen');
eq(E.learnWord(d, ji), { ok: false, reason: 'not-edited' }, 'unedited word refused');

// 3. Split + stress, remember, applied to a new analysis of a new sentence.
E.splitSyllable(d, ji, 0, 2);
E.editLexicalStress(d, ji, '01');
const r = E.learnWord(d, ji);
ok(r.ok, 'edited word is remembered');
eq(r.entry.syllables.map(s => s.text), ['ja', 'en'], 'syllable division stored');
eq(r.entry.pattern, '01', 'stress stored');
eq(r.entry.defaultPattern, '1', 'automatic pattern stored for later comparison');
eq(r.entry.engineBuild, E.build, 'entry records the engine build');
ok(d.words[ji].editHistory.some(h => h.op === 'remember'), 'remembering is in the edit history');
const d2 = E.analyze('Jaen is far.');
eq(words(d2)[0], 'ja·en:01', 'remembered word applied in a new sentence');
eq(d2.words[0].lexicalSource, 'learned', 'source reported as learned');
eq(d2.words[0].lexicalRule, 'remembered-word', 'rule reported');
eq(d2.words[0].userEdited, { lexical: false, template: false, rhythmic: false },
  'a remembered word is not a user edit in the new document');
eq(d2.stats.learnedRate, 0.33, 'statistics count learned words separately');
ok(!('learnedRate' in E.analyze('We flew.').stats), 'no learned rate when unused');

// 4. resetWord returns to the remembered analysis, not the dictionary.
E.editLexicalStress(d2, 0, '10');
E.resetWord(d2, 0);
eq(words(d2)[0], 'ja·en:01', 'reset restores the remembered analysis');

// 5. Refusals: heteronym and function word.
d = E.analyze('Please record it.');
let i = d.words.findIndex(w => w.normalized === 'record');
E.editLexicalStress(d, i, '10');
eq(E.learnWord(d, i), { ok: false, reason: 'context-heteronym' }, 'heteronym refused');
eq(E.learnableWord('Record'), 'context-heteronym', 'learnableWord reports heteronym');
d = E.analyze('the cat');
E.editLexicalStress(d, 0, '1');
eq(E.learnWord(d, 0), { ok: false, reason: 'function-word' }, 'function word refused');
eq(E.learnableWord('jaen'), null, 'ordinary word is learnable');
// heteronyms keep their contextual reading even if a list tries to force one
E.loadLearnedWords(Object.assign(E.getLearnedWords(),
  { record: { syllables: [{ text: 're', stress: '1' }, { text: 'cord', stress: '0' }] } }));
ok(!('record' in E.getLearnedWords()), 'a heteronym in an imported list is rejected');

// 6. A non-heteronym CMU variant word (adult) can be remembered and keeps
//    its dictionary pronunciations as alternates.
d = E.analyze('An adult.');
i = d.words.findIndex(w => w.normalized === 'adult');
const auto = d.words[i].lexicalPattern;
const altIdx = d.words[i].alternates.findIndex(a => a.pattern !== auto);
E.selectPronunciation(d, i, altIdx);
const ra = E.learnWord(d, i);
ok(ra.ok, 'a chosen dictionary pronunciation can be remembered');
const d3 = E.analyze('Every adult.');
const ad = d3.words.find(w => w.normalized === 'adult');
eq(ad.lexicalPattern, ra.entry.pattern, 'remembered pronunciation applied');
ok(ad.syllables.every(s => Array.isArray(s.phonemes)), 'phonemes kept with the pronunciation');
ok(ad.alternates.some(a => a.pattern === auto), 'the dictionary default stays available');

// 7. Same-as-default refused.
d = E.analyze('We flew.');
E.editLexicalStress(d, 1, '1');
eq(E.learnWord(d, 1).reason, 'same-as-default', 'no-op correction refused');

// 8. refreshWord updates unedited instances only.
E.forgetWord('jaen');
d = E.analyze('Jaen and Jaen.');
const idx = d.words.map((w, k) => w.normalized === 'jaen' ? k : -1).filter(k => k >= 0);
E.editRhythmicStress(d, idx[1], 0, 'W');           // second instance edited
E.splitSyllable(d, idx[0], 0, 2); E.editLexicalStress(d, idx[0], '01');
E.learnWord(d, idx[0]);
eq(E.refreshWord(d, 'jaen'), 0, 'edited instances are not refreshed');
d = E.analyze('Jaen, Jaen.');
E.forgetWord('jaen');
eq(E.refreshWord(d, 'jaen'), 2, 'forgetting refreshes unedited instances');
ok(d.words.every(w => w.lexicalSource !== 'learned'), 'forgotten word reverts');

// 9. Load validation.
const res = E.loadLearnedWords({
  jaen: { syllables: [{ text: 'xx', stress: '1' }] },                 // letters mismatch
  ok:   { syllables: [{ text: 'o', stress: '0' }, { text: 'k', stress: '9' }] }, // bad digit
  nope: { syllables: [{ text: 'nope', stress: '0' }] },               // no stress
  bogus: null,
  zorb: { syllables: [{ text: 'zo', stress: '0' }, { text: 'rb', stress: '1' }] }
});
eq(res, { loaded: 1, rejected: 4 }, 'invalid entries rejected, valid one kept');
eq(Object.keys(E.getLearnedWords()), ['zorb'], 'only the valid entry remains');
const gw = E.getLearnedWords(); gw.zorb.pattern = '10';
eq(E.getLearnedWords().zorb.pattern, '01', 'getLearnedWords returns a copy');

// 10. Metrical syncope never touches a remembered word.
globalThis.window = globalThis.window || globalThis;
require('./cmudict.js');
E.loadDictionary(globalThis.window.CMUDICT_FULL, 'full');
const SYNC = 'Then the little Hiawatha learned of every bird its language';
E.loadLearnedWords({});
const control = E.analyze(SYNC, { textType: 'verse' });
ok(control.words.some(w => w.lexicalRule === 'metrical-syncope'),
  'control: syncope does apply to the unremembered word');
E.loadLearnedWords({ every: { syllables: [
  { text: 'ev', stress: '1', phonemes: ['EH1', 'V'] },
  { text: 'er', stress: '0', phonemes: ['ER0'] },
  { text: 'y', stress: '0', phonemes: ['IY0'] }] } });
d = E.analyze(SYNC, { textType: 'verse' });
ok(d.words.filter(w => w.normalized === 'every').every(w =>
  w.syllables.length === 3 && w.lexicalRule !== 'metrical-syncope'),
  'syncope leaves remembered words alone');

E.loadDictionary(SMALL, 'test');
E.loadLearnedWords({});
eq(strip(E.analyze(text)), before, 'clearing the list restores the original analysis');
console.log(checks + ' remembered-word checks passed.');
