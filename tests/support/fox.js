import { test } from '@playwright/test';

// The Fox Signals pages are the Django site's, built by
// tools/build-fox-signals.py from a recorded day (Tuesday 13 October
// 2026, the clock stopped at 17:10): 38 races, 28 of them finished.
// Conviction figures, track records and signal evidence are stand-ins.
export const FOX_PAGES = [
  'fox-board.html', 'fox-board-member.html', 'fox-race-trace.html', 'fox-race.html', 'fox-race-visitor.html',
  'fox-race-replay.html', 'fox-runner.html', 'fox-alerts.html', 'fox-stable.html', 'fox-settings.html',
];

/** Open a Fox Signals page. Offsite requests and script errors are recorded, as for the other pages. */
export async function openFox(page, file, { waitUntil = 'domcontentloaded' } = {}) {
  const { origin } = new URL(test.info().project.use.baseURL);
  const offsite = [];
  const problems = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) offsite.push(request.url());
  });
  page.on('pageerror', (error) => problems.push(`script error: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/' + file, { waitUntil });
  await page.locator('.fxv-nav').waitFor();
  return { offsite, problems };
}

/** The Board's rows a reader can see (the finished ones are folded away). */
export const shownRows = (page) => page.locator('.fxv-row:visible');

/** The chart's axis labels, top to bottom. */
export const axis = (page) => page.locator('.fx-tchart__gridlabel').allTextContents();
