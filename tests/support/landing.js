import { test } from '@playwright/test';

// The day the snapshot was captured. Countdowns and "next off" logic are
// computed from the clock, so every run pins time to this morning.
export const SNAPSHOT_TIME = new Date('2026-08-25T12:00:00+01:00');

// Every section of the landing page, in page order. Feature tests assert
// each one renders; visual tests screenshot each one.
export const SECTIONS = [
  { name: 'hero', selector: '#big-race-day' },
  { name: 'editorial-shelf', selector: '.land-shelf' },
  { name: 'day-hub', selector: '#day-hub' },
  { name: 'market-intelligence', selector: '.money-moves' },
  { name: 'battle', selector: '#the-battle' },
  { name: 'den', selector: '#ask-den' },
  { name: 'ai-chamber', selector: '#ai-chamber' },
  { name: 'ai-lab', selector: '#ai-lab' },
  { name: 'how-it-works', selector: '#how-it-works' },
  { name: 'challenges', selector: '#challenges' },
  { name: 'saturday-draw', selector: '#saturday-draw' },
  { name: 'footer', selector: 'footer.sf' },
];

// Live-site sections the redesign commented out ("TEMP HIDDEN").
export const HIDDEN_SECTIONS = [
  { name: 'syndicates', selector: '#syndicates' },
  { name: 'track-record', selector: '.results-section' },
  { name: 'final-cta', selector: '.final-cta-section' },
];

// Chrome that is position:fixed. Hidden while screenshotting a section so
// it doesn't paint over whatever happens to be scrolled beneath it.
export const FIXED_CHROME = ['.site-nav', '.ticker-bar--hero-foot', '.scroll-progress', '.demo-banner'];

// Decoration that paints differently from one moment to the next: the
// TV-static canvas, the battle card's binary rain (reshuffles every 800ms)
// and the Saturday Draw's idle name cycle (every 1.6s, at a random
// opacity). Masked in screenshots so a section's real content is what gets
// compared. Freezing the clock instead is not an option: it also freezes
// the animation frames Playwright needs to capture a screenshot.
export const NON_DETERMINISTIC_ART = [
  'canvas',
  '.battle-static',
  '.battle-card__fox-binary',
  '#drawHorse',
  '#drawPreLabel',
];

// Replace the Saturday Draw's runner list the moment the parser inserts it.
// Mutation callbacks run before the next parser-inserted script executes,
// so landing.js reads the injected field as if the server had sent it.
function injectDrawRunners(runnersJson) {
  new MutationObserver((mutations, observer) => {
    const island = document.getElementById('saturday-draw-runners');
    if (!island) return;
    island.textContent = runnersJson;
    observer.disconnect();
  }).observe(document, { childList: true, subtree: true });
}

/**
 * Open the landing page. The browser can only resolve localhost (see
 * OFFLINE_EXCEPT_LOCALHOST in playwright.config.js), so analytics and stray
 * debug endpoints never reach anything; every attempt is still recorded in
 * `offsite` for the tests that police them.
 *
 * Feature tests only need the scripts booted (DOMContentLoaded); visual
 * tests pass `waitUntil: 'load'` so every image has painted.
 */
export async function openLanding(page, { runners, clock = 'fixed', waitUntil = 'domcontentloaded' } = {}) {
  const { origin } = new URL(test.info().project.use.baseURL);
  const offsite = [];
  const problems = [];

  if (runners) await page.addInitScript(injectDrawRunners, JSON.stringify(runners));

  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) offsite.push(request.url());
  });
  page.on('pageerror', (error) => problems.push(`script error: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });

  if (clock === 'fixed') await page.clock.setFixedTime(SNAPSHOT_TIME);
  if (clock === 'controlled') await page.clock.install({ time: SNAPSHOT_TIME });

  await page.goto('/', { waitUntil });
  return { offsite, problems };
}

/** Mark a test as a known defect that a named upgrade PR fixes. It must
 * fail today; when the fix lands Playwright reports it as unexpectedly
 * passing, which forces the marker to be removed in that PR. */
export function knownIssue(pr, reason) {
  test.fail(true, `Known issue, fixed in ${pr}: ${reason}`);
}
