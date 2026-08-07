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
const stress = fs.readFileSync(path.join(__dirname, "learn", "stress", "index.html"), "utf8");
const rhythm = fs.readFileSync(path.join(__dirname, "learn", "rhythm", "index.html"), "utf8");
const flatRhythm = rhythm.replace(/\s+/g, " ");
const flatStress = stress.replace(/\s+/g, " ");

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
check("hub lists the two unwritten explainers as in development",
  (hub.match(/In development/g) || []).length === 2 &&
  ["Intonation", "Implicit prosody"]
    .every(t => hub.includes("<h3>" + t + "</h3>")));
check("hub links all three live explainers",
  ["stress/", "rhythm/", "phrasing/"].every(h => hub.includes('href="' + h + '"')));
check("hub does not link pages that do not exist yet",
  !/href="(intonation|implicit-prosody)\//.test(hub));
check("hub graph lists all three live articles",
  ["stress", "rhythm", "phrasing"]
    .every(n => hub.includes("learn/" + n + "/#article")));
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
check("no Learn page links an explainer that does not exist",
  [phrasing, stress, rhythm].every(
    page => !/href="\.\.\/(intonation|implicit-prosody)\//.test(page)));
check("status notes on every live page list only unwritten pages", (function () {
  const note = "intonation and implicit prosody &mdash; are in development";
  return [flat, flatStress, flatRhythm].every(
    page => page.includes(note) && !/stress|rhythm/.test(
      (page.match(/status-note">More Learn pages[^<]*/) || [""])[0]));
})());

// --- Stress page ------------------------------------------------------------
check("stress page canonical URL",
  stress.includes('rel="canonical" href="https://prosodytrainer.com/learn/stress/"'));
check("stress page brand in title and description",
  /<title>[^<]*Prosody Trainer/.test(stress) &&
  /<meta name="description" content="Prosody Trainer/.test(stress));
check("stress page exactly one h1", (stress.match(/<h1/g) || []).length === 1);
check("stress page JSON-LD parses and joins the site graph", (function () {
  const match = stress.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return false;
  try {
    const node = JSON.parse(match[1]);
    return node["@type"] === "Article" &&
           node.isPartOf["@id"] === "https://prosodytrainer.com/#website" &&
           node.author["@id"] === "https://prosodytrainer.com/#jennifer-gross";
  } catch (error) { return false; }
})());
check("stress page reuses shared stylesheets, defines none of its own",
  stress.includes('href="../../style.css"') && stress.includes('href="../../site.css"') &&
  !stress.includes("<style>"));

// The claims about the 2026 study must not outrun the paper.
check("percentage correct, not raw scores, described as falling",
  flatStress.includes("Mean percentage correct did not go up") &&
  flatStress.includes("Raw scores did rise") &&
  flatStress.includes("not improvement within either one"));
check("no claim about individual participants' accuracy",
  !/Nobody|no participant|nobody/i.test(flatStress));
check("baseline-adjusted framing of the headline finding",
  flatStress.includes("baseline-adjusted difference"));
check("per-sample replication reported",
  flatStress.includes("<i>d</i> = 0.25 and 0.34"));
check("participant ratings match the questionnaire items",
  flatStress.includes("greater perceived improvement in their prosodic") &&
  flatStress.includes("clearer instructions") &&
  !/rated the lessons as clearer and more useful/.test(flatStress));
check("six limits stated, including durability and expectancy",
  flatStress.includes("Six limits are worth stating plainly") &&
  flatStress.includes("Durability is unknown") &&
  flatStress.includes("Expectancy cannot be ruled out") &&
  flatStress.includes("no delayed retention test"));
check("outcome-measure reliability disclosed",
  flatStress.includes("&alpha; = .40 at pretest, .43 at posttest"));
check("conclusion hedged to malleability, not fixity",
  flatStress.includes("prosodic sensitivity appears malleable") &&
  !/is not fixed/.test(flatStress));
check("scalability claim scoped to live instructors and coaching",
  flatStress.includes("no live instructor and no") &&
  !/requires no expert modelling/.test(flatStress));
check("beat dots not attributed to the training materials",
  flatStress.includes("are the\n        marker types used in the training".replace(/\s+/g, " ")) &&
  flatStress.includes("beat dots are an additional way") &&
  !/Those are the same kinds of markers used in the training/.test(flatStress));
check("print does distinguish HIStory from his STORY",
  flatStress.includes("in print, the space does that") &&
  !/Nothing on the\s*page distinguishes/.test(flatStress));
check("effect size stated, not hidden", flatStress.includes("Cohen&rsquo;s <i>d</i> was 0.31"));
check("transfer limit stated",
  flatStress.includes("Transfer to unmarked text was not demonstrated") &&
  flatStress.includes("it was not marker-free"));
check("absence of reading outcomes stated",
  flatStress.includes("No reading outcomes were measured"));
check("sample limits stated",
  flatStress.includes("predominantly skilled college readers"));
check("design described accurately",
  ["528", "randomized", "active-control", "two independent replications"]
    .every(t => flatStress.toLowerCase().includes(t.toLowerCase())));
check("no OSF view_only token published", !stress.includes("view_only"));
check("noun/verb stress framed as a tendency, not a rule",
  flatStress.includes("a tendency, not a rule"));
check("own research cited on the stress page",
  ["10.1002/rrq.67", "10.1002/rrq.198", "10.1007/s11145-026-10840-2"]
    .every(doi => stress.includes(doi)));
check("every DOI on the stress page is one I verified against the article", (function () {
  const verified = new Set([
    "10.1007/s11145-026-10840-2", "10.1002/rrq.198", "10.1002/rrq.67",
    "10.1016/0885-2308(87)90004-0", "10.1016/j.jneuroling.2008.09.002",
    "10.1016/j.jml.2020.104089", "10.1080/10888438.2021.1995390"
  ]);
  const found = stress.match(/10\.\d{4,}\/[^"<\s]+/g) || [];
  return found.length > 0 && found.every(d => verified.has(d));
})());
check("stress page links into the tools",
  stress.includes('href="../../rhythm-reader/"') &&
  stress.includes('href="../../rhythm-reader-pro/"'));
check("stress page links back to the hub", stress.includes('href="../"'));
check("phrasing page cross-links to stress",
  phrasing.includes('<a href="../stress/">Stress</a>'));
check("both Learn pages link back to the hub",
  phrasing.includes('<a href="../">Learn</a>') && stress.includes('<a href="../">Learn</a>'));

check("typographic apostrophes throughout the Learn prose", (function () {
  const proseOnly = text => text.split("\n")
    .filter(line => !/ld\+json|doi\.org|href=|"@/.test(line))
    .join("\n");
  return [stress, rhythm, phrasing, hub].every(page => !proseOnly(page).includes("'"));
})());

// --- Rhythm page ------------------------------------------------------------
check("rhythm page canonical URL",
  rhythm.includes('rel="canonical" href="https://prosodytrainer.com/learn/rhythm/"'));
check("rhythm page brand in title and description",
  /<title>[^<]*Prosody Trainer/.test(rhythm) &&
  /<meta name="description" content="Prosody Trainer/.test(rhythm));
check("rhythm page exactly one h1", (rhythm.match(/<h1/g) || []).length === 1);
check("rhythm page JSON-LD parses and joins the site graph", (function () {
  const match = rhythm.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return false;
  try {
    const node = JSON.parse(match[1]);
    return node["@type"] === "Article" &&
           node.isPartOf["@id"] === "https://prosodytrainer.com/#website" &&
           node.author["@id"] === "https://prosodytrainer.com/#jennifer-gross";
  } catch (error) { return false; }
})());
check("rhythm page reuses shared stylesheets, defines none of its own",
  rhythm.includes('href="../../style.css"') && rhythm.includes('href="../../site.css"') &&
  !rhythm.includes("<style>"));

// The four feet must match the engine's actual inventory, names included.
check("all four feet present with their traditional names",
  ["trochee", "iamb", "anapest", "dactyl"].every(n => flatRhythm.includes("<i>" + n + "</i>")));
check("foot inventory framed as a modelling choice, not a fact",
  flatRhythm.includes("a modelling decision, not a fact about English"));
check("engine's exclusions stated: no spondee, no amphibrach template",
  flatRhythm.includes("no strong&ndash;strong foot") &&
  flatRhythm.includes("not given a fifth"));
check("feet-cross-words point made with the banana case",
  flatRhythm.includes("an anapest followed by an iamb") &&
  flatRhythm.includes("still weak&ndash;strong&ndash;weak"));
check("feet fitted within phrases, never across a boundary",
  flatRhythm.includes("never drawn across a phrase") ||
  flatRhythm.includes("never drawn across a phrase boundary"));
check("rhythm not described as even timing",
  flatRhythm.includes("Not a metronome") &&
  flatRhythm.includes("does not divide into equal intervals"));
check("nuclear stress framed as a tendency that context overrides",
  flatRhythm.includes("nuclear stress tendency") &&
  flatRhythm.includes("a tendency, and one"));

// Reading-research claims must stay correlational and correctly attributed.
check("correlational limit stated",
  flatRhythm.includes("largely correlational"));
check("Wolters meta-analysis correctly scoped to production-based prosody",
  flatRhythm.includes("production-based prosody") &&
  flatRhythm.includes("<i>r</i> = 0.51"));
check("2026 effect size carried over, not inflated",
  flatRhythm.includes("<i>d</i> = 0.31") &&
  flatRhythm.includes("transfer to fully\n        unmarked text was not demonstrated".replace(/\s+/g, " ")));
check("every DOI on the rhythm page is one I verified against the article", (function () {
  const verified = new Set([
    "10.1007/s11145-026-10840-2", "10.1002/rrq.198", "10.1037/h0033467",
    "10.1037/0096-1523.14.3.389", "10.1111/j.1467-9817.2006.00323.x",
    "10.1080/01443410903560922", "10.1080/10888438.2020.1850733",
    "10.1007/s11145-024-10610-y"
  ]);
  const found = rhythm.match(/10\.\d{4,}\/[^"<\s]+/g) || [];
  return found.length > 0 && found.every(d => verified.has(d));
})());
check("rhythm page links into the tools",
  rhythm.includes('href="../../rhythm-reader/"') &&
  rhythm.includes('href="../../rhythm-reader-pro/"'));
check("the three explainers cross-link each other",
  rhythm.includes('href="../stress/"') && rhythm.includes('href="../phrasing/"') &&
  stress.includes('href="../rhythm/"') && phrasing.includes('href="../rhythm/"'));
check("rhythm page links back to the hub", rhythm.includes('<a href="../">Learn</a>'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
