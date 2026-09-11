# Rhythm Reader 3.2.1 — diagnostic fixes

Prepared against public commit `960dcec` on branch `fix/rhythm-diagnostic-regressions`.
This is a review candidate, not a deployed release.

## Changes

- Treat unstressed r-coloured schwa (`ER0`) as reduced when evaluating beat placement and retraction. The verb in “Alicia will permit John to borrow her car.” keeps lexical `01` and realized `WS`; with default clash suppression, John yields its beat. This avoids changing the apparent noun/verb stress contrast. Tennessee air and thirteen men retain their expected retraction. The rule is a conservative modeling constraint, not a comprehensive account of English stress shift.
- Display unopened as `un·o·pened`, preserving its lexical `010` and realized `WSW`. No dictionary pronunciation was changed.
- Bump both identical engines from 3.2.0 to 3.2.1. Bump this identifier for every future engine release; archive the corresponding source revision.
- Add non-enumerable, frozen snapshot metadata to both dictionaries. SHA-256 covers JSON-encoded, sorted `[word, pronunciation]` entries. The upstream CMU release is unknown and remains explicitly null. Run `npm run stamp:dictionaries` after updating dictionary data. The metadata does not add a dictionary word or alter word counts.
- Record snapshot ID and checksum in full JSON, syllable/profile/lexicon/session CSVs, and annotated/stimulus/training text exports. New CSV columns are appended, preserving previous column positions. Unversioned custom dictionaries do not inherit bundled provenance.
- Update the decision and focus explanations: prose does not force a periodic foot; lexical stress, realized beats and nuclear prominence differ; the nuclear default remains the last content word in each punctuation-bounded phrase. No blanket final-adjunct deaccenting was added.

## Validation

Passed:

- All 16 supplied diagnostic cases in both engines, including verse promotion with and without registered readings and heteronyms with clash suppression on and off.
- Dictionary checksum recomputation, JSON/CSV metadata checks, Pro export-helper execution, and page-script syntax checks.
- Existing 27 contextual heteronym checks, 27 phrase-prominence checks, known-reading alternatives, Pro polish checks, and 25 ternary-boundary/provenance checks.
- All 40 rhythm-candidate regression thresholds.
- All 13 non-interface acceptance criteria.

Limitations:

- The acceptance suite's interface criterion could not run because jsdom is not installed. Starting a local preview server was also denied by the session's environment. The updated pages have not been visually verified in a browser. Run `node test_interface.js` with jsdom installed and perform a browser smoke test before deployment.
- The Learn suite reports 173 passes and five failures. Running the unchanged HEAD source produced the exact same five failures: the old phrase-boundary wording assertion and four hub/map assertions. This change adds no Learn test failures. They remain outside this targeted repair.

## Suggested review checks before publishing

1. Check both tools display perMIT in the Alicia sentence and un·O·pened in syllable mode.
2. Confirm TENnessee AIR, THIRteen MEN, and verse IN/OF/BE still appear.
3. Download each Pro export and verify build 3.2.1 and dictionary fingerprint fields. The full JSON remains schema version 3 with additive metadata.
4. Publish both engine files and both dictionary files together with the updated Pro page and Learn pages. Preserve the prior release for rollback.

Publishing this review branch does not deploy the live website. Browser verification and review remain necessary before merging for release.
