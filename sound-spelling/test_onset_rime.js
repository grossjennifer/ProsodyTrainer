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

console.log('Onset & Rime engine checks');

const shake = ORR.analyze('shake');
eq('shake -> onset "sh"', shake.onsetL, 'sh');
eq('shake -> onset /\u0283/', shake.onsetIPA, '\u0283');
eq('shake -> rime "ake"', shake.rimeL, 'ake');
eq('shake -> rime /e\u026Ak/', shake.rimeIPA, 'e\u026Ak');
eq('shake from lexicon', shake.source, 'lexicon');

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

eq('-ake is consistent (1 pronunciation)', ORR.families['ake'].groups.length, 1);
eq('-ove varies (3 pronunciations)', ORR.families['ove'].groups.length, 3);
eq('-ead varies (2 pronunciations)', ORR.families['ead'].groups.length, 2);
eq('-eat varies (3 pronunciations)', ORR.families['eat'].groups.length, 3);

const flake = ORR.analyze('flake');
eq('flake is estimated (out of lexicon)', flake.source, 'estimated');
eq('flake rime resolved by analogy', flake.rimeKnown, true);
eq('flake -> onset /fl/', flake.onsetIPA, 'fl');
eq('flake -> rime /e\u026Ak/ (borrowed from -ake)', flake.rimeIPA, 'e\u026Ak');

const zorp = ORR.analyze('zorp');
eq('nonsense rime (-orp) not in families', zorp.rimeKnown, false);
eq('zorp -> onset /z/', zorp.onsetIPA, 'z');
eq('CMU words loaded (night & school in lexicon)', !!ORR.LEX['night'] && !!ORR.LEX['school'], true);
eq('lexicon larger than the supplement alone', Object.keys(ORR.LEX).length > 120, true);

eq('sound inventory has 8 sounds', ORR.soundInventory().length, 8);
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
const allMarked = ORR.SPELLINGS.every(s => s.spellings.every(sp =>
  sp.ex.every(w => w.indexOf('[') >= 0 && w.indexOf(']') > w.indexOf('['))));
eq('every example marks its grapheme with [ ]', allMarked, true);

eq('/k/ top spelling is c', K.spellings[0].g, 'c');
eq('/k/ c \u2248 68%', Math.round(K.spellings[0].pct), 68);
const SH = ORR.spellingsFor('\u0283');
eq('/\u0283/ top spelling is ti (beats sh)', SH.spellings[0].g, 'ti');
const sortedWithPct = ORR.SPELLINGS.every(s => {
  const ps = s.spellings.map(x => x.pct);
  return ps.every(p => typeof p === 'number') && ps.slice(1).every((p, i) => p <= ps[i]);
});
eq('every sound: spellings carry a share and sort high\u2192low', sortedWithPct, true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
