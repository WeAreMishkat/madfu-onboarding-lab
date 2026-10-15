#!/usr/bin/env node
/**
 * Serve dist/ the way GitHub Pages does: under a base path, real files as-is, anything else gets
 * 404.html with HTTP 404 (the SPA then routes itself). Used by Playwright and the PDF build.
 *
 *   node scripts/serve-pages.mjs --port 4799 --base /madfu-onboarding-lab/
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const port = Number(arg('port', '4799'));
const base = arg('base', '/');
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf', '.json': 'application/json', '.ico': 'image/x-icon'
};

async function fileFor(path) {
  try {
    const s = await stat(path);
    if (s.isFile()) return path;
    if (s.isDirectory()) {
      const index = join(path, 'index.html');
      await stat(index);
      return index;
    }
  } catch { /* not found */ }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (base !== '/' && pathname === base.replace(/\/$/, '')) { res.writeHead(301, { location: base }); res.end(); return; }
  if (!pathname.startsWith(base)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not under base'); return; }
  pathname = pathname.slice(base.length);
  const target = normalize(join(dist, pathname));
  if (!target.startsWith(dist)) { res.writeHead(400); res.end(); return; }
  const found = await fileFor(target);
  if (found) {
    res.writeHead(200, { 'content-type': TYPES[extname(found)] ?? 'application/octet-stream' });
    res.end(await readFile(found));
    return;
  }
  res.writeHead(404, { 'content-type': TYPES['.html'] });
  res.end(await readFile(join(dist, '404.html')));
}).listen(port, () => console.log(`pages-like server on http://localhost:${port}${base}`));
