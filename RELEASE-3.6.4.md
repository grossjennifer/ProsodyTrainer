# Rhythm Reader 3.6.4 — text handling, one verse choice, contact page

Prepared on top of 3.6.3. Engine and page changes, both tools (engines identical).

## Engine

1. **Accented letters.** A word may now contain any letter. `café` was split into the word `caf` and a stray `é` and read as one syllable. Accents are removed for dictionary lookup and syllable counting only; the letters shown are the ones typed. A typed final `é` selects the reading with a sounded final syllable where the dictionary lists one, so `résumé` is the noun (RÉ·su·mé) and `resume` stays the verb.
2. **Hyphenated words listed whole in the dictionary** keep the dictionary's stress but are divided part by part, so no syllable runs across the hyphen and the hyphen is shown: `well-·known`, `moth·er-·in-·law`, `twen·ty-·one` (were `wel·lknown`, `moth·e·rin·law`, `twent·yo·ne`).
3. **Stressed final -lle** is a silent e, not a syllabic l: `mi·chelle`, `ga·zelle` (were `miche·lle`). The ordinary consonant + le ending (`lit·tle`, `ta·ble`) is unchanged.
4. **Song is analysed as verse.** The two never gave a different reading. `song` is still accepted as a text type so saved settings and older scripts keep working; it is recorded as `verse`.

Across 360 analyses of 120 unrelated texts, the only change is the division of `Michelle`.

## Pages

- **Both tools:** the research-example buttons no longer carry the internal item notes as tooltips. The notes remain in `known-rhythms.js`, which is a public file in a public repository.
- **Both tools:** one text-type choice, "Verse, song or rhyme", in place of two.
- **Both tools:** when the text contains figures, a note says that numbers and symbols written as figures are not given beats and should be spelled out. The engine does not expand figures: `2019`, `$25` and `3:30` each have several spoken forms, and the display would have to show words the reader did not type.
- **How the tools decide:** new section, "Prose or verse — the choice that shapes Tier 3", describing the text-type decision, the sentence-layout rule from 3.6.1, and its known cost.
- **Contact page** at `/contact/`, linked from the homepage About section and listed in the sitemap. It gives the e-mail address and university profile already published on the site, and nothing further.

## Not changed

- `Vaudeville` is still divided `vaudevi·lle`, and `Danielle` as `Dan·iel·le`.
- The site navigation still reads "About and contact" and still leads to the About section, which now links to the contact page.

## Validation

`npm test` passes, including the new `test_text_handling.js` (21 checks) and `test_contact_page.js` (9 checks). Both per-folder suites pass in both tools. Evaluation harness unchanged (45/47 exact, 17/17 held-out). Rhythm-measure candidates under Verse: 40 of 40. The contact page, both tools, and the homepage were rendered at desktop and phone widths with no horizontal overflow and no script errors.
