'use strict';
// Run after replacing either dictionary. The checksum identifies the sorted
// word/pronunciation payload, not an unverified upstream CMU release.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const marker = '// Prosody dictionary snapshot metadata';
for (const [file, name, kind] of [
  ['cmudict.js', 'CMUDICT_FULL', 'full'],
  ['cmudict-subset.js', 'CMUDICT_SUBSET', 'subset']
]) {
  const target = path.join(__dirname, file);
  const source = fs.readFileSync(target, 'utf8').split(marker)[0].trimEnd();
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const dict = context.window[name];
  const entries = Object.keys(dict).sort().map(key => [key, dict[key]]);
  const sha256 = crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  const metadata = { id: 'cmu-' + kind + '-sha256-' + sha256,
    sha256, checksumFormat: 'JSON.stringify(sorted [word, pronunciation] entries)',
    entries: entries.length, upstreamRelease: null };
  const footer = '\n\n' + marker + '\nObject.defineProperty(window.' + name +
    ', "__prosodyMetadata", { value: Object.freeze(' + JSON.stringify(metadata) + ') });\n';
  fs.writeFileSync(target, source + footer);
  console.log(file + ': ' + metadata.id);
}
