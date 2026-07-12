/* Self-playing opening exhibit and homepage handoff. */
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

  if (!panels.length || !backButton || !forwardButton || !playPauseButton ||
      !beginButton || !skipButton || !counter) return;

  const reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let current = -1;
  let paused = false;
  let queue = [];
  const advance = { id: null, remaining: 0, startedAt: 0 };

  function arm(item) {
    item.startedAt = Date.now();
    item.id = window.setTimeout(function () {
      queue = queue.filter(function (queued) { return queued !== item; });
      item.fn();
    }, item.remaining);
  }

  function later(fn, ms) {
    if (reducedMotion || paused) { fn(); return; }
    const item = { fn: fn, remaining: ms, id: null, startedAt: 0 };
    queue.push(item);
    arm(item);
  }

  function clearTimers() {
    queue.forEach(function (item) {
      if (item.id !== null) window.clearTimeout(item.id);
    });
    queue = [];
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

  function cancelAdvance() {
    if (advance.id !== null) window.clearTimeout(advance.id);
    advance.id = null;
    advance.remaining = 0;
  }

  function armAdvance() {
    advance.startedAt = Date.now();
    advance.id = window.setTimeout(function () {
      advance.id = null;
      next();
    }, advance.remaining);
  }

  function scheduleAdvance(duration) {
    cancelAdvance();
    if (reducedMotion || duration <= 0) return;
    advance.remaining = duration;
    if (!paused) armAdvance();
  }

  function freezeAdvance() {
    if (advance.id === null) return;
    window.clearTimeout(advance.id);
    advance.id = null;
    advance.remaining = Math.max(0, advance.remaining - (Date.now() - advance.startedAt));
  }

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
    playPauseButton.textContent = paused ? "Resume" : "Pause";
    playPauseButton.setAttribute("aria-pressed", paused ? "true" : "false");
    playPauseButton.setAttribute("aria-label", paused ? "Resume animation" : "Pause animation");
  }

  function pulseBeats(container, startDelay, step) {
    if (!container || reducedMotion) return;
    const beats = Array.from(container.querySelectorAll(".beat"))
      .sort(function (a, b) { return Number(a.dataset.beat) - Number(b.dataset.beat); });
    beats.forEach(function (beat, index) {
      later(function () {
        beat.classList.add("is-pulsing");
        later(function () { beat.classList.remove("is-pulsing"); }, 1400);
      }, startDelay + index * step);
    });
  }

  function playClip(button) {
    const src = button.getAttribute("data-audio");
    try {
      const clip = new Audio(src);
      const promise = clip.play();
      if (promise && typeof promise.catch === "function") promise.catch(function () {});
    } catch (error) {
      /* Audio is optional until the recordings are added. */
    }
    button.classList.add("was-played", "is-sounding");
    window.setTimeout(function () { button.classList.remove("is-sounding"); }, 1800);
  }

  function showPanel(index) {
    clearTimers();
    cancelAdvance();

    panels.forEach(function (panel) { panel.classList.remove("is-active"); });
    const panel = panels[index];
    panel.classList.add("is-active");
    counter.textContent = (index + 1) + " of " + panels.length;

    panel.querySelectorAll("[data-reveal]").forEach(function (element) {
      element.classList.remove("is-shown");
      const delay = Number(element.getAttribute("data-delay") || 0);
      later(function () { element.classList.add("is-shown"); }, delay + 250);
    });

    panel.querySelectorAll("[data-swap-out]").forEach(function (element) {
      element.classList.remove("is-hidden-away");
      const at = Number(element.getAttribute("data-swap-out") || 0);
      later(function () { element.classList.add("is-hidden-away"); }, at);
    });

    panel.querySelectorAll("[data-clear]").forEach(function (element) {
      element.classList.remove("is-cleared");
      if (!reducedMotion) {
        const at = Number(element.getAttribute("data-clear") || 0);
        later(function () { element.classList.add("is-cleared"); }, at);
      }
    });

    const panelNumber = panel.getAttribute("data-panel");
    if (panelNumber === "4") pulseBeats(panel, 3200, 850);
    if (panelNumber === "5") {
      pulseBeats(panel.querySelector(".pattern-a"), 800, 700);
      pulseBeats(panel.querySelector(".pattern-b"), 9000, 700);
    }
    if (panelNumber === "7" && !reducedMotion) {
      panel.querySelectorAll(".audio-button").forEach(function (button) {
        const at = Number(button.getAttribute("data-play-at") || 0);
        later(function () { playClip(button); }, at);
      });
    }

    const isFinal = index === panels.length - 1;
    backButton.disabled = index === 0;
    forwardButton.disabled = isFinal;
    beginButton.hidden = !isFinal;
    skipButton.hidden = isFinal;
    playPauseButton.hidden = reducedMotion || isFinal;
    scheduleAdvance(Number(panel.getAttribute("data-duration") || 0));
  }

  function next() {
    if (current >= panels.length - 1) return;
    current += 1;
    showPanel(current);
  }

  function previous() {
    if (current <= 0) return;
    current -= 1;
    showPanel(current);
  }

  function completeExhibit() {
    if (document.body.classList.contains("exhibit-complete")) return;
    clearTimers();
    cancelAdvance();

    const controls = document.querySelector(".exhibit-controls");
    if (exhibit) exhibit.hidden = true;
    if (controls) controls.hidden = true;
    if (siteContent) {
      siteContent.hidden = false;
      siteContent.removeAttribute("hidden");
      siteContent.setAttribute("tabindex", "-1");
    }

    document.body.classList.add("exhibit-complete");
    try { window.scrollTo({ top: 0, left: 0, behavior: "auto" }); }
    catch (error) { try { window.scrollTo(0, 0); } catch (ignored) {} }

    const target = document.getElementById("site-heading") || siteContent;
    if (target) {
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      try { target.focus({ preventScroll: true }); }
      catch (error) { try { target.focus(); } catch (ignored) {} }
    }
    document.dispatchEvent(new CustomEvent("exhibit:complete"));
  }

  window.completeExhibit = completeExhibit;

  backButton.addEventListener("click", previous);
  forwardButton.addEventListener("click", next);
  playPauseButton.addEventListener("click", function () { setPaused(!paused); });
  beginButton.addEventListener("click", completeExhibit);
  skipButton.addEventListener("click", completeExhibit);

  document.addEventListener("keydown", function (event) {
    if (event.target instanceof HTMLElement && event.target.closest("button")) return;
    if (event.key === "ArrowRight") next();
    else if (event.key === "ArrowLeft") previous();
    else if (event.key === " ") {
      event.preventDefault();
      setPaused(!paused);
    }
  });

  document.querySelectorAll(".audio-button").forEach(function (button) {
    button.addEventListener("click", function () {
      setPaused(true);
      playClip(button);
    });
  });

  next();
})();
