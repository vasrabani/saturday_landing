import { defineConfig, devices } from '@playwright/test';
import { VIEWPORTS } from './tests/support/viewports.js';

// SITE_ROOT lets `npm run baseline` serve the design reference commit
// from a git worktree on its own port; normal runs serve this checkout.
const siteRoot = process.env.SITE_ROOT ?? '.';
const port = Number(process.env.PORT) || 4173;

// Every hostname except localhost resolves to nothing, so analytics and
// other third-party calls fail inside the browser. This seals the network
// without request interception, which is too slow on this page (see
// `workers` below). Attempts still appear as `request` events.
const OFFLINE_EXCEPT_LOCALHOST = '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost';

const chromeAt = (viewport) => ({
  ...devices['Desktop Chrome'],
  viewport: { width: viewport.width, height: viewport.height },
  isMobile: viewport.touch,
  hasTouch: viewport.touch,
  launchOptions: { args: [OFFLINE_EXCEPT_LOCALHOST] },
});

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  // The page is animation-heavy and still carries ~34 MB of images (PR 3).
  // On a 4-core machine, 4 browsers loading it at once starve each other
  // past the timeout; 2 load in ~2s each.
  workers: 2,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  // A missing reference image is a failure, never silently written:
  // reference images only come from `npm run baseline`.
  updateSnapshots: 'none',
  snapshotPathTemplate: 'tests/visual/__baseline__/{projectName}/{arg}{ext}',
  expect: {
    // Playwright captures until two frames match. Tall sections of this page
    // take seconds to paint while workers compete, so allow for that.
    timeout: 20_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.2, animations: 'disabled', caret: 'hide' },
  },
  use: {
    baseURL: `http://localhost:${port}`,
    timezoneId: 'Europe/London',
    locale: 'en-GB',
    // Tracing snapshots the DOM on every action, which is expensive on this
    // page, so record only when CI retries a failure.
    trace: 'on-first-retry',
  },
  webServer: {
    command: `node tools/serve.mjs "${siteRoot}"`,
    env: { PORT: String(port) },
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
  },
  projects: [
    ...VIEWPORTS.map((viewport) => ({
      name: `features-${viewport.name}`,
      testMatch: /(features|a11y)\.spec\.js/,
      use: chromeAt(viewport),
    })),
    ...VIEWPORTS.map((viewport) => ({
      name: `visual-${viewport.name}`,
      testMatch: /visual\.spec\.js/,
      use: {
        ...chromeAt(viewport),
        // Screenshots are taken in reduced-motion mode so entry animations
        // are at their end state. Otherwise a capture can land mid-fade and
        // no two runs match. Motion itself is covered by features.spec.js.
        contextOptions: { reducedMotion: 'reduce' },
      },
    })),
  ],
});
