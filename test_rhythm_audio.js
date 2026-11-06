/* ============================================================================
 * test_rhythm_audio.js — the tap track ("Hear the beat") in both tools.
 * ----------------------------------------------------------------------------
 * Part 1 tests the timetable (RhythmAudio.schedule) against the real engine
 * with the full dictionary: the claims the feature makes about timing.
 *   • every syllable is played exactly once, in reading order;
 *   • beats are isochronous within a phrase, and a comma inside metrical
 *     text does not break the beat grid;
 *   • an upbeat ("the" in "the MOUSE") does not push the first beat late;
 *   • a sentence boundary adds a rest of at least one beat;
 *   • the schedule follows the reader's edits (editRhythmicStress).
 *
 * Part 2 loads both real pages in jsdom with a recording fake AudioContext
 * and drives them the way a person would: press Play, check that clicks were
 * scheduled with beats louder than weak ticks, that the highlighted syllable
 * advances, that Stop works, and that editing a beat stops playback.
 * ========================================================================== */
'use strict';

const path = require('path');
const assert = require('assert');

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

global.window = global.window || {};
require('./cmudict.js');
const E = require('./rhythm-reader/engine.js');
const A = require('./rhythm-audio.js');
if (!window.CMUDICT_FULL) { console.log('FAIL: cmudict.js did not load'); process.exit(1); }
E.loadDictionary(window.CMUDICT_FULL, 'full');

const beatsOf = sch => sch.events.filter(e => e.stress === 'S');
const marked = sch => sch.events.map(e =>
  e.stress === 'S' ? e.text.toUpperCase() : e.text.toLowerCase()).join(' ');

/* ---------------------------------------------------------------- Part 1 */

// 1. Every syllable once, in order, and nothing invented.
{
  const d = E.analyze('Happy children running quickly. The sun arose above the quiet hill.', {});
  const sch = A.schedule(d);
  const expected = [];
  d.words.forEach((wd, w) => wd.syllables.forEach((sy, s) => expected.push(w + ':' + s)));
  ok(sch.events.map(e => e.w + ':' + e.s).join(' ') === expected.join(' '),
    'every syllable is scheduled exactly once, in reading order');
  ok(sch.events.every((e, i) => i === 0 || e.t > sch.events[i - 1].t),
    'onsets strictly increase');
  ok(sch.events.every(e => e.stress ===
      d.words[e.w].syllables[e.s].rhythmicStress),
    'each event carries the syllable’s rhythmicStress, not its lexical stress');
  ok(sch.beats === beatsOf(sch).length, 'beat count matches strong events');
  ok(sch.total > sch.events[sch.events.length - 1].t, 'total includes a final rest');
}

// 2. Isochrony inside a metrical line with commas.
{
  const d = E.analyze('Twinkle, twinkle, little star, how I wonder what you are.', {});
  const sch = A.schedule(d, { bpm: 120 });
  const bt = beatsOf(sch).map(e => e.t);
  const gaps = bt.slice(1).map((x, i) => x - bt[i]);
  ok(bt.length >= 6, `Twinkle has its beats (${marked(sch)})`);
  ok(gaps.every(g => g === 500),
    `commas do not break the beat grid in metrical text — gaps ${gaps.join(',')}`);
}

// 3. Upbeat placement and sentence rest.
{
  const d = E.analyze('The mouse ran up the clock. Not a creature was stirring, not even a mouse.',
    { textType: 'verse' });
  const sch = A.schedule(d, { bpm: 120 });
  ok(/^the MOUSE ran UP the CLOCK/.test(marked(sch)),
    `the mouse line plays as the engine marks it — got ${marked(sch)}`);
  const first = beatsOf(sch)[0];
  ok(first.t <= 250, `the upbeat "the" does not push the first beat late (first beat at ${first.t} ms)`);
  const clock = sch.events.find(e => e.word === 'clock');
  const nextOnset = sch.events.find(e => e.phrase > clock.phrase).t;
  ok(nextOnset - clock.t >= 1000,
    `a sentence boundary rests at least a beat beyond the beat interval (${nextOnset - clock.t} ms)`);
  // Beat times stay on one grid across the whole passage.
  const bt = beatsOf(sch).map(e => e.t);
  ok(bt.every(t => (t - bt[0]) % 500 === 0),
    `all beats fall on one 500 ms grid — ${bt.join(',')}`);
}

// 4. Tempo scales everything.
{
  const d = E.analyze('The sun arose above the quiet hill.', {});
  const a = A.schedule(d, { bpm: 60 }), b = A.schedule(d, { bpm: 120 });
  ok(a.beatMs === 1000 && b.beatMs === 500, 'beatMs follows bpm');
  ok(Math.abs(a.total - 2 * b.total) <= 2, 'halving the tempo doubles the duration');
}

// 5. The tap track follows the reader’s edits.
{
  const d = E.analyze('The mouse ran up the clock.', { textType: 'verse' });
  const before = A.schedule(d).beats;
  const up = d.words.findIndex(w => w.normalized === 'up');
  const cur = d.words[up].syllables[0].rhythmicStress;
  E.editRhythmicStress(d, up, 0, cur === 'S' ? 'W' : 'S');
  const after = A.schedule(d);
  ok(after.events.find(e => e.w === up).stress !== cur,
    'an edited beat is heard as edited');
  ok(after.beats === before + (cur === 'S' ? -1 : 1), 'beat count changes by one');
}

// 6. Degenerate input.
{
  ok(A.schedule(null).events.length === 0, 'null doc gives an empty schedule');
  const d = E.analyze('and', {});
  const sch = A.schedule(d);
  ok(sch.events.length === 1 && sch.total > 0, 'a single word plays and ends');
}

/* ---------------------------------------------------------------- Part 2 */

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.log(`Part 1: ${checks} checks passed.`);
  console.log('SKIPPED Part 2: jsdom not installed (npm install). PAGE WIRING WAS NOT VERIFIED.');
  process.exit(0);
}

/* A fake AudioContext that records every click the player schedules. */
function installFakeAudio(win) {
  const log = [];
  log.gains = [];
  class Param {
    constructor(owner, name) { this.owner = owner; this.name = name; }
    setValueAtTime(v, t) { this.owner.events.push([this.name, 'set', v, t]); }
    exponentialRampToValueAtTime(v, t) { this.owner.events.push([this.name, 'ramp', v, t]); }
  }
  class Node {
    constructor() { this.events = []; }
    connect(n) { return n; }
  }
  class FakeAC {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = new Node(); this.closed = false; }
    createOscillator() {
      const n = new Node(); n.frequency = { value: 0 };
      n.start = (t) => log.push({ ctx: this, t, freq: n.frequency.value, osc: n });
      n.stop = () => {};
      return n;
    }
    createGain() { const n = new Node(); n.gain = new Param(n, 'gain'); log.gains.push(n); return n; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); }
  }
  win.AudioContext = FakeAC;
  return log;
}

async function open(relPath) {
  let audioLog = null;
  const dom = await JSDOM.fromFile(path.join(__dirname, relPath), {
    runScripts: 'dangerously', resources: 'usable',
    beforeParse(win) { audioLog = installFakeAudio(win); }
  });
  await sleep(2500);   // dictionary load + first analyse
  return { dom, d: dom.window.document, audioLog };
}

async function exercise(relPath, goId, surfaceSel) {
  const { dom, d, audioLog } = await open(relPath);
  const label = relPath.split('/')[0];
  d.getElementById('input').value = 'The mouse ran up the clock.';
  d.getElementById(goId).click();
  await sleep(150);

  const btn = d.getElementById('playBtn');
  const row = d.getElementById('playRow');
  ok(btn && !row.hidden, `${label}: Hear the beat control is present and shown`);
  ok(d.querySelector('script[src="../rhythm-audio.js"]'),
    `${label}: page loads the shared rhythm-audio.js`);

  // Fast tempo so the test does not wait long.
  const tempo = d.getElementById('tempo');
  tempo.value = '180';
  tempo.dispatchEvent(new dom.window.Event('input'));
  ok(d.getElementById('tempoVal').value === '180', `${label}: tempo readout follows the slider`);

  btn.click();
  ok(btn.getAttribute('aria-pressed') === 'true', `${label}: Play sets pressed state`);
  ok(/Stop/.test(btn.textContent), `${label}: button becomes Stop while playing`);
  const nSyl = 6;   // the mouse ran up the clock: six monosyllables
  ok(audioLog.length === nSyl, `${label}: one click per syllable (${audioLog.length})`);
  const hi = audioLog.filter(c => c.freq === 880).length;
  ok(hi === 3, `${label}: three beats sound as beats (${hi})`);

  // Beats are louder than weak ticks (gain peak, in schedule order).
  const peaks = audioLog.gains.map(g => Math.max(...g.events.map(e => e[2])));
  const strongPeaks = peaks.filter((p, i) => audioLog[i].freq === 880);
  const weakPeaks = peaks.filter((p, i) => audioLog[i].freq !== 880);
  ok(Math.min(...strongPeaks) > 2 * Math.max(...weakPeaks),
    `${label}: beats are much louder than weak ticks`);

  await sleep(260);
  const now1 = d.querySelectorAll(surfaceSel + ' .syl.now');
  ok(now1.length === 1, `${label}: exactly one syllable is highlighted while playing`);
  const firstText = now1[0] && now1[0].textContent;
  await sleep(350);
  const now2 = d.querySelector(surfaceSel + ' .syl.now');
  ok(now2 && now2.textContent !== firstText,
    `${label}: the highlight advances (${firstText} → ${now2 && now2.textContent})`);

  // Stop.
  btn.click();
  ok(btn.getAttribute('aria-pressed') === 'false', `${label}: Stop clears pressed state`);
  ok(!d.querySelector(surfaceSel + ' .syl.now'), `${label}: Stop clears the highlight`);
  ok(audioLog[0].ctx.closed, `${label}: Stop discards queued clicks (context closed)`);

  // Editing a beat during playback stops it.
  btn.click();
  ok(btn.getAttribute('aria-pressed') === 'true', `${label}: plays again`);
  const sylBtn = d.querySelector(surfaceSel + ' .syl');
  sylBtn.click();
  await sleep(50);
  ok(btn.getAttribute('aria-pressed') === 'false',
    `${label}: editing a beat stops playback so sound and display never disagree`);

  // Runs to completion on its own and resets.
  btn.click();
  await sleep(6 * (60000 / 180) / 1 + 600);
  ok(btn.getAttribute('aria-pressed') === 'false' && !d.querySelector(surfaceSel + ' .syl.now'),
    `${label}: playback ends by itself and resets the control`);

  // Re-analysing stops playback.
  btn.click();
  d.getElementById(goId).click();
  await sleep(100);
  ok(btn.getAttribute('aria-pressed') === 'false', `${label}: re-analysing stops playback`);

  dom.window.close();
}

(async () => {
  await exercise('rhythm-reader/index.html', 'go', '#out');
  await exercise('rhythm-reader-pro/index.html', 'analyzeBtn', '#surface');

  // Pro: a display-only change must NOT stop playback.
  {
    const { dom, d } = await open('rhythm-reader-pro/index.html');
    d.getElementById('input').value = 'The mouse ran up the clock.';
    d.getElementById('analyzeBtn').click();
    await sleep(150);
    const btn = d.getElementById('playBtn');
    btn.click();
    d.querySelector('#modeSeg button[data-mode="caps"]').click();
    await sleep(50);
    ok(btn.getAttribute('aria-pressed') === 'true',
      'Pro: changing the display mode leaves playback running');
    btn.click();
    dom.window.close();
  }

  // No Web Audio: the control hides rather than doing nothing.
  {
    const dom = await JSDOM.fromFile(path.join(__dirname, 'rhythm-reader/index.html'),
      { runScripts: 'dangerously', resources: 'usable' });
    await sleep(2500);
    ok(dom.window.document.getElementById('playRow').hidden,
      'without Web Audio the Hear-the-beat row is hidden');
    dom.window.close();
  }

  console.log(`test_rhythm_audio.js: all ${checks} checks passed.`);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
