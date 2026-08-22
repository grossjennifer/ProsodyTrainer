'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const readerEngine = fs.readFileSync(
  path.join(root, 'rhythm-reader', 'engine.js'), 'utf8');
const proEngine = fs.readFileSync(
  path.join(root, 'rhythm-reader-pro', 'engine.js'), 'utf8');
const html = fs.readFileSync(
  path.join(root, 'rhythm-reader-pro', 'index.html'), 'utf8');
const E = require('./rhythm-reader-pro/engine.js');

assert.strictEqual(readerEngine, proEngine,
  'Reader and Pro must continue to ship the same engine');
assert.strictEqual(E.build, '3.2.0');

E.loadDictionary({
  HAPPY: 'HH AE1 P IY0', CHILDREN: 'CH IH1 L D R AH0 N',
  RUNNING: 'R AH1 N IH0 NG', QUICKLY: 'K W IH1 K L IY0'
}, 'test');
const doc = E.analyze('Happy children running quickly.',
  { textType: 'verse', useKnownReadings: false });
assert.strictEqual(doc.engineBuild, E.build,
  'an analysis records the engine build');

const syllableCSV = E.toCSV(doc).split('\n');
assert(syllableCSV[0].endsWith(',engine_build'),
  'syllable CSV appends a build column without renaming existing fields');
assert(syllableCSV.slice(1).every(row => row.endsWith(',' + E.build)),
  'every syllable row records the build');

const profile = E.profileCSV(doc);
assert(profile.includes('engine_build,' + E.build),
  'profile export records the build');
assert(profile.includes('pdi_reference,distance_from_automatic_model'),
  'profile export states what PDI is measured against');

assert(html.includes('id="buildChip"'), 'Pro displays a build chip');
assert(html.includes("'Build ' + E.build"), 'build chip reads from the engine');
assert(html.includes('show model fit'), 'uncertainty display uses model-fit wording');
assert(html.includes('distance from automatic model (PDI)'),
  'PDI label names the automatic model as its reference');
assert(html.includes('not an\n  independent measure of a reader\'s prosodic ability'),
  'PDI help rejects an ability interpretation');

assert(/id="tab-debug"[\s\S]*aria-controls="panel-debug"/.test(html),
  'tabs name the panels they control');
assert(/id="panel-lexicon"[\s\S]*aria-labelledby="tab-lexicon" hidden/.test(html),
  'inactive panels begin hidden and labelled');
assert(html.includes("ev.key === 'ArrowRight'"),
  'tab list implements arrow-key navigation');
assert(html.includes("ev.key === 'Home'"),
  'tab list implements Home/End navigation');
assert(html.includes('g.tabIndex = 0'),
  'letter-boundary split controls are keyboard focusable');
assert(html.includes("ev.key !== 'Enter' && ev.key !== ' '"),
  'split controls accept Enter and Space');

assert(html.includes("const cols = ['engine_build','participant'"),
  'research-session CSV starts with the build identifier');
assert(html.includes("'instances', 'engine_build'"),
  'metrical-lexicon CSV records the build');
assert((html.match(/Rhythm Reader Pro build ' \+ E\.build/g) || []).length >= 3,
  'plain-text, stimulus-pair, and training exports identify the build');

console.log('Rhythm Reader Pro polish checks passed.');
