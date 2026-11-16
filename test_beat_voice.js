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
const data = {};
for (const k of ['strong', 'weak']) {
  const m = new RegExp(k + ": '([A-Za-z0-9+/=]+)'").exec(src);
  ok(m, k + ' recording is embedded');
  const buf = Buffer.from(m[1], 'base64');
  ok(buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE', k + ' is a WAV file');
  const fmt = buf.indexOf('fmt ');
  ok(buf.readUInt16LE(fmt + 8) === 1, k + ' is PCM');
  ok(buf.readUInt16LE(fmt + 10) === 1, k + ' is mono');
  const rate = buf.readUInt32LE(fmt + 12);
  ok(rate === 22050, k + ' is 22.05 kHz');
  ok(buf.readUInt16LE(fmt + 22) === 16, k + ' is 16-bit');
  const d = buf.indexOf('data');
  const n = buf.readUInt32LE(d + 4) / 2;
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) s[i] = buf.readInt16LE(d + 8 + 2 * i);
  data[k] = { dur: n / rate, s, rate };
}
near(data.strong.dur, 0.342, 0.01, '"DUM" is about 342 ms');
near(data.weak.dur, 0.158, 0.01, '"da" is about 158 ms');
ok(data.strong.dur > 1.8 * data.weak.dur, 'the beat syllable is clearly the longer one');
for (const k of ['strong', 'weak']) {
  const { s, rate } = data[k];
  const peak = s.reduce((a, v) => Math.max(a, Math.abs(v)), 0) / 32768;
  ok(peak > 0.8 && peak < 0.95, k + ' is normalised and does not clip');
  // The onset is the beat: sound must begin within 10 ms, not after a lead-in of silence.
  const first = s.findIndex(v => Math.abs(v) > 0.1 * 32768);
  ok(first >= 0 && first / rate < 0.03, k + ' begins sounding within 30 ms');
  const tail = Math.max(...Array.from(s.slice(-Math.round(rate * 0.003))).map(Math.abs)) / 32768;
  ok(tail < 0.05, k + ' ends faded, with no click');
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
  ok(seen.length === 2 && seen[0] > seen[1] && seen[1] > 6000, 'both recordings went to the decoder, DUM first');
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
