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

  // The opening exhibit is a teaching piece: it plays on every visit, and the
  // reader can leave at any time with "Skip intro" (or "Explore the full site"
  // on the final panel). No visit is tracked or stored.

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
    // "Play" rather than "Resume": this button controls automatic playback,
    // while "Continue" advances the tour. Two forward-sounding labels side by
    // side left it unclear which one moved you onward. The visible text is the
    // accessible name; it is not doubled with aria-pressed, which would make a
    // screen reader say "Play, pressed" for a paused tour.
    playPauseButton.textContent = paused ? "Play" : "Pause";
  }

  function pulseBeats(container, startDelay, step) {
    if (!container || reducedMotion || paused) return;
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

  // What a screen reader hears for each panel: the counter, then the panel's
  // title and takeaway lines. Sighted readers watch the same text arrive on
  // its own timing; the announcement gives it to assistive technology at once.
  function describePanel(panel) {
    const parts = [];
    panel.querySelectorAll(".display-line, .panel-title, .takeaway").forEach(function (element) {
      const text = element.textContent.replace(/\s+/g, " ").trim();
      if (text) parts.push(text);
    });
    return parts.join(" ");
  }

  // Keep keyboard focus on a live control when the one it was on is disabled
  // or hidden by a panel change.
  function moveFocusFrom(element, to) {
    if (document.activeElement === element && to && !to.disabled && !to.hidden) {
      try { to.focus(); } catch (error) {}
    }
  }

  function showPanel(index) {
    clearTimers();
    cancelAdvance();

    // While paused (or with reduced motion), a panel is shown as a still: every
    // line visible at once, nothing cleared away, no pulses, no audio. Stepping
    // through a paused tour therefore never hides a sentence mid-thought.
    const still = reducedMotion || paused;

    panels.forEach(function (panel) { panel.classList.remove("is-active"); });
    const panel = panels[index];
    panel.classList.add("is-active");
    panel.classList.toggle("is-still", still);
    counter.textContent = (index + 1) + " of " + panels.length;
    const spoken = document.createElement("span");
    spoken.className = "visually-hidden";
    spoken.textContent = ". " + describePanel(panel);
    counter.appendChild(spoken);

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
      if (!still) {
        const at = Number(element.getAttribute("data-clear") || 0);
        later(function () { element.classList.add("is-cleared"); }, at);
      }
    });

    const panelNumber = panel.getAttribute("data-panel");
    if (panelNumber === "4") pulseBeats(panel, 3200, 850);
    if (panelNumber === "5") {
      pulseBeats(panel.querySelector(".pattern-a"), 800, 700);
      pulseBeats(panel.querySelector(".pattern-b"), 10500, 700);
    }
    // Keyed on the buttons themselves rather than a panel number, so the
    // audio panel keeps working if panels are added or reordered.
    if (panel.querySelector(".audio-button") && !still) {
      panel.querySelectorAll(".audio-button").forEach(function (button) {
        const at = Number(button.getAttribute("data-play-at") || 0);
        later(function () { playClip(button); }, at);
      });
    }

    const isFinal = index === panels.length - 1;
    if (index === 0) moveFocusFrom(backButton, forwardButton);
    if (isFinal) {
      moveFocusFrom(forwardButton, backButton);
      moveFocusFrom(skipButton, beginButton);
      moveFocusFrom(playPauseButton, backButton);
    }
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

  // The homepage is never hidden from the document; the exhibit floats above it
  // while body.exhibit-active is set. Content underneath is made inert so that
  // keyboard and screen-reader focus cannot wander into it behind the overlay.
  function raiseExhibit() {
    document.body.classList.add("exhibit-active");
    if (siteContent) {
      siteContent.setAttribute("inert", "");
      siteContent.setAttribute("aria-hidden", "true");
    }
  }

  // Keyboard shortcuts belong to the tour alone. The handler is removed when
  // the tour ends, so Space scrolls the homepage and opens its disclosure
  // widgets again, and the arrow keys stop driving a hidden exhibit.
  function onKeydown(event) {
    if (!document.body.classList.contains("exhibit-active")) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLElement &&
        event.target.closest("button, a, summary, input, textarea, select")) return;
    if (event.key === "ArrowRight") next();
    else if (event.key === "ArrowLeft") previous();
    else if (event.key === " ") {
      event.preventDefault();
      setPaused(!paused);
    }
  }

  function completeExhibit() {
    if (document.body.classList.contains("exhibit-complete")) return;
    clearTimers();
    cancelAdvance();
    document.removeEventListener("keydown", onKeydown);

    const controls = document.querySelector(".exhibit-controls");
    document.body.classList.remove("exhibit-active");
    if (exhibit) exhibit.hidden = true;
    if (controls) controls.hidden = true;
    if (siteContent) {
      siteContent.removeAttribute("inert");
      siteContent.removeAttribute("aria-hidden");
      siteContent.removeAttribute("hidden");
      siteContent.setAttribute("tabindex", "-1");
    }

    document.body.classList.add("exhibit-complete");
    try { window.sessionStorage.setItem("pt-tour-seen", "1"); } catch (error) {}
    const replay = document.getElementById("replay-intro");
    if (replay) replay.hidden = false;
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
  document.addEventListener("keydown", onKeydown);

  document.querySelectorAll(".audio-button").forEach(function (button) {
    button.addEventListener("click", function () {
      setPaused(true);
      playClip(button);
    });
  });

  // Replay restarts the exhibit: forget that this tab has seen it, drop any
  // section hash (a hash also skips the tour), and reload.
  function requestReplay() {
    try { window.sessionStorage.removeItem("pt-tour-seen"); } catch (error) {}
    const plain = window.location.pathname + window.location.search;
    try {
      if (window.location.hash) window.location.replace(plain);
      else window.location.reload();
    }
    catch (error) { window.location.href = plain; }
  }
  Array.prototype.forEach.call(
    document.querySelectorAll(".js-replay-intro"),
    function (button) { button.addEventListener("click", requestReplay); }
  );

  // Play the welcome on a first visit; the reader can skip at any time.
  // The inline bootstrap in index.html marks the body .exhibit-skip when this
  // tab has already seen the tour or the URL carries a section hash — then go
  // straight to the site, and honour the hash instead of scrolling to the top.
  if (document.body.classList.contains("exhibit-skip")) {
    const hash = window.location.hash;
    completeExhibit();
    const section = hash && document.getElementById(hash.slice(1));
    if (section) {
      try { section.scrollIntoView(); } catch (error) {}
    }
  } else {
    raiseExhibit();
    next();
  }
})();
