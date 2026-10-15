#!/usr/bin/env node
/**
 * Smoke-test a deployed Merchant Onboarding Lab.
 *
 *   npm run smoke:deployed -- https://<app-host>
 *
 * Checks: every route answers 200 with the app shell (direct-route refresh works), the JS bundle
 * loads, official logo and a vetted evidence image are served, an unknown route still returns the
 * shell (client-side 404), and the shell carries noindex.
 */
const base = (process.argv[2] || process.env.LAB_URL || '').replace(/\/$/, '');
if (!/^https:\/\//.test(base) && !/^http:\/\/localhost:\d+$/.test(base)) {
  console.error('Usage: npm run smoke:deployed -- https://<deployed-host>');
  process.exit(2);
}

const ROUTES = ['/', '/tabby', '/tamara', '/madfu/current', '/madfu/proposed', '/compare', '/compare?view=all', '/no-such-page'];
const ASSETS = ['/madfu-wordmark.svg', '/favicon.svg', '/evidence/madfu-current/01-lead-form.png'];
let failed = 0;
const ok = (msg) => console.log(`  PASS  ${msg}`);
const bad = (msg) => { failed++; console.log(`  FAIL  ${msg}`); };

let bundle = null;
for (const r of ROUTES) {
  const res = await fetch(base + r, { redirect: 'follow' });
  const html = await res.text();
  if (res.status === 200 && html.includes('<div id="root">')) ok(`${r} → 200 app shell`);
  else bad(`${r} → ${res.status}`);
  if (r === '/') {
    bundle = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1] ?? null;
    if (html.includes('noindex')) ok('shell has robots noindex'); else bad('shell missing robots noindex');
  }
}
if (bundle) {
  const res = await fetch(base + bundle);
  const js = await res.text();
  if (res.status === 200 && js.length > 50000) ok(`bundle ${bundle} (${Math.round(js.length / 1024)} kB)`);
  else bad(`bundle ${bundle} → ${res.status}`);
} else bad('no bundle reference in the shell');
for (const a of ASSETS) {
  const res = await fetch(base + a);
  const type = res.headers.get('content-type') || '';
  if (res.status === 200 && !type.includes('text/html')) ok(`${a} → 200 ${type}`);
  else bad(`${a} → ${res.status} ${type}`);
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll deployment smoke checks passed');
process.exit(failed ? 1 : 0);
