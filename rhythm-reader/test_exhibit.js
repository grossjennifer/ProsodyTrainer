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

const wait = ms => new Promise(res => setTimeout(res, ms));

function loadDom(opts) {
  opts = opts || {};
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  // jsdom lacks matchMedia and Audio; provide minimal stand-ins.
  window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q }));
  window.Audio = function () { return { play: () => Promise.resolve() }; };
  // Optionally compress every panel's dwell time so autoplay can be observed.
  if (opts.fastDurations) {
    window.document.querySelectorAll(".exhibit-panel").forEach(p => {
      if (Number(p.getAttribute("data-duration")) > 0) {
        p.setAttribute("data-duration", String(opts.fastDurations));
      }
    });
  }
  const js = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
  window.eval(js);
  return { dom, window, document: window.document };
}

async function main() {

  console.log("Opening exhibit — structural checks");
  {
    const { document } = loadDom();
    const panels = document.querySelectorAll(".exhibit-panel");
    check("13 panels present", panels.length === 13);
    check("panel 1 active on load", panels[0].classList.contains("is-active"));
    check("every panel declares a data-duration", Array.from(panels).every(p => p.hasAttribute("data-duration")));
    check("final panel never auto-advances (duration 0)", panels[12].getAttribute("data-duration") === "0");
    check("back button exists", !!document.getElementById("back-button"));
    check("forward button exists", !!document.getElementById("forward-button"));
    check("play/pause button exists", !!document.getElementById("play-pause-button"));
    check("Begin Exploring button exists and starts hidden",
          document.getElementById("begin-button") && document.getElementById("begin-button").hidden === true);
    check("Skip intro exists", !!document.getElementById("skip-intro"));
    check("no Continue button remains", !document.getElementById("continue-button"));
    check("counter reads 1 of 13", document.getElementById("panel-counter").textContent === "1 of 13");
    check("back disabled on first panel", document.getElementById("back-button").disabled === true);

    const opening = panels[0].querySelectorAll(".display-line");
    check("opening line 1 as specified",
          opening[0] && opening[0].textContent.trim() === "Every skilled reader hears a voice that isn\u2019t there.");
    check("opening line 2 as specified",
          opening[1] && opening[1].textContent.trim() === "Let\u2019s look a little closer.");
    check("opening panel has exactly two lines", opening.length === 2);

    check("three audio buttons", document.querySelectorAll(".audio-button").length === 3);
    check("three melody maps", document.querySelectorAll(".melody-map").length === 3);
    check("melody SVGs have aria-labels", Array.from(document.querySelectorAll(".melody-map svg")).every(s => s.getAttribute("aria-label")));
    check("architecture has six levels", document.querySelectorAll(".arch-level").length === 6);

    const sputniks = document.querySelectorAll(".sputnik");
    check("Sputnik only in panel 13", sputniks.length === 1 &&
          sputniks[0].closest("[data-panel]").getAttribute("data-panel") === "13");
    check("Sputnik is now a photograph", sputniks[0].tagName === "IMG" &&
          sputniks[0].getAttribute("src") === "sputnik.png");
    check("Sputnik photograph has descriptive alt text",
          (sputniks[0].getAttribute("alt") || "").length > 20);

    check("phrase boundaries use │", Array.from(document.querySelectorAll(".phrase-boundary")).every(b => b.textContent === "│"));
    check("no iambic/trochaic labels in exhibit", !document.body.textContent.match(/iambic|trochaic/i));
    check("audio transcript present", !!document.querySelector(".audio-transcript"));
  }

  console.log("Opening exhibit — transport flow checks");
  {
    const { document } = loadDom();
    const fwd = document.getElementById("forward-button");
    const back = document.getElementById("back-button");
    const panels = document.querySelectorAll(".exhibit-panel");

    fwd.click(); fwd.click();
    check("forward advances (panel 3 after two presses)", panels[2].classList.contains("is-active"));
    check("counter reads 3 of 13", document.getElementById("panel-counter").textContent === "3 of 13");
    back.click();
    check("rewind returns to panel 2", panels[1].classList.contains("is-active"));
    check("back enabled off the first panel", back.disabled === false);

    for (let i = 0; i < 11; i++) fwd.click();             // to panel 13
    check("panel 13 (Sputnik) active", panels[12].classList.contains("is-active"));
    check("forward disabled on final panel", fwd.disabled === true);
    check("Begin Exploring revealed on final panel", document.getElementById("begin-button").hidden === false);
    check("skip hidden on final panel", document.getElementById("skip-intro").hidden === true);
    back.click();
    check("rewind still works from the final panel", panels[11].classList.contains("is-active"));
    check("Begin Exploring hides again off the final panel", document.getElementById("begin-button").hidden === true);
    fwd.click();

    let completed = false;
    document.addEventListener("exhibit:complete", () => { completed = true; });
    document.getElementById("begin-button").click();
    check("exhibit hidden after Begin Exploring", document.getElementById("opening-exhibit").hidden === true);
    check("site content revealed", document.getElementById("site-content").hidden === false);
    check("exhibit:complete dispatched", completed);
  }

  console.log("Opening exhibit — autoplay checks");
  {
    const { document } = loadDom({ fastDurations: 60 });
    const panels = document.querySelectorAll(".exhibit-panel");
    await wait(150);
    check("exhibit advances on its own", !panels[0].classList.contains("is-active"));

    // Pause freezes the tour.
    const toggle = document.getElementById("play-pause-button");
    toggle.click();
    const frozenAt = Array.from(panels).findIndex(p => p.classList.contains("is-active"));
    await wait(200);
    const stillAt = Array.from(panels).findIndex(p => p.classList.contains("is-active"));
    check("pause halts auto-advance", frozenAt === stillAt && frozenAt !== -1);
    check("toggle reads Resume while paused", toggle.getAttribute("aria-label") === "Resume");

    // Resume picks the tour back up.
    toggle.click();
    await wait(200);
    const movedTo = Array.from(panels).findIndex(p => p.classList.contains("is-active"));
    check("resume restarts auto-advance", movedTo > stillAt);
    check("toggle reads Pause while playing", toggle.getAttribute("aria-label") === "Pause");
  }

  console.log("Opening exhibit — final panel rests");
  {
    const { document } = loadDom({ fastDurations: 25 });
    const panels = document.querySelectorAll(".exhibit-panel");
    await wait(25 * 14 + 400);
    check("tour arrives at Sputnik unaided", panels[12].classList.contains("is-active"));
    await wait(200);
    check("tour rests on Sputnik (no auto-finish)",
          panels[12].classList.contains("is-active") &&
          document.getElementById("opening-exhibit").hidden === false);
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
    const toggle = document.getElementById("play-pause-button");
    check("audio takeaway hidden initially", takeaway.hidden === true);
    buttons[0].click();
    check("pressing a clip pauses the tour", toggle.getAttribute("aria-label") === "Resume");
    buttons[1].click();
    check("takeaway still hidden after two plays", takeaway.hidden === true);
    buttons[2].click();
    check("takeaway revealed after all three plays", takeaway.hidden === false);
    check("played buttons marked", Array.from(buttons).every(b => b.classList.contains("was-played")));
  }

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

main();
