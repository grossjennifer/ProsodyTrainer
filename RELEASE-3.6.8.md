# Rhythm Reader 3.6.8 — quotation marks, equal stimulus counts, text as typed

Prepared on top of 3.6.7. Engine changes in both tools (engines identical), and the Rhythm Reader Pro export page.

**Readings change only for text that contains quotation marks.** Across 447 analyses of 149 texts without quotation marks (auto, Verse, Prose), no beat, no phrase boundary and no label changed.

## 1. Quotation marks are not phrase boundaries

A quotation mark was treated like a full stop. `The word "permit" has two readings.` was cut into three phrases, each given its own main accent, and the same happened to any quoted word, title or phrase inside a clause.

Quotation marks now enclose without pausing. Quoted speech is still set off wherever the writer punctuated it, because the comma and the full stop are boundaries in their own right: `She said, "I will go to the store."` is two phrases, as before. Parentheses and dashes are unchanged.

A sentence with a quoted word now has the same beats as the same sentence without the quotation marks. Of 16 test sentences with quotation marks, 12 read as before and 4 changed:

| Before | After |
|---|---|
| he CALLED it a "stuck RECord" aGAIN | he CALLED it a "STUCK RECord" aGAIN |
| the WORD "PERmit" has two REAdings | the word "PERmit" has TWO REAdings |
| the sign SAID "fresh PROduce" in red LETters | the SIGN said "fresh PROduce" in RED LETters |
| we READ "the RAven" AND "ANnabel LEE" in CLASS | we READ "the RAven" and "ANnabel LEE" in CLASS |

The cost: quoted speech written with no comma before it (`She said "I will go."`) is no longer split at the quotation mark.

## 2. Incongruent stimuli carry the same number of marks

The incongruent version of a stimulus pair is meant to carry the same number of marks as the congruent one (Gross et al., 2017). When a phrase had no unstressed one-syllable word left to take a mark, the mark was dropped without notice: `STILL aCHIEving STILL purSUing` has four beats and its incongruent version had two marks.

- The remaining unstressed syllables inside the phrase's longer words are now used, in order. That line now gives four and four.
- Where equal counts are impossible, because a phrase has more beats than syllables without one (`WITH a HEART for ANy FATE`: four and three), the pair now reports it: `incongruentMap` and `stimulusPair` return `shortfall`, and the stimulus-pair export carries an `UNEQUAL MARK COUNTS` warning.

Across 165 texts under all three text types, the incongruent version changed for 4 texts, each gaining the marks it lacked. No pair that already had equal counts changed. Ten of 111 verse lines cannot have equal counts; nearly all are seven-syllable trochaic lines that end on a beat.

**If you built stimuli with an earlier build, check them**: a pair generated before 3.6.8 could have unequal counts with nothing in the export to say so beyond the two numbers.

## 3. The annotated text keeps the letters as typed

The annotated text export wrote every syllable without a beat in lower case, so `Sam went to Paris on Tuesday.` became `SAM went to PAR·is on TUES·day.` only by luck and `Maria` became `ma·RI·a`. Syllables without a beat now keep the letters as typed (`Ma·RI·a`), and a typed apostrophe is kept. The export states the convention: capitals mark beats.

One case cannot be told apart in this format: a one-letter syllable that is always a capital, the pronoun `I`.

## 4. File names

A participant ID is still recorded inside every file exactly as typed. In the *name* of a downloaded file it is reduced to letters, digits, dot, hyphen and underscore, so an ID containing a slash or a space cannot produce a broken or misplaced file. `P-07` is used as it is.

## Not changed

- Prose stress weights. The prose readings of text without quotation marks are those of 3.6.5.
- The 40 prose sentences awaiting human marking contain no quotation marks.

## Validation

`npm test` passes, including the new `test_quotes_stimuli.js` (41 checks); `test_pro_session.js` grows from 60 to 69 checks. Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out). Rhythm-measure candidates under Verse: 40 of 40.
