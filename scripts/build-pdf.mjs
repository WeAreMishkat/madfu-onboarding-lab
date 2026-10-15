#!/usr/bin/env node
/**
 * Build Madfu_Merchant_Onboarding_Wireframes.pdf from the print route (same source as the app).
 *
 *   npm run pdf        (builds with base "/", serves dist, prints /print/wireframes to public/)
 *
 * Commit the PDF in public/ so every deployment serves the matching document.
 */
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('../public/Madfu_Merchant_Onboarding_Wireframes.pdf', import.meta.url));
const PORT = 4797;

execSync('npx vite build', { cwd: root, stdio: 'inherit', env: { ...process.env, LAB_BASE: '/' } });
const server = spawn(process.execPath, ['scripts/serve-pages.mjs', '--port', String(PORT), '--base', '/'], { cwd: root, stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 800));

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1300 } });
  await page.goto(`http://localhost:${PORT}/print/wireframes`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.dataset.printReady === '1', null, { timeout: 30_000 });
  const pages = await page.locator('.pw-page').count();
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: out, width: '1600px', height: '1300px', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
  await browser.close();
  console.log(`PDF written: ${out} (${pages} pages)`);
} finally {
  server.kill();
}
