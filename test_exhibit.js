/* Headless checks for the opening exhibit, run via: node test_exhibit.js */
"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name); }
}

function loadDom() {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  // jsdom lacks matchMedia and Audio; provide minimal stand-ins.
  window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q }));
  window.Audio = function () { return { play: () => Promise.resolve() }; };
  const js = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
  window.eval(js);
  return { dom, window, document: window.document };
}

console.log("Opening exhibit — structural checks");
{
  const { document } = loadDom();
  const panels = document.querySelectorAll(".exhibit-panel");
  check("13 panels present", panels.length === 13);
  check("panel 1 active on load", panels[0].classList.contains("is-active"));
  check("Continue button exists", !!document.getElementById("continue-button"));
  check("Skip intro exists", !!document.getElementById("skip-intro"));
  check("counter reads 1 of 13", document.getElementById("panel-counter").textContent === "1 of 13");
  check("three audio buttons", document.querySelectorAll(".audio-button").length === 3);
  check("three melody maps", document.querySelectorAll(".melody-map").length === 3);
  check("melody SVGs have aria-labels", Array.from(document.querySelectorAll(".melody-map svg")).every(s => s.getAttribute("aria-label")));
  check("architecture has six levels", document.querySelectorAll(".arch-level").length === 6);
  check("Sputnik only in panel 13", document.querySelectorAll(".sputnik").length === 1 &&
        document.querySelector(".sputnik").closest("[data-panel]").getAttribute("data-panel") === "13");
  check("phrase boundaries use │", Array.from(document.querySelectorAll(".phrase-boundary")).every(b => b.textContent === "│"));
  check("no iambic/trochaic labels in exhibit", !document.body.textContent.match(/iambic|trochaic/i));
  check("audio transcript present", !!document.querySelector(".audio-transcript"));
}

console.log("Opening exhibit — flow checks");
{
  const { document } = loadDom();
  const btn = document.getElementById("continue-button");
  const panels = document.querySelectorAll(".exhibit-panel");
  for (let i = 0; i < 11; i++) btn.click();               // advance to panel 12
  check("panel 12 active after 11 clicks", panels[11].classList.contains("is-active"));
  btn.click();                                            // panel 13
  check("panel 13 (Sputnik) active", panels[12].classList.contains("is-active"));
  check("button reads Begin Exploring on final panel", btn.textContent === "Begin Exploring");
  check("skip hidden on final panel", document.getElementById("skip-intro").hidden === true);

  let completed = false;
  document.addEventListener("exhibit:complete", () => { completed = true; });
  btn.click();                                            // finish
  check("exhibit hidden after Begin Exploring", document.getElementById("opening-exhibit").hidden === true);
  check("site content revealed", document.getElementById("site-content").hidden === false);
  check("exhibit:complete dispatched", completed);
}

console.log("Opening exhibit — skip and audio checks");
{
  const { document } = loadDom();
  let completed = false;
  document.addEventListener("exhibit:complete", () => { completed = true; });
  document.getElementById("skip-intro").click();
  check("skip completes the exhibit", completed && document.getElementById("opening-exhibit").hidden);
}
{
  const { document } = loadDom();
  const buttons = document.querySelectorAll(".audio-button");
  const takeaway = document.getElementById("audio-takeaway");
  check("audio takeaway hidden initially", takeaway.hidden === true);
  buttons[0].click(); buttons[1].click();
  check("takeaway still hidden after two plays", takeaway.hidden === true);
  buttons[2].click();
  check("takeaway revealed after all three plays", takeaway.hidden === false);
  check("played buttons marked", Array.from(buttons).every(b => b.classList.contains("was-played")));
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
