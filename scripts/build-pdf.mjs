#!/usr/bin/env node
/**
 * Build the Madfu Proposed PDFs from the print routes (same source as the app):
 *   Madfu_Merchant_Onboarding_Wireframes.pdf     /print/wireframes      1600 × 1300 px pages
 *   Madfu_Proposed_Simple_Master_Board.pdf       /print/board-simple    2200 × 1150 px
 *   Madfu_Proposed_Detailed_Master_Board.pdf     /print/board-detailed  2000 × 1250 px pages
 *
 *   npm run pdf        (builds with base "/", serves dist, prints each route to public/)
 *
 * Commit the PDFs in public/ so every deployment serves the matching documents.
 */
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4797;
const TARGETS = [
  { route: '/print/wireframes', file: 'Madfu_Merchant_Onboarding_Wireframes.pdf', w: 1600, h: 1300 },
  { route: '/print/board-simple', file: 'Madfu_Proposed_Simple_Master_Board.pdf', w: 2200, h: 1150 },
  { route: '/print/board-detailed', file: 'Madfu_Proposed_Detailed_Master_Board.pdf', w: 2000, h: 1250 }
];

execSync('npx vite build', { cwd: root, stdio: 'inherit', env: { ...process.env, LAB_BASE: '/' } });
const server = spawn(process.execPath, ['scripts/serve-pages.mjs', '--port', String(PORT), '--base', '/'], { cwd: root, stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 800));

try {
  const browser = await chromium.launch();
  for (const t of TARGETS) {
    const out = fileURLToPath(new URL(`../public/${t.file}`, import.meta.url));
    const page = await browser.newPage({ viewport: { width: t.w, height: t.h } });
    await page.goto(`http://localhost:${PORT}${t.route}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.dataset.printReady === '1', null, { timeout: 30_000 });
    const pages = await page.locator('.pw-page').count();
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: out, width: `${t.w}px`, height: `${t.h}px`, printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    await page.close();
    console.log(`PDF written: ${out} (${pages} pages)`);
  }
  await browser.close();
} finally {
  server.kill();
}
