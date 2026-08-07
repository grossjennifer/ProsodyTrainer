/* Dependency-free static regression checks for the Learn pages.
 * Run: node test_learn.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const phrasing = fs.readFileSync(
  path.join(__dirname, "learn", "phrasing", "index.html"), "utf8");
const shared = fs.readFileSync(path.join(__dirname, "site.css"), "utf8");
const home = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const hub = fs.readFileSync(path.join(__dirname, "learn", "index.html"), "utf8");

// Hard-wrapped source: collapse whitespace before matching running prose.
const flat = phrasing.replace(/\s+/g, " ");

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log("  \u2713 " + label);
  } else {
    failed += 1;
    console.error("  \u2717 " + label);
  }
}

console.log("Learn page regression checks");

// --- The hub, and the path from the homepage to the phrasing page ---------
check("Learn hub exists with a canonical URL",
  hub.includes('rel="canonical" href="https://prosodytrainer.com/learn/"'));
check("hub links the phrasing page", hub.includes('href="phrasing/"'));
check("hub declares a CollectionPage tied to the site graph",
  hub.includes('"@type": "CollectionPage"') &&
  hub.includes('"@id": "https://prosodytrainer.com/#website"'));
check("hub JSON-LD parses", (function () {
  const match = hub.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  try { return !!JSON.parse(match[1]); } catch (error) { return false; }
})());
check("hub lists the four unwritten explainers as in development",
  (hub.match(/In development/g) || []).length === 4 &&
  ["Stress", "Rhythm", "Intonation", "Implicit prosody"]
    .every(t => hub.includes("<h3>" + t + "</h3>")));
check("hub does not link pages that do not exist yet",
  !/href="(stress|rhythm|intonation|implicit-prosody)\//.test(hub));
check("homepage reaches the phrasing page in two clicks",
  home.includes('<a class="site-card" href="learn/"') &&
  hub.includes('href="phrasing/"'));
check("hub reuses the shared stylesheets, defines none of its own",
  hub.includes('href="../style.css"') && hub.includes('href="../site.css"') &&
  !hub.includes("<style>"));

// --- Shared chrome: one source of truth, no duplicated CSS ---------------
check("homepage links the shared stylesheet", home.includes('href="site.css"'));
check("homepage no longer inlines the site chrome", !home.includes("<style>"));
check("shared stylesheet carries the hoisted chrome",
  shared.includes(".site-shell") && shared.includes(".site-card") &&
  shared.includes(".site-footer-note"));
check("Learn page links tokens then chrome, in that order",
  shared.length > 0 &&
  phrasing.indexOf('href="../../style.css"') <
  phrasing.indexOf('href="../../site.css"'));
check("Learn page defines no styles of its own",
  !phrasing.includes("<style>"));
check("Learn styles live in the shared sheet",
  shared.includes(".learn-example") && shared.includes(".learn-layers"));

// --- Entity and crawlability gates, matching the homepage ----------------
check("brand in title tag", /<title>[^<]*Prosody Trainer/.test(phrasing));
check("brand in meta description",
  /<meta name="description" content="Prosody Trainer/.test(phrasing));
check("canonical URL declared",
  phrasing.includes('rel="canonical" href="https://prosodytrainer.com/learn/phrasing/"'));
check("exactly one h1", (phrasing.match(/<h1/g) || []).length === 1);
check("no content gated by the hidden attribute",
  !/<(?:div|section|main)[^>]*\shidden/.test(phrasing));
check("JSON-LD parses as an Article", (function () {
  const match = phrasing.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return false;
  try {
    const node = JSON.parse(match[1]);
    return node["@type"] === "Article" &&
           node.isPartOf["@id"] === "https://prosodytrainer.com/#website" &&
           node.author["@id"] === "https://prosodytrainer.com/#jennifer-gross";
  } catch (error) { return false; }
})());
check("structured data cites the sources named in the prose",
  ["Frazier", "Fodor", "Kjelgaard", "10.1002/rrq.67"]
    .every(name => phrasing.includes(name)));
check("Frazier & Rayner DOI present (verified)",
  phrasing.includes("10.1016/0010-0285(82)90008-1"));
check("Kjelgaard & Speer 1999 DOI present (verified)",
  phrasing.includes("10.1006/jmla.1998.2620"));
check("Speer, Kjelgaard & Dobroth 1996 cited with DOI (verified)",
  flat.includes("Speer, S. R., Kjelgaard, M. M., &amp; Dobroth, K. M. (1996)") &&
  phrasing.includes("10.1007/BF01708573"));
check("every DOI in the reference list is one I verified", (function () {
  const verified = new Set(["10.1016/0010-0285(82)90008-1", "10.1006/jmla.1998.2620",
                            "10.1007/BF01708573", "10.1002/rrq.67"]);
  // DOIs may legitimately contain parentheses, e.g. 10.1016/0010-0285(82)90008-1
  const found = phrasing.match(/10\.\d{4,}\/[^"<\s]+/g) || [];
  return found.length > 0 && found.every(d => verified.has(d));
})());
check("Fodor cited as the NELS 32 silent-reading paper",
  flat.includes("Prosodic disambiguation in silent reading") &&
  !flat.includes("Psycholinguistics cannot escape prosody"));
check("own 2014 paper carries its published title",
  flat.includes("Evidence for prosody in silent reading"));
check("homepage carries the corrected 2014 title too",
  home.includes("Evidence for prosody in silent reading") &&
  !home.includes("Evidence for prosody in reading"));

// --- The linguistics has to be right ------------------------------------
check("garden-path pair present, unpunctuated form",
  phrasing.includes("While the man hunted the deer ran into the woods."));
check("garden-path pair present, punctuated form",
  /While the man hunted<span class="learn-boundary">,<\/span> the deer/.test(phrasing));
check("the pair is minimal: identical but for the comma", (function () {
  const strip = t => t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const bare = "While the man hunted the deer ran into the woods.";
  const commaed = strip(
    (phrasing.match(/While the man hunted<span class="learn-boundary">[\s\S]*?woods\./) || [""])[0]);
  return phrasing.includes(bare) &&
         commaed.replace(",", "").replace(/\s+/g, " ") === bare;
})());
check("phrasing shown without punctuation too (bracketing)",
  phrasing.includes("old men and women") &&
  phrasing.includes("[[old men] and [women]]") &&
  phrasing.includes("[old [men and women]]"));
check("first bracketing hedged: only NECESSARILY old",
  flat.includes("only the men are <i>necessarily</i> old"));
check("no absolute claim that grouping precedes meaning",
  !flat.includes("Before a sentence can mean anything") &&
  flat.includes("Grouping shapes meaning"));
check("garden-path claim scoped to the evidence",
  !flat.includes("one of the most reliably measured effects") &&
  flat.includes("studied extensively in reading research"));
check("prosody findings stated as facilitation and interference",
  !flat.includes("largely disappears") &&
  flat.includes("listeners process the sentence more easily"));
check("layer figure kept but linear causation claim dropped",
  phrasing.includes('class="learn-layers"') &&
  !flat.includes("Each layer constrains the one above it") &&
  flat.includes("interact rather than operating as cleanly separate levels"));
check("foot-fitting attributed to the tools, not asserted of English",
  flat.includes("The tools on this site make that relationship concrete") &&
  flat.includes("not the only one"));
check("rejected example absent: transitivity/pronoun confound",
  !phrasing.includes("the professor lectured"));
check("rejected example absent: cannibalized students",
  !phrasing.includes("After eating the students"));
check("Grandma used as hook, flagged as punctuation-dependent",
  flat.includes("Let&rsquo;s eat, Grandma") &&
  flat.includes("punctuation explicitly marks the intended grouping"));
check("own research cited", phrasing.includes("Gross, J., Millett"));
check("layer stack marks phrasing as the focus",
  phrasing.includes('class="learn-layers"') &&
  /<li class="is-focus">Phrasing<\/li>/.test(phrasing));

// --- Links out ----------------------------------------------------------
check("links into Rhythm Reader", phrasing.includes('href="../../rhythm-reader/"'));
check("links into Rhythm Reader Pro", phrasing.includes('href="../../rhythm-reader-pro/"'));
check("links home", phrasing.includes('class="brand-link" href="../../"'));
check("professional email present", phrasing.includes("mailto:grossj@gvsu.edu"));
check("no pre-migration faculty profile URLs", !phrasing.includes("gross-jennifer-44"));
check("unbuilt Learn pages named but not linked",
  flat.includes("are in development") &&
  !phrasing.includes('href="../stress/"') &&
  !phrasing.includes('href="../intonation/"'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
