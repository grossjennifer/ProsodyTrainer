/* ============================================================================
 * eval/prose_score.js — from two markers' sheets to a scored engine.
 * ----------------------------------------------------------------------------
 * The 40 ordinary sentences in eval/prose_gold_candidates.js are being marked
 * independently by two people in the sheet "Prose Stress Marking: 40
 * Sentences" (capitals on each stressed syllable: "the DOG ran aWAY"). This
 * script does everything that follows, in one pass:
 *
 *   1. reads both markers' files (.xlsx, .csv, .tsv, or pasted text);
 *   2. turns each marking into a per-syllable S/W pattern;
 *   3. reports how far the two markers agree (percent, Cohen's kappa);
 *   4. writes the disagreements to a rulings sheet for the owner to settle;
 *   5. builds the gold readings: agreed items, plus any that have been ruled;
 *   6. scores the engine against that gold, overall and by probed pattern.
 *
 * Usage
 *   node eval/prose_score.js --a markerA.xlsx --b markerB.csv
 *   node eval/prose_score.js --a A.xlsx --b B.xlsx --rulings rulings.csv
 *   node eval/prose_score.js --score-only            (uses eval/prose_gold.json)
 *
 * Options
 *   --a, --b <file>      the two markers' files
 *   --rulings <file>     the owner's rulings on disagreements (see step 4)
 *   --out <dir>          where the rulings sheet and gold are written
 *                        (default: eval/). Use a scratch directory to try
 *                        things without touching the repository's gold.
 *   --score-only         skip steps 1–5; score against the existing gold
 *   --text-type <t>      text type for scoring: prose | auto | both (default both)
 *   --json <file>        also write the scores as JSON (a snapshot)
 *   --baseline <file>    compare with an earlier snapshot; exit 1 if any
 *                        sentence that matched the gold then no longer does
 *   --verbose            print every sentence, not only the mismatches
 *
 * What the engine's own syllables are used for
 *   A marker's capitals have to be placed on syllables, and the only
 *   syllable division available is the engine's. Each unbroken run of
 *   capitals is ONE beat, on the syllable holding the run's first letter
 *   (the rule eval/harness.js already uses), so "TELLing" and "TELling"
 *   mean the same thing whatever division the engine chose.
 *
 * Three things capitals cannot say, and how they are handled
 *   - The pronoun "I" is always a capital. It cannot be marked, so it is
 *     left out of every count (shown as "·" in patterns).
 *   - A capital that is only spelling ("He", "Sam", "Tuesday") is not a
 *     beat: a single capital at the start of a word that the sentence
 *     itself capitalises is ignored. "SAM" or "TUESday" is a beat.
 *   - A word typed all in capitals ("BEFORE") names the word, not the
 *     syllable. The beat is placed on the word's dictionary stress and the
 *     item is flagged in the report.
 * ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

/* ---- Engine bootstrap ----------------------------------------------------
 * Stored readings are switched off: the point of this set is to measure what
 * the engine works out for itself on sentences it has never seen. */
let E = null;
function engine(enginePath) {
  if (E) return E;
  global.window = global.window || {};
  require(path.join(ROOT, 'cmudict.js'));
  E = require(enginePath || path.join(ROOT, 'rhythm-reader/engine.js'));
  E.loadDictionary(global.window.CMUDICT_FULL, 'full');
  E.loadKnownReadings([]);
  return E;
}

/* ==========================================================================
 * 1. Reading a marker's file
 * ======================================================================== */

const ITEM_ID = /^P\d{2}$/;

/* Minimal .xlsx reader: enough for a sheet of text cells. An .xlsx file is a
 * zip archive; this walks its central directory, inflates the two parts it
 * needs, and reads cell values. No dependency. */
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive (is this really an .xlsx file?)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('damaged zip directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files[name] = () => (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function xmlText(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');
}

function readXlsx(buf) {
  const files = unzip(buf);
  const shared = [];
  if (files['xl/sharedStrings.xml']) {
    const xml = files['xl/sharedStrings.xml']();
    for (const si of xml.match(/<si\b[^>]*>[\s\S]*?<\/si>|<si\b[^>]*\/>/g) || []) {
      // Phonetic runs (<rPh>) are a reading aid, not cell text.
      const body = si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
      shared.push((body.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || [])
        .map(t => xmlText(t.replace(/<[^>]+>/g, ''))).join(''));
    }
  }
  const sheetName = Object.keys(files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))[0];
  if (!sheetName) throw new Error('no worksheet found in the .xlsx file');
  const xml = files[sheetName]();
  const rows = [];
  for (const row of xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) || []) {
    const cells = [];
    for (const c of row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (/\br="([A-Z]+)\d+"/.exec(c) || [])[1];
      if (!ref) continue;
      let col = 0;
      for (const ch of ref) col = col * 26 + (ch.charCodeAt(0) - 64);
      const type = (/\bt="([^"]+)"/.exec(c) || [])[1];
      let value = '';
      if (type === 'inlineStr') {
        value = (c.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || []).map(t => xmlText(t.replace(/<[^>]+>/g, ''))).join('');
      } else {
        const v = (/<v>([\s\S]*?)<\/v>/.exec(c) || [])[1];
        if (v !== undefined) value = type === 's' ? (shared[+v] || '') : xmlText(v);
      }
      cells[col - 1] = value;
    }
    rows.push(Array.from(cells, v => v || ''));
  }
  return rows;
}

/* RFC 4180 delimited text: quoted fields, doubled quotes, newlines in fields. */
function readDelimited(text, delim) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* Pasted text, one item per line: "P01 he forGOT to LOCK the DOOR", with or
 * without a full stop, colon, dash or tab after the id. */
function readPlain(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(P\d{2})\b[\s.:)\-–—|]*(.*?)\s*$/.exec(line);
    if (m) rows.push([m[1], '', m[2], '']);
  }
  return rows;
}

function readTable(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  if (ext === '.xlsx') return readXlsx(buf);
  const text = buf.toString('utf8').replace(/^﻿/, '');
  if (ext === '.csv') return readDelimited(text, ',');
  if (ext === '.tsv') return readDelimited(text, '\t');
  // No recognised extension: a table if it looks like one, else pasted lines.
  const tabbed = readDelimited(text, '\t');
  if (tabbed.some(r => r.length >= 3 && ITEM_ID.test((r[0] || '').trim()))) return tabbed;
  return readPlain(text);
}

/* The marking is in the third column ("Your marking"). A marker who typed
 * over the Sentence column instead is still understood. A rulings sheet is
 * read by its "Ruling" header. */
function readMarkings(file, candidates, wantColumn) {
  const rows = readTable(file);
  const byId = new Map(candidates.map(c => [c.id, c]));
  let col = 2;
  if (wantColumn) {
    const header = rows.find(r => r.some(c => new RegExp('^\\s*' + wantColumn + '\\s*$', 'i').test(c || '')));
    if (!header) throw new Error(`${path.basename(file)}: no "${wantColumn}" column found`);
    col = header.findIndex(c => new RegExp('^\\s*' + wantColumn + '\\s*$', 'i').test(c || ''));
  }
  const out = new Map();
  const problems = [];
  for (const r of rows) {
    const id = (r[0] || '').trim().toUpperCase();
    if (!ITEM_ID.test(id)) continue;
    if (!byId.has(id)) { problems.push(`${id}: not one of the ${candidates.length} items`); continue; }
    if (out.has(id)) { problems.push(`${id}: appears more than once; the first is used`); continue; }
    let marking = (r[col] || '').trim();
    if (!marking && !wantColumn) {
      const second = (r[1] || '').trim();
      if (second && second !== byId.get(id).text) marking = second;
    }
    const notes = wantColumn ? '' : (r[3] || '').trim();
    out.set(id, { marking, notes });
  }
  return { markings: out, problems };
}

/* ==========================================================================
 * 2. From capitals to a per-syllable pattern
 * ======================================================================== */

const WORDISH = /\p{L}+(?:['’]\p{L}+)*(?:-\p{L}+(?:['’]\p{L}+)*)*/gu;
const letters = s => s.replace(/[^\p{L}]/gu, '');
const isUpper = ch => ch !== ch.toLowerCase() && ch === ch.toUpperCase();
const fold = s => letters(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* One analysis per sentence, used only for its words and syllable division. */
const docCache = new Map();
function divisionOf(text) {
  if (!docCache.has(text)) docCache.set(text, engine().analyze(text, { textType: 'prose' }));
  return docCache.get(text);
}

function syllableRanges(word) {
  const ranges = [];
  let off = 0;
  for (const sy of word.syllables) {
    const len = letters(sy.text).length;
    ranges.push([off, off + len]);
    off += len;
  }
  return ranges;
}

/* Returns { perWord: ['W', 'WS', '·', …], flags: [...] } or { error }.
 * 'S' beat, 'W' no beat, '·' cannot be marked (the pronoun "I"). */
function patternOf(text, marking) {
  const doc = divisionOf(text);
  const original = text.match(WORDISH) || [];
  const tokens = (marking || '').match(WORDISH) || [];
  if (!tokens.length) return { error: 'blank' };
  if (tokens.length !== doc.words.length) {
    return { error: `has ${tokens.length} words; the sentence has ${doc.words.length}` };
  }
  const flags = [];
  const perWord = [];
  for (let wi = 0; wi < doc.words.length; wi++) {
    const tok = letters(tokens[wi]);
    const orig = letters(original[wi] || '');
    if (fold(tok) !== fold(orig)) {
      return { error: `word ${wi + 1} is "${tokens[wi]}"; the sentence has "${original[wi]}"` };
    }
    const word = doc.words[wi];
    if (orig === 'I') { perWord.push('·'.repeat(word.syllables.length)); continue; }

    const ranges = syllableRanges(word);
    const at = i => { const k = ranges.findIndex(([a, b]) => i >= a && i < b); return k === -1 ? ranges.length - 1 : k; };
    const beats = new Set();
    for (let i = 0; i < tok.length; i++) {
      if (!isUpper(tok[i]) || (i > 0 && isUpper(tok[i - 1]))) continue;
      let end = i;
      while (end + 1 < tok.length && isUpper(tok[end + 1])) end++;
      // A lone capital that the sentence itself has there is spelling.
      if (i === 0 && end === 0 && tok.length > 1 && orig[0] && isUpper(orig[0])) continue;
      if (i === 0 && end === tok.length - 1 && ranges.length > 1) {
        // The whole word in capitals: put the beat on its dictionary stress.
        const primary = word.syllables.findIndex(s => s.lexicalStress === '1');
        beats.add(primary === -1 ? 0 : primary);
        flags.push(`"${tokens[wi]}" is all capitals; beat placed on its dictionary stress`);
        continue;
      }
      beats.add(at(i));
    }
    perWord.push(word.syllables.map((_, si) => (beats.has(si) ? 'S' : 'W')).join(''));
  }
  return { perWord, flags };
}

function enginePattern(text, textType) {
  const doc = engine().analyze(text, { textType });
  return {
    perWord: doc.words.map(w => w.syllables.map(s => (s.rhythmicStress === 'S' ? 'S' : 'W')).join('')),
    regime: doc.regime && doc.regime.regime,
  };
}

/* "he forGOT to LOCK the DOOR": a pattern shown the way a marker types it.
 * One case needs care so that what is shown reads back as the same pattern:
 * a beat on a one-letter first syllable of a word the sentence capitalises
 * ("Our" as O·ur, "Even" as E·ven) would look like spelling, so the whole
 * word is shown in capitals, which patternOf reads as that word's stress. */
function render(text, perWord) {
  const doc = divisionOf(text);
  const original = text.match(WORDISH) || [];
  return doc.words.map((w, wi) => {
    const pat = perWord[wi];
    if (pat[0] === '\u00b7') return original[wi] || w.word;   // the pronoun "I", as typed
    const plain = w.syllables.map((s, si) =>
      (pat[si] === 'S' ? s.text.toUpperCase() : s.text.toLowerCase())).join('');
    const orig = letters(original[wi] || '');
    const lone = pat[0] === 'S' && pat.indexOf('S', 1) === -1 && letters(w.syllables[0].text).length === 1;
    if (lone && w.syllables.length > 1 && orig[0] && isUpper(orig[0]) &&
        w.syllables[0].lexicalStress === '1') return plain.toUpperCase();
    return plain;
  }).join(' ');
}

/* The syllables on which two patterns differ, as "DOOR, when". */
function differing(text, a, b) {
  const doc = divisionOf(text);
  const out = [];
  doc.words.forEach((w, wi) => w.syllables.forEach((s, si) => {
    const x = a[wi][si], y = b[wi][si];
    if (x !== '·' && y !== '·' && x !== y) out.push(w.syllables.length > 1 ? `${s.text} (in ${w.word})` : s.text);
  }));
  return out;
}

/* ==========================================================================
 * 3. Agreement between two patterns, or two sets of patterns
 * ======================================================================== */

/* Counts over the syllables both could mark. a/b are perWord arrays. */
function tally(a, b, into) {
  const t = into || { both: 0, onlyA: 0, onlyB: 0, neither: 0 };
  for (let wi = 0; wi < a.length; wi++) {
    for (let si = 0; si < a[wi].length; si++) {
      const x = a[wi][si], y = b[wi][si];
      if (x === '·' || y === '·') continue;
      if (x === 'S' && y === 'S') t.both++;
      else if (x === 'S') t.onlyA++;
      else if (y === 'S') t.onlyB++;
      else t.neither++;
    }
  }
  return t;
}

const same = (a, b) => { const t = tally(a, b); return t.onlyA === 0 && t.onlyB === 0; };

/* Percent agreement and Cohen's kappa for a 2×2 beat / no-beat table. Kappa
 * is undefined (null) when chance agreement is total, e.g. no beats at all. */
function agreement(t) {
  const n = t.both + t.onlyA + t.onlyB + t.neither;
  if (!n) return { n: 0, percent: null, kappa: null };
  const po = (t.both + t.neither) / n;
  const pa = (t.both + t.onlyA) / n, pb = (t.both + t.onlyB) / n;
  const pe = pa * pb + (1 - pa) * (1 - pb);
  return { n, percent: po, kappa: pe >= 1 ? null : (po - pe) / (1 - pe) };
}

const pct = x => (x === null || x === undefined ? 'n/a' : (100 * x).toFixed(1) + '%');
const num = x => (x === null || x === undefined ? 'n/a' : x.toFixed(2));

/* Landis & Koch's conventional bands, for readers who want a word. */
function kappaBand(k) {
  if (k === null) return '';
  return k < 0 ? 'worse than chance' : k <= 0.20 ? 'slight' : k <= 0.40 ? 'fair' :
    k <= 0.60 ? 'moderate' : k <= 0.80 ? 'substantial' : 'almost perfect';
}

/* ==========================================================================
 * 4–5. Comparing the markers, the rulings sheet, and the gold
 * ======================================================================== */

function compareMarkers(candidates, A, B) {
  const items = [];
  const total = { both: 0, onlyA: 0, onlyB: 0, neither: 0 };
  for (const c of candidates) {
    const a = A.markings.get(c.id), b = B.markings.get(c.id);
    const pa = a ? patternOf(c.text, a.marking) : { error: 'missing' };
    const pb = b ? patternOf(c.text, b.marking) : { error: 'missing' };
    const item = { id: c.id, text: c.text, pattern: c.pattern, a: pa, b: pb,
      notesA: a ? a.notes : '', notesB: b ? b.notes : '' };
    if (pa.error || pb.error) item.status = 'unusable';
    else {
      tally(pa.perWord, pb.perWord, total);
      item.status = same(pa.perWord, pb.perWord) ? 'agreed' : 'disagreed';
      if (item.status === 'disagreed') item.differ = differing(c.text, pa.perWord, pb.perWord);
    }
    items.push(item);
  }
  return { items, total, stats: agreement(total) };
}

const csvCell = v => (/[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);

/* The rulings sheet. The engine's own reading is deliberately not on it, so
 * that the ruling is made on the two human readings alone. */
function rulingsSheet(comparison, existing) {
  const lines = [['Item', 'Sentence', 'Marker A', 'Marker B', 'They differ on', 'Ruling', 'Notes A', 'Notes B']];
  for (const it of comparison.items) {
    if (it.status !== 'disagreed') continue;
    const kept = existing && existing.get(it.id) ? existing.get(it.id).marking : '';
    lines.push([it.id, it.text, render(it.text, it.a.perWord), render(it.text, it.b.perWord),
      it.differ.join('; '), kept, it.notesA, it.notesB]);
  }
  return lines.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
}

function buildGold(comparison, rulings) {
  const gold = [];
  const open = [];
  const badRulings = [];
  for (const it of comparison.items) {
    if (it.status === 'agreed') {
      // Where one marker could not mark a syllable ("I"), neither could the other.
      gold.push({ id: it.id, text: it.text, marked: render(it.text, it.a.perWord),
        perWord: it.a.perWord, source: 'agreed' });
    } else if (it.status === 'disagreed') {
      const r = rulings && rulings.get(it.id);
      if (r && r.marking) {
        const p = patternOf(it.text, r.marking);
        if (p.error) { badRulings.push(`${it.id}: the ruling ${p.error}`); open.push(it.id); continue; }
        const matches = same(p.perWord, it.a.perWord) ? 'A' : same(p.perWord, it.b.perWord) ? 'B' : 'neither';
        gold.push({ id: it.id, text: it.text, marked: render(it.text, p.perWord),
          perWord: p.perWord, source: 'ruled', rulingMatches: matches });
      } else open.push(it.id);
    }
  }
  return { gold, open, badRulings };
}

/* ==========================================================================
 * 6. Scoring the engine
 * ======================================================================== */

function scoreEngine(gold, candidates, textType) {
  const probe = new Map(candidates.map(c => [c.id, c.pattern]));
  const rows = [];
  const total = { both: 0, onlyA: 0, onlyB: 0, neither: 0 };   // A = engine, B = gold
  const byProbe = new Map();
  for (const g of gold) {
    const e = enginePattern(g.text, textType);
    const t = tally(e.perWord, g.perWord);
    tally(e.perWord, g.perWord, total);
    const exact = t.onlyA === 0 && t.onlyB === 0;
    const row = { id: g.id, exact, added: t.onlyA, missed: t.onlyB, regime: e.regime,
      engine: render(g.text, e.perWord), gold: g.marked, probe: probe.get(g.id) || '' };
    rows.push(row);
    const p = byProbe.get(row.probe) || { n: 0, exact: 0, added: 0, missed: 0 };
    p.n++; p.exact += exact ? 1 : 0; p.added += t.onlyA; p.missed += t.onlyB;
    byProbe.set(row.probe, p);
  }
  return { textType, rows, total, stats: agreement(total),
    exact: rows.filter(r => r.exact).length, n: rows.length,
    readAsVerse: rows.filter(r => r.regime && r.regime !== 'prose').length,
    byProbe: [...byProbe.entries()].sort((x, y) => x[1].exact / x[1].n - y[1].exact / y[1].n) };
}

/* ==========================================================================
 * Report
 * ======================================================================== */

/* "P13–P24, P26" from a list of ids. */
function ranges(ids) {
  const n = ids.map(id => parseInt(id.slice(1), 10)).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < n.length; i++) {
    let j = i;
    while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
    const id = k => 'P' + String(k).padStart(2, '0');
    out.push(j > i ? `${id(n[i])}\u2013${id(n[j])}` : id(n[i]));
    i = j;
  }
  return out.join(', ');
}

/* A path as the user would type it: relative inside the working directory. */
function shown(p) {
  const rel = path.relative(process.cwd(), p);
  return rel.startsWith('..') ? p : rel;
}

function printComparison(cmp, nameA, nameB, log) {
  const usable = cmp.items.filter(i => i.status !== 'unusable');
  const agreed = cmp.items.filter(i => i.status === 'agreed');
  const s = cmp.stats;
  log('TWO MARKERS');
  log(`  A: ${nameA}`);
  log(`  B: ${nameB}`);
  log(`  Sentences both marked usably: ${usable.length} of ${cmp.items.length}`);
  log(`  Sentences marked identically: ${agreed.length} of ${usable.length}`);
  log(`  Syllables compared: ${s.n}   agreement ${pct(s.percent)}   Cohen's kappa ${num(s.kappa)}` +
      (s.kappa === null ? '' : ` (${kappaBand(s.kappa)})`));
  log(`  Beats: both ${cmp.total.both}, only A ${cmp.total.onlyA}, only B ${cmp.total.onlyB}`);
  const lean = cmp.total.onlyA - cmp.total.onlyB;
  if (Math.abs(lean) >= 5) log(`  Marker ${lean > 0 ? 'A' : 'B'} marks more beats overall (${Math.abs(lean)} more).`);

  const empty = e => e === 'blank' || e === 'missing';
  for (const [name, key] of [['A', 'a'], ['B', 'b']]) {
    const blank = cmp.items.filter(i => empty(i[key].error)).map(i => i.id);
    if (blank.length) log(`  Not yet marked by ${name}: ${blank.length} (${ranges(blank)})`);
  }
  const broken = cmp.items.filter(i => (i.a.error && !empty(i.a.error)) || (i.b.error && !empty(i.b.error)));
  if (broken.length) {
    log('\n  Could not be read (the marking does not match the sentence word for word):');
    for (const it of broken) {
      if (it.a.error && !empty(it.a.error)) log(`    ${it.id}  A ${it.a.error}`);
      if (it.b.error && !empty(it.b.error)) log(`    ${it.id}  B ${it.b.error}`);
    }
  }
  const flagged = cmp.items.filter(i => (i.a.flags && i.a.flags.length) || (i.b.flags && i.b.flags.length));
  if (flagged.length) {
    log('\n  Read with an assumption:');
    for (const it of flagged) {
      for (const f of it.a.flags || []) log(`    ${it.id}  A: ${f}`);
      for (const f of it.b.flags || []) log(`    ${it.id}  B: ${f}`);
    }
  }
  const dis = cmp.items.filter(i => i.status === 'disagreed');
  if (dis.length) {
    log(`\n  Disagreements (${dis.length}):`);
    for (const it of dis) {
      log(`    ${it.id}  A: ${render(it.text, it.a.perWord)}`);
      log(`         B: ${render(it.text, it.b.perWord)}`);
      log(`         differ on: ${it.differ.join('; ')}`);
    }
  }
}

function printScore(sc, verbose, log) {
  log(`\nENGINE ${engine().build || ''} — text type: ${sc.textType}`);
  log(`  Sentences matching the gold exactly: ${sc.exact} of ${sc.n}`);
  log(`  Syllables: ${pct(sc.stats.percent)} correct   kappa with gold ${num(sc.stats.kappa)}`);
  log(`  Beats the engine added: ${sc.total.onlyA}   beats it missed: ${sc.total.onlyB}`);
  if (sc.textType === 'auto') log(`  Read as verse, not prose: ${sc.readAsVerse} of ${sc.n}`);
  log('  By probed pattern (worst first):');
  for (const [name, p] of sc.byProbe) {
    log(`    ${String(p.exact).padStart(2)}/${String(p.n).padEnd(2)}  +${p.added} −${p.missed}  ${name}`);
  }
  const listed = verbose ? sc.rows : sc.rows.filter(r => !r.exact);
  if (listed.length) log(verbose ? '  Every sentence:' : '  Mismatches:');
  for (const r of listed) {
    log(`    ${r.id} ${r.exact ? 'ok ' : `+${r.added} −${r.missed}`}  engine: ${r.engine}`);
    if (!r.exact) log(`                 gold:   ${r.gold}`);
  }
}

/* ==========================================================================
 * Command line
 * ======================================================================== */

function main(argv, log) {
  log = log || console.log;
  const opt = (name, dflt) => { const i = argv.indexOf('--' + name); return i === -1 ? dflt : argv[i + 1]; };
  const flag = name => argv.includes('--' + name);
  const candidates = require('./prose_gold_candidates.js');
  const outDir = path.resolve(opt('out', path.join(ROOT, 'eval')));
  const goldPath = path.join(outDir, 'prose_gold.json');
  engine(opt('engine') && path.resolve(opt('engine')));

  let gold;
  if (flag('score-only')) {
    if (!fs.existsSync(goldPath)) {
      log(`No gold yet at ${shown(goldPath)}. Run with --a and --b first.`);
      return 2;
    }
    gold = JSON.parse(fs.readFileSync(goldPath, 'utf8')).items;
  } else {
    const fa = opt('a'), fb = opt('b');
    if (!fa || !fb) {
      log('Usage: node eval/prose_score.js --a <marker A file> --b <marker B file> [--rulings <file>]');
      log('       node eval/prose_score.js --score-only');
      return 2;
    }
    const A = readMarkings(fa, candidates), B = readMarkings(fb, candidates);
    for (const p of A.problems) log(`Note (A): ${p}`);
    for (const p of B.problems) log(`Note (B): ${p}`);
    const cmp = compareMarkers(candidates, A, B);
    printComparison(cmp, path.basename(fa), path.basename(fb), log);

    const rulingsFile = opt('rulings');
    const rulings = rulingsFile ? readMarkings(rulingsFile, candidates, 'Ruling').markings : null;
    const built = buildGold(cmp, rulings);
    for (const b of built.badRulings) log(`\nRuling not usable — ${b}`);

    fs.mkdirSync(outDir, { recursive: true });
    const sheetPath = path.join(outDir, 'prose_rulings.csv');
    const nDis = cmp.items.filter(i => i.status === 'disagreed').length;
    if (nDis) {
      fs.writeFileSync(sheetPath, rulingsSheet(cmp, rulings));
      log(`\nRULINGS`);
      log(`  ${nDis} disagreement${nDis === 1 ? '' : 's'} written to ${shown(sheetPath)}.`);
      log(`  Settled: ${nDis - built.open.length}.  Still open: ${built.open.length}` +
          (built.open.length ? ` (${built.open.join(', ')})` : '') + '.');
      if (built.open.length) {
        log('  To settle one, type the reading you accept in its Ruling column (capitals on');
        log('  stressed syllables), save, and run again with --rulings <that file>.');
      }
    }
    gold = built.gold;
    fs.writeFileSync(goldPath, JSON.stringify({
      about: 'Gold prose readings built by eval/prose_score.js. Do not edit by hand: change a marking or a ruling and rebuild.',
      built: new Date().toISOString().slice(0, 10),
      markerA: path.basename(fa), markerB: path.basename(fb),
      rulings: rulingsFile ? path.basename(rulingsFile) : null,
      divisionFromEngine: engine().build || null,
      agreement: { sentencesCompared: cmp.items.filter(i => i.status !== 'unusable').length,
        sentencesIdentical: cmp.items.filter(i => i.status === 'agreed').length,
        syllables: cmp.stats.n, percent: cmp.stats.percent, kappa: cmp.stats.kappa },
      open: built.open,
      items: gold,
    }, null, 2) + '\n');
    log(`\nGOLD`);
    log(`  ${gold.length} of ${candidates.length} sentences have a gold reading ` +
        `(${gold.filter(g => g.source === 'agreed').length} agreed, ${gold.filter(g => g.source === 'ruled').length} ruled).`);
    log(`  Written to ${shown(goldPath)}.`);

    // How close is the engine to each marker, next to how close they are to each other?
    for (const [name, M] of [['A', A], ['B', B]]) {
      const t = { both: 0, onlyA: 0, onlyB: 0, neither: 0 };
      let n = 0, exact = 0;
      for (const c of candidates) {
        const m = M.markings.get(c.id);
        const p = m ? patternOf(c.text, m.marking) : { error: 'missing' };
        if (p.error) continue;
        const e = enginePattern(c.text, 'prose');
        tally(e.perWord, p.perWord, t); n++; if (same(e.perWord, p.perWord)) exact++;
      }
      const s = agreement(t);
      log(`  Engine (Prose) against marker ${name} alone: ${exact} of ${n} sentences, ` +
          `${pct(s.percent)} of syllables, kappa ${num(s.kappa)}.`);
    }
    log(`  The two markers against each other: kappa ${num(cmp.stats.kappa)}. ` +
        `The engine cannot be expected to agree with them more than they agree with each other.`);
  }

  if (!gold.length) { log('\nNo gold readings to score against yet.'); return 0; }

  const want = opt('text-type', 'both');
  const types = want === 'both' ? ['prose', 'auto'] : [want];
  const scores = types.map(t => scoreEngine(gold, candidates, t));
  for (const sc of scores) printScore(sc, flag('verbose'), log);

  const snapshot = { engine: engine().build || null, gold: gold.length,
    scores: scores.map(sc => ({ textType: sc.textType, exact: sc.exact, n: sc.n,
      percent: sc.stats.percent, added: sc.total.onlyA, missed: sc.total.onlyB,
      items: Object.fromEntries(sc.rows.map(r => [r.id, { exact: r.exact, engine: r.engine }])) })) };
  if (opt('json')) fs.writeFileSync(path.resolve(opt('json')), JSON.stringify(snapshot, null, 2) + '\n');

  let status = 0;
  if (opt('baseline')) {
    const base = JSON.parse(fs.readFileSync(path.resolve(opt('baseline')), 'utf8'));
    log(`\nAGAINST THE EARLIER SNAPSHOT (engine ${base.engine})`);
    for (const now of snapshot.scores) {
      const was = (base.scores || []).find(s => s.textType === now.textType);
      if (!was) continue;
      const lost = [], won = [], moved = [];
      for (const [id, r] of Object.entries(now.items)) {
        const b = was.items[id];
        if (!b) continue;
        if (b.exact && !r.exact) lost.push(id);
        else if (!b.exact && r.exact) won.push(id);
        else if (b.engine !== r.engine) moved.push(id);
      }
      log(`  ${now.textType}: ${was.exact} → ${now.exact} of ${now.n}.  Newly right: ${won.join(', ') || 'none'}.  ` +
          `Newly wrong: ${lost.join(', ') || 'none'}.  Changed but still wrong: ${moved.join(', ') || 'none'}.`);
      if (lost.length) status = 1;
    }
    if (status) log('  A sentence that matched the gold no longer does. Exit status 1.');
  }
  return status;
}

module.exports = { readTable, readXlsx, readDelimited, readPlain, readMarkings, patternOf, render,
  differing, tally, agreement, kappaBand, compareMarkers, rulingsSheet, buildGold, scoreEngine, main };

if (require.main === module) process.exit(main(process.argv.slice(2)));
