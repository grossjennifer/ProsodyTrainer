/* test_contact_page.js — the contact page exists, is reachable, and is listed. */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const read = p => fs.readFileSync(path.join(__dirname, p), 'utf8');
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

const page = read('contact/index.html');
ok(/<title>Contact \| Prosody Trainer<\/title>/.test(page), 'title');
ok(/rel="canonical" href="https:\/\/prosodytrainer\.com\/contact\/"/.test(page), 'canonical');
ok(/href="mailto:grossj@gvsu\.edu"/.test(page), 'gives an e-mail address');
ok(/nav aria-label="Site navigation"/.test(page), 'has the site navigation');
ok(/"@type": "ContactPage"/.test(page), 'structured data names it a contact page');
ok(/https:\/\/prosodytrainer\.com\/#jennifer-gross/.test(page), 'refers to the site author entity');
ok(!/[a-z]'[a-z]/.test(page.replace(/<script[\s\S]*?<\/script>/g, '')),
  'typographic apostrophes only in prose');
ok(/href="contact\/"/.test(read('index.html')), 'homepage About section links to it');
ok(/<loc>https:\/\/prosodytrainer\.com\/contact\/<\/loc>/.test(read('sitemap.xml')), 'listed in the sitemap');
console.log(`test_contact_page.js: ${checks} checks passed.`);
