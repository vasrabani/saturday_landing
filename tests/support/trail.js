import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';

// The trail is a live page: the clock drives the freshness pill ("Live ·
// 12s ago") from data-generated-at, so time is pinned to the moment the
// snapshot was rendered rather than to the landing page's morning.
const page = readFileSync(join(process.cwd(), 'trail.html'), 'utf8');
export const TRAIL_TIME = new Date(page.match(/data-generated-at="([^"]+)"/)[1]);

// Every band of the trail, in page order. Feature tests assert each one
// renders; visual tests screenshot each one.
export const TRAIL_SECTIONS = [
  { name: 'trail-masthead', selector: '.trail__masthead' },
  { name: 'trail-grid', selector: '#trailGrid' },
  { name: 'trail-legend', selector: '.trail__legend' },
  { name: 'trail-spotlight', selector: '.trail__spotlight' },
  { name: 'trail-proposition', selector: '.trail__proposition' },
  { name: 'trail-today-record', selector: '.trail__record' },
];

// Bands the page only shows in another state, so they are on
// trail-states.html rather than here: the anatomy panel and the
// early-signals banner (both belong to the not-published-yet day).


// The freshness pill counts seconds since the page was generated, so it
// reads differently on every capture.
export const TRAIL_NON_DETERMINISTIC = ['#trailFreshness'];

// Every state a cell can be in, and every confidence tier. The sandbox
// page is the fixture day precisely so all of them are on it.
export const CELL_STATES = ['pending', 'live', 'won', 'placed', 'lost', 'void', 'no_fancy'];
export const CELL_TIERS = [1, 2, 3, 4];

/** Poll faster than the page's own 4s, so a test sees the day move. */
function fastPoll(ms) {
  new MutationObserver((mutations, observer) => {
    const main = document.querySelector('main.trail');
    if (!main) return;
    main.setAttribute('data-live-poll-ms', String(ms));
    observer.disconnect();
  }).observe(document, { childList: true, subtree: true });
}

/**
 * Open the Fox Trail. The live feed is served by tools/serve.mjs, which
 * replays fixtures/trail-live-timeline.json one frame per request, so the
 * page settles races exactly as it does on a real Saturday.
 *
 * `pollMs` overrides the page's own poll interval; `live: false` blocks
 * the feed entirely, for tests that need the day to stand still.
 */
export async function openTrail(page_, { pollMs, live = true, waitUntil = 'domcontentloaded' } = {}) {
  const { origin } = new URL(test.info().project.use.baseURL);
  const offsite = [];
  const problems = [];
  const polls = [];

  // trail_flip.js remembers the reveal toggle per viewer, so a page can
  // open with the settled cells already turned over. Tests start from the
  // same place every time.
  await page_.addInitScript(() => {
    try { window.localStorage.removeItem('trail_flip_revealed'); } catch { /* private mode */ }
  });
  if (pollMs) await page_.addInitScript(fastPoll, pollMs);
  if (!live) await page_.route('**/trail/live/**', (route) => route.abort());

  page_.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) offsite.push(request.url());
  });
  page_.on('response', (response) => {
    if (response.url().includes('/trail/live/')) polls.push(response.headers()['x-trail-frame']);
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  page_.on('pageerror', (error) => problems.push(`script error: ${error.message}`));

  await page_.clock.setFixedTime(TRAIL_TIME);
  await page_.goto('/trail.html', { waitUntil });
  return { offsite, problems, polls };
}

/** State + tier of every cell on the grid, in page order. */
export function cellStates(page_) {
  return page_.locator('#trailGrid article.cell').evaluateAll((cells) =>
    cells.map((cell) => ({
      raceId: cell.dataset.raceId,
      state: (cell.className.match(/cell--(pending|live|won|placed|lost|void|no_fancy)/) || [])[1],
      tier: (cell.className.match(/cell--tier-(\d)/) || [])[1],
      hidden: cell.hasAttribute('hidden') || cell.classList.contains('cell--ghost'),
      isNow: Boolean(cell.querySelector('.cell__now')),
    })),
  );
}

/**
 * Show the legend. Below 1280px it is an off-canvas panel behind a
 * trigger (trail_nav.js); at desktop width it is a permanent rail and
 * the trigger is display:none, so this is a no-op there.
 */
export async function openLegend(page_) {
  const legend = page_.locator('.trail__legend').first();
  if (await legend.isVisible()) return;
  await page_.locator('[data-role="nav-open"]').click();
  await legend.waitFor({ state: 'visible' });
}

