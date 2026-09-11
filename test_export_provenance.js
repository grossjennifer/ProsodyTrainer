'use strict';
// Exercise the actual Pro export helpers without a browser dependency.
// This does not replace the separate interface-wiring suite.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
global.window = {};
require('./cmudict');
const E = require('./rhythm-reader-pro/engine');
E.loadDictionary(window.CMUDICT_FULL, 'full');
const doc = E.analyze('Alicia will permit John to borrow her car.', { textType: 'prose' });
const html = fs.readFileSync(__dirname + '/rhythm-reader-pro/index.html', 'utf8');
const context = { E, doc, session: { log: [{ engine_build: E.build,
  dictionary_id: doc.dictionaryMetadata.id, dictionary_sha256: doc.dictionaryMetadata.sha256 }] },
  lexEntries: () => doc.words.map((wd, wi) => ({ wd, instances: [{ wi }] })) };
vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('function exportProvenance()'),
  html.indexOf("document.getElementById('exportSel').addEventListener")), context);
vm.runInContext(html.slice(html.indexOf('function researchCSV()'), html.indexOf("let mode = 'bold'")), context);
for (const name of ['exportProvenance', 'lexiconCSV', 'researchCSV']) {
  const output = context[name]();
  assert(output.includes(doc.dictionaryMetadata.sha256), name + ' checksum');
  assert(output.includes(doc.dictionaryMetadata.id), name + ' snapshot');
  assert(output.includes(E.build), name + ' engine build');
}
for (const file of ['rhythm-reader/index.html', 'rhythm-reader-pro/index.html']) {
  const source = fs.readFileSync(__dirname + '/' + file, 'utf8');
  for (const m of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
    if (m[1].trim()) new Function(m[1]);
}
console.log('Pro export helpers preserve build and dictionary provenance; both page scripts parse.');
