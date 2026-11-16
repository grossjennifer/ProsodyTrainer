/* test_audio_clips.js — the six recorded clips exist where the pages ask for
 * them, and the intonation page's Play buttons work as progressive
 * enhancement (hidden in the served markup, revealed by the page's script). */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const at = p => path.join(__dirname, p);

const home = fs.readFileSync(at('index.html'), 'utf8');
for (const name of ['really-statement.mp3', 'really-question.mp3', 'really-exclamation.mp3']) {
  ok(home.includes('data-audio="' + name + '"'), 'homepage asks for ' + name);
  ok(fs.existsSync(at(name)) && fs.statSync(at(name)).size > 2000, name + ' exists');
}
const page = fs.readFileSync(at('learn/intonation/index.html'), 'utf8');
const buttons = page.match(/<button class="learn-audio"[^>]*>/g) || [];
ok(buttons.length === 3, 'three Play buttons');
for (const b of buttons) {
  const src = /data-audio="\.\.\/\.\.\/(audio\/oh-[a-z]+\.mp3)"/.exec(b);
  ok(src, 'button names its clip: ' + b);
  ok(fs.existsSync(at(src[1])) && fs.statSync(at(src[1])).size > 2000, src[1] + ' exists');
  ok(/\shidden>/.test(b), 'hidden in the served markup');
  ok(/aria-label="Play Oh [^"]+"/.test(b), 'says which contour it plays');
}
ok(/button\.hidden = false/.test(page), 'the page script reveals the buttons');
ok(!/\.hidden\s*=\s*true/.test(page), 'the script hides nothing');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { JSDOM = null; }
if (JSDOM) {
  const played = [];
  const dom = new JSDOM(page, { runScripts: 'dangerously',
    beforeParse(win) {
      win.Audio = function (src) { this.src = src; this.addEventListener = () => {};
        this.pause = () => {}; this.play = () => { played.push(src); return Promise.resolve(); }; };
    } });
  const d = dom.window.document;
  const live = Array.from(d.querySelectorAll('.learn-audio'));
  ok(live.every(b => !b.hidden), 'buttons are visible once the script has run');
  live[1].click();
  ok(played.length === 1 && /oh-question\.mp3$/.test(played[0]), 'a click plays that clip');
  ok(live[1].closest('li').classList.contains('is-sounding'), 'the contour is marked while it sounds');
  live[2].click();
  ok(!live[1].closest('li').classList.contains('is-sounding'), 'starting another clip settles the first');
} else {
  console.log('NOTE: jsdom not installed; the click behaviour was not exercised.');
}
// The rhythm page: the two recorded beats, on the trochee and iamb examples.
const rhythm = fs.readFileSync(at('learn/rhythm/index.html'), 'utf8');
const beats = rhythm.match(/<button class="learn-audio"[^>]*>/g) || [];
ok(beats.length === 2, 'two beat buttons on the rhythm page');
for (const [i, clip, label] of [[0, 'audio/dum-da.mp3', 'Play DUM-da, a strong-weak beat'],
                                [1, 'audio/da-dum.mp3', 'Play da-DUM, a weak-strong beat']]) {
  ok(beats[i].includes('data-audio="../../' + clip + '"'), 'button ' + i + ' names ' + clip);
  ok(beats[i].includes('aria-label="' + label + '"'), 'button ' + i + ' says what it plays');
  ok(/\shidden>/.test(beats[i]), 'hidden in the served markup');
  ok(fs.existsSync(at(clip)) && fs.statSync(at(clip)).size > 2000, clip + ' exists');
}
ok(rhythm.indexOf('dum-da.mp3') > rhythm.indexOf('JACK</span>') &&
   rhythm.indexOf('dum-da.mp3') < rhythm.indexOf('MOUSE</span>'), 'DUM-da sits with the strong-weak example');
ok(rhythm.indexOf('da-dum.mp3') > rhythm.indexOf('MOUSE</span>') &&
   rhythm.indexOf('da-dum.mp3') < rhythm.indexOf('BRAINS</span>'), 'da-DUM sits with the weak-strong example');
ok(/\.learn-example\.is-sounding \.learn-audio/.test(fs.readFileSync(at('site.css'), 'utf8')), 'sounding state is styled');
if (JSDOM) {
  const played = [];
  const dom = new JSDOM(rhythm, { runScripts: 'dangerously',
    beforeParse(win) {
      win.Audio = function (src) { this.src = src; this.addEventListener = () => {};
        this.pause = () => {}; this.play = () => { played.push(src); return Promise.resolve(); }; };
    } });
  const live = Array.from(dom.window.document.querySelectorAll('.learn-audio'));
  ok(live.length === 2 && live.every(b => !b.hidden), 'beat buttons are visible once the script has run');
  live[1].click();
  ok(played.length === 1 && /da-dum\.mp3$/.test(played[0]), 'a click plays that beat');
  ok(live[1].closest('.learn-example').classList.contains('is-sounding'), 'the example is marked while it sounds');
  live[0].click();
  ok(!live[1].closest('.learn-example').classList.contains('is-sounding'), 'starting the other beat settles the first');
  ok(/dum-da\.mp3$/.test(played[1]), 'the second click plays the other beat');
}
console.log(`test_audio_clips.js: ${checks} checks passed.`);
