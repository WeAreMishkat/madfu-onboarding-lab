import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a production build served the way GitHub Pages serves it
 * (base path /madfu-onboarding-lab/, unknown paths → 404.html). Set LAB_URL to test a live site.
 */
const BASE_PATH = '/madfu-onboarding-lab/';
const live = process.env.LAB_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: live ?? `http://localhost:4799${BASE_PATH}`,
    viewport: { width: 1440, height: 900 },
    trace: 'off'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: live ? undefined : {
    command: 'npm run build:pages && node scripts/serve-pages.mjs --port 4799 --base /madfu-onboarding-lab/',
    url: `http://localhost:4799${BASE_PATH}`,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
