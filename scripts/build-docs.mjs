#!/usr/bin/env node
/**
 * Write docs/MADFU_PROPOSED_JOURNEY.md from the Madfu Proposed model (same source as the app, boards
 * and PDFs).   npm run docs
 * src/experiences/proposed/docs.test.ts fails when the committed file is out of date.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('../docs/MADFU_PROPOSED_JOURNEY.md', import.meta.url));

const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { renderJourneyDoc } = await server.ssrLoadModule('/src/experiences/proposed/model/docs.ts');
  mkdirSync(fileURLToPath(new URL('../docs', import.meta.url)), { recursive: true });
  writeFileSync(out, renderJourneyDoc());
  console.log(`written: ${out}`);
} finally {
  await server.close();
}
