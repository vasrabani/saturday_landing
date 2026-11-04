import { test } from '@playwright/test';

// The Fox's Wire was captured on the morning of Saturday 31 October 2026
// (GMT): the front page, the five articles it leads with and the six
// LLaMa Letters for Ascot that afternoon. The clock is pinned just after
// the last of them was filed, so "3 hrs ago" reads the same every run.
export const NEWS_TIME = new Date('2026-10-31T10:45:00+00:00');

export const FRONT_PAGE = '/news/';

export const ARTICLES = [
  '/news/article/2026/the-deep-dive-bet365-charlie-hall-steeple-chase-grade-2-gbb-race-wetherby-1455/',
  '/news/article/2026/sly-mans-horses-to-watch-saturday-31-october-2026/',
  '/news/article/2026/market-steamers-saturday-31-october-2026/',
  '/news/article/2026/sly-mans-top-rated-saturday-31-october-2026/',
  '/news/article/2026/sly-mans-jockeys-taking-aim-saturday-31-october-2026/',
];

export const LETTERS = ['1250', '1325', '1400', '1433', '1510', '1543'].map((time) => `/letters/ascot-2026-10-31/${time}/`);

export const NEWS_PAGES = [FRONT_PAGE, ...ARTICLES, ...LETTERS];

// The front page's sections, in page order: the masthead, the top
// stories, then §1 to §7 and the 10:00 Card. Feature tests assert the
// order; visual tests screenshot each one.
export const NEWS_SECTIONS = [
  { name: 'news-masthead', selector: '.wire-mast' },
  { name: 'news-top-stories', selector: '.wire-top' },
  { name: 'news-desks', selector: '.wire-pillars' },
  { name: 'news-lead', selector: '#lead' },
  { name: 'news-cases', selector: '#cases' },
  { name: 'news-pin', selector: '#pin' },
  { name: 'news-fold', selector: '#fold' },
  { name: 'news-archive', selector: '#archive' },
  { name: 'news-movers', selector: '#movers' },
  { name: 'news-record', selector: '#record' },
  { name: 'news-card', selector: '#card' },
];

// Where the tour strip remembers it was dismissed (base.html's script).
const TOUR_DISMISSED_KEY = 'sr_demo_banner_dismissed';

/**
 * Open a news page with the clock pinned to the capture. The browser can
 * only resolve localhost (see OFFLINE_EXCEPT_LOCALHOST in
 * playwright.config.js), so nothing reaches the live site; every attempt
 * is still recorded in `offsite` for the test that polices them.
 * `tour: false` opens it as a returning reader, with the site's tour
 * strip already dismissed.
 */
export async function openNews(page, { path = FRONT_PAGE, tour = true, waitUntil = 'load' } = {}) {
  const { origin } = new URL(test.info().project.use.baseURL);
  const offsite = [];
  const problems = [];

  if (!tour) {
    await page.addInitScript((key) => {
      try {
        window.localStorage.setItem(key, '1');
      } catch { /* private mode */ }
    }, TOUR_DISMISSED_KEY);
  }
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) offsite.push(request.url());
  });
  page.on('pageerror', (error) => problems.push(`script error: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });

  await page.clock.setFixedTime(NEWS_TIME);
  await page.goto(path, { waitUntil });
  return { offsite, problems };
}

/** An element's box in page coordinates. */
export const box = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, width: r.width, height: r.height };
  });
