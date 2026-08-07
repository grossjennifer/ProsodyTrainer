RHYTHM READER PRO — INTERFACE REFINEMENT

Files
-----
index.html            Rhythm Reader Pro interface (loads engine.js)
engine.js             Four-foot linguistic engine — single source of truth
test_rhythm_feet.js   Node regression checks (four-foot rhythm model)
test_nuclear_stress.js  Node regression checks (Nuclear Stress Rule)

Interface changes
-----------------
1. The title now clearly identifies Rhythm Reader Pro.
2. The opening description is more direct and research-oriented.
3. Dictionary coverage is moved into Research settings and uses reader-facing wording.
4. Example buttons show both the metrical name and strong/weak pattern.
5. Ambiguous output is described in plain language, while the technical label remains available in the analysis tools.
6. The ambiguity panel is shorter and makes “Keep both” the primary option.
7. Phrase-boundary insertion marks and heteronym flags no longer clutter the default reading surface; they appear only in the appropriate analysis views.
8. “Open analysis tools” replaces the less direct disclosure label.
9. The explanatory caveat is shorter.

Engine and structure (this revision)
-------------------------------------
- Single source of truth: index.html no longer inlines a copy of the engine.
  It loads engine.js with <script src="engine.js">, so the page and both test
  files run the exact same code. A fix can no longer land in one copy and miss
  the other.
- Nuclear Stress Rule (NSR): the engine now marks the main (nuclear) accent of
  each intonational phrase on its last content word — so "the final word tends
  to be stressed" [Chomsky & Halle 1968; Liberman 1975; Liberman & Prince 1977].
  It is a gated pass (config.nuclearStress, on by default) and never overrides a
  user's rhythmic edit. Spondee rarity was already enforced by the four-foot
  inventory (no SS foot) plus optional clash subordination.
- Nucleus display: the phrase's main beat is marked in the reading surface with
  a small ▲ beneath the syllable — a shape cue that shows in every display mode
  and does not rely on color alone — plus a legend key and a screen-reader label
  ("main beat, phrase nucleus"). The nucleus is never hidden by the density filter.
- Contrast: a --beat-ink token (#6E2138) is used for beat-colored text on light
  backgrounds, raising those pairings from ~5.8:1 (WCAG AA) to ~9:1 (AAA).

Installation
------------
Replace the current Pro index.html and engine.js with these files. They must be
kept together in the same folder: index.html now loads engine.js rather than
embedding it, so engine.js is required beside it. Both load correctly from disk
(file://) — a classic <script src> with a relative path is not subject to the
module/CORS restriction that would otherwise block file:// loads.

(index.html is therefore no longer a single standalone file. If you ever need a
one-file build to hand to someone, inline engine.js back into the page; ask and
a standalone copy can be produced on request.)

Testing
-------
From this folder, run:

    node test_rhythm_feet.js
    node test_nuclear_stress.js

Expected result:

    All four-foot rhythm tests passed.
    15 nuclear-stress checks passed.
