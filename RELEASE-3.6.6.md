# Rhythm Reader Pro 3.6.6 — the instrument never loses or fails to record what a reader did

Prepared on top of 3.6.5. Rhythm Reader Pro page, plus the engine's two CSV export functions. **No reading changes**: across 360 analyses of 120 texts, no beat and no label changed. The build number moves because the export format did.

## 1. Hand edits are never discarded silently

Changing the text type re-ran the analysis from scratch and dropped every hand edit without warning; so did pressing Analyze again over the same text. (The two rule checkboxes already preserved edits.)

- Both now ask first: "Changing the text type re-runs the analysis and discards your N hand edits. Continue?" Declining keeps the edits and puts the setting back.
- Nothing is asked when there are no edits to lose.
- A changed text type is the same passage re-read, so the passage index no longer goes up.

Edits are not carried across a text-type change. A fresh analysis under another text type can differ from the old one in ways an edit cannot be mapped onto (146 of 618 text and type pairs tested), so carrying them would guess.

## 2. The research session log can reconstruct what the reader saw

- **Setting changes are logged** (`setting-change`, with the setting's name and its value before and after). Changing a rule checkbox changed the reading and wrote nothing.
- **Every row carries the settings in force**: `text_type`, `strict_alternation`, `clash_subordination`.
- **Beats that move as a consequence are logged** (`beat-reflow`). Taking the beat off `said` can put one on `she`; the log recorded one change where the screen showed two. This covers beat edits, word-stress edits, phrase-boundary edits, and setting changes.
- **Discarded edits are logged** (`edits-discarded`, with the count).

The three new columns are appended; existing columns keep their names and order.

## 3. Every export states the settings it was produced under

Only the JSON export recorded them. Now:

- Syllable table: `text_type`, `regime`, `strict_alternation`, `clash_subordination`, `analysis_source` (appended).
- Prosody profile: the same five as rows.
- Metrical lexicon: `text_type`, `regime`, `strict_alternation`, `clash_subordination` (appended).
- Annotated text, stimulus pair, and training set: a text-type line, a rules line, the analysis source, and the number of hand-edited words.

## Not changed

- The cue-fading labels ("one mark per sentence") are unchanged pending a decision.
- The annotated text export still lowercases the text; stimulus pairs can still have unequal mark counts; a participant ID is still written as typed.

## Validation

`npm test` passes, including the new `test_pro_session.js` (34 checks, driving the real page). `test_pro_polish.js` and `test_rhythm_audio.js` were updated for the new columns and the new question. Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out). Rhythm-measure candidates under Verse: 40 of 40.
