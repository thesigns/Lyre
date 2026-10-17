import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

// Paths relative to the project root, with forward slashes.
function listFiles(dir) {
  return readdirSync(join(rootPath, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(rootPath, join(e.parentPath, e.name)).replace(/\\/g, '/'));
}

const assets = [...read('sw.js').match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('the service worker caches every app file, and only existing ones', () => {
  const appFiles = [
    'index.html',
    'manifest.webmanifest',
    ...['css', 'js', 'melodies', 'icons'].flatMap(listFiles),
  ];
  for (const f of appFiles) assert.ok(assets.includes(f), `missing from sw.js ASSETS: ${f}`);
  for (const f of assets) if (f !== './') assert.ok(existsSync(new URL(f, root)), `not found: ${f}`);
});

test('manifest allows rotation and points to existing icons', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.lang, 'en');
  for (const icon of manifest.icons) assert.ok(existsSync(new URL(icon.src, root)), icon.src);
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
});
