'use strict';
const assert = require('assert');
global.window = {};
require('./cmudict.js');
const E = require('./rhythm-reader/engine.js');
E.loadDictionary(window.CMUDICT_FULL, 'full');

const cases = [
  ['Both the minute details are expressed.', 'minute', 1],
  ['every day down to the minute.', 'minute', 0],
  ['a quantity of conflict exists.', 'conflict', 0],
  ['in order to produce steam.', 'produce', 1],
  ['an assortment of produce.', 'produce', 0],
  ['chose to convert to the other side.', 'convert', 1],
  ['maintain the record.', 'record', 0],
  ['desired to record her voice.', 'record', 1],
  ["a learner's permit.", 'permit', 0],
  ['decided to permit her to travel.', 'permit', 1],
  ['started to rebel against them.', 'rebel', 1],
  ['Amy feels content.', 'content', 1],
  ['winning the contest.', 'contest', 0],
  ['the overdue project.', 'project', 0],
  ['We project a film.', 'project', 1],
  ['their right to refuse tasks.', 'refuse', 1],
  ['will subject herself to studying.', 'subject', 1],
  ['the subject of a paper.', 'subject', 0],
  ['expand and contract.', 'contract', 1],
  ['Because of their conduct.', 'conduct', 0],
  ['The performance was perfect.', 'perfect', 0],
  ['the yellow object for discussion.', 'object', 0],
  ['I must object.', 'object', 1],
  ['In the desert.', 'desert', 0],
  ['and desert the children.', 'desert', 1],
  ['a special present.', 'present', 0],
  ['status as a convict.', 'convict', 0]
];

for (const [text, target, primary] of cases) {
  const doc = E.analyze(text);
  const word = doc.words.find(w => w.normalized === target);
  assert(word, `missing ${target}: ${text}`);
  assert.strictEqual(word.lexicalPattern.indexOf('1'), primary,
    `${target} in "${text}" -> ${word.lexicalPattern}`);
}
console.log(`${cases.length} contextual heteronym checks passed.`);
