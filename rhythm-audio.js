/* ============================================================================
 * rhythm-audio.js — hear the beat the engine (or the reader) chose.
 * ----------------------------------------------------------------------------
 * Shared by Rhythm Reader and Rhythm Reader Pro. Two independent parts:
 *
 *   schedule(doc, opts)  → a pure, testable timetable: one event per syllable
 *                          with its onset in milliseconds, built from the
 *                          document's rhythmicStress marks. No DOM, no audio.
 *   player(hooks)        → plays that timetable as a tap track with the Web
 *                          Audio API (a click on every beat, a softer tick on
 *                          every weak syllable) and calls back on each
 *                          syllable so the page can highlight it.
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
 * This is the rhythm without the words. Nothing here speaks; see the design
 * note in README/REVISION_NOTES for why a voice is a separate, harder tier.
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
   * Returns { play(doc, opts), stop(), get playing(), supported }
   *
   * Sound: a sine tone at one pitch for every syllable. A beat differs from a
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
        click(base + ev.t / 1000, ev.stress === 'S', ev.dur / 1000);
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
      supported: !!AC
    };
  }

  const RhythmAudio = { schedule, player, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = RhythmAudio;
  global.RhythmAudio = RhythmAudio;

})(typeof window !== 'undefined' ? window : globalThis);
