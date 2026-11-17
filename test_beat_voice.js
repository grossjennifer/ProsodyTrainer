/* test_beat_voice.js — "Hear the beat" speaks recorded syllables: "DUM" on a
 * beat, "da" on a weak syllable, in place of the tone and tick. Checks the
 * embedded recordings, the routing (strong/weak, level, fade at fast tempos),
 * the decode path, and the fallback to tones when decoding is unavailable. */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m} (got ${a}, want ${b})`);

const src = fs.readFileSync(path.join(__dirname, 'rhythm-audio.js'), 'utf8');

/* ---- 1. The embedded recordings are well-formed WAV ---- */
// 3.6.11: three tokens of each syllable, each in versions from longest to shortest.
function wav(b64, label) {
  const buf = Buffer.from(b64, 'base64');
  ok(buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE', label + ' is a WAV file');
  const fmt = buf.indexOf('fmt ');
  ok(buf.readUInt16LE(fmt + 8) === 1 && buf.readUInt16LE(fmt + 10) === 1 &&
     buf.readUInt32LE(fmt + 12) === 22050 && buf.readUInt16LE(fmt + 22) === 16, label + ': 16-bit mono PCM at 22.05 kHz');
  const d = buf.indexOf('data');
  const n = buf.readUInt32LE(d + 4) / 2;
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) s[i] = buf.readInt16LE(d + 8 + 2 * i);
  return { dur: n / 22050, s, rate: 22050 };
}
const data = {};
for (const k of ['strong', 'weak']) {
  const block = new RegExp(k + ': \\[([\\s\\S]*?)\\n    \\]').exec(src);
  ok(block, k + ' recordings are embedded');
  const tokens = block[1].split(/\],\s*\[/).map(t => (t.match(/'([A-Za-z0-9+/=]+)'/g) || []).map(q => q.slice(1, -1)));
  data[k] = tokens.map((versions, ti) => versions.map((b, vi) => wav(b, `${k} token ${ti + 1} version ${vi + 1}`)));
}
ok(data.strong.length === 3 && data.weak.length === 3, 'three tokens of each syllable');
ok(data.strong.every(v => v.length === 3) && data.weak.every(v => v.length === 2), 'DUM in three lengths, da in two');
near(data.strong[0][0].dur, 0.342, 0.01, 'the first "DUM" is the clip used since 16 November (342 ms)');
near(data.weak[0][0].dur, 0.158, 0.01, 'the first "da" likewise (158 ms)');
for (const k of ['strong', 'weak']) {
  for (const versions of data[k]) {
    for (let v = 1; v < versions.length; v++) ok(versions[v].dur < versions[v - 1].dur - 0.03, k + ': versions run from longest to shortest');
  }
}
ok(data.strong.every(v => v[v.length - 1].dur <= 143 * 1.1 / 1000), 'the shortest DUM fits the shortest beat slot (143 ms: three-beat pattern at 180 per minute)');
ok(data.weak.every(v => v[v.length - 1].dur <= 95 * 1.1 / 1000), 'the shortest da fits the shortest weak slot (95 ms)');
ok(data.strong.every(v => v[0].dur > 1.8 * data.weak[0][0].dur), 'the beat syllable is clearly the longer one');
// Loudness as the loudest 30 ms: whole-clip RMS would count the fades, which
// are a larger share of a shorter version.
const rms = s => {
  const w = Math.round(22050 * 0.03);
  let best = 0;
  for (let i = 0; i + w <= s.length; i += 55) {
    let e = 0; for (let k = i; k < i + w; k++) e += (s[k] / 32768) ** 2;
    best = Math.max(best, Math.sqrt(e / w));
  }
  return best;
};
for (const k of ['strong', 'weak']) {
  const ref = 20 * Math.log10(rms(data[k][0][0].s));
  for (const [ti, versions] of data[k].entries()) {
    for (const [vi, { s, rate }] of versions.entries()) {
      const label = `${k} ${ti + 1}.${vi + 1}`;
      const peak = s.reduce((a, v) => Math.max(a, Math.abs(v)), 0) / 32768;
      ok(peak > 0.7 && peak < 0.98, label + ' is normalised and does not clip');
      ok(Math.abs(20 * Math.log10(rms(s)) - ref) < 2, label + ' is within 2 dB of the first token at its loudest');
      const first = s.findIndex(v => Math.abs(v) > 0.1 * 32768);
      ok(first >= 0 && first / rate < 0.03, label + ' begins sounding within 30 ms');
      const tail = Math.max(...Array.from(s.slice(-Math.round(rate * 0.003))).map(Math.abs)) / 32768;
      ok(tail < 0.05, label + ' ends faded, with no click');
    }
  }
}

/* ---- 2. Routing, with a recording fake AudioContext ---- */
function fakeAudio(withBuffers) {
  const log = { sources: [], oscs: [], gains: [] };
  class Param {
    constructor() { this.ev = []; }
    setValueAtTime(v, t) { this.ev.push(['set', v, t]); }
    linearRampToValueAtTime(v, t) { this.ev.push(['lin', v, t]); }
    exponentialRampToValueAtTime(v, t) { this.ev.push(['exp', v, t]); }
  }
  class FakeAC {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createGain() { const g = { gain: new Param(), connect: n => n }; log.gains.push(g); return g; }
    createOscillator() {
      const o = { frequency: { value: 0 }, connect: n => n, stop() {} };
      o.start = t => log.oscs.push({ t }); return o;
    }
    close() { return Promise.resolve(); }
  }
  if (withBuffers) FakeAC.prototype.createBufferSource = function () {
    const n = { buffer: null, stopAt: null };
    n.connect = g => { n.gain = g; return g; };
    n.start = t => { n.t = t; log.sources.push(n); };
    n.stop = t => { n.stopAt = t; };
    return n;
  };
  return { FakeAC, log };
}
const A = require('./rhythm-audio.js');
const STRONG = { duration: 0.342, name: 'DUM' }, WEAK = { duration: 0.158, name: 'da' };
// "the MOUSE ran UP the CLOCK": w S w S w S
const doc = { words: 'the mouse ran up the clock'.split(' ').map((t, i) => ({
  text: t, syllables: [{ text: t, rhythmicStress: i % 2 ? 'S' : 'w' }] })),
  phrases: [{ span: [0, 5], boundaryAfter: 'strong' }] };

{
  const { FakeAC, log } = fakeAudio(true);
  const p = A.player({ AudioContext: FakeAC, voice: { strong: STRONG, weak: WEAK } });
  ok(p.voiced === true, 'an injected voice is in use');
  const sch = p.play(doc, { bpm: 120 });
  p.stop(true);
  ok(log.sources.length === sch.events.length && sch.events.length === 6, 'one recorded syllable per event');
  ok(log.oscs.length === 0, 'no tones when the voice is available');
  sch.events.forEach((ev, i) => {
    const n = log.sources[i];
    ok(n.buffer === (ev.stress === 'S' ? STRONG : WEAK), `event ${i}: ${ev.stress === 'S' ? 'DUM' : 'da'} on a ${ev.stress} syllable`);
    near(n.t, 0.08 + ev.t / 1000, 1e-9, `event ${i}: starts on its onset`);
  });
  const level = n => n.gain.gain.ev[0][1];
  const s = log.sources.find(n => n.buffer === STRONG), w = log.sources.find(n => n.buffer === WEAK);
  ok(level(s) > level(w), 'the beat syllable is louder');
  const dB = 20 * Math.log10(level(s) / level(w));
  ok(dB > 3 && dB < 7, 'gain puts "da" 3 to 7 dB under "DUM" before the recordings\' own difference');
  // 120 bpm, binary: strong slot 300 ms, weak slot 200 ms.
  ok(w.stopAt === null && w.gain.gain.ev.length === 1, '"da" (158 ms) fits a 200 ms slot and plays whole');
  ok(s.stopAt !== null, '"DUM" (342 ms) is longer than 110% of a 300 ms slot and is trimmed');
  const fade = s.gain.gain.ev[s.gain.gain.ev.length - 1];
  ok(fade[0] === 'lin' && fade[1] < 0.001, 'the trim is a fade to silence, not a cut');
  near(fade[2] - s.t, 0.33, 1e-6, 'the fade ends 10% past the slot');
}
{
  // Fast tempo: nothing may ring past the next syllable's slot by more than 10%.
  const { FakeAC, log } = fakeAudio(true);
  const p = A.player({ AudioContext: FakeAC, voice: { strong: STRONG, weak: WEAK } });
  const sch = p.play(doc, { bpm: 180 });
  p.stop(true);
  sch.events.forEach((ev, i) => {
    const n = log.sources[i];
    const end = n.stopAt === null ? n.t + n.buffer.duration : n.stopAt;
    ok(end - n.t <= ev.dur / 1000 * 1.1 + 0.011, `180 bpm, event ${i}: ends within its slot`);
  });
  ok(log.sources.every(n => n.playbackRate === undefined), 'nothing is sped up or re-pitched');
}
{
  // Slow tempo: every syllable plays whole.
  const { FakeAC, log } = fakeAudio(true);
  const p = A.player({ AudioContext: FakeAC, voice: { strong: STRONG, weak: WEAK } });
  p.play(doc, { bpm: 60 }); p.stop(true);
  ok(log.sources.every(n => n.stopAt === null), '60 bpm: no syllable is trimmed');
}
{
  const { FakeAC, log } = fakeAudio(true);
  const p = A.player({ AudioContext: FakeAC, voice: false });
  ok(p.voiced === false, 'voice: false forces the tones');
  const sch = p.play(doc, { bpm: 120 }); p.stop(true);
  ok(log.oscs.length === sch.events.length && log.sources.length === 0, 'tones play when the voice is off');
}
{
  // Voice decoded, but a context without buffer sources: fall back to tones.
  const { FakeAC, log } = fakeAudio(false);
  const p = A.player({ AudioContext: FakeAC, voice: { strong: STRONG, weak: WEAK } });
  const sch = p.play(doc, { bpm: 120 }); p.stop(true);
  ok(log.oscs.length === sch.events.length, 'no createBufferSource: tones, not silence');
}
{
  // No decoder in this environment (Node): the player still works, with tones.
  const { FakeAC, log } = fakeAudio(true);
  const p = A.player({ AudioContext: FakeAC });
  ok(p.voiced === false && p.supported, 'without a decoder the player is unvoiced but supported');
  const sch = p.play(doc, { bpm: 120 }); p.stop(true);
  ok(log.oscs.length === sch.events.length, 'and plays tones');
}

/* ---- 2b. Tokens in turn, and the version that fits (3.6.11) ---- */
{
  const mk = (name, d) => ({ duration: d, name });   // durations as embedded
  const voice = {
    strong: [[mk('D1', 0.342), mk('D1m', 0.237), mk('D1s', 0.150)],
             [mk('D2', 0.332), mk('D2m', 0.237), mk('D2s', 0.150)],
             [mk('D3', 0.306), mk('D3m', 0.237), mk('D3s', 0.150)]],
    weak: [[mk('a1', 0.158), mk('a1s', 0.098)], [mk('a2', 0.164), mk('a2s', 0.098)], [mk('a3', 0.142), mk('a3s', 0.098)]]
  };
  const run = (text, bpm, tt) => {
    const { FakeAC, log } = fakeAudio(true);
    const p = A.player({ AudioContext: FakeAC, voice });
    const E = require('./rhythm-reader/engine.js');
    const d = E.analyze(text, { textType: tt || 'verse' });
    const sch = p.play(d, { bpm }); p.stop(true);
    return { sch, played: log.sources.map(n => n.buffer.name), log };
  };
  const slow = run('The mouse ran up the clock.', 60);
  ok(slow.played.join(' ') === 'a1 D1 a2 D2 a3 D3', 'tokens are taken in turn, separately for DUM and da: ' + slow.played.join(' '));
  ok(slow.log.sources.every(n => n.stopAt === null), 'at 60 per minute every syllable plays whole, longest version');
  const again = run('The mouse ran up the clock.', 60);
  ok(again.played.join(' ') === slow.played.join(' '), 'every play starts on the same tokens');
  const fast = run('Not a creature was stirring not even a mouse', 180);
  ok(fast.log.sources.every(n => n.stopAt === null), 'three-beat pattern at 180 per minute: nothing needs to be cut short');
  ok(fast.played.some(n => /^D\ds$/.test(n)), 'and the shortest DUM is used where the slot is shortest');
  const mid = run('Tyger Tyger burning bright', 120);
  // The longest version that fits is chosen, every time.
  for (const r of [slow, fast, mid]) {
    const all = [...voice.strong, ...voice.weak];
    r.sch.events.forEach((ev, i) => {
      const n = r.log.sources[i];
      const versions = all.find(v => v.includes(n.buffer));
      const fit = ev.dur / 1000 * 1.1;
      const want = versions.find(b => b.duration <= fit) || versions[versions.length - 1];
      ok(n.buffer === want, `the longest version that fits its ${Math.round(ev.dur)} ms slot`);
    });
  }
  for (const r of [slow, fast, mid]) {
    r.sch.events.forEach((ev, i) => {
      const n = r.log.sources[i];
      const end = n.stopAt === null ? n.t + n.buffer.duration : n.stopAt;
      ok(end - n.t <= ev.dur / 1000 * 1.1 + 0.011, 'no syllable runs past its slot by more than 10%');
    });
  }
  // A single buffer per syllable (older callers) still works as one token.
  const { FakeAC, log } = fakeAudio(true);
  const p = A.player({ AudioContext: FakeAC, voice: { strong: STRONG, weak: WEAK } });
  p.play(doc, { bpm: 120 }); p.stop(true);
  ok(log.sources.every(n => n.buffer === STRONG || n.buffer === WEAK), 'one buffer per syllable is accepted');
}

/* ---- 3. The decode path ---- */
(async () => {
  const seen = [];
  globalThis.atob = globalThis.atob || (b => Buffer.from(b, 'base64').toString('binary'));
  globalThis.OfflineAudioContext = class {
    decodeAudioData(ab) { seen.push(ab.byteLength); return Promise.resolve({ duration: ab.byteLength / 44100 }); }
  };
  const { FakeAC, log } = fakeAudio(true);
  const p = A.player({ AudioContext: FakeAC });
  ok(p.voiced === false, 'not voiced until decoding finishes');
  await new Promise(r => setTimeout(r, 20));
  ok(p.voiced === true, 'voiced once both recordings decode');
  ok(seen.length === 15, 'every version of every token went to the decoder (9 DUM, 6 da)');
  ok(seen[0] > seen[1] && seen[1] > seen[2], 'DUM first, longest version first');
  const sch = p.play(doc, { bpm: 120 }); p.stop(true);
  ok(log.sources.length === sch.events.length && log.oscs.length === 0, 'decoded recordings are what plays');

  globalThis.OfflineAudioContext = class { decodeAudioData() { return Promise.reject(new Error('no')); } };
  const q = A.player({ AudioContext: FakeAC });
  await new Promise(r => setTimeout(r, 20));
  ok(q.voiced === false, 'a failed decode leaves the tones in place');
  delete globalThis.OfflineAudioContext;

  /* ---- 4. The pages say what is heard ---- */
  for (const f of ['rhythm-reader/index.html', 'rhythm-reader-pro/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, f), 'utf8');
    const help = /<span id="playHelp"[^>]*>([\s\S]*?)<\/span>/.exec(html)[1].replace(/\s+/g, ' ');
    ok(/DUM on every beat/.test(help) && /soft da on every weak syllable/.test(help), f + ': help text describes the syllables');
    ok(!/tick|tone/.test(help), f + ': help text no longer describes tones');
    ok(/src="\.\.\/rhythm-audio\.js"/.test(html), f + ': loads the shared player');
  }
  console.log(`test_beat_voice.js: ${checks} checks passed.`);
})().catch(e => { console.error(e); process.exit(1); });
