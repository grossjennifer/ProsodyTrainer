#!/usr/bin/env node
/**
 * test_asset_paths.js — every local asset a page asks for must exist on disk.
 *
 * Catches the class of failure where an HTML file references a script,
 * stylesheet, or image that was renamed, moved, or never committed. The
 * browser reports this only as an undefined global at click time; the
 * unit suites don't see it at all, because they load modules by
 * filesystem path rather than by the URL the page requests.
 *
 * Case-sensitive by design: macOS is case-insensitive, GitHub Pages is not,
 * so a casing mismatch works locally and 404s live.
 *
 * Usage:  node test_asset_paths.js
 * Exits non-zero on any failure, so it can gate a push.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SKIP_DIRS = new Set(['node_modules', '.git']);

// src="..." or href="..." on script, link, img, audio, source, iframe
const ASSET_RE = /<(?:script|link|img|audio|source|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;

function htmlFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, found);
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

function isLocal(url) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;   // http:, https:, mailto:, data:
  if (url.startsWith('//')) return false;                // protocol-relative
  if (url.startsWith('#')) return false;                 // in-page anchor
  return true;
}

/** Resolve as a server would, then confirm the exact-case name is on disk. */
function existsExactCase(abs) {
  const dir = path.dirname(abs);
  const base = path.basename(abs);
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).includes(base);
}

let checked = 0;
const failures = [];

for (const file of htmlFiles(ROOT)) {
  const rel = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');
  const seen = new Set();

  for (const m of html.matchAll(ASSET_RE)) {
    let url = m[1].trim();
    if (!isLocal(url)) continue;

    url = url.split('#')[0].split('?')[0];
    if (!url) continue;

    // Directory links (learn/stress/) resolve to that folder's index.html
    let target = url.endsWith('/') ? url + 'index.html' : url;

    const abs = url.startsWith('/')
      ? path.join(ROOT, target.slice(1))
      : path.resolve(path.dirname(file), target);

    const key = abs;
    if (seen.has(key)) continue;
    seen.add(key);

    checked++;
    if (!existsExactCase(abs)) {
      failures.push({ page: rel, url: m[1].trim(), expected: path.relative(ROOT, abs) });
    }
  }
}

for (const f of failures) {
  console.error(`  \u2717 ${f.page} requests "${f.url}" \u2014 nothing at ${f.expected}`);
}

if (failures.length === 0) {
  console.log(`\n${checked} local asset references checked, all resolve.`);
  process.exit(0);
} else {
  console.error(`\n${checked} checked, ${failures.length} broken.`);
  process.exit(1);
}
