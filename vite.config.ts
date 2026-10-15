/// <reference types="vitest/config" />
import { copyFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages has no SPA rewrites. Serving a copy of index.html as 404.html makes every deep link
 * and refresh (e.g. /madfu-onboarding-lab/madfu/proposed) load the app, which then routes itself.
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist/', import.meta.url));
      copyFileSync(`${dist}index.html`, `${dist}404.html`);
    }
  };
}

export default defineConfig({
  // LAB_BASE=/madfu-onboarding-lab/ for GitHub Pages; "/" for local dev, tests and other hosts.
  base: process.env.LAB_BASE || '/',
  plugins: [react(), spaFallback()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    testTimeout: 45000,
    include: ['src/**/*.test.{ts,tsx}']
  }
});
