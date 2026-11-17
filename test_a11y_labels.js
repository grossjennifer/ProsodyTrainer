/* test_a11y_labels.js — accessibility fixes of 17 November 2026, found with
 * axe-core in Chrome and checked here on the live pages (jsdom):
 *   1. Pro's text-type menu has a name even when its visible label is hidden.
 *   2. Every syllable button's name begins with the letters it shows
 *      (WCAG 2.5.3 Label in Name), so voice control can reach it.
 *   5. The amber confidence colour meets 4.5:1 on the striped table rows.
 *   6. No empty column heading in Pro's word table.
 *   7. Rhythm Reader has headings for its two sections.
 *   4. The passage is one Tab stop; the arrow keys move between syllables.
 * Requires jsdom. Skips loudly rather than silently passing if it is absent.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIPPED: jsdom not installed. ACCESSIBILITY LABELS WERE NOT VERIFIED.'); process.exit(0); }
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lum = hex => {
  const f = v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const c = [1, 3, 5].map(i => f(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  const load = async f => {
    const dom = await JSDOM.fromFile(path.join(__dirname, f), { runScripts: 'dangerously', resources: 'usable' });
    await sleep(2500);
    dom.window.confirm = () => true;
    return dom.window.document;
  };
  const labelsBeginWithText = (d, sel, name) => {
    const btns = Array.from(d.querySelectorAll(sel));
    ok(btns.length > 5, `${name}: syllable buttons are present`);
    for (const b of btns) {
      const shown = b.textContent.replace(/[▲·]/g, '').trim();
      ok(shown && (b.getAttribute('aria-label') || '').toLowerCase().startsWith(shown.toLowerCase()),
        `${name}: "${b.getAttribute('aria-label')}" begins with "${shown}"`);
    }
  };

  // Rhythm Reader
  let d = await load('rhythm-reader/index.html');
  d.getElementById('input').value = 'Happy children running quickly. The sun arose above the quiet hill.';
  d.getElementById('go').click(); await sleep(150);
  labelsBeginWithText(d, '#out .syl', 'Rhythm Reader');
  ok(/^py, in Happy, no beat\./.test(Array.from(d.querySelectorAll('#out .syl')).find(b => b.textContent === 'py').getAttribute('aria-label')),
    'Rhythm Reader: a part names its word');
  ok(/^sun, has a beat\./.test(Array.from(d.querySelectorAll('#out .syl')).find(b => b.textContent === 'sun').getAttribute('aria-label')),
    'Rhythm Reader: a one-part word does not repeat itself');
  const h2 = Array.from(d.querySelectorAll('h2')).map(h => h.textContent.trim());
  ok(h2.includes('Your text') && h2.includes('The beat'), 'Rhythm Reader: section headings for screen readers');
  for (const id of ['textH', 'beatH']) ok(d.querySelector(`section[aria-labelledby="${id}"]`), `Rhythm Reader: section named by ${id}`);

  // Rhythm Reader Pro
  d = await load('rhythm-reader-pro/index.html');
  d.getElementById('analyzeBtn').click(); await sleep(150);
  labelsBeginWithText(d, '#surface .syl', 'Rhythm Reader Pro');
  ok(d.getElementById('textType').getAttribute('aria-label') === 'Text type', 'Pro: the text-type menu has its own name');
  const ths = Array.from(d.querySelectorAll('#debugTableWrap th'));
  ok(ths.length >= 10 && ths.every(th => th.textContent.trim()), 'Pro: the word table has no empty column heading');
  const css = fs.readFileSync(path.join(__dirname, 'rhythm-reader-pro/index.html'), 'utf8');
  const amber = /\.conf-mid \{ color: (#[0-9A-Fa-f]{6}); \}/.exec(css)[1];
  ok(ratio(amber, '#EFF2F1') >= 4.5 && ratio(amber, '#FFFFFF') >= 4.5, `Pro: amber ${amber} meets 4.5:1 on striped and plain rows`);

  // 4. One Tab stop for the whole passage, arrow keys inside it.
  for (const [file, go, box] of [['rhythm-reader/index.html', 'go', 'out'], ['rhythm-reader-pro/index.html', 'analyzeBtn', 'surface']]) {
    const dd = await load(file);
    const w = dd.defaultView;
    dd.getElementById('input').value = 'Happy children running quickly.';
    dd.getElementById(go).click(); await sleep(150);
    const c = dd.getElementById(box);
    const btns = Array.from(c.querySelectorAll('button'));
    const name = file.split('/')[0];
    ok(c.getAttribute('role') === 'group' && /^Rhythm, 8 syllables\. Arrow keys move between them\.$/.test(c.getAttribute('aria-label')),
      `${name}: the passage is one named group`);
    ok(btns.filter(b => b.tabIndex === 0).length === 1 && btns[0].tabIndex === 0, `${name}: exactly one syllable is in the Tab order, the first`);
    const key = (k, extra) => dd.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, extra || {})));
    btns[0].focus();
    key('ArrowRight'); ok(dd.activeElement === btns[1], `${name}: ArrowRight moves to the next syllable`);
    ok(btns[1].tabIndex === 0 && btns[0].tabIndex === -1, `${name}: the Tab stop follows`);
    key('End'); ok(dd.activeElement === btns[btns.length - 1], `${name}: End goes to the last`);
    key('ArrowRight'); ok(dd.activeElement === btns[btns.length - 1], `${name}: ArrowRight stops at the end`);
    key('Home'); ok(dd.activeElement === btns[0], `${name}: Home goes to the first`);
    key('ArrowLeft'); ok(dd.activeElement === btns[0], `${name}: ArrowLeft stops at the start`);
    key('ArrowDown'); ok(dd.activeElement === btns[1], `${name}: ArrowDown also moves on`);
    key('ArrowRight', { ctrlKey: true }); ok(dd.activeElement === btns[1], `${name}: modified arrows are left to the browser`);
    // Toggling rebuilds the passage; focus and the Tab stop stay on that syllable.
    dd.activeElement.click(); await sleep(100);
    const now = Array.from(c.querySelectorAll('button'));
    ok(/^py, in Happy/.test(dd.activeElement.getAttribute('aria-label') || ''), `${name}: focus stays on the toggled syllable`);
    ok(now.filter(b => b.tabIndex === 0).length === 1 && dd.activeElement.tabIndex === 0, `${name}: and it remains the one Tab stop`);
  }

  // The Learn pages (17 November 2026).
  const pages = ['learn/index.html', ...fs.readdirSync(path.join(__dirname, 'learn'))
    .filter(n => fs.existsSync(path.join(__dirname, 'learn', n, 'index.html'))).map(n => `learn/${n}/index.html`)];
  ok(pages.length === 8, 'eight Learn pages');
  for (const f of pages) {
    const html = fs.readFileSync(path.join(__dirname, f), 'utf8');
    ok(/<html lang="en" class="learn">/.test(html), `${f}: takes the Learn type size`);
    for (const m of html.matchAll(/<button class="learn-audio"[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)) {
      const shown = m[2].replace(/<[^>]+>|&#9654;|▶/g, '').replace(/\s+/g, ' ').trim();
      ok(m[1].toLowerCase().startsWith(shown.toLowerCase()), `${f}: "${m[1]}" begins with "${shown}"`);
    }
  }
  const style = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  ok(/html\.learn \{ font-size: 115%; \}/.test(style) && /min-width: 900px\) \{ html\.learn \{ font-size: 135%; \}/.test(style),
    'Learn type: 15% larger, 35% on laptop and desktop widths');
  ok(/\.learn-refs p \{\s*overflow-wrap: anywhere;/.test(fs.readFileSync(path.join(__dirname, 'site.css'), 'utf8')),
    'Learn references: long links wrap on a narrow screen');

  console.log(`test_a11y_labels.js: ${checks} checks passed.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
