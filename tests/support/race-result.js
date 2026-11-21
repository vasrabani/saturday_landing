import { test } from '@playwright/test';

// results-race.html is one race's full result (/results/<date>/<course>/<HH-MM>/
// on the Django site): the 15:00 at Haydock on Saturday 21 November 2026,
// 7 ran, five finished, one pulled up, one fell, one non-runner. The top
// five are the real result; the rest of the field is made up to show the
// non-finishers.
export const RACE_RESULT_PAGE = '/results-race.html';

/** Open the page. Offsite requests and script errors are recorded. */
export async function openRaceResult(page, { waitUntil = 'domcontentloaded' } = {}) {
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
  await page.goto(RACE_RESULT_PAGE, { waitUntil });
  await page.locator('[data-race-result]').waitFor();
  return { offsite, problems };
}
