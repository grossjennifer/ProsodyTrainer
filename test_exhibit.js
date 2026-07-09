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
  check("11 panels present", panels.length === 11);
  check("panel 1 active on load", panels[0].classList.contains("is-active"));
  check("transport back/forward/pause present",
        !!document.getElementById("back-button") &&
        !!document.getElementById("forward-button") &&
        !!document.getElementById("play-pause-button"));
  check("Begin Exploring button exists and starts hidden",
        !!document.getElementById("begin-button") && document.getElementById("begin-button").hidden === true);
  check("Skip intro exists", !!document.getElementById("skip-intro"));
  check("counter reads 1 of 11", document.getElementById("panel-counter").textContent === "1 of 11");
  check("architecture has six levels", document.querySelectorAll(".arch-level").length === 6);
  check("Sputnik photo only in panel 11",
        document.querySelectorAll(".sputnik").length === 1 &&
        document.querySelector("img.sputnik").getAttribute("src") === "sputnik.png" &&
        document.querySelector(".sputnik").closest("[data-panel]").getAttribute("data-panel") === "11");
  check("phrase boundaries use \u2502",
        Array.from(document.querySelectorAll(".phrase-boundary")).every(b => b.textContent === "\u2502"));
  check("no iambic/trochaic labels in exhibit", !document.body.textContent.match(/iambic|trochaic/i));
}

console.log("Brief \u2014 wording checks");
{
  const { document } = loadDom();
  const text = document.getElementById("opening-exhibit").textContent;
  check("stress takeaway: Some syllables stand out.", text.includes("Some syllables stand out."));
  check("rhythm takeaway uses connected words",
        text.includes("Stress creates a beat across connected words.") &&
        !text.includes("connected language"));
  check("hippo rhythm reveal present",
        text.includes("POT") && text.includes("SNORT") && text.includes("LOUD") &&
        text.includes("WA") && text.includes("EDGE"));
  check("hippo phrasing reveal present",
        text.replace(/\s+/g, " ").includes("The hippopotamus \u2502 snorted loudly \u2502 at the water\u2019s edge."));
  check("no leaning-forward / stepping-down phrasing",
        !text.includes("lean forward") && !text.includes("step down"));
  check("beat-pattern panel has no large title",
        !text.includes("Sentences Have Different Beat Patterns") &&
        !document.querySelector('[data-panel="5"] .panel-title'));
  check("beat-pattern takeaway present", text.includes("Sentences can have different beat patterns."));
  check("Step 1 plain sentence present", text.includes("The band will play tonight at school."));
  check("Step 1 marked line present",
        text.includes("BAND") && text.includes("PLAY") && text.includes("NIGHT") && text.includes("SCHOOL"));
  check("ta-DUM cue uses quiet interpuncts", text.includes("ta-DUM \u00B7 ta-DUM \u00B7 ta-DUM \u00B7 ta-DUM"));
  check("Step 1 takeaway present", text.includes("A lighter syllable can lead into the beat."));
  check("Step 2 plain sentence present", text.includes("Drama students practiced loudly."));
  check("Step 2 marked line present",
        text.includes("DRA") && text.includes("STU") && text.includes("PRAC"));
  check("DUM-ta cue uses quiet interpuncts", text.includes("DUM-ta \u00B7 DUM-ta \u00B7 DUM-ta \u00B7 DUM-ta"));
  check("Step 2 takeaway present", text.includes("The beat can also come first."));
  check("no tall bars inside the beat-pattern panel",
        !document.querySelector('[data-panel="5"]').textContent.includes("\u2502") &&
        !document.querySelector('[data-panel="5"] .foot-divider'));
  check("intonation heading present", text.includes("One word, three voices."));
  check("intonation instruction present", text.includes("Listen to each one."));
  check("no melody maps remain", document.querySelectorAll(".melody-map").length === 0);
  check("no high/mid/low pitch labels remain", !/\bhigh\b[\s\S]*\bmid\b[\s\S]*\blow\b/.test(text));
  check("hierarchy says Stress, not Lexical Stress",
        Array.from(document.querySelectorAll(".arch-level")).some(l => l.textContent === "Stress") &&
        !text.includes("Lexical Stress"));
  check("hierarchy closing line updated",
        text.includes("With stress, rhythm, phrasing, and intonation, readers turn print back into a voice."));
  check("Sputnik lines present",
        text.includes("I\u2019ve been listening all along.") && text.includes("Now you can hear it too."));
}

console.log("Beat patterns \u2014 two quiet steps");
{
  const { document } = loadDom();
  const panel = document.querySelector('[data-panel="5"]');
  const a = panel.querySelector(".rhythm-example.pattern-a");
  const b = panel.querySelector(".rhythm-example.pattern-b");
  check("two steps present", !!a && !!b);

  const aDelays = Array.from(a.querySelectorAll("[data-reveal]"))
    .map(el => Number(el.getAttribute("data-delay")));
  check("step one unfolds marked line \u2192 cue \u2192 takeaway",
        aDelays.length === 3 && aDelays[0] < aDelays[1] && aDelays[1] < aDelays[2]);
  check("step one plain sentence yields to its marked twin",
        a.querySelector("[data-swap-out]") !== null);

  const bDelays = Array.from(b.querySelectorAll("[data-reveal]"))
    .map(el => Number(el.getAttribute("data-delay")));
  check("step two unfolds plain \u2192 marked \u2192 cue \u2192 takeaway",
        bDelays.length === 4 && bDelays[0] < bDelays[1] &&
        bDelays[1] < bDelays[2] && bDelays[2] < bDelays[3]);

  const recedeAt = Number(a.getAttribute("data-recede"));
  check("step one settles back before step two begins",
        recedeAt > 0 && recedeAt <= Math.min(...bDelays));
  check("closing line arrives after both steps",
        Number(panel.querySelector(":scope > .takeaway").getAttribute("data-delay")) > Math.max(...bDelays));
}
{
  // Shrink the recede timer so the settling-back can be observed quickly.
  const { document } = loadDom(doc => {
    doc.querySelector('[data-panel="5"] .pattern-a').setAttribute("data-recede", "20");
  });
  const forward = document.getElementById("forward-button");
  for (let i = 0; i < 4; i++) forward.click();            // 1 -> 5
  check("panel 5 active", document.querySelectorAll(".exhibit-panel")[4].classList.contains("is-active"));
  await sleep(300);
  const stepA = document.querySelector('[data-panel="5"] .pattern-a');
  check("step one receded on its timer", stepA.classList.contains("is-receded"));
  forward.click();                                        // leave...
  document.getElementById("back-button").click();         // ...and revisit
  check("revisiting resets the receded step", !stepA.classList.contains("is-receded"));
}

console.log("Transition \u2014 Begin Exploring reveals the homepage at the top");
{
  const { document, window, scrolls } = loadDom();
  const forward = document.getElementById("forward-button");
  const begin = document.getElementById("begin-button");
  const panels = document.querySelectorAll(".exhibit-panel");

  for (let i = 0; i < 10; i++) forward.click();           // 1 -> 11
  check("panel 11 (Sputnik) active after 10 steps", panels[10].classList.contains("is-active"));
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
        takeaway.textContent.includes("Punctuation helps shape the voice."));
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
  for (let i = 0; i < 7; i++) forward.click();            // 1 -> 8 (intonation)
  check("panel 8 (intonation) active",
        document.querySelectorAll(".exhibit-panel")[7].classList.contains("is-active"));
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
