/* test_a11y_labels.js — accessibility fixes of 17 November 2026, found with
 * axe-core in Chrome and checked here on the live pages (jsdom):
 *   1. Pro's text-type menu has a name even when its visible label is hidden.
 *   2. Every syllable button's name begins with the letters it shows
 *      (WCAG 2.5.3 Label in Name), so voice control can reach it.
 *   5. The amber confidence colour meets 4.5:1 on the striped table rows.
 *   6. No empty column heading in Pro's word table.
 *   7. Rhythm Reader has headings for its two sections.
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

  console.log(`test_a11y_labels.js: ${checks} checks passed.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
