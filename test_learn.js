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
const focus = fs.readFileSync(path.join(__dirname, "learn", "focus", "index.html"), "utf8");
const flatFocus = focus.replace(/\s+/g, " ");
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
check("hub links all four live explainers",
  ["stress/", "rhythm/", "focus/", "phrasing/"].every(h => hub.includes('href="' + h + '"')));
check("hub does not link pages that do not exist yet",
  !/href="(intonation|implicit-prosody)\//.test(hub));
check("hub graph lists all four live articles",
  ["stress", "rhythm", "focus", "phrasing"]
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
                            "10.1007/BF01708573", "10.1002/rrq.67", "10.1002/rrq.97"]);
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
  [phrasing, stress, rhythm, focus].every(
    page => !/href="\.\.\/(intonation|implicit-prosody)\//.test(page)));
check("status notes on every live page list only unwritten pages", (function () {
  const note = "intonation and implicit prosody &mdash; are in development";
  return [flat, flatStress, flatRhythm, flatFocus].every(
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
check("difficulty explains the percentage drop, length the raw rise",
  flatStress.includes("because the posttest was deliberately more difficult") &&
  flatStress.includes("twenty items rather than ten, so raw scores are not directly comparable"));
check("stress and rhythm not conflated as a stress-only effect",
  flatStress.includes("What happens when stress and rhythm are marked") &&
  flatStress.includes("combined orthographic stress") &&
  flatStress.includes("does not isolate stress marking as the") &&
  flatStress.includes("orthographic support for stress and rhythm a plausible target"));
check("acoustic cues stated as tendencies, reduction not universal",
  flatStress.includes("usually longer, often a") &&
  flatStress.includes("may keep a fuller") &&
  !/keeps its full quality while the/.test(flatStress));
check("heteronym pairs: stress central, not sole difference",
  flatStress.includes("stress pattern is central to distinguishing") &&
  !/stress is the only thing separating/.test(flatStress));
check("paper's own term for the posttest markers",
  flatStress.includes("fewer and less salient markers") &&
  !/fewer and fainter/.test(flatStress));
check("expectancy stated as weakened but not eliminated",
  flatStress.includes("weaken an expectancy explanation without eliminating it") &&
  !/Less comfortable is not excluded/.test(flatStress));
check("lesson delivery described completely",
  flatStress.includes("recorded audio models and immediate feedback") &&
  flatStress.includes("no live instructor and no one-to-one coaching"));
check("each limitation opens with a bold lead-in", (function () {
  const section = stress.slice(stress.indexOf("Seven limits"), stress.indexOf("<h2>Try it"));
  return (section.match(/<p><strong>/g) || []).length === 7;
})());
check("2018 design limitation stated: no plain-text control",
  flatStress.includes("cannot separate help from hindrance") &&
  flatStress.includes("no plain-text control") &&
  flatStress.includes("interference is a live possibility"));
check("2018 described as a preference study, not a training study",
  flatStress.includes("it asked about preference, not performance, and no") &&
  !/The first marked lexical stress explicitly/.test(flatStress) &&
  flatRhythm.includes("That was a preference judgment, with") &&
  !/the training studies from this project/.test(flatRhythm));
check("first-syllable tuning and early-sentence findings reported",
  flatStress.includes("more sensitive to marking on a word&rsquo;s <i>first</i> syllable") &&
  flatStress.includes("roughly 85% of English content words") &&
  flatStress.includes("rated more helpful <i>early</i> in a sentence"));
check("compound contrast is the paper's three-way version",
  flatStress.includes("Big Bird after an") &&
  flatStress.includes("every blue BIRD</i> is any bird"));
check("rhythm rule shown with both clash examples",
  flatRhythm.includes("nessee") && flatRhythm.includes("This is the rhythm") &&
  flatRhythm.includes("teen") && flatRhythm.includes("Kelly &amp; Bock, 1988"));
check("pseudoword stress-shift example present",
  flatRhythm.includes("vane pilots") && flatRhythm.includes("balloons"));
check("absent spondee explained by clash avoidance, not just asserted",
  flatRhythm.includes("A\n        clash is the thing English rhythm works to avoid".replace(/\s+/g, " ")));
check("hub records the site's origin in the 2018 paper",
  hub.includes("Where this came from") &&
  hub.replace(/\s+/g, " ").includes("hear the rhythm of text"));
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
check("seven limits stated, including durability and expectancy",
  flatStress.includes("Seven limits are worth stating plainly") &&
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
    "10.1002/rrq.97",
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
  return [stress, rhythm, focus, phrasing, hub].every(page => !proseOnly(page).includes("'"));
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
check("exclusions named in traditional terms: spondee and amphibrach",
  flatRhythm.includes("traditionally called a <i>spondee</i>") &&
  flatRhythm.includes("<i>amphibrachic</i> in traditional metrics") &&
  flatRhythm.includes("is not given a\n        word-sized template".replace(/\s+/g, " ")));
check("opening does not overstate one-stress-per-word",
  !/A single word has one strongest syllable/.test(flatRhythm) &&
  flatRhythm.includes("In most English words of more than one"));
check("lexical stress described as anchored, phrase prominence as variable",
  !/The same syllable can be the beat in one phrase/.test(flatRhythm) &&
  flatRhythm.includes("A word keeps its own lexical stress wherever it appears"));
check("monosyllable case kept, with the posttest item",
  flatRhythm.includes("in the forests <span class=\"learn-stress\">OF</span> the night") &&
  flatRhythm.includes("comes from the 2026 posttest"));
check("dyslexia claim scoped to specific prosodic skills",
  flatRhythm.includes("substantial deficits in specific prosodic skills") &&
  !/most pronounced in dyslexia/.test(flatRhythm));
check("verse and prose contrast hedged",
  flatRhythm.includes("Verse permits substitution too") &&
  !/verse tends to hold one shape/.test(flatRhythm));
check("2026 design stated precisely with per-sample effects",
  flatRhythm.includes("<i>d</i> = 0.25 and 0.34 by sample; 0.31 combined") &&
  flatRhythm.includes("two\n        independent samples".replace(/\s+/g, " ")));
check("every author cited in the body appears in the reference list", (function () {
  const body = flatRhythm.split("Further reading")[0];
  const refs = flatRhythm.split("Further reading")[1] || "";
  const cited = ["Liberman, 1975", "Liberman &amp; Prince, 1977", "Chomsky &amp; Halle, 1968",
                 "Kelly &amp; Bock, 1988", "David et al., 2007", "Holliman et al., 2010",
                 "Mundy &amp; Wood,\n        2025", "Wolters et al., 2022"];
  const surnames = ["Liberman, M. (1975)", "Liberman, M., &amp; Prince, A. (1977)",
                    "Chomsky, N., &amp; Halle, M. (1968)", "Kelly, M. H.", "David, D.",
                    "Holliman, A. J.", "Mundy, I. R.", "Wolters, A. P."];
  return surnames.every(n => refs.includes(n));
})());
check("feet-cross-words point made with the banana case",
  flatRhythm.includes("an anapest followed by an iamb") &&
  flatRhythm.includes("still weak&ndash;strong&ndash;weak"));
check("feet fitted within phrases, never across a boundary",
  flatRhythm.includes("never drawn across a phrase") ||
  flatRhythm.includes("never drawn across a phrase boundary"));
check("rhythm not described as even timing",
  flatRhythm.includes("Not a metronome") &&
  flatRhythm.includes("does not divide into equal intervals"));
check("no false claim that function words are skipped in the first two examples",
  !/Trailing function words/.test(flatRhythm) &&
  !/skips back to\s*the last word carrying content/.test(flatRhythm));
check("last-content-word rule shown with a genuine trailing case",
  flatRhythm.includes("She gave the <span class=\"learn-stress\">KEYS</span> to him") &&
  flatRhythm.includes("comes last and takes nothing"));
check("nucleus placed on the word's stressed syllable, not its final one",
  flatRhythm.includes("<i>CHILD</i>ren, not child<i>REN</i>"));
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
  flatRhythm.includes("0.31 combined") &&
  flatRhythm.includes("transfer to fully unmarked text was not demonstrated"));
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

check("2014 erratum cited wherever the 2014 paper is", (function () {
  return [phrasing, stress].every(page =>
    page.includes("10.1002/rrq.97") &&
    page.includes("mean and standard-deviation columns interleaved"));
})());
check("erratum sits next to the open-access link, not orphaned", (function () {
  return [phrasing, stress].every(page => {
    const oa = page.indexOf("oapsf_articles/29");
    const er = page.indexOf("10.1002/rrq.97");
    return oa > -1 && er > oa && er - oa < 600;
  });
})());
check("open-access links accompany the paywalled DOIs", (function () {
  const oa2014 = "scholarworks.gvsu.edu/oapsf_articles/29";
  const oa2018 = "scholarworks.gvsu.edu/oapsf_articles/87";
  return phrasing.includes(oa2014) && stress.includes(oa2014) &&
         stress.includes(oa2018) && rhythm.includes(oa2018);
})());
check("no unverified open-access claim for the 2026 paper",
  ![stress, rhythm].some(page => /s11145-026-10840-2[\s\S]{0,200}Open access/.test(page)));

// --- Emphasis and focus page ------------------------------------------------
check("focus page canonical URL",
  focus.includes('rel="canonical" href="https://prosodytrainer.com/learn/focus/"'));
check("focus page brand in title and description",
  /<title>[^<]*Prosody Trainer/.test(focus) &&
  /<meta name="description" content="Prosody Trainer/.test(focus));
check("focus page exactly one h1", (focus.match(/<h1/g) || []).length === 1);
check("focus page JSON-LD parses and joins the site graph", (function () {
  const match = focus.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return false;
  try {
    const node = JSON.parse(match[1]);
    return node["@type"] === "Article" &&
           node.isPartOf["@id"] === "https://prosodytrainer.com/#website" &&
           node.author["@id"] === "https://prosodytrainer.com/#jennifer-gross";
  } catch (error) { return false; }
})());
check("focus page reuses shared stylesheets, defines none of its own",
  focus.includes('href="../../style.css"') && focus.includes('href="../../site.css"') &&
  !focus.includes("<style>"));

// The paired stimuli must keep the final sentence identical across contexts.
check("canoe pair present in both emphases",
  flatFocus.includes('<span class="learn-stress">SAM</span> fell out of the canoe') &&
  flatFocus.includes('Sam <span class="learn-stress">FELL</span> out of the canoe'));
check("function-word focus shown with both stimuli",
  flatFocus.includes('He <span class="learn-stress">CAN</span>') &&
  flatFocus.includes('<span class="learn-stress">WHERE</span> is my hamster') &&
  flatFocus.includes('Where is <span class="learn-stress">MY</span> hamster'));
check("cap-emphasis provenance credited",
  flatFocus.includes("borrowed rather than invented") &&
  flatFocus.includes("aioli"));
check("function-word focus stated as possible, not automatic",
  flatFocus.includes("possible, not automatic") &&
  flatFocus.includes("only about a third of the time"));

// Claims about the 2014 study must not outrun it.
check("no claim that an inner voice was directly observed",
  flatFocus.includes("It does not prove that anyone heard a voice") &&
  flatFocus.includes("as though</i> guided by a"));
check("inconsistent accuracy result disclosed, not buried",
  flatFocus.includes("The accuracy data are inconsistent") &&
  flatFocus.includes("accuracy (proportion correct) did not") &&
  flatFocus.includes("it was actually higher on the"));
check("jargon glossed on first use", flatFocus.includes("accuracy (proportion correct)"));
check("explicit bridge from the canoe pair to the principle",
  flatFocus.includes("The words have not changed. Only the context has"));
check("nuclear stress described as predicted, and named",
  flatFocus.includes("predicts the main accent of each phrase using") &&
  flatFocus.includes("English nuclear stress to fall late"));
check("function-word examples are italicised, not bare",
  flatFocus.includes("<i>he</i>, <i>can</i>, <i>that</i>, and <i>a</i>"));
check("reference DOIs stay full resolvable URLs, consistent across Learn pages",
  [phrasing, stress, rhythm, focus].every(page =>
    /<a href="https:\/\/doi\.org\/[^"]+">https:\/\/doi\.org\//.test(page)));
check("sample limits stated", flatFocus.includes("The readers were undergraduates"));
check("rating figures taken from the erratum, and said to be",
  flatFocus.includes("3.83 and 3.36 against 2.54 and 2.31") &&
  flatFocus.includes("is the source of the rating figures quoted above"));
check("reaction-time figures reported for both stimulus types",
  flatFocus.includes("3,290 against 4,157") && flatFocus.includes("3,558 against 4,399"));
check("tools' inability to see discourse context stated plainly",
  flatFocus.includes("which the\n        tools cannot see".replace(/\s+/g, " ")) &&
  flatFocus.includes("will sometimes disagree"));
check("focus page cross-links the other explainers",
  ["../stress/", "../rhythm/", "../"].every(h => focus.includes('href="' + h + '"')));
check("stress page hands sentence-level emphasis to the focus page",
  stress.includes('<a href="../focus/">emphasis and focus</a>'));
check("every DOI on the focus page is one I verified", (function () {
  const verified = new Set([
    "10.1002/rrq.67", "10.1002/rrq.97", "10.1121/1.392372",
    "10.1016/j.pragma.2005.03.017", "10.1016/j.jml.2010.06.004"
  ]);
  const found = focus.match(/10\.\d{4,}\/[^"<\s]+/g) || [];
  return found.length > 0 && found.every(d => verified.has(d));
})());
check("focus page carries the open-access link and the erratum",
  focus.includes("oapsf_articles/29") && focus.includes("10.1002/rrq.97"));

check("Learn appears in the site navigation, not just by direct link",
  home.includes('<a href="learn/">Learn</a>') &&
  hub.includes('<a href="./">Learn</a>') &&
  [stress, rhythm, focus, phrasing].every(page => page.includes('<a href="../">Learn</a>')));
check("origin section names its source paper in full",
  hub.includes("Gross, J., &amp; Winegard".replace("&amp; Winegard", "Winegard, B., &amp; Plotkowski")) ||
  hub.replace(/\s+/g, " ").includes("Gross, J., Winegard, B., &amp; Plotkowski, A. R. (2018)"));
check("origin section cites the 2018 DOI and its open-access copy, not a bare year",
  hub.includes("10.1002/rrq.198") && hub.includes("oapsf_articles/87") &&
  !hub.replace(/\s+/g, " ").includes("The 2018 study on marking stress in print"));
check("origin section points at the page carrying the caveats",
  hub.replace(/\s+/g, " ").includes('The <a href="stress/">stress page</a> sets out what'));
check("hub status note reads 'added', and drops the future tense",
  hub.replace(/\s+/g, " ").includes("being added one at a time") &&
  !/being written one at a time/.test(hub));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
