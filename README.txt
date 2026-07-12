PROSODY TRAINER — WELCOME EXHIBIT + REFINED HOMEPAGE

Files
-----
index.html          Opening exhibit plus the refined Prosody Trainer homepage
style.css           Exhibit styling and the merged final scene
script.js           Timed reveals, navigation, audio, and site handoff
test_exhibit.js     Dependency-free Node regression checks
sputnik.png         Transparent-background mascot placeholder

Homepage refinements
--------------------
- Broader, more balanced hero layout
- Larger body and card text for readability
- Clearer distinction between available tools and tools in development
- Revised science language with less repetition
- "Use Prosody Trainer" section organized around learning, research, and teaching
- Three selected publications with DOI links
- Expanded researcher biography, GVSU profile link, and professional email
- More useful footer with same-page navigation and accessibility contact
- No public telephone number

Sputnik image
--------------
The included sputnik.png is a temporary transparent-background mascot placeholder.
Replace it with the previously prepared Sputnik cutout, keeping the filename
sputnik.png, when you add these files to the live site.

Audio for Panel 7 — Intonation
------------------------------
Add the forthcoming recordings to this folder using these exact filenames:

  really-statement.mp3     Really.   (settled, falling voice)
  really-question.mp3      Really?   (rising voice)
  really-exclamation.mp3   Really!   (high, emphatic voice)

The exhibit attempts to play the three voices in sequence. Some browsers block
audio until the visitor first interacts with the page; the buttons always allow
each voice to be replayed. A written transcript remains available.

Testing
-------
From this folder, run:

  node test_exhibit.js
