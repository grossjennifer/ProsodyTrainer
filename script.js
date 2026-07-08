/* ==========================================================================
   The Hidden Architecture of Reading — self-playing exhibit
   The exhibit now plays itself: each panel carries a data-duration, and
   the tour advances when a panel's choreography has had time to land.
   The visitor keeps full control through a transport — rewind (◀),
   pause/resume, and forward (▶) — plus Skip intro.

   Courtesies:
   - Pausing freezes everything mid-gesture (reveals, pulses, the advance).
   - Pressing an audio clip on the intonation panel pauses the tour so all
     three versions can be heard without being rushed. No audio autoplays.
   - Under prefers-reduced-motion, nothing moves and nothing self-advances:
     each panel appears complete, and ◀ / ▶ step through at the reader's pace.
   - The final panel (Sputnik) never auto-advances; the tour rests there
     until the visitor presses Begin Exploring.
   ========================================================================== */

(function () {
  "use strict";

  const panels = Array.from(document.querySelectorAll(".exhibit-panel"));
  const backButton = document.getElementById("back-button");
  const forwardButton = document.getElementById("forward-button");
  const playPauseButton = document.getElementById("play-pause-button");
  const beginButton = document.getElementById("begin-button");
  const skipButton = document.getElementById("skip-intro");
  const counter = document.getElementById("panel-counter");
  const exhibit = document.getElementById("opening-exhibit");
  const siteContent = document.getElementById("site-content");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PAUSE_GLYPH = "\u275A\u275A";   /* ❚❚ */
  const PLAY_GLYPH = "\u25B7";          /* ▷  */

  let current = -1;
  let paused = false;

  /* ------------------------------------------------------------------ */
  /* Pause-aware timers                                                 */
  /* Every scheduled moment — a reveal, a pulse, the auto-advance —     */
  /* freezes when the visitor pauses and picks up where it left off.    */
  /* ------------------------------------------------------------------ */

  let queue = [];

  function arm(item) {
    item.startedAt = Date.now();
    item.id = window.setTimeout(function () {
      queue = queue.filter(function (q) { return q !== item; });
      item.fn();
    }, item.remaining);
  }

  function later(fn, ms) {
    // Under reduced motion, timed reveals collapse to "now".
    // While paused, arriving at a panel shows it complete rather than blank.
    if (reducedMotion || paused) { fn(); return; }
    const item = { fn: fn, remaining: ms, id: null, startedAt: 0 };
    queue.push(item);
    arm(item);
  }

  function freezeTimers() {
    queue.forEach(function (item) {
      if (item.id === null) return;
      window.clearTimeout(item.id);
      item.id = null;
      item.remaining = Math.max(0, item.remaining - (Date.now() - item.startedAt));
    });
  }

  function thawTimers() {
    queue.forEach(function (item) {
      if (item.id === null) arm(item);
    });
  }

  function clearTimers() {
    queue.forEach(function (item) {
      if (item.id !== null) window.clearTimeout(item.id);
    });
    queue = [];
  }

  /* ------------------------------------------------------------------ */
  /* Auto-advance (kept separate so pausing never fires it instantly)  */
  /* ------------------------------------------------------------------ */

  const advance = { id: null, remaining: 0, startedAt: 0 };

  function scheduleAdvance(duration) {
    cancelAdvance();
    if (reducedMotion || duration <= 0) return;   // reader-paced, or final panel
    advance.remaining = duration;
    if (!paused) armAdvance();
  }

  function armAdvance() {
    advance.startedAt = Date.now();
    advance.id = window.setTimeout(function () {
      advance.id = null;
      next();
    }, advance.remaining);
  }

  function freezeAdvance() {
    if (advance.id === null) return;
    window.clearTimeout(advance.id);
    advance.id = null;
    advance.remaining = Math.max(0, advance.remaining - (Date.now() - advance.startedAt));
  }

  function cancelAdvance() {
    if (advance.id !== null) window.clearTimeout(advance.id);
    advance.id = null;
    advance.remaining = 0;
  }

  /* ------------------------------------------------------------------ */
  /* Pause / resume                                                     */
  /* ------------------------------------------------------------------ */

  function setPaused(state) {
    if (paused === state) return;
    paused = state;
    if (paused) {
      freezeTimers();
      freezeAdvance();
    } else {
      thawTimers();
      if (advance.remaining > 0 && advance.id === null) armAdvance();
    }
    playPauseButton.textContent = paused ? PLAY_GLYPH : PAUSE_GLYPH;
    playPauseButton.setAttribute("aria-label", paused ? "Resume" : "Pause");
    playPauseButton.setAttribute("aria-pressed", paused ? "true" : "false");
  }

  /* ------------------------------------------------------------------ */
  /* Panel activation                                                   */
  /* ------------------------------------------------------------------ */

  function showPanel(index) {
    clearTimers();
    cancelAdvance();

    panels.forEach(function (p) { p.classList.remove("is-active"); });
    const panel = panels[index];
    panel.classList.add("is-active");

    counter.textContent = (index + 1) + " of " + panels.length;

    // Reset reveals so revisiting behaves cleanly.
    panel.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.remove("is-shown");
    });
    panel.querySelectorAll("[data-swap-out]").forEach(function (el) {
      el.classList.remove("is-hidden-away");
    });

    // Schedule this panel's reveals.
    panel.querySelectorAll("[data-reveal]").forEach(function (el) {
      const delay = Number(el.getAttribute("data-delay") || 0);
      later(function () { el.classList.add("is-shown"); }, delay + 250);
    });

    // Plain lines that yield to their marked twin (panels 4 and 7).
    panel.querySelectorAll("[data-swap-out]").forEach(function (el) {
      const at = Number(el.getAttribute("data-swap-out"));
      later(function () { el.classList.add("is-hidden-away"); }, at);
    });

    // Panel-specific choreography.
    const n = panel.getAttribute("data-panel");
    if (n === "4") pulseBeats(panel, 3600, 900);            // POT → SNORT → LOUD → WA → EDGE
    if (n === "5") pulseBeats(panel.querySelector(".rise"), 900, 650);
    if (n === "6") pulseBeats(panel.querySelector(".fall"), 900, 650);

    // Transport state.
    const isFinal = index === panels.length - 1;
    backButton.disabled = index === 0;
    forwardButton.disabled = isFinal;
    beginButton.hidden = !isFinal;
    skipButton.hidden = isFinal;
    playPauseButton.hidden = reducedMotion || isFinal;

    // The tour advances itself — except on the final panel, which rests.
    scheduleAdvance(Number(panel.getAttribute("data-duration") || 0));
  }

  /* Pulse the stressed beats of a container in sequence, like footsteps. */
  function pulseBeats(container, startDelay, step) {
    if (!container || reducedMotion) return;
    const beats = Array.from(container.querySelectorAll(".beat"))
      .sort(function (a, b) {
        return Number(a.dataset.beat) - Number(b.dataset.beat);
      });
    beats.forEach(function (beat, i) {
      later(function () {
        beat.classList.add("is-pulsing");
        later(function () { beat.classList.remove("is-pulsing"); }, 1400);
      }, startDelay + i * step);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Navigation                                                         */
  /* ------------------------------------------------------------------ */

  function next() {
    if (current >= panels.length - 1) return;   // the final panel rests
    current += 1;
    showPanel(current);
  }

  function prev() {
    if (current <= 0) return;
    current -= 1;
    showPanel(current);
  }

  function finish() {
    clearTimers();
    cancelAdvance();
    exhibit.hidden = true;
    document.querySelector(".exhibit-controls").hidden = true;
    if (siteContent) siteContent.hidden = false;
    document.dispatchEvent(new CustomEvent("exhibit:complete"));
  }

  backButton.addEventListener("click", prev);
  forwardButton.addEventListener("click", next);
  playPauseButton.addEventListener("click", function () { setPaused(!paused); });
  beginButton.addEventListener("click", finish);
  skipButton.addEventListener("click", finish);

  // Keyboard: arrows step, space pauses (when focus isn't on a button).
  document.addEventListener("keydown", function (e) {
    if (e.target instanceof HTMLElement && e.target.closest("button")) return;
    if (e.key === "ArrowRight") { next(); }
    else if (e.key === "ArrowLeft") { prev(); }
    else if (e.key === " ") { e.preventDefault(); setPaused(!paused); }
  });

  /* ------------------------------------------------------------------ */
  /* Panel 9 — audio buttons                                            */
  /* Pressing a clip pauses the tour: listening deserves stillness.     */
  /* ------------------------------------------------------------------ */

  const audioButtons = Array.from(document.querySelectorAll(".audio-button"));
  const audioTakeaway = document.getElementById("audio-takeaway");
  const played = new Set();

  audioButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setPaused(true);

      const src = button.getAttribute("data-audio");
      try {
        const clip = new Audio(src);
        clip.play().catch(function () {
          /* Placeholder files may be silent or absent; the press still counts. */
        });
      } catch (e) { /* no audio support; the press still counts */ }

      button.classList.add("was-played");
      played.add(button);

      if (played.size === audioButtons.length && audioTakeaway.hidden) {
        audioTakeaway.hidden = false;
        audioTakeaway.setAttribute("data-reveal", "");
        window.requestAnimationFrame(function () {
          audioTakeaway.classList.add("is-shown");
        });
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* Begin                                                              */
  /* ------------------------------------------------------------------ */

  next();
})();
