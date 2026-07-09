/* ==========================================================================
   The Hidden Architecture of Reading — self-playing exhibit
   The exhibit now plays itself: each panel carries a data-duration, and
   the tour advances when a panel's choreography has had time to land.
   The visitor keeps full control through a transport — rewind (◀),
   pause/resume, and forward (▶) — plus Skip intro.

   Courtesies:
   - Pausing freezes everything mid-gesture (reveals, pulses, the advance).
   - On the intonation panel the three voices play by themselves, one
     after another; the buttons replay any of them, and pressing one
     pauses the tour so nothing is rushed. (Browsers may keep sound
     muted until the visitor's first interaction with the page.)
   - Under prefers-reduced-motion, nothing moves and nothing self-advances:
     each panel appears complete, clips play only when pressed, and
     ◀ / ▶ step through at the reader's pace.
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
    panel.querySelectorAll("[data-recede]").forEach(function (el) {
      el.classList.remove("is-receded");
    });

    // Schedule this panel's reveals.
    panel.querySelectorAll("[data-reveal]").forEach(function (el) {
      const delay = Number(el.getAttribute("data-delay") || 0);
      later(function () { el.classList.add("is-shown"); }, delay + 250);
    });

    // Plain lines that yield to their marked twin (panels 4 and 5).
    panel.querySelectorAll("[data-swap-out]").forEach(function (el) {
      const at = Number(el.getAttribute("data-swap-out"));
      later(function () { el.classList.add("is-hidden-away"); }, at);
    });

    // Whole steps that settle back once their moment has passed
    // (panel 5: the first example recedes before the second begins,
    // so only one example holds full size at a time).
    panel.querySelectorAll("[data-recede]").forEach(function (el) {
      const at = Number(el.getAttribute("data-recede"));
      later(function () { el.classList.add("is-receded"); }, at);
    });

    // Panel-specific choreography.
    const n = panel.getAttribute("data-panel");
    if (n === "4") pulseBeats(panel, 3600, 900);            // POT → SNORT → LOUD → WA → EDGE
    if (n === "5") {                                        // beat patterns: step one, then step two
      pulseBeats(panel.querySelector(".pattern-a"), 3000, 700);
      pulseBeats(panel.querySelector(".pattern-b"), 11800, 700);
    }
    if (n === "8" && !reducedMotion) {                      // the three voices play themselves
      panel.querySelectorAll(".audio-button").forEach(function (button) {
        const at = Number(button.getAttribute("data-play-at") || 0);
        later(function () { playClip(button); }, at);
      });
    }

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

  /* The one and only handoff from exhibit to homepage. Both Begin
     Exploring and Skip intro call it (and the inline safety net in
     index.html delegates to it). Idempotent: however many wired
     listeners fire, the handoff happens exactly once. */
  function completeExhibit() {
    if (document.body.classList.contains("exhibit-complete")) return;

    clearTimers();
    cancelAdvance();

    // 1–2. Hide the exhibit and its controls completely.
    const controls = document.querySelector(".exhibit-controls");
    if (exhibit) exhibit.hidden = true;
    if (controls) controls.hidden = true;

    // 3–4. Reveal the homepage.
    if (siteContent) {
      siteContent.hidden = false;
      siteContent.removeAttribute("hidden");
      siteContent.setAttribute("tabindex", "-1");
    }

    // Belt and braces: the stylesheet also hides the exhibit and
    // shows the site whenever this class is present on <body>.
    document.body.classList.add("exhibit-complete");

    // 5. The visitor arrives at the top of the homepage —
    //    no scrolling required to discover it.
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (e) {
      try { window.scrollTo(0, 0); } catch (e2) { /* older engines */ }
    }

    // 6. Keyboard focus moves to the homepage heading (falling back
    //    to #site-content), so keyboard and screen-reader visitors
    //    land where sighted visitors are looking.
    const target = document.getElementById("site-heading") || siteContent;
    if (target) {
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      try { target.focus({ preventScroll: true }); }
      catch (e) { try { target.focus(); } catch (e2) { /* focus is a courtesy */ } }
    }

    // 7. Announce completion for anything listening.
    document.dispatchEvent(new CustomEvent("exhibit:complete"));
  }

  // Exposed so the inline safety net (and anything else) can call
  // the same single function.
  window.completeExhibit = completeExhibit;

  backButton.addEventListener("click", prev);
  forwardButton.addEventListener("click", next);
  playPauseButton.addEventListener("click", function () { setPaused(!paused); });
  beginButton.addEventListener("click", completeExhibit);
  skipButton.addEventListener("click", completeExhibit);

  // Keyboard: arrows step, space pauses (when focus isn't on a button).
  document.addEventListener("keydown", function (e) {
    if (e.target instanceof HTMLElement && e.target.closest("button")) return;
    if (e.key === "ArrowRight") { next(); }
    else if (e.key === "ArrowLeft") { prev(); }
    else if (e.key === " ") { e.preventDefault(); setPaused(!paused); }
  });

  /* ------------------------------------------------------------------ */
  /* Panel 8 — the three voices                                         */
  /* The clips play by themselves, one after another, when the panel   */
  /* arrives (scheduled in showPanel). The buttons replay any voice;   */
  /* pressing one pauses the tour: listening deserves stillness.       */
  /* ------------------------------------------------------------------ */

  function playClip(button) {
    const src = button.getAttribute("data-audio");
    try {
      const clip = new Audio(src);
      clip.play().catch(function () {
        /* Placeholder files may be silent or absent, and browsers may
           block sound before the visitor's first interaction; the
           sequence continues either way. */
      });
    } catch (e) { /* no audio support; the exhibit continues */ }

    button.classList.add("was-played");

    // A brief ring marks which voice is sounding (never color alone —
    // the button's played glyph keeps the state visible afterwards).
    button.classList.add("is-sounding");
    window.setTimeout(function () { button.classList.remove("is-sounding"); }, 1800);
  }

  Array.from(document.querySelectorAll(".audio-button")).forEach(function (button) {
    button.addEventListener("click", function () {
      setPaused(true);
      playClip(button);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Begin                                                              */
  /* ------------------------------------------------------------------ */

  next();
})();
