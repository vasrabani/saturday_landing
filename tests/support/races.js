import { test } from '@playwright/test';
import { BRANCHES } from './races-branches.cjs';

// The three pages were captured on Friday 16 October 2026 at 15:43 BST
// with racing on (tools/build-races.mjs): today mid-card (races.html:
// three meetings live, two to come, eight results in), tomorrow's card
// the day before (races-tomorrow.html: Champions Day, the busiest day
// captured, 60 races at 8 meetings) and yesterday's with every result
// in (races-yesterday.html). Nothing on the page counts down from the
// clock, but it is pinned to the capture all the same.
export const RACES_TIME = new Date('2026-10-16T15:43:00+01:00');

export const RACES_PAGES = {
  today: '/races.html',
  tomorrow: '/races-tomorrow.html',
  yesterday: '/races-yesterday.html',
};

// Where the spoiler script remembers the winners a reader has revealed.
export const REVEALED_KEY = 'sr_revealed_races';

// Every band of the page, in page order. Feature tests assert each one
// renders; visual tests screenshot each one. The meeting is the first
// of the day: all five are the same component.
export const RACES_SECTIONS = [
  { name: 'races-masthead', selector: '.browse-masthead' },
  { name: 'races-tabs', selector: '.meeting-nav' },
  { name: 'races-meeting', selector: '.meetings-paper .meeting-block' },
  { name: 'races-notes', selector: '.browse-notes' },
];

// Inside a meeting the layout follows the meeting's own width
// (browse.css, the container queries on .meeting-block): three columns
// from 860px, the time beside the rest from 640px, one column below.
export const MEETING_WIDE_MIN = 860;
export const MEETING_MEDIUM_MIN = 640;

/**
 * Open one of the three pages. The browser can only resolve localhost
 * (see OFFLINE_EXCEPT_LOCALHOST in playwright.config.js), so nothing
 * reaches the live site; every attempt is still recorded in `offsite`
 * for the tests that police them. `revealed` seeds the winners a reader
 * revealed on an earlier visit; `branch` serves a state no capture has
 * (tests/support/races-branches.cjs) in place of the page.
 */
export async function openRaces(page, { day, branch, revealed, waitUntil = 'load' } = {}) {
  const { origin } = new URL(test.info().project.use.baseURL);
  const offsite = [];
  const problems = [];
  const which = day ?? (branch ? BRANCHES[branch].day : 'today');

  if (revealed) {
    await page.addInitScript(([key, ids]) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(ids));
      } catch { /* private mode */ }
    }, [REVEALED_KEY, revealed]);
  }
  if (branch) {
    await page.route(`**${RACES_PAGES[which]}`, async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, body: BRANCHES[branch].change(await response.text()) });
    });
  }

  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) offsite.push(request.url());
  });
  page.on('pageerror', (error) => problems.push(`script error: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });

  await page.clock.setFixedTime(RACES_TIME);
  await page.goto(RACES_PAGES[which], { waitUntil });
  return { offsite, problems };
}

/** The day's meetings, in page order. */
export const meetings = (page) => page.locator('.meetings-paper .meeting-block');

/** The races of one meeting, in running order. */
export const racesOf = (meeting) => meeting.locator('.race-row');

/** A meeting's tab in the pinned bar. */
export const tabOf = (page, n) => page.locator(`.meeting-nav a[href="#meeting-${n}"]`);

/**
 * Wait for a scroll to finish: the site and the tabs scroll smoothly,
 * and a smooth scroll can take a few frames to start, so this waits
 * (up to half a second) for the page to move before waiting for it to
 * stand still.
 */
export async function settled(page) {
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const start = window.scrollY;
    for (let i = 0; i < 20 && window.scrollY === start; i += 1) await wait(25);
    let last = -1;
    let same = 0;
    for (let i = 0; i < 80 && same < 4; i += 1) {
      await wait(50);
      if (window.scrollY === last) same += 1;
      else {
        same = 0;
        last = window.scrollY;
      }
    }
  });
}

/** Scroll a meeting's top to just below the pinned tabs (its scroll-margin), without pressing its tab. */
export async function scrollToMeeting(page, n) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'start', behavior: 'instant' }), `meeting-${n}`);
  await page.waitForTimeout(150);
}

/** The box of an element, as the reader sees it in the window. */
export const box = (locator) => locator.evaluate((el) => el.getBoundingClientRect().toJSON());
