RHYTHM READER PRO — INTERFACE REFINEMENT

Files
-----
index.html            Refined self-contained Rhythm Reader Pro interface
engine.js             Four-foot linguistic engine (unchanged)
test_rhythm_feet.js   Node regression checks

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

Installation
------------
Replace the current Pro index.html and engine.js with these files. The index.html is self-contained and can also run by itself.

Testing
-------
From this folder, run:

    node test_rhythm_feet.js

Expected result:

    All four-foot rhythm tests passed.
