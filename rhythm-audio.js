/* ============================================================================
 * rhythm-audio.js — hear the beat the engine (or the reader) chose.
 * ----------------------------------------------------------------------------
 * Shared by Rhythm Reader and Rhythm Reader Pro. Two independent parts:
 *
 *   schedule(doc, opts)  → a pure, testable timetable: one event per syllable
 *                          with its onset in milliseconds, built from the
 *                          document's rhythmicStress marks. No DOM, no audio.
 *   player(hooks)        → plays that timetable with the Web Audio API as
 *                          spoken nonsense syllables (a recorded "DUM" on
 *                          every beat, a recorded "da" on every weak
 *                          syllable) and calls back on each syllable so the
 *                          page can highlight it. Where the recordings cannot
 *                          be decoded it falls back to a tone and a tick.
 *
 * Timing model — stress-timed, the way the Learn pages describe English:
 *   • Beats (syllables with rhythmicStress 'S') fall at equal intervals, one
 *     beat interval apart (60000 / bpm ms).
 *   • Within the interval from one beat to the next, the stressed syllable
 *     takes a longer share than each weak syllable (stressWeight, 1.5 : 1 by
 *     default), because stressed syllables are longer as well as louder;
 *     the weak syllables share the rest equally. Beats stay isochronous.
 *   • Leading weak syllables before a phrase's first beat (an anacrusis, the
 *     "the" in "the MOUSE ran UP the CLOCK") are an upbeat: each takes the
 *     same slot a weak syllable of the following foot takes, so the first
 *     beat is not pushed late by a whole empty bar.
 *   • Each intonation phrase ends in a rest: one beat after a strong
 *     boundary (sentence-final punctuation), half a beat after a weak one
 *     (a comma).
 *   • The timetable reads rhythmicStress only, so every tap a reader makes
 *     is heard, and a lexical-tier view is NOT played — the beat is a
 *     rhythmic claim.
 *
 * This is the rhythm without the words. "DUM" and "da" carry the beat and
 * nothing else; the text itself is not spoken. See the design note in
 * README/REVISION_NOTES for why reading the words aloud is a separate, harder
 * tier.
 * ========================================================================== */
(function (global) {
  'use strict';

  const DEFAULTS = {
    bpm: 120,            // beat interval 500 ms
    strongRestBeats: 1,  // rest after a strong phrase boundary, in beats
    weakRestBeats: 0.5,  // rest after a weak phrase boundary (comma)
    stressWeight: 1.5    // a beat syllable's share of its foot vs. one weak syllable
  };

  /* --------------------------------------------------------------------------
   * schedule(doc, opts)
   * Returns { events, total, beatMs, beats } where each event is
   *   { t, dur, w, s, stress, nuclear, word, text, phrase }
   * t in ms from the start; dur is the syllable's slot in ms (its share of
   * the beat interval); w/s index doc.words / .syllables; phrase indexes
   * doc.phrases. `total` is the end time including the final rest.
   * ------------------------------------------------------------------------ */
  function schedule(doc, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const beatMs = 60000 / o.bpm;
    const events = [];
    let t = 0, beats = 0;
    if (!doc || !Array.isArray(doc.words)) return { events, total: 0, beatMs, beats };

    const phrases = (doc.phrases && doc.phrases.length)
      ? doc.phrases
      : [{ span: [0, doc.words.length - 1], boundaryAfter: 'strong' }];
    const prose = !!(doc.regime && doc.regime.regime === 'prose');

    // The beat grid: once the first beat has sounded, every later beat lands
    // on lastBeat + k × beatMs. Phrase boundaries and upbeats are fitted to
    // that grid rather than inserted as fixed gaps, so a comma inside a
    // metrical line ("Twinkle, twinkle, little star") does not break the beat.
    let lastBeat = null;
    let restNext = 0;   // rest required before the next phrase's first beat
    const onGrid = (x) => {
      if (lastBeat === null) return x;
      const k = Math.ceil((x - lastBeat) / beatMs - 1e-9);
      return lastBeat + Math.max(0, k) * beatMs;
    };

    phrases.forEach((ip, pi) => {
      const [a, b] = ip.span;
      const syls = [];
      for (let w = a; w <= b; w++) {
        const wd = doc.words[w];
        if (!wd) continue;
        wd.syllables.forEach((sy, s) => syls.push({ w, s, sy, wd }));
      }
      if (!syls.length) return;

      // Group into feet: each group starts at a beat; a leading group of
      // weak syllables (if any) is the anacrusis.
      const groups = [];
      let cur = [];
      syls.forEach(x => {
        if (x.sy.rhythmicStress === 'S' && cur.length) { groups.push(cur); cur = []; }
        cur.push(x);
      });
      if (cur.length) groups.push(cur);

      // Weak-syllable slot of a foot: the beat syllable counts stressWeight,
      // each weak syllable 1, and together they fill one beat interval.
      const sw = o.stressWeight;
      const weakSlot = n => beatMs / (sw + n - 1);
      const slotOf = (g, gi) => {
        if (g[0].sy.rhythmicStress === 'S') return weakSlot(g.length);
        // Anacrusis: match the weak-slot length of the foot that follows
        // (as if it had at least one weak syllable); with no following foot
        // (a phrase with no beat at all) use half-beats.
        const next = groups[gi + 1];
        return next ? weakSlot(Math.max(2, next.length)) : beatMs / 2;
      };
      const slotFor = (g, gi, x) => {
        const weak = slotOf(g, gi);
        if (x.sy.rhythmicStress !== 'S') return weak;
        return g.length === 1 ? beatMs : weak * sw;
      };

      // Fit the phrase's first beat to the grid, leaving room for the rest
      // owed by the previous boundary and for this phrase's upbeat.
      const lead = groups[0][0].sy.rhythmicStress === 'S'
        ? 0 : groups[0].length * slotOf(groups[0], 0);
      const firstBeat = onGrid(t + restNext + lead);
      t = firstBeat - lead;

      groups.forEach((g, gi) => {
        g.forEach(x => {
          const slot = slotFor(g, gi, x);
          const strong = x.sy.rhythmicStress === 'S';
          if (strong) { beats++; lastBeat = t; }
          events.push({
            t: Math.round(t), dur: Math.round(slot), w: x.w, s: x.s,
            stress: strong ? 'S' : 'W',
            nuclear: !!x.sy.nuclear,
            word: x.wd.word, text: x.sy.text, phrase: pi
          });
          t += slot;
        });
      });

      // A strong boundary (sentence-final punctuation) earns a full beat of
      // rest beyond the grid. A weak one (comma) is absorbed by the grid in
      // metrical text; in prose, where there is no grid to keep, it is a
      // half-beat pause.
      restNext = ip.boundaryAfter === 'weak'
        ? (prose ? beatMs * o.weakRestBeats : 0)
        : beatMs * o.strongRestBeats;
    });

    const total = onGrid(t + restNext);
    return { events, total: Math.round(total), beatMs, beats };
  }

  /* --------------------------------------------------------------------------
   * player(hooks)
   *   hooks.onSyllable(event)  called at each syllable's onset
   *   hooks.onEnd()            called when playback finishes or is stopped
   *   hooks.AudioContext       optional injection (tests)
   *   hooks.voice              optional injection (tests): { strong, weak }
   *                            AudioBuffers, or false to force the tones
   * Returns { play(doc, opts), stop(), get playing(), get voiced(), supported }
   *
   * Sound: two recorded syllables, "DUM" on a beat and "da" on a weak
   * syllable (Prof. Gross's voice; the first syllable of a spoken "DUM-da" and
   * of a spoken "da-DUM", each cut at the silence before the next consonant).
   * The beat syllable is longer and louder, as a stressed syllable is. A
   * recording longer than its slot at a fast tempo is faded out at the end of
   * the slot, so syllables never pile up; nothing is sped up or re-pitched.
   * The recordings are embedded below (VOICE_DATA) and decoded once, when the
   * player is built, so Play itself stays synchronous.
   *
   * Fallback (recordings not decoded: no decodeAudioData, or it failed): a
   * sine tone at one pitch for every syllable. A beat differs from a
   * weak syllable the way a stressed syllable differs from an unstressed one
   * in English: it is louder and longer (a sustained tone filling about half
   * its slot, versus a short soft tick). Pitch is kept the same on purpose:
   * in English, pitch marks the phrase accent rather than stress itself, so
   * it is left free to mark accent. The phrase nucleus (▲) sounds like any
   * other beat; the display already marks it.
   * ------------------------------------------------------------------------ */
  function player(hooks) {
    hooks = hooks || {};
    const AC = hooks.AudioContext ||
      (typeof global.AudioContext !== 'undefined' ? global.AudioContext :
       typeof global.webkitAudioContext !== 'undefined' ? global.webkitAudioContext : null);
    let ctx = null;
    let timers = [];
    let playing = false;
    let token = 0;
    let voice = null;   // { strong, weak } AudioBuffers once decoded

    if (hooks.voice) voice = hooks.voice;
    else if (hooks.voice !== false) loadVoice();

    /* Decode the two recordings once. An OfflineAudioContext needs no user
       gesture, so this runs at page load; decoded buffers are not tied to
       the context that made them and are reused by every later play. */
    function loadVoice() {
      const OAC = typeof global.OfflineAudioContext !== 'undefined' ? global.OfflineAudioContext :
        typeof global.webkitOfflineAudioContext !== 'undefined' ? global.webkitOfflineAudioContext : null;
      if (!OAC || typeof global.atob !== 'function') return;
      let dec;
      try { dec = new OAC(1, 1, 22050); } catch (e) { return; }
      if (typeof dec.decodeAudioData !== 'function') return;
      const one = b64 => new Promise((resolve, reject) => {
        const bin = global.atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const p = dec.decodeAudioData(bytes.buffer, resolve, reject);
        if (p && typeof p.then === 'function') p.then(resolve, reject);
      });
      Promise.all([one(VOICE_DATA.strong), one(VOICE_DATA.weak)])
        .then(([strong, weak]) => { if (strong && weak) voice = { strong, weak }; })
        .catch(() => {});
    }

    /* One recorded syllable at `at`, faded out at the end of its slot when
       the recording is longer than the slot. */
    function speak(at, strong, slotSec) {
      const buf = strong ? voice.strong : voice.weak;
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buf;
      const level = strong ? VOICE_STRONG_GAIN : VOICE_WEAK_GAIN;
      const room = Math.max(0.06, (slotSec || buf.duration) * VOICE_SLOT_FILL);
      gain.gain.setValueAtTime(level, at);
      if (buf.duration > room) {
        gain.gain.setValueAtTime(level, at + room - VOICE_FADE);
        gain.gain.linearRampToValueAtTime(0.0001, at + room);
      }
      src.connect(gain).connect(ctx.destination);
      src.start(at);
      if (buf.duration > room) src.stop(at + room + 0.01);
    }

    function sound(at, strong, slotSec) {
      if (!ctx) return;
      if (voice && typeof ctx.createBufferSource === 'function') speak(at, strong, slotSec);
      else click(at, strong, slotSec);
    }

    function click(at, strong, slotSec) {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      const peak = strong ? 0.9 : 0.22;
      const dur = strong
        ? Math.min(0.28, Math.max(0.09, 0.55 * (slotSec || 0.3)))
        : 0.04;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.005);
      if (strong) gain.gain.exponentialRampToValueAtTime(peak * 0.7, at + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + dur + 0.01);
    }

    function clearTimers() {
      timers.forEach(id => clearTimeout(id));
      timers = [];
    }

    function stop(silent) {
      if (!playing) return;
      playing = false;
      token++;
      clearTimers();
      if (ctx) {
        // Closing the context discards every click already queued on the
        // audio clock; the next play opens a fresh one.
        try { const c = ctx; ctx = null; Promise.resolve(c.close()).catch(() => {}); }
        catch (e) { ctx = null; }
      }
      if (!silent && typeof hooks.onEnd === 'function') hooks.onEnd();
    }

    function play(doc, opts) {
      stop(true);
      const sch = schedule(doc, opts);
      if (!sch.events.length) return sch;
      if (AC) {
        try { ctx = new AC(); } catch (e) { ctx = null; }
      }
      if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume();
      playing = true;
      const my = ++token;
      // Lead-in so the first click is not clipped by context start-up.
      const lead = 0.08;
      const base = ctx ? ctx.currentTime + lead : 0;
      sch.events.forEach(ev => {
        sound(base + ev.t / 1000, ev.stress === 'S', ev.dur / 1000);
        timers.push(setTimeout(() => {
          if (my !== token) return;
          if (typeof hooks.onSyllable === 'function') hooks.onSyllable(ev, sch);
        }, lead * 1000 + ev.t));
      });
      timers.push(setTimeout(() => {
        if (my !== token) return;
        playing = false;
        clearTimers();
        if (ctx) { try { const c = ctx; ctx = null; Promise.resolve(c.close()).catch(() => {}); } catch (e) { ctx = null; } }
        if (typeof hooks.onEnd === 'function') hooks.onEnd();
      }, lead * 1000 + sch.total));
      return sch;
    }

    return {
      play, stop,
      get playing() { return playing; },
      get voiced() { return !!voice; },
      supported: !!AC
    };
  }

  /* The two recordings: 16-bit mono WAV at 22.05 kHz, base64. WAV, not MP3,
     because an MP3 decodes with a few milliseconds of leading silence that
     differs between browsers, and here the onset is the beat.
       strong  "DUM", 342 ms    weak  "da", 158 ms
     Both are normalised to the same peak; the gains below put "da" about
     7 dB under "DUM". */
  const VOICE_STRONG_GAIN = 0.9;
  const VOICE_WEAK_GAIN = 0.55;
  const VOICE_SLOT_FILL = 1.1;   // a syllable may run 10% past its slot before fading
  const VOICE_FADE = 0.02;       // seconds
  const VOICE_DATA = {
    strong: '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',
    weak: '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'
  };

  const RhythmAudio = { schedule, player, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = RhythmAudio;
  global.RhythmAudio = RhythmAudio;

})(typeof window !== 'undefined' ? window : globalThis);
