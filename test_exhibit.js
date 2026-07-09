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
  window.scrollTo = function (x, y) { scrolls.push([x, y]); };
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
  check("beat-pattern title present", text.includes("Sentences Have Different Beat Patterns"));
  check("beat-pattern takeaway present", text.includes("Sentences can have different beat patterns."));
  check("Example A line present",
        text.includes("BAND") && text.includes("PLAY") && text.includes("NIGHT") && text.includes("SCHOOL"));
  check("ta-DUM cue present", text.includes("ta-DUM \u2502 ta-DUM \u2502 ta-DUM \u2502 ta-DUM"));
  check("Example A caption present", text.includes("Here, the beat comes after a lighter syllable."));
  check("Example B line present",
        text.includes("DRA") && text.includes("STU") && text.includes("PRAC"));
  check("DUM-ta cue present", text.includes("DUM-ta \u2502 DUM-ta \u2502 DUM-ta \u2502 DUM-ta"));
  check("Example B caption present", text.includes("Here, the beat comes first."));
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

console.log("Transition \u2014 Begin Exploring reveals the homepage at the top");
{
  const { document, scrolls } = loadDom();
  const forward = document.getElementById("forward-button");
  const begin = document.getElementById("begin-button");
  const panels = document.querySelectorAll(".exhibit-panel");

  for (let i = 0; i < 10; i++) forward.click();           // 1 -> 11
  check("panel 11 (Sputnik) active after 10 steps", panels[10].classList.contains("is-active"));
  check("Begin Exploring shown on final panel", begin.hidden === false);
  check("skip hidden on final panel", document.getElementById("skip-intro").hidden === true);
  check("forward disabled on final panel", forward.disabled === true);

  let completed = false;
  document.addEventListener("exhibit:complete", () => { completed = true; });
  begin.click();

  check("exhibit hidden after Begin Exploring", document.getElementById("opening-exhibit").hidden === true);
  check("exhibit controls hidden", document.querySelector(".exhibit-controls").hidden === true);
  check("site content revealed", document.getElementById("site-content").hidden === false);
  check("window scrolled to top", scrolls.some(c => c[0] === 0 && c[1] === 0));
  check("focus moved to homepage heading",
        document.activeElement === document.getElementById("site-heading"));
  check("exhibit:complete dispatched", completed);
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
