/* Dependency-free static regression checks. Run: node test_exhibit.js */
"use strict";

const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log("  ✓ " + label);
  } else {
    failed += 1;
    console.error("  ✗ " + label);
  }
}

console.log("Prosody Trainer regression checks");
check("nine exhibit panels", (html.match(/class="exhibit-panel/g) || []).length === 9);
check("homepage hidden until handoff", html.includes('id="site-content" hidden'));
check("Tools, Science, Use, Research, and About navigation", ["tools", "science", "use", "research", "about"].every(id => html.includes('href="#' + id + '"')));
check("two live tools", (html.match(/<a class="site-card"/g) || []).length === 2);
check("two tools marked in development", (html.match(/In development/g) || []).length === 2);
check("three selected publications", (html.match(/class="site-publication"/g) || []).length === 3);
check("2026 publication included", html.includes("Training with orthographic stress and rhythm markers"));
check("university profile included", html.includes("https://www.gvsu.edu/psychology/gross-jennifer-44.htm"));
check("professional email included", html.includes("mailto:grossj@gvsu.edu"));
check("public telephone number omitted", !html.includes("616-331-3511"));
check("Sputnik image expected", html.includes('src="sputnik.png"'));
check("three audio filenames present", ["really-statement.mp3", "really-question.mp3", "really-exclamation.mp3"].every(name => html.includes(name)));
check("reduced-motion support", css.includes("prefers-reduced-motion"));
check("completion safety rules", css.includes("body.exhibit-complete #opening-exhibit") && css.includes("#site-content[hidden]"));
check("single homepage handoff exposed", js.includes("window.completeExhibit = completeExhibit"));
check("audio playback handler", js.includes("function playClip"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
