/* Regression checks for the Onset & Rime prototype engine.
 * Extracts the engine <script> from index.html and exercises it.
 * Run with: node test_onset_rime.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const dict = fs.readFileSync(path.join(__dirname, '..', 'cmudict-subset.js'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const engine = scripts.find(s => s.includes('g.ORR = {'));
if (!engine) { console.error('engine script not found'); process.exit(1); }

const sandbox = { window: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(dict, sandbox);     // sets window.CMUDICT_SUBSET
vm.runInContext(engine, sandbox);
const ORR = sandbox.window.ORR;

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (got === want) { pass++; console.log('  \u2713 ' + label); }
  else { fail++; console.error('  \u2717 ' + label + '  got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)); }
}
function ok(label, cond) { eq(label, !!cond, true); }
function ipas(fam) { return fam.groups.map(g => g.ipa); }

console.log('Onset & Rime engine checks');

/* ---------- one-syllable words: onset + rime (unchanged behaviour) ---------- */
const shake = ORR.analyze('shake');
eq('shake -> onset "sh"', shake.onsetL, 'sh');
eq('shake -> onset /\u0283/', shake.onsetIPA, '\u0283');
eq('shake -> rime "ake"', shake.rimeL, 'ake');
eq('shake -> rime /e\u026Ak/', shake.rimeIPA, 'e\u026Ak');
eq('shake from lexicon', shake.source, 'lexicon');
eq('shake is one syllable', shake.multisyllabic, false);
eq('shake syllableCount 1', shake.syllableCount, 1);

const cat = ORR.analyze('cat');
eq('cat -> onset /k/', cat.onsetIPA, 'k');
eq('cat -> rime /\u00E6t/', cat.rimeIPA, '\u00E6t');

const eat = ORR.analyze('eat');
eq('eat -> no onset', eat.onsetL, '');
eq('eat -> rime /i\u02D0t/', eat.rimeIPA, 'i\u02D0t');

const knead = ORR.analyze('knead');
eq('knead -> onset letters "kn"', knead.onsetL, 'kn');
eq('knead -> onset /n/ (silent k)', knead.onsetIPA, 'n');
eq('knead -> rime /i\u02D0d/', knead.rimeIPA, 'i\u02D0d');

/* ---------- rime families over monosyllables (lexicon-robust) ---------- */
eq('-ake is consistent (1 pronunciation)', ORR.families['ake'].groups.length, 1);
eq('-ake sound is /e\u026Ak/', ORR.families['ake'].groups[0].ipa, 'e\u026Ak');
ok('-ove varies (>= 3 pronunciations)', ORR.families['ove'].groups.length >= 3);
ok('-ove includes /\u028Cv/, /u\u02D0v/, /o\u028Av/',
  ['\u028Cv','u\u02D0v','o\u028Av'].every(x => ipas(ORR.families['ove']).indexOf(x) >= 0));
ok('-ead varies (>= 2 pronunciations)', ORR.families['ead'].groups.length >= 2);
ok('-ead includes /\u025Bd/ and /i\u02D0d/',
  ['\u025Bd','i\u02D0d'].every(x => ipas(ORR.families['ead']).indexOf(x) >= 0));
ok('-eat varies (>= 3 pronunciations)', ORR.families['eat'].groups.length >= 3);
ok('-eat includes /i\u02D0t/, /e\u026At/, /\u025Bt/',
  ['i\u02D0t','e\u026At','\u025Bt'].every(x => ipas(ORR.families['eat']).indexOf(x) >= 0));
ok('many rime families now (> 100)', Object.keys(ORR.families).length > 100);

/* ---------- out-of-lexicon estimation ---------- */
const flake = ORR.analyze('flake');
eq('flake is estimated (out of lexicon)', flake.source, 'estimated');
eq('flake rime resolved by analogy', flake.rimeKnown, true);
eq('flake -> onset /fl/', flake.onsetIPA, 'fl');
eq('flake -> rime /e\u026Ak/ (borrowed from -ake)', flake.rimeIPA, 'e\u026Ak');

const zilb = ORR.analyze('zilb');
eq('nonsense rime (-ilb) not in families', zilb.rimeKnown, false);
eq('zilb -> onset /z/', zilb.onsetIPA, 'z');
eq('CMU words loaded (night & school in lexicon)', !!ORR.LEX['night'] && !!ORR.LEX['school'], true);
eq('lexicon larger than the supplement alone', Object.keys(ORR.LEX).length > 120, true);

/* ---------- NEW: syllable-level onset & rime for multisyllabic words ---------- */
// Onsets and rimes are syllable-internal, so a disyllable has TWO of each
// (Treiman, Fowler, Gross, Berch & Weatherston, 1995).
const rabbit = ORR.analyze('rabbit');
eq('rabbit is multisyllabic', rabbit.multisyllabic, true);
eq('rabbit has 2 syllables', rabbit.syllableCount, 2);
eq('rabbit syllable 1 onset /r/', rabbit.syllables[0].onsetIPA, 'r');
eq('rabbit syllable 1 rime /\u00E6b/', rabbit.syllables[0].rimeIPA, '\u00E6b');
eq('rabbit syllable 2 has no onset', rabbit.syllables[1].onsetIPA, '');
eq('rabbit syllable 2 rime /\u0259t/ (schwa)', rabbit.syllables[1].rimeIPA, '\u0259t');
eq('rabbit stress on first syllable', rabbit.syllables[0].stress, 1);
eq('rabbit spells as rab\u00B7bit', rabbit.syllables.map(s => s.text).join('\u00B7'), 'rab\u00B7bit');

const about = ORR.analyze('about');
eq('about has 2 syllables', about.syllableCount, 2);
eq('about syllable 1 no onset', about.syllables[0].onsetIPA, '');
eq('about syllable 1 rime /\u0259/', about.syllables[0].rimeIPA, '\u0259');
eq('about syllable 2 onset /b/', about.syllables[1].onsetIPA, 'b');
eq('about syllable 2 rime /a\u028At/', about.syllables[1].rimeIPA, 'a\u028At');
eq('about stress on second syllable', about.syllables[1].stress, 1);

const teacher = ORR.analyze('teacher');
eq('teacher syllable 2 onset /t\u0283/ (affricate)', teacher.syllables[1].onsetIPA, 't\u0283');
eq('teacher syllable 2 rime /\u0259r/ (schwar, reduced)', teacher.syllables[1].rimeIPA, '\u0259r');

const computer = ORR.analyze('computer');
eq('computer has 3 syllables', computer.syllableCount, 3);
eq('computer final rime /\u0259r/', computer.syllables[2].rimeIPA, '\u0259r');

// Regression for the coverage bug: common multisyllabic words must get the syllable
// treatment (from the bundled word list) even if the shared dictionary lacks them,
// NOT the old whole-word "onset + remainder" split.
['elephant','computer','rabbit','teacher','remember','table','about'].forEach(function(w){
  var a=ORR.analyze(w);
  ok(w+' is treated as multisyllabic (not whole-word split)', a.multisyllabic===true && a.syllableCount>=2);
  ok(w+' rime is not the whole remainder', a.syllables[0].text.length < w.length);
});
eq('elephant has 3 syllables', ORR.analyze('elephant').syllableCount, 3);

// Out-of-lexicon multisyllabic words degrade gracefully to a spelling split (letters,
// no fabricated sounds) rather than the broken single-cell view.
var oov = ORR.analyze('splonktarp');
eq('oov multisyllabic is flagged multisyllabic', oov.multisyllabic, true);
eq('oov multisyllabic has no fabricated sound', oov.soundKnown, false);
ok('oov multisyllabic splits into 2 syllables', oov.syllableCount===2);
ok('oov syllables carry letter onset/rime', oov.syllables[0].text==='splonk' && oov.syllables[1].text==='tarp');
ok('oov syllable 1 onset letters "spl"', oov.syllables[0].onsetL==='spl');
// silent-e words are still one syllable (flake stays monosyllabic / estimated)
eq('flake stays one syllable (silent e)', ORR.analyze('flake').syllableCount, 1);

// the pure syllabifier is exposed and applies the stressed-lax-vowel-keeps-coda rule
const sy = ORR.syllabify(['B','AE1','S','K','IH0','T']);   // basket
eq('syllabify basket -> 2 syllables', sy.length, 2);
eq('basket syllable 1 keeps coda /s/ (bas.ket)', ORR.ipaString(sy[0].rime), '\u00E6s');
eq('basket syllable 1 coda is /s/ and syllable 2 onset is /k/',
  ORR.ipaString(sy[0].coda) === 's' && sy[1].onset.map(p => p.replace(/[0-9]/g,'')).join('') === 'K', true);

/* ---------- sound -> spelling inventory: full English phoneme set ---------- */
eq('inventory covers the full phoneme set (>= 39)', ORR.soundInventory().length >= 39, true);
ok('inventory includes newly added consonants /\u014B/ /\u03B8/ /\u00F0/ /\u0292/',
  ['\u014B','\u03B8','\u00F0','\u0292'].every(x => ORR.soundInventory().indexOf(x) >= 0));
ok('inventory includes newly added vowels /\u0259/ /a\u026A/ /\u0254\u026A/ /\u025C\u02D0r/',
  ['\u0259','a\u026A','\u0254\u026A','\u025C\u02D0r'].every(x => ORR.soundInventory().indexOf(x) >= 0));
const groups = ORR.soundGroups();
eq('sounds are split into consonants + vowels', groups.length, 2);
ok('consonants group has /\u014B/', groups[0].sounds.indexOf('\u014B') >= 0);
ok('vowels group has schwa /\u0259/', groups[1].sounds.indexOf('\u0259') >= 0);

const K = ORR.spellingsFor('k');
eq('/k/ shows 5 spellings', K.spellings.length, 5);
eq('/k/ includes ck', K.spellings.some(s => s.g === 'ck'), true);
eq('/k/ includes ch', K.spellings.some(s => s.g === 'ch'), true);
const F = ORR.spellingsFor('f');
eq('/f/ includes ph', F.spellings.some(s => s.g === 'ph'), true);
eq('/f/ includes gh', F.spellings.some(s => s.g === 'gh'), true);
const AY = ORR.spellingsFor('e\u026A');
eq('/e\u026A/ includes split digraph a_e', AY.spellings.some(s => s.g === 'a_e'), true);
eq('/e\u026A/ includes eigh', AY.spellings.some(s => s.g === 'eigh'), true);
// new sounds carry correct spelling options
ok('/\u03B8/ is spelled th', ORR.spellingsFor('\u03B8').spellings.some(s => s.g === 'th'));
ok('/\u014B/ includes ng', ORR.spellingsFor('\u014B').spellings.some(s => s.g === 'ng'));
ok('/d\u0292/ includes dge', ORR.spellingsFor('d\u0292').spellings.some(s => s.g === 'dge'));
ok('/\u0254\u026A/ includes oy', ORR.spellingsFor('\u0254\u026A').spellings.some(s => s.g === 'oy'));
ok('schwa /\u0259/ has several vowel-letter spellings', ORR.spellingsFor('\u0259').spellings.length >= 3);

const allMarked = ORR.SPELLINGS.every(s => s.spellings.every(sp =>
  sp.ex.every(w => w.indexOf('[') >= 0 && w.indexOf(']') > w.indexOf('['))));
eq('every example marks its grapheme with [ ]', allMarked, true);

eq('/k/ top spelling is c', K.spellings[0].g, 'c');
eq('/k/ c \u2248 68%', Math.round(K.spellings[0].pct), 68);
const SH = ORR.spellingsFor('\u0283');
eq('/\u0283/ top spelling is ti (beats sh)', SH.spellings[0].g, 'ti');

// where corpus shares are given, they must be numbers sorted high -> low
const sharedSounds = ORR.SPELLINGS.filter(s => typeof s.spellings[0].pct === 'number');
ok('a handful of sounds carry corpus shares', sharedSounds.length >= 8);
const sortedWithPct = sharedSounds.every(s => {
  const ps = s.spellings.map(x => x.pct);
  return ps.every(p => typeof p === 'number') && ps.slice(1).every((p, i) => p <= ps[i]);
});
eq('shared sounds: every spelling has a share, sorted high\u2192low', sortedWithPct, true);
// sounds without corpus shares still list spellings + examples (no fabricated figures)
const plainOk = ORR.SPELLINGS.filter(s => typeof s.spellings[0].pct !== 'number')
  .every(s => s.spellings.length >= 1 && s.spellings.every(sp => !('pct' in sp)));
eq('un-scored sounds list spellings without inventing percentages', plainOk, true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
