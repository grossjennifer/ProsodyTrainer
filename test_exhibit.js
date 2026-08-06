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
check("homepage content NOT gated by the hidden attribute", !/id="site-content"[^>]*\shidden/.test(html));
check("homepage reachable without JavaScript (exhibit is CSS-gated)", css.includes("body:not(.exhibit-active) .opening-exhibit"));
check("exhibit renders as a fixed overlay when active", /body\.exhibit-active \.opening-exhibit \{[^}]*position: fixed/.test(css));
check("scroll locked behind the overlay", css.includes("body.exhibit-active { overflow: hidden; }"));
check("overlay raised by body class, not by hiding content", js.includes("function raiseExhibit") && js.includes('classList.add("exhibit-active")'));
check("overlay lowered on completion", js.includes('classList.remove("exhibit-active")'));
check("content inert behind the overlay", js.includes('setAttribute("inert", "")') && js.includes('removeAttribute("inert")'));
check("Tools, Science, Use, Research, and About navigation", ["tools", "science", "use", "research", "about"].every(id => html.includes('href="#' + id + '"')));
check("three live tools", (html.match(/<a class="site-card"/g) || []).length === 3);
check("Sound & Spelling tool linked", html.includes('href="sound-spelling/"'));
check("reading-science references present", html.includes("Treiman") && html.includes("Hanna"));
check("two tools marked in development", (html.match(/In development/g) || []).length === 2);
check("three selected publications", (html.match(/class="site-publication"/g) || []).length === 3);
check("2026 publication included", html.includes("Training with orthographic stress and rhythm markers"));
check("2014 publication carries its published title (with \"silent\")",
  html.includes("Evidence for prosody in silent reading") &&
  !html.includes("Evidence for prosody in reading<"));
check("university profile linked at post-migration URL", html.includes("https://www.gvsu.edu/psychology/gross-jennifer-209"));
check("no pre-migration faculty profile URLs remain", !html.includes("gross-jennifer-44"));
check("both profile links repaired", (html.match(/psychology\/gross-jennifer-209/g) || []).length >= 2);
check("professional email included", html.includes("mailto:grossj@gvsu.edu"));
check("public telephone number omitted", !html.includes("616-331-3511"));
check("Sputnik image expected", html.includes('src="sputnik.png"'));
check("three audio filenames present", ["really-statement.mp3", "really-question.mp3", "really-exclamation.mp3"].every(name => html.includes(name)));
check("reduced-motion support", css.includes("prefers-reduced-motion"));
check("completion safety rules", css.includes("body.exhibit-complete #opening-exhibit") && css.includes("#site-content[hidden]"));
check("single homepage handoff exposed", js.includes("window.completeExhibit = completeExhibit"));
check("audio playback handler", js.includes("function playClip"));
check("welcome plays on every visit (unconditional next())", /\n\s*\/\/ Always play the welcome[\s\S]*?\n\s*next\(\);\n\}\)\(\);/.test(js));
check("no stored visit counter or cap", !js.includes("INTRO_VISIT_LIMIT") && !js.includes("prosodyTrainerIntroCount"));
check("replay controls generalized to a class", js.includes("js-replay-intro"));
check("prominent homepage replay control present", html.includes('id="replay-intro-hero"'));
check("panel 6 caption folded into a shorter takeaway", html.includes("even in silent reading") && !html.includes("Readers group words into meaningful phrases"));
check("Sputnik credited as the Prosody Pup", html.includes("the Prosody Pup"));
check("theoretical foundations cited", html.includes("Selkirk") && html.includes("Liberman"));

// Entity / AEO gates
check("brand name in meta description", /<meta name="description" content="Prosody Trainer/.test(html));
check("canonical URL declared", html.includes('rel="canonical" href="https://prosodytrainer.com/"'));
check("JSON-LD block present", html.includes('type="application/ld+json"'));
check("JSON-LD parses and exposes a @graph", (function () {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return false;
  try {
    const graph = JSON.parse(match[1])["@graph"];
    return Array.isArray(graph) && graph.length >= 9;
  } catch (error) { return false; }
})());
check("Person node names Jennifer Gross", html.includes('"name": "Jennifer Gross"'));
check("Person sameAs points at the live faculty profile", html.includes('"https://www.gvsu.edu/psychology/gross-jennifer-209"'));
check("GVSU affiliation declared", html.includes("CollegeOrUniversity") && html.includes("Grand Valley State University"));
check("all three live tools in structured data", ["rhythm-reader/#tool", "rhythm-reader-pro/#tool", "sound-spelling/#tool"].every(id => html.includes(id)));
check("three DOIs cited in structured data", ["10.1007/s11145-026-10840-2", "10.1002/rrq.198", "10.1002/rrq.67"].every(doi => html.includes(doi)));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
