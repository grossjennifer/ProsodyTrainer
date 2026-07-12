/* Headless checks for the opening exhibit, run via: node test_exhibit.js */
"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log("  \u2713 " + name); }
  else { failed++; console.log("  \u2717 " + name); }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

function loadDom(beforeScript) {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  // jsdom stand-ins: matchMedia, Audio (recording plays), and a scroll recorder.
  window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q }));
  const plays = [];
  window.Audio = function (src) { return { play: () => { plays.push(src); return Promise.resolve(); } }; };
  const scrolls = [];
  window.scrollTo = function (a, b) {
    if (a && typeof a === "object") scrolls.push([a.left || 0, a.top || 0]);
    else scrolls.push([a, b]);
  };
  if (beforeScript) beforeScript(window.document);
  const js = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
  window.eval(js);
  return { dom, window, document: window.document, scrolls, plays };
}

(async () => {

console.log("Opening exhibit \u2014 structural checks");
{
  const { document } = loadDom();
  const panels = document.querySelectorAll(".exhibit-panel");
  check("9 panels present", panels.length === 9);
  check("panel 1 active on load", panels[0].classList.contains("is-active"));
  check("transport back/forward/pause present",
        !!document.getElementById("back-button") &&
        !!document.getElementById("forward-button") &&
        !!document.getElementById("play-pause-button"));
  check("Begin Exploring button exists and starts hidden",
        !!document.getElementById("begin-button") && document.getElementById("begin-button").hidden === true);
  check("Skip intro exists", !!document.getElementById("skip-intro"));
  check("counter reads 1 of 9", document.getElementById("panel-counter").textContent === "1 of 9");
  check("architecture has six levels", document.querySelectorAll(".arch-level").length === 6);
  check("Sputnik cutout appears only in the merged final panel",
        document.querySelectorAll(".sputnik").length === 1 &&
        document.querySelector("img.sputnik").getAttribute("src") === "sputnik.png" &&
        document.querySelector(".sputnik").closest("[data-panel]").getAttribute("data-panel") === "9");
  check("brand and Sputnik share the final panel",
        document.querySelector('[data-panel="9"] .brand') &&
        document.querySelector('[data-panel="9"] .sputnik-scene'));
  check("intonation buttons have descriptive accessible names",
        Array.from(document.querySelectorAll(".audio-button")).every(b => b.getAttribute("aria-label")));
  check("pause control has a full accessible name",
        document.getElementById("play-pause-button").getAttribute("aria-label") === "Pause animation");
  check("navigation is plain text \u2014 Back / Pause / Continue",
        document.getElementById("back-button").textContent.trim() === "Back" &&
        document.getElementById("play-pause-button").textContent.trim() === "Pause" &&
        document.getElementById("forward-button").textContent.trim() === "Continue");
  check("no play-icon glyphs anywhere in the navigation controls",
        !/[\u25B6\u25B7\u25BA\u25C0\u25C4\u23F4\u23F5\u275A]/.test(document.querySelector(".exhibit-controls").textContent));
  check("phrase boundaries use \u2502",
        Array.from(document.querySelectorAll(".phrase-boundary")).every(b => b.textContent === "\u2502"));
  check("no iambic/trochaic labels in exhibit", !document.body.textContent.match(/iambic|trochaic/i));
}

console.log("Brief \u2014 wording checks");
{
  const { document } = loadDom();
  const text = document.getElementById("opening-exhibit").textContent;
  check("stress takeaway identifies the strongest syllable", text.includes("In many words, one syllable carries the strongest beat."));
  check("sentence-rhythm bridge is concise",
        text.includes("Across a sentence, the beats form a pattern."));
  check("short puppy rhythm reveal present",
        text.includes("LIT") && text.includes("PUP") && text.includes("RAN") && text.includes("WAY"));
  check("hippopotamus example removed from the welcome",
        !text.toLowerCase().includes("hippopotamus") &&
        document.querySelector('[data-panel="4"]').textContent.includes("The little puppy ran away."));
  check("no leaning-forward / stepping-down phrasing",
        !text.includes("lean forward") && !text.includes("step down"));
  check("beat-pattern panel has no large title",
        !text.includes("Sentences Have Different Beat Patterns") &&
        !document.querySelector('[data-panel="5"] .panel-title'));
  check("beat-pattern takeaway present", text.includes("Sentences can have different beat patterns."));
  check("no plain-sentence ghosts in the beat-pattern panel",
        !text.includes("The band will play tonight at school.") &&
        !text.includes("Drama students practiced loudly.") &&
        !document.querySelector('[data-panel="5"] [data-swap-out]'));
  check("Step 1 marked line present",
        text.includes("BAND") && text.includes("PLAY") && text.includes("NIGHT") && text.includes("SCHOOL"));
  check("ta-DUM cue uses quiet interpuncts", text.includes("ta-DUM \u00B7 ta-DUM \u00B7 ta-DUM \u00B7 ta-DUM"));
  check("Step 1 caption names the strong beat", text.includes("A lighter syllable can lead into a strong beat."));
  check("Step 2 marked line present",
        text.includes("DRA") && text.includes("STU") && text.includes("PRAC"));
  check("DUM-ta cue uses quiet interpuncts", text.includes("DUM-ta \u00B7 DUM-ta \u00B7 DUM-ta \u00B7 DUM-ta"));
  check("Step 2 caption names the strong beat", text.includes("A strong beat can also come first."));
  check("no tall bars inside the beat-pattern panel",
        !document.querySelector('[data-panel="5"]').textContent.includes("\u2502") &&
        !document.querySelector('[data-panel="5"] .foot-divider'));
  const flat = text.replace(/\s+/g, " ");
  check("Grandma: unbroken line present", flat.includes("Let\u2019s eat Grandma."));
  check("Grandma: boundary line present", flat.includes("Let\u2019s eat \u2502 Grandma."));
  check("Grandma: phrasing lesson connects to silent reading", text.includes("Readers group words into meaningful phrases—even when reading silently."));
  check("Grandma: comma line present", flat.includes("Let\u2019s eat, Grandma."));
  check("Grandma: takeaway updated", text.includes("Grouping can change meaning.") &&
        !text.includes("Grouping changes meaning."));
  check("no cartoon grandmother \u2014 Grandma panel is words alone",
        document.querySelectorAll('[data-panel="6"] img, [data-panel="6"] svg').length === 0);
  check("intonation heading present", text.includes("One word, three voices."));
  check("intonation instruction present", text.includes("Listen to each one."));
  check("no melody maps remain", document.querySelectorAll(".melody-map").length === 0);
  check("no high/mid/low pitch labels remain", !/\bhigh\b[\s\S]*\bmid\b[\s\S]*\blow\b/.test(text));
  check("hierarchy says Stress, not Lexical Stress",
        Array.from(document.querySelectorAll(".arch-level")).some(l => l.textContent === "Stress") &&
        !text.includes("Lexical Stress"));
  check("hierarchy closing line updated",
        text.includes("Together, stress, rhythm, phrasing, and intonation help readers turn print into a voice—and a voice into meaning."));
  check("Sputnik lines present",
        text.includes("I\u2019ve been listening all along.") && text.includes("Now you can hear it too."));
  check("brand page merged with Sputnik rather than standing alone",
        document.querySelectorAll('[data-panel="9"] .brand').length === 1 &&
        document.querySelectorAll('.exhibit-panel').length === 9);
}

console.log("Beat patterns \u2014 one at a time");
{
  const { document } = loadDom();
  const panel = document.querySelector('[data-panel="5"]');
  const steps = panel.querySelectorAll(".rhythm-steps > .rhythm-step");
  check("two steps present, sharing one stage", steps.length === 2);
  const a = steps[0], b = steps[1];
  check("steps carry pattern-a and pattern-b",
        a.classList.contains("pattern-a") && b.classList.contains("pattern-b"));

  const aDelays = Array.from(a.querySelectorAll("[data-reveal]"))
    .map(el => Number(el.getAttribute("data-delay")));
  check("step one unfolds marked line \u2192 cue \u2192 caption",
        aDelays.length === 3 && aDelays[0] < aDelays[1] && aDelays[1] < aDelays[2]);

  const bDelays = Array.from(b.querySelectorAll("[data-reveal]"))
    .map(el => Number(el.getAttribute("data-delay")));
  check("step two unfolds marked line \u2192 cue \u2192 caption",
        bDelays.length === 3 && bDelays[0] < bDelays[1] && bDelays[1] < bDelays[2]);

  const clearA = Number(a.getAttribute("data-clear"));
  check("step one clears away completely before step two begins",
        clearA > 0 && clearA + 1100 <= Math.min(...bDelays));
  check("step two never clears \u2014 the takeaway joins it",
        !b.hasAttribute("data-clear"));

  const takeaway = panel.querySelector(":scope > .takeaway");
  check("takeaway sits beneath the stage and arrives last",
        !!takeaway && !takeaway.closest(".rhythm-step") &&
        Number(takeaway.getAttribute("data-delay")) > Math.max(...bDelays));
}
{
  // Shrink the clear timer so the handover can be observed quickly.
  const { document } = loadDom(doc => {
    doc.querySelector('[data-panel="5"] .pattern-a').setAttribute("data-clear", "20");
  });
  const forward = document.getElementById("forward-button");
  for (let i = 0; i < 4; i++) forward.click();            // 1 -> 5
  check("panel 5 active", document.querySelectorAll(".exhibit-panel")[4].classList.contains("is-active"));
  await sleep(300);
  const stepA = document.querySelector('[data-panel="5"] .pattern-a');
  const stepB = document.querySelector('[data-panel="5"] .pattern-b');
  check("step one cleared fully on its timer; step two remains",
        stepA.classList.contains("is-cleared") && !stepB.classList.contains("is-cleared"));
  forward.click();                                        // leave...
  document.getElementById("back-button").click();         // ...and revisit
  check("revisiting resets the cleared step", !stepA.classList.contains("is-cleared"));
}

console.log("Grandma \u2014 one sentence carries the phrasing lesson");
{
  const { document } = loadDom();
  const panel = document.querySelector('[data-panel="6"]');
  const reveals = Array.from(panel.querySelectorAll("[data-reveal]"));
  const delays = reveals.map(el => Number(el.getAttribute("data-delay") || 0));
  check("five reveals in strictly rising order",
        reveals.length === 5 && delays.every((d, i) => i === 0 || d > delays[i - 1]));
  const order = reveals.map(el => el.textContent.replace(/\s+/g, " ").trim());
  check("sequence: plain \u2192 boundary \u2192 lesson \u2192 comma \u2192 takeaway",
        order[0] === "Let\u2019s eat Grandma." &&
        order[1] === "Let\u2019s eat \u2502 Grandma." &&
        order[2] === "Readers group words into meaningful phrases—even when reading silently." &&
        order[3] === "Let\u2019s eat, Grandma." &&
        order[4] === "Grouping can change meaning.");
}

console.log("Transition \u2014 Begin Exploring reveals the homepage at the top");
{
  const { document, window, scrolls } = loadDom();
  const forward = document.getElementById("forward-button");
  const begin = document.getElementById("begin-button");
  const panels = document.querySelectorAll(".exhibit-panel");

  for (let i = 0; i < 8; i++) forward.click();            // 1 -> 9
  check("merged final panel active after 8 steps", panels[8].classList.contains("is-active"));
  check("Begin Exploring shown on final panel", begin.hidden === false);
  check("skip hidden on final panel", document.getElementById("skip-intro").hidden === true);
  check("forward disabled on final panel", forward.disabled === true);
  check("completeExhibit exposed on window", typeof window.completeExhibit === "function");

  let completions = 0;
  document.addEventListener("exhibit:complete", () => { completions++; });
  begin.click();

  check("exhibit hidden after Begin Exploring", document.getElementById("opening-exhibit").hidden === true);
  check("exhibit controls hidden", document.querySelector(".exhibit-controls").hidden === true);
  check("site content revealed, hidden attribute removed",
        document.getElementById("site-content").hidden === false &&
        !document.getElementById("site-content").hasAttribute("hidden"));
  check("site content made programmatically focusable",
        document.getElementById("site-content").getAttribute("tabindex") === "-1");
  check("body carries exhibit-complete", document.body.classList.contains("exhibit-complete"));
  check("window scrolled to top", scrolls.some(c => c[0] === 0 && c[1] === 0));
  check("focus moved to homepage heading",
        document.activeElement === document.getElementById("site-heading"));
  check("exhibit:complete dispatched", completions === 1);

  begin.click();                                          // a second press must be harmless
  check("completion is idempotent \u2014 the handoff fires exactly once", completions === 1);
}

console.log("Transition \u2014 Skip intro behaves identically");
{
  const { document, scrolls } = loadDom();
  let completed = false;
  document.addEventListener("exhibit:complete", () => { completed = true; });
  document.getElementById("skip-intro").click();
  check("skip completes the exhibit", completed && document.getElementById("opening-exhibit").hidden);
  check("skip hides controls", document.querySelector(".exhibit-controls").hidden === true);
  check("skip reveals site at the top", document.getElementById("site-content").hidden === false &&
        scrolls.some(c => c[0] === 0 && c[1] === 0));
  check("skip moves focus to homepage heading",
        document.activeElement === document.getElementById("site-heading"));
  check("skip also marks the body exhibit-complete",
        document.body.classList.contains("exhibit-complete"));
}

console.log("Stylesheet \u2014 completion safety rules");
{
  const css = fs.readFileSync(path.join(__dirname, "style.css"), "utf8").replace(/\s+/g, " ");
  check("exhibit and controls forced hidden once complete",
        css.includes("body.exhibit-complete #opening-exhibit") &&
        css.includes("body.exhibit-complete .exhibit-controls") &&
        /body\.exhibit-complete \.exhibit-controls \{ display: none; \}/.test(css));
  check("#site-content[hidden] forced to display none",
        css.includes("#site-content[hidden] { display: none; }"));
  check("beat-pattern sentences sized down so the cue is easy to see",
        css.includes(".rhythm-step .demo-sentence { font-size: clamp(1.25rem, 3.2vw, 1.75rem); }"));
}

console.log("Intonation \u2014 the three voices play themselves");
{
  const { document } = loadDom();
  const buttons = document.querySelectorAll(".audio-button");
  check("three audio buttons", buttons.length === 3);
  check("buttons labeled Really. / Really? / Really!",
        buttons[0].textContent.includes("Really.") &&
        buttons[1].textContent.includes("Really?") &&
        buttons[2].textContent.includes("Really!"));
  const ats = Array.from(buttons).map(b => Number(b.getAttribute("data-play-at")));
  check("each button has an autoplay time, in sequence",
        ats.every(t => t > 0) && ats[0] < ats[1] && ats[1] < ats[2]);
  const takeaway = document.getElementById("audio-takeaway");
  check("takeaway is a timed reveal, not gated",
        takeaway.hasAttribute("data-reveal") && !takeaway.hidden);
  check("takeaway has both lines",
        takeaway.textContent.includes("Same word. Different voice.") &&
        takeaway.textContent.includes("Punctuation gives readers clues about how it might sound."));
  check("transcript available in a disclosure",
        !!document.querySelector(".audio-transcript-details summary") &&
        document.querySelector(".audio-transcript-details").textContent.includes("really"));
}
{
  // Shrink the autoplay schedule so the sequence can be observed quickly.
  const { document, plays } = loadDom(doc => {
    const buttons = doc.querySelectorAll(".audio-button");
    buttons[0].setAttribute("data-play-at", "10");
    buttons[1].setAttribute("data-play-at", "30");
    buttons[2].setAttribute("data-play-at", "50");
    doc.getElementById("audio-takeaway").setAttribute("data-delay", "70");
  });
  const forward = document.getElementById("forward-button");
  for (let i = 0; i < 6; i++) forward.click();            // 1 -> 7 (intonation)
  check("panel 7 (intonation) active",
        document.querySelectorAll(".exhibit-panel")[6].classList.contains("is-active"));
  await sleep(500);
  check("three clips played automatically, in order",
        plays.length === 3 &&
        plays[0] === "really-statement.mp3" &&
        plays[1] === "really-question.mp3" &&
        plays[2] === "really-exclamation.mp3");
  const buttons = document.querySelectorAll(".audio-button");
  check("autoplayed buttons marked", Array.from(buttons).every(b => b.classList.contains("was-played")));
  check("takeaway revealed on its own timer",
        document.getElementById("audio-takeaway").classList.contains("is-shown"));
  const playPause = document.getElementById("play-pause-button");
  buttons[1].click();                                     // replay a voice by hand
  check("pressing a clip replays it", plays.length === 4 && plays[3] === "really-question.mp3");
  check("pressing a clip pauses the tour", playPause.getAttribute("aria-pressed") === "true");
  check("paused button reads Resume \u2014 text, not a play triangle",
        playPause.textContent.trim() === "Resume");
  check("paused button exposes Resume animation to assistive technology",
        playPause.getAttribute("aria-label") === "Resume animation");
}

console.log("Homepage \u2014 harmonization hooks");
{
  const { document } = loadDom();
  const heading = document.getElementById("site-heading");
  check("homepage heading focusable", !!heading && heading.getAttribute("tabindex") === "-1");
  check("homepage lives in #site-content", !!document.querySelector("#site-content .site-shell"));
  check("site content hidden before the exhibit ends",
        document.getElementById("site-content").hidden === true);
  const style = document.querySelector("head style").textContent;
  check("homepage styles use shared design tokens",
        style.includes("var(--paper)") && style.includes("var(--ink)") &&
        style.includes("var(--glow)") && style.includes("var(--serif)"));
  check("no leftover crimson/teal palette",
        !style.includes("#A03052") && !style.includes("#2E6E6A") && !style.includes("#EFF2F1"));
  check("homepage respects reduced motion", style.includes("prefers-reduced-motion"));
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
})();
