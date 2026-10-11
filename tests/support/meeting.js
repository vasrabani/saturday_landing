import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

// Both pages were captured on the evening of Friday 9 October 2026: the
// Friday card with every result in (meeting.html), and Saturday's card
// the evening before (meeting-upcoming.html). meeting_full.js counts down
// to the next off from the clock, so every run pins time to that evening.
export const MEETING_TIME = new Date('2026-10-09T21:30:00+01:00');

export const MEETING_PAGES = {
  results: '/meeting.html',
  upcoming: '/meeting-upcoming.html',
};

// bet_slip.js keeps a day's slip in localStorage under the key that
// day's page carries; a test that opens a page with a slip already made
// seeds it there, as the live page would have left it.
export const slipStorageKey = (day = 'results') =>
  /data-storage-key="([^"]+)"/.exec(readFileSync(join(process.cwd(), MEETING_PAGES[day]), 'utf8'))[1];

/** A slip of `n` picks made at another meeting, as bet_slip.js records them. */
export const slipFromElsewhere = (n) =>
  Array.from({ length: n }, (_, i) => ({
    runnerId: String(9000 + i), raceId: String(8000 + i), raceTime: `1${i}:00`, raceName: `Race ${i + 1}`,
    course: 'Chepstow', horseName: `Horse ${i + 1}`, oddsFractional: '5/1', oddsDecimal: 6,
  }));

// Every band of the page, in page order. Feature tests assert each one
// renders; visual tests screenshot each one. The race is the first of
// the card: all eight are the same component.
export const MEETING_SECTIONS = [
  { name: 'meeting-masthead', selector: '.mf-hero' },
  { name: 'meeting-tabs', selector: '.mf-switcher' },
  { name: 'meeting-strip', selector: '.mf-jump' },
  { name: 'meeting-race', selector: '.mf-race' },
  { name: 'meeting-slip', selector: '#betSlip' },
  { name: 'meeting-paddles', selector: '.mf-paddles' },
];

// The slip is a column beside the races from 1024px (meeting.css, 8a);
// below that it is a bar at the foot of the screen that opens as a sheet.
export const SLIP_DOCK_MIN_WIDTH = 1024;
export const showsSlipSheet = (page) => page.viewportSize().width < SLIP_DOCK_MIN_WIDTH;

// The masthead is a centred stack from 768px and the live page's
// left-hand column below (meeting.css, 2).
export const MASTHEAD_COLUMN_MAX_WIDTH = 767;

/**
 * Open a meeting page. The browser can only resolve localhost (see
 * OFFLINE_EXCEPT_LOCALHOST in playwright.config.js), so nothing reaches
 * the live site; every attempt is still recorded in `offsite` for the
 * tests that police them.
 */
export async function openMeeting(page, { day = 'results', waitUntil = 'domcontentloaded', slip } = {}) {
  const { origin } = new URL(test.info().project.use.baseURL);
  const offsite = [];
  const problems = [];

  if (slip) {
    await page.addInitScript(([key, picks]) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(picks));
      } catch { /* private mode */ }
    }, [slipStorageKey(day), slip]);
  }

  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) offsite.push(request.url());
  });
  page.on('pageerror', (error) => problems.push(`script error: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });

  await page.clock.setFixedTime(MEETING_TIME);
  await page.goto(MEETING_PAGES[day], { waitUntil });
  return { offsite, problems };
}

/**
 * Serve a meeting page with a change made to its markup first, for a
 * card the captures are not. Call it before openMeeting.
 */
export async function rewriteMeeting(page, day, change) {
  await page.route(`**${MEETING_PAGES[day]}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: change(await response.text()) });
  });
}

/** The races on the page, in running order. */
export const races = (page) => page.locator('.mf-race[id]');

/** The runners of one race, in card order. */
export const runnersOf = (race) => race.locator('.racecard__runner');

/**
 * Pick the first priced runner in each of the first `n` races that have
 * one, the way a visitor would: a press on each Pick button. Returns
 * what was picked, in order, so a test can check the tickets against the
 * rows. A race with no priced runner is passed over (bet_slip.js takes
 * no pick without a price).
 */
export async function pick(page, n) {
  return page.evaluate(async (count) => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const priced = (row) => Number.isFinite(parseFloat(row.dataset.oddsDecimal));
    const picked = [];
    for (const race of document.querySelectorAll('.mf-race[id]')) {
      if (picked.length === count) break;
      const row = Array.from(race.querySelectorAll('.racecard__runner')).find(priced);
      if (!row) continue;
      row.querySelector('[data-action="add-to-slip"]').click();
      await wait(60);
      const silk = row.querySelector('img.racecard__silk');
      picked.push({
        raceId: race.id,
        horse: row.dataset.horseName,
        number: +row.dataset.number > 0 ? row.dataset.number : '',
        odds: row.dataset.oddsFractional,
        silks: silk ? silk.getAttribute('src') : '',
        jockey: row.querySelector('.racecard__jockey-name').textContent.replace(/\s+/g, ' ').trim(),
      });
    }
    await wait(200);
    return picked;
  }, n);
}

/** What the slip's tickets show, in order. */
export function tickets(page) {
  return page.locator('#slipLegs .mf-slip__leg').evaluateAll((legs) =>
    legs.map((leg) => {
      const text = (sel) => (leg.querySelector(sel) ? leg.querySelector(sel).textContent.replace(/\s+/g, ' ').trim() : '');
      const silks = leg.querySelector('.mfr-leg__silks img');
      return {
        horse: text('.mf-slip__leg-horse'),
        odds: text('.mf-slip__leg-odds'),
        number: text('.mfr-cloth'),
        jockey: text('.mfr-leg__jockey'),
        silks: silks ? silks.getAttribute('src') : '',
        silksLoaded: !!silks && silks.complete && silks.naturalWidth > 0,
      };
    }),
  );
}

/** Show the slip: a no-op where it is docked, the sheet below 1024px. */
export async function openSlip(page) {
  const panel = page.locator('#betSlip');
  const handle = page.locator('#slipHandle');
  if (!(await handle.isVisible())) return;
  if (!(await panel.evaluate((el) => el.classList.contains('is-open')))) await handle.click();
  await expect(panel).toHaveClass(/is-open/);
}

/** Scroll until the page stands still: site.js and meeting_masthead.js scroll smoothly. */
export async function settled(page) {
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    let last = -1;
    let same = 0;
    for (let i = 0; i < 60 && same < 4; i += 1) {
      await wait(50);
      if (window.scrollY === last) same += 1;
      else {
        same = 0;
        last = window.scrollY;
      }
    }
  });
}
