RHYTHM READER PRO — FOUR-FOOT CORRECTION

Files
-----
index.html            Corrected self-contained Rhythm Reader Pro interface
engine.js             Corrected standalone linguistic engine
test_rhythm_feet.js   Node regression checks

What changed
------------
1. Phrase-level rhythmic stress is fitted across the continuous syllable stream,
   rather than treating every word as a self-contained foot.
2. The rhythmic inventory is limited to four patterns:
      SW   trochee (strong–weak)
      WS   iamb (weak–strong)
      WWS  anapest (weak–weak–strong)
      SWW  dactyl (strong–weak–weak)
3. WSW is no longer labeled or used as an amphibrachic fifth foot.
4. A phrase may contain a one-syllable pickup or final residue when its edge does
   not form a complete foot.
5. Dictionary stress, manual edits, research logging, exports, confidence views,
   phrase editing, and other Pro functions are preserved.
6. The older profile field proportion_amphibrachic is retained at 0 only so
   existing data-processing scripts do not break.

Installation
------------
Replace the current Pro index.html and engine.js with these two corrected files.
The index.html already embeds the corrected engine and can also run by itself.

Testing
-------
From this folder, run:

    node test_rhythm_feet.js

Expected result:

    All four-foot rhythm tests passed.
