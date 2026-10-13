import { test } from '@playwright/test';

// llama-index.html is the Django page (/llama-index/) for Monday 12
// October 2026 as the site rendered it, in this sandbox's copy of the
// site's shell: three meetings, 246 horses. Its signals and comments are
// stand-ins (the copy of the database it was drawn from has no tips).
export const INDEX_PAGE = '/llama-index.html';
export const INDEX_SLIP_KEY = 'saturday:slip:2026-10-12';

// The search waits 90ms after the last key (llama_index.js, SEARCH_MS).
export const SEARCH_SETTLES_MS = 250;

/** Open the index. Offsite requests and script errors are recorded, as for the meeting page. */
export async function openIndex(page, { query = '', waitUntil = 'domcontentloaded' } = {}) {
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
  await page.goto(INDEX_PAGE + query, { waitUntil });
  await page.locator('[data-li-count="signal"]:not(:empty)').waitFor();
  return { offsite, problems };
}

export const rows = (page) => page.locator('.li-row');
export const shownRows = (page) => page.locator('.li-row:not([hidden])');
export const pickable = (page) => page.locator('.li-row--to_run:not([hidden])').filter({ has: page.locator('[data-action="add-to-slip"]:not([disabled])') });

/** The attributes of every row showing, in the order showing. */
export const shown = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.li-row')].filter((row) => !row.hidden).map((row) => ({ ...row.dataset })));

export async function search(page, text) {
  await page.locator('[data-li-search]').fill(text);
  await page.waitForTimeout(SEARCH_SETTLES_MS);
}

/** Pick one horse from each of the first `n` races still to run; returns the rows picked. */
export async function pickFromRaces(page, n) {
  return page.evaluate(async (wanted) => {
    const seen = new Set();
    const picked = [];
    for (const row of document.querySelectorAll('.li-row--to_run')) {
      if (seen.size === wanted) break;
      if (seen.has(row.dataset.raceId)) continue;
      const button = row.querySelector('[data-action="add-to-slip"]:not([disabled])');
      if (!button) continue;
      seen.add(row.dataset.raceId);
      button.click();
      await new Promise((done) => setTimeout(done, 80));
      picked.push({ id: row.id, raceId: row.dataset.raceId, inSlip: row.classList.contains('racecard__runner--in-slip') });
    }
    return picked;
  }, n);
}
