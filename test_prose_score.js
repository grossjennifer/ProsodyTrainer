/* test_prose_score.js — the pipeline that turns two markers' sheets into gold
 * prose readings and a scored engine (eval/prose_score.js). Every marking
 * used here is synthetic (eval/fixtures/); nothing here is a gold reading.
 * All output goes to a temporary directory: the repository's own
 * eval/prose_gold.json is never written by this test. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const S = require('./eval/prose_score.js');
const candidates = require('./eval/prose_gold_candidates.js');

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };
const FX = path.join(__dirname, 'eval', 'fixtures');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-score-'));
const text = id => candidates.find(c => c.id === id).text;
const pat = (id, marking) => S.patternOf(text(id), marking);

/* ---- Capitals to patterns ---- */
eq(pat('P01', 'he forGOT to LOCK the DOOR when he LEFT').perWord,
   ['W', 'WS', 'W', 'S', 'W', 'S', 'W', 'W', 'S'], 'capitals become beats');
eq(pat('P01', 'He forGOT to LOCK the DOOR when he LEFT.').perWord,
   pat('P01', 'he forGOT to LOCK the DOOR when he LEFT').perWord, 'a sentence capital and a full stop change nothing');
eq(pat('P04', 'Our MEEting has been MOVED to THREE on TUESday.').perWord,
   pat('P04', 'Our MEETing has been MOVED to THREE on TUESday.').perWord, 'where the capitals stop inside a word does not matter');
eq(pat('P30', 'Sam fell OUT of the caNOE.').perWord[0], 'W', 'a spelling capital on a name is not a beat');
eq(pat('P30', 'SAM fell OUT of the caNOE.').perWord[0], 'S', 'a name in capitals is a beat');
eq(pat('P04', 'Our MEETing has been MOVED to THREE on Tuesday.').perWord[8], 'WW', 'Tuesday as spelled carries no beat');
eq(pat('P04', 'Our MEETing has been MOVED to THREE on TUESday.').perWord[8], 'SW', 'TUESday carries one');
eq(pat('P25', 'I would LIKE a CUP of COFfee with my BREAKfast.').perWord[0], '·', 'the pronoun I cannot be marked');
{
  const p = pat('P07', 'She WANTed to FINish the CHAPter BEFORE DINner.');
  eq(p.perWord[6], 'WS', 'a word all in capitals takes its dictionary stress, not its first syllable');
  ok(p.flags.length === 1 && /BEFORE/.test(p.flags[0]), 'and the assumption is flagged');
}
eq(pat('P02', 'HE asked whether she had seen it').perWord[0], 'S', 'a one-syllable word in capitals is a beat even at the start');
ok(/7 words/.test(pat('P10', 'NObody could LEAVE unTIL the STORM PASSED.').error), 'a dropped word is reported, not guessed at');
ok(/word 2 is "forgets"/.test(pat('P01', 'He forgets to lock the door when he left.').error), 'a changed word is reported');
eq(pat('P11', '').error, 'blank', 'a blank marking is blank');
eq(pat('P01', 'he forGOT to LOCK the DOOR when he LEFT').perWord.join('').length, 10, 'one mark per syllable');

/* ---- What is shown reads back as itself ---- */
for (const c of candidates) {
  const e = S.patternOf(c.text, c.text.toLowerCase()).perWord;            // no beats
  const all = e.map(w => w.replace(/W/g, 'S'));                           // every syllable a beat
  const first = e.map(w => (w[0] === '·' ? w : 'S' + w.slice(1)));   // word-initial beats
  for (const p of [e, first]) {
    const back = S.patternOf(c.text, S.render(c.text, p));
    ok(!back.error && S.tally(back.perWord, p).onlyA + S.tally(back.perWord, p).onlyB === 0,
      `${c.id}: a rendered pattern reads back unchanged`);
  }
  ok(all.join('').length === e.join('').length, `${c.id}: patterns have a stable length`);
}

/* ---- Agreement arithmetic ---- */
{
  const a = S.agreement({ both: 20, onlyA: 5, onlyB: 10, neither: 15 });
  eq(a.n, 50, 'syllables counted');
  ok(Math.abs(a.percent - 0.70) < 1e-12, 'percent agreement');
  ok(Math.abs(a.kappa - 0.40) < 1e-12, "Cohen's kappa (textbook case: po .70, pe .50)");
  eq(S.agreement({ both: 0, onlyA: 0, onlyB: 0, neither: 12 }).kappa, null, 'kappa is undefined when nobody marks a beat');
  eq(S.agreement({ both: 7, onlyA: 0, onlyB: 0, neither: 9 }).kappa, 1, 'identical markings give kappa 1');
  eq(S.kappaBand(0.9), 'almost perfect', 'kappa bands');
  eq(S.kappaBand(0.5), 'moderate', 'kappa bands');
  const t = S.tally(['S', '·', 'WS'], ['W', '·', 'WS']);
  eq(t, { both: 1, onlyA: 1, onlyB: 0, neither: 1 }, 'unmarkable syllables are left out of the count');
}

/* ---- Reading files ---- */
const A = S.readMarkings(path.join(FX, 'synthetic_marker_a.xlsx'), candidates);
const B = S.readMarkings(path.join(FX, 'synthetic_marker_b.csv'), candidates);
const Bt = S.readMarkings(path.join(FX, 'synthetic_marker_b_pasted.txt'), candidates);
eq(A.markings.size, 40, 'xlsx: every item row is found below the instruction rows');
eq(A.markings.get('P01').marking, 'He forGOT to LOCK the DOOR when he LEFT.', 'xlsx: the marking column is read');
eq(A.markings.get('P01').notes, 'SYNTHETIC test marking', 'xlsx: notes are kept');
eq(A.markings.get('P13').marking, '', 'xlsx: an empty cell is a blank marking');
eq(B.markings.get('P09').marking, 'AFter the MEETing ENDed, they WENT out for LUNCH.', 'csv: a comma inside a sentence survives');
eq(B.markings.get('P02').notes, 'unsure, "whether" could go either way', 'csv: quoted notes survive');
eq(Bt.markings.get('P02').marking, B.markings.get('P02').marking, 'pasted text gives the same marking as the sheet');
eq(S.readDelimited('a,"b ""c"", d"\r\n"x\ny",z\n', ','), [['a', 'b "c", d'], ['x\ny', 'z']], 'delimited text: quotes and line breaks in fields');
eq(S.readPlain('P01. he LEFT\nP02: she\nnot an item\n  P03 - it  \n').map(r => [r[0], r[2]]),
   [['P01', 'he LEFT'], ['P02', 'she'], ['P03', 'it']], 'pasted lines: id, then the marking');
{
  // A marker who typed over the Sentence column instead of the marking column.
  const f = path.join(tmp, 'over.csv');
  fs.writeFileSync(f, 'Item,Sentence,Your marking,Notes\nP30,SAM fell OUT of the caNOE.,,\nP20,This is a test sentence.,,\n');
  const M = S.readMarkings(f, candidates).markings;
  eq(M.get('P30').marking, 'SAM fell OUT of the caNOE.', 'a marking typed into the Sentence column is still found');
  eq(M.get('P20').marking, '', 'an untouched sentence is not mistaken for a marking');
  const g = path.join(tmp, 'dup.csv');
  fs.writeFileSync(g, 'P30,x,one,\nP30,x,two,\nP99,x,three,\n');
  const D = S.readMarkings(g, candidates);
  eq(D.markings.get('P30').marking, 'one', 'a repeated item keeps its first marking');
  ok(D.problems.length === 2, 'a repeated item and an unknown item are both reported');
}

/* ---- Comparing the two markers ---- */
const cmp = S.compareMarkers(candidates, A, B);
const status = id => cmp.items.find(i => i.id === id).status;
eq(['P01', 'P04', 'P06', 'P07', 'P12', 'P25'].map(status), Array(6).fill('agreed'), 'identical beats agree, however they were typed');
eq(['P02', 'P03', 'P05', 'P08', 'P09', 'P30'].map(status), Array(6).fill('disagreed'), 'different beats disagree');
eq(['P10', 'P11', 'P13'].map(status), Array(3).fill('unusable'), 'a dropped word and a blank are set aside');
eq(cmp.items.find(i => i.id === 'P08').differ, ['not'], 'the differing syllable is named');
eq(cmp.items.find(i => i.id === 'P02').differ, ['wheth (in whether)'], 'and placed in its word');
eq([cmp.total.both, cmp.total.onlyA, cmp.total.onlyB], [47, 5, 1], 'beat counts across the twelve usable sentences');
ok(cmp.stats.kappa > 0.85 && cmp.stats.kappa < 0.95, 'kappa for the fixture');

/* ---- Rulings and gold ---- */
const sheet = S.rulingsSheet(cmp, null);
const rows = S.readDelimited(sheet, ',');
eq(rows[0], ['Item', 'Sentence', 'Marker A', 'Marker B', 'They differ on', 'Ruling', 'Notes A', 'Notes B'], 'rulings sheet header');
eq(rows.slice(1).map(r => r[0]), ['P02', 'P03', 'P05', 'P08', 'P09', 'P30'], 'one row per disagreement, and only those');
ok(rows.slice(1).every(r => r[5] === ''), 'the Ruling column starts empty');
ok(!/engine/i.test(sheet), "the engine's reading is not shown to the person ruling");

const R = S.readMarkings(path.join(FX, 'synthetic_rulings.csv'), candidates, 'Ruling').markings;
const built = S.buildGold(cmp, R);
const g = id => built.gold.find(x => x.id === id);
eq(built.gold.filter(x => x.source === 'agreed').length, 6, 'agreed sentences become gold');
eq(built.gold.filter(x => x.source === 'ruled').map(x => x.id), ['P02', 'P05', 'P30'], 'ruled sentences become gold');
eq(built.open, ['P03', 'P08', 'P09'], 'unruled disagreements stay out of the gold');
ok(built.badRulings.length === 1 && /^P08/.test(built.badRulings[0]), 'a ruling that does not match the sentence is refused');
eq([g('P02').rulingMatches, g('P05').rulingMatches, g('P30').rulingMatches], ['A', 'B', 'neither'], 'a ruling may side with A, with B, or with neither');
eq(g('P30').marked, 'SAM FELL out of the caNOE', 'a ruled reading is stored as marked');
ok(!g('P10') && !g('P11'), 'unusable sentences are never gold');
eq(S.buildGold(cmp, null).gold.length, 6, 'with no rulings, only agreed sentences are gold');
{
  // A sheet with rulings already typed keeps them when it is rewritten.
  const again = S.readDelimited(S.rulingsSheet(cmp, R), ',');
  eq(again.find(r => r[0] === 'P05')[5], 'my SISter BOUGHT a new CAR last WEEK', 'rewriting the sheet keeps rulings already made');
}

/* ---- Scoring the engine ---- */
const sc = S.scoreEngine(built.gold, candidates, 'prose');
eq(sc.n, 9, 'every gold sentence is scored');
ok(sc.rows.every(r => r.exact === (r.added === 0 && r.missed === 0)), 'exact means no beat added and none missed');
ok(sc.rows.every(r => r.probe), 'each sentence carries the pattern it was chosen to probe');
eq(sc.byProbe.reduce((n, [, p]) => n + p.n, 0), 9, 'the by-pattern table covers every sentence once');
ok(sc.total.onlyA === sc.rows.reduce((n, r) => n + r.added, 0), 'added beats sum');
{
  // Score the engine against itself: it must be perfect, which checks the plumbing.
  const E = require('./rhythm-reader/engine.js');
  const self = candidates.map(c => {
    const d = E.analyze(c.text, { textType: 'prose' });
    return { id: c.id, text: c.text, perWord: d.words.map(w => w.syllables.map(s => (s.rhythmicStress === 'S' ? 'S' : 'W')).join('')) };
  }).map(x => ({ ...x, marked: S.render(x.text, x.perWord) }));
  const perfect = S.scoreEngine(self, candidates, 'prose');
  eq([perfect.exact, perfect.total.onlyA, perfect.total.onlyB], [40, 0, 0], "the engine scores 40 of 40 against its own readings");
  // And those readings survive being typed out and read back, "I" aside.
  let back = 0;
  for (const x of self) {
    const p = S.patternOf(x.text, x.marked);
    const t = S.tally(p.perWord, x.perWord);
    if (!p.error && t.onlyA === 0 && t.onlyB === 0) back++;
  }
  eq(back, 40, 'all 40 engine readings survive render and read-back');
}

/* ---- The command, end to end, in a scratch directory ---- */
{
  const lines = [];
  const log = s => lines.push(s);
  const base = ['--a', path.join(FX, 'synthetic_marker_a.xlsx'), '--b', path.join(FX, 'synthetic_marker_b.csv'), '--out', tmp];
  eq(S.main([...base, '--rulings', path.join(FX, 'synthetic_rulings.csv'), '--text-type', 'prose',
    '--json', path.join(tmp, 'snap.json')], log), 0, 'the command runs');
  const out = lines.join('\n');
  ok(/Sentences marked identically: 6 of 12/.test(out), 'report: agreement');
  ok(/Not yet marked by B: 27 \(P11, P13–P24, P26–P29, P31–P40\)/.test(out), 'report: unmarked items as ranges');
  ok(/P10 {2}B has 7 words/.test(out), 'report: the unreadable item');
  ok(/9 of 40 sentences have a gold reading \(6 agreed, 3 ruled\)/.test(out), 'report: gold');
  ok(/Still open: 3 \(P03, P08, P09\)/.test(out), 'report: open disagreements');
  const gold = JSON.parse(fs.readFileSync(path.join(tmp, 'prose_gold.json'), 'utf8'));
  eq(gold.items.length, 9, 'gold file written');
  eq(gold.open, ['P03', 'P08', 'P09'], 'gold file records what is still open');
  ok(gold.markerA === 'synthetic_marker_a.xlsx' && gold.agreement.sentencesIdentical === 6, 'gold file records where it came from');
  ok(fs.existsSync(path.join(tmp, 'prose_rulings.csv')), 'rulings sheet written');

  // Score-only, against the snapshot just taken: nothing changed, status 0.
  lines.length = 0;
  eq(S.main(['--score-only', '--out', tmp, '--text-type', 'prose', '--baseline', path.join(tmp, 'snap.json')], log), 0, 'unchanged engine: status 0');
  ok(/Newly wrong: none/.test(lines.join('\n')), 'report: nothing newly wrong');

  // A snapshot that claims a now-wrong sentence used to be right must fail the run.
  const snap = JSON.parse(fs.readFileSync(path.join(tmp, 'snap.json'), 'utf8'));
  const wrong = Object.entries(snap.scores[0].items).find(([, r]) => !r.exact)[0];
  snap.scores[0].items[wrong].exact = true;
  fs.writeFileSync(path.join(tmp, 'better.json'), JSON.stringify(snap));
  lines.length = 0;
  eq(S.main(['--score-only', '--out', tmp, '--text-type', 'prose', '--baseline', path.join(tmp, 'better.json')], log), 1, 'a sentence lost against the baseline: status 1');
  ok(new RegExp('Newly wrong: ' + wrong).test(lines.join('\n')), 'report: names the sentence that was lost');

  lines.length = 0;
  eq(S.main(['--score-only', '--out', path.join(tmp, 'empty')], log), 2, 'score-only with no gold: status 2, with a message');
  eq(S.main([], log), 2, 'no arguments: usage, status 2');
}

/* ---- The repository's own gold is untouched ---- */
ok(!fs.existsSync(path.join(__dirname, 'eval', 'prose_gold.json')) ||
   !/synthetic/.test(fs.readFileSync(path.join(__dirname, 'eval', 'prose_gold.json'), 'utf8')),
   'no synthetic marking has reached eval/prose_gold.json');
ok(candidates.every(c => c.gold === null), 'the candidates file still carries no gold (gold lives in prose_gold.json)');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`test_prose_score.js: ${checks} checks passed.`);
