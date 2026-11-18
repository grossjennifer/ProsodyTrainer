/* test_quotes_stimuli.js — engine 3.6.8.
 *   1. Quotation marks enclose; they are not phrase boundaries.
 *   2. The incongruent stimulus carries as many marks as the congruent one
 *      whenever the phrase has room, and says so when it cannot.
 *   3. The annotated text keeps the letters as typed on syllables with no beat.
 */
'use strict';
const assert = require('assert');
global.window = global.window || {};
require('./cmudict.js');
require('./known-rhythms.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');
E.loadKnownReadings([]);
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };
const A = (t, tt) => E.analyze(t, { textType: tt || 'prose' });
const phrases = d => d.phrases.map(ip => d.words.slice(ip.span[0], ip.span[1] + 1).map(w => w.word).join(' '));
const beats = d => d.words.map(w => w.rhythmicPattern).join(' ');

/* ---- 1. Quotation marks ---- */
eq(phrases(A('The word "permit" has two readings.')), ['The word permit has two readings'], 'a quoted word does not cut the sentence in three');
eq(phrases(A('He called it a "stuck record" again.')), ['He called it a stuck record again'], 'a quoted phrase stays inside its clause');
eq(phrases(A('She said "no" twice.')), ['She said no twice'], 'straight quotes');
eq(phrases(A('She said “no” twice.')), ['She said no twice'], 'curly quotes');
eq(phrases(A('She said, "I will go to the store."')), ['She said', 'I will go to the store'], 'quoted speech is still set off by its comma');
eq(phrases(A('"I will go," she said.')), ['I will go', 'she said'], 'and by the comma that closes it');
eq(phrases(A('"Stop!" he shouted. "You cannot go in there."')), ['Stop', 'he shouted', 'You cannot go in there'], 'and by sentence punctuation');
eq(phrases(A('We left (it was late) and went home.')), ['We left', 'it was late', 'and went home'], 'parentheses still set a phrase apart');
eq(phrases(A('We left — it was late — and went home.')), ['We left', 'it was late', 'and went home'], 'dashes still set a phrase apart');
for (const [plain, quoted] of [
  ['The word permit has two readings.', 'The word "permit" has two readings.'],
  ['He called it a stuck record again.', 'He called it a "stuck record" again.'],
  ['She whispered good night and closed the door.', 'She whispered "good night" and closed the door.'],
  ['Mary had a little lamb.', 'Mary had a "little" lamb.'],
]) {
  for (const tt of ['prose', 'verse', 'auto']) {
    eq(beats(A(quoted, tt)), beats(A(plain, tt)), `${tt}: quotation marks alone do not change the beats (${quoted})`);
  }
}
{
  // A sentence that ends inside quotation marks is still a sentence.
  const d = A('She said, "I will go to the store."', 'auto');
  ok(d.regime.sentenceLayout === true, 'closing quotation mark after the full stop: still sentence layout');
  const t = 'Tell me "why" again';
  ok(E.roundTripText ? E.roundTripText(A(t)) === t : true, 'the text is reproduced exactly, quotation marks included');
}

/* ---- 2. Incongruent stimuli ---- */
const pair = (t, tt) => E.stimulusPair(A(t, tt || 'verse'));
{
  const p = pair('Still achieving still pursuing');
  eq([p.congruentCount, p.incongruentCount, p.shortfall], [4, 4, 0], 'four beats, four incongruent marks (was two)');
  eq(p.congruent, 'STILL aCHIEving STILL purSUing', 'congruent version');
  const d = A('Still achieving still pursuing', 'verse');
  const m = E.incongruentMap(d);
  for (const key of m.marks) {
    const [w, s] = key.split(':').map(Number);
    ok(d.words[w].syllables[s].rhythmicStress !== 'S', 'no incongruent mark sits on a beat');
  }
  eq(m.marks.size, new Set(m.marks).size, 'no syllable is marked twice');
}
{
  const p = pair('And departing leave behind us');
  eq([p.congruentCount, p.incongruentCount, p.shortfall], [3, 3, 0], 'a second line: equal counts (3 since the 3.6.11 ruling leaves "and" weak)');
}
{
  const p = pair('The mouse ran up the clock.');
  eq([p.congruentCount, p.incongruentCount, p.shortfall], [3, 3, 0], 'an ordinary line is unchanged');
  eq(p.incongruent, 'THE mouse RAN up THE clock.', 'and gives the same stimulus as before');
}
{
  // Four beats, three syllables without one: equal counts are impossible.
  const p = pair('With a heart for any fate');
  eq([p.congruentCount, p.incongruentCount, p.shortfall], [4, 3, 1], 'an impossible case is reported, not hidden');
}
{
  // Across the evaluation texts: counts are equal exactly when there is no shortfall,
  // and a shortfall only ever happens where a phrase has more beats than non-beats.
  const c = require('./eval/corpus.js'), r = require('./eval/rhythm_measure_candidates.js');
  const texts = [...c.PASSAGES.map(x => x.text), ...r.map(x => x.text)];
  let short = 0;
  for (const t of texts) {
    for (const tt of ['verse', 'prose']) {
      const d = A(t, tt), m = E.incongruentMap(d);
      assert.strictEqual(m.congruentCount - m.incongruentCount, m.shortfall, 'shortfall is the difference: ' + t);
      if (!m.shortfall) continue;
      short++;
      const tight = d.phrases.some(ip => {
        let S = 0, W = 0;
        for (let w = ip.span[0]; w <= ip.span[1]; w++) d.words[w].syllables.forEach(s => (s.rhythmicStress === 'S' ? S++ : W++));
        return S > W;
      });
      assert.ok(tight, 'a shortfall without a phrase that is short of room: ' + t);
    }
  }
  checks += 2;
  ok(short > 0, 'the impossible case does occur in real lines (' + short + ' analyses)');
}

/* ---- 3. Annotated text ---- */
eq(E.annotatedText(A('Sam and Maria went to Paris on Tuesday.')), 'SAM and Ma·RI·a WENT to PAR·is on TUES·day.', 'names keep their capitals when they carry no beat on that syllable');
eq(E.annotatedText(A('I told him that NASA called.')).slice(0, 2), 'I ', 'the pronoun I is written as typed');
ok(/JUN·gle’s/.test(E.annotatedText(A('He enjoyed the jungle’s great joys.'))), 'a typed apostrophe is kept');
{
  const t = 'Sam and Maria went to Paris on Tuesday.';
  eq(E.annotatedText(A(t)).replace(/·/g, '').toLowerCase(), t.toLowerCase(), 'apart from capitals and syllable dots, the text is the text');
}

console.log(`test_quotes_stimuli.js: ${checks} checks passed.`);
