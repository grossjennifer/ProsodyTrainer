# Rhythm Reader Pro 3.6.7 — a typed ID cannot become a spreadsheet formula

Prepared on top of 3.6.6. One function in the engine (`csvEscape`) and its two callers in the Rhythm Reader Pro page. **No reading changes and no change to any ordinary export**: across 453 analyses of 151 texts (auto, Verse, Prose), the syllable table and the prosody profile are identical to 3.6.6 apart from the build number.

## The problem

A spreadsheet opens any cell that begins with `=`, `+`, `-` or `@` as a formula. The participant ID and the study label are typed by hand and were written to the research log exactly as typed, so an ID of `=2+3` was recorded as `5`, and a pasted string beginning with `=` could run a command when the file was opened. The same held for the metrical lexicon export.

## What changed

1. A cell of text that begins with `=`, `+`, `-`, `@`, a tab or a carriage return is written with a leading apostrophe, the standard guard, so a spreadsheet shows it as text: `=2+3` is written `'=2+3`.
2. Numbers are left alone. `-12.5` and `+3` are numbers, not formulas, whether they arrive as numbers or as text.
3. A carriage return inside a cell now forces quoting, as a line feed always did.
4. The three CSV writers (syllable table and prosody profile in the engine; research log and metrical lexicon in the Pro page) now share the one function, exported as `E.csvEscape`. Before, the page carried two copies of its own.

## What to know when analysing data

- A participant ID or study label that begins with one of those characters arrives in the CSV with a leading apostrophe. Strip one leading apostrophe when reading those two columns. An ID such as `P-07` or `2026-11-A` is untouched.
- The JSON export keeps every value exactly as typed.
- Column names and order are unchanged.

## Not changed

- The participant ID is still used as typed in the name of the downloaded file.
- The annotated text export still lowercases the text; stimulus pairs can still have unequal mark counts; an opening quotation mark still starts a phrase.

## Validation

`npm test` passes; `test_pro_session.js` grows from 38 to 60 checks, the new ones driving the real page with a hostile participant ID and study label. Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out). Rhythm-measure candidates under Verse: 40 of 40.
