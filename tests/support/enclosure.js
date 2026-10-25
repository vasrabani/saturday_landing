import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';

// The Enclosure's pages are the Django site's, built by
// tools/build-enclosure.py from a recorded card (Bath, Tuesday 29
// September 2026) and a made-up room: Hartwell & Penn's eleven guests,
// seen as Priya Shah. One folder per scenario, the clock stopped at:
//   morning 12:40, race-day 16:20, day-done 19:05 (as Priya),
//   steward 16:20 (as the host), visitor 19:05 (no invitation, a
//   public showcase day).
export const SCENARIOS = ['morning', 'race-day', 'day-done', 'steward', 'visitor'];

/** Every page of a scenario, by file name. */
export const pagesOf = (scenario) =>
  readdirSync(join('enclosure', scenario)).filter((file) => file.endsWith('.html')).sort();

/**
 * Open an Enclosure page. Script errors and failed requests to the
 * sandbox are recorded. Requests elsewhere are not: the runners' silks
 * come from the silks service, which the test browser cannot reach.
 */
export async function openEnclosure(page, path, { waitUntil = 'domcontentloaded' } = {}) {
  const { origin } = new URL(test.info().project.use.baseURL);
  const problems = [];
  page.on('pageerror', (error) => problems.push(`script error: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).origin === origin) {
      problems.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto(`/enclosure/${path}`, { waitUntil });
  await page.locator('.enc-shell').waitFor();
  return { problems };
}

/**
 * Anything showing past either edge of the screen, bar what is hidden
 * or meant to scroll sideways. A long name cut short inside its card
 * (overflow hidden, an ellipsis) is not past the edge: only what can
 * be seen is measured.
 */
export const pastTheEdges = (page) => page.evaluate(() => {
  const width = document.documentElement.clientWidth;
  const seen = (el) => {
    let { left, right } = el.getBoundingClientRect();
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (getComputedStyle(parent).overflowX !== 'visible') {
        const box = parent.getBoundingClientRect();
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
      }
    }
    return { left, right };
  };
  return [...document.querySelectorAll('.enc-shell *')].filter((el) => {
    if (el.closest('[hidden], [aria-hidden="true"], .enc-visually-hidden, dialog:not([open]), .enc-feed__chips')) return false;
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (!(box.width > 0 && box.height > 0) || style.visibility === 'hidden' || style.position === 'fixed') return false;
    const { left, right } = seen(el);
    return right > left && (right > width + 1 || left < -1);
  }).map((el) => String(el.className.baseVal ?? el.className).split(' ')[0]).slice(0, 5);
});
