import { test, expect } from '@playwright/test';
import { RESTORED_SECTIONS, SECTIONS, openLanding } from './support/landing.js';
import { showsDesktopNav, showsDrawerNav } from './support/viewports.js';

const DRAW_FIELD = [
  { name: 'Trawlerman', odds: '5/2' },
  { name: 'Illinois', odds: '40/1' },
  { name: 'Dark Cloud Rising', odds: '7/2' },
];

const LOCAL_DEBUG_URL = /\/\/(localhost|127\.0\.0\.1)[:/]/;

const visibleFlags = (tiles) =>
  tiles.evaluateAll((els) => els.filter((el) => !el.hidden).map((el) => el.dataset.flags.split(/\s+/)));

test.describe('page health', () => {
  test('loads without script errors or failed local requests', async ({ page }) => {
    const { problems } = await openLanding(page);
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });

  test('does not scroll horizontally', async ({ page }) => {
    await openLanding(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('calls no localhost or debug endpoints', async ({ page }) => {
    const { offsite } = await openLanding(page);
    await page.waitForLoadState('networkidle');
    expect(offsite.filter((url) => LOCAL_DEBUG_URL.test(url))).toEqual([]);
  });

  test('loads no third-party analytics in the sandbox', async ({ page }) => {
    const { offsite } = await openLanding(page);
    await page.waitForLoadState('networkidle');
    expect(offsite.filter((url) => url.includes('clarity.ms'))).toEqual([]);
  });
});

test.describe('sections', () => {
  for (const section of SECTIONS) {
    test(`renders ${section.name}`, async ({ page }) => {
      await openLanding(page);
      const element = page.locator(section.selector).first();
      await expect(element).toBeVisible();
      expect((await element.boundingBox()).height).toBeGreaterThan(0);
    });
  }

  for (const section of RESTORED_SECTIONS) {
    test(`renders ${section.name}`, async ({ page }) => {
      await openLanding(page);
      await expect(page.locator(section.selector).first()).toBeVisible();
    });
  }
});

test.describe('navigation', () => {
  test('a way to navigate is visible at every width', async ({ page }) => {
    await openLanding(page);
    const hamburger = page.locator('#navHamburger');
    const desktopLinks = page.locator('.site-nav__links');
    expect((await hamburger.isVisible()) || (await desktopLinks.isVisible())).toBe(true);
  });

  test('desktop dropdowns open one at a time and close on Escape', async ({ page }) => {
    test.skip(!showsDesktopNav(page), 'dropdowns are desktop-only');
    await openLanding(page);
    const dropdowns = page.locator('.site-nav__dropdown');
    const first = dropdowns.nth(0);
    const second = dropdowns.nth(1);

    await first.locator('.site-nav__dropdown-trigger').click();
    await expect(first).toHaveClass(/\bopen\b/);
    await expect(first.locator('.site-nav__dropdown-trigger')).toHaveAttribute('aria-expanded', 'true');
    await expect(first.locator('.site-nav__dropdown-menu')).toBeVisible();

    await second.locator('.site-nav__dropdown-trigger').click();
    await expect(second).toHaveClass(/\bopen\b/);
    await expect(first).not.toHaveClass(/\bopen\b/);

    await page.keyboard.press('Escape');
    await expect(second).not.toHaveClass(/\bopen\b/);
  });

  test('the hamburger is hidden when the desktop nav shows', async ({ page }) => {
    test.skip(!showsDesktopNav(page), 'desktop-only');
    await openLanding(page);
    await expect(page.locator('#navHamburger')).toBeHidden();
  });

  test('mobile drawer opens, expands a section and closes', async ({ page }) => {
    test.skip(!showsDrawerNav(page), 'the drawer is for narrow screens');
    await openLanding(page);
    const hamburger = page.locator('#navHamburger');
    const drawer = page.locator('#mobileDrawer');

    await expect(page.locator('.site-nav__dropdown-trigger').first()).toBeHidden();
    await hamburger.click();
    await expect(drawer).toHaveClass(/\bopen\b/);
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');

    const accordion = drawer.locator('.mob-drawer__accordion').first();
    await accordion.locator('.mob-drawer__accordion-trigger').click();
    await expect(accordion).toHaveClass(/\bopen\b/);
    await expect(accordion.locator('.mob-drawer__accordion-body a').first()).toBeVisible();

    await page.locator('#drawerClose').click();
    await expect(drawer).not.toHaveClass(/\bopen\b/);

    await hamburger.click();
    await expect(drawer).toHaveClass(/\bopen\b/);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toHaveClass(/\bopen\b/);
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
  });
});

// The hero is built to the "Can you beat the Fox?" drawings (November
// 2026): Mr Fox, the headline, the Fox against the Cubs, one button and
// four ways in (five, with the Wire). The drawings leave out three things PR 9 had rebuilt in
// the hero after the redesign dropped them, and which were tested here so
// that they could not go missing quietly a second time: the race detail
// (Runners, Prize fund), the routes into The Pin and Pick 6, and the Big
// Race / Bet of the Day switch. They leave out the hero's countdown too;
// that came back (November 2026, at the client's request) in the race
// line over the duel, with each side's pick under its card. The other
// three are out of the hero on purpose, not quietly.
test.describe('the hero, as drawn', () => {
  test('sets the Fox against the Cubs', async ({ page }) => {
    await openLanding(page);
    const cards = page.locator('#big-race-day .hf-duel__card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('The Fox');
    await expect(cards.nth(0)).toHaveAttribute('href', /tipsters\/mr-fox\//);
    await expect(cards.nth(1)).toContainText('The Cubs');
    await expect(cards.nth(1)).toHaveAttribute('href', /\/cubs\//);
  });

  test('names the featured race and counts down to its off', async ({ page }) => {
    await openLanding(page);
    const race = page.locator('#big-race-day .hf-race');
    await expect(race.locator('.hf-race__card')).toHaveAttribute('href', /races\/4438\/$/);
    await expect(race).toContainText('15:45');
    await expect(race).toContainText('Musselburgh');
    await expect(race.locator('.hf-race__to-off')).toHaveText(/^Off in \d\d:\d\d:\d\d$/i, { useInnerText: true });
    // A day later in every time zone: past the off, before a result.
    await page.clock.setFixedTime(new Date('2026-08-26T12:00:00Z'));
    await expect(race.locator('.hf-race__post')).toBeVisible();
    await expect(race.locator('.hf-race__to-off')).toBeHidden();
  });

  test("shows each side's pick under its card", async ({ page }) => {
    await openLanding(page);
    const picks = page.locator('#big-race-day .hf-duel__card .hf-duel__pick');
    await expect(picks).toHaveCount(2);
    await expect(picks.nth(0)).toHaveText('Dark Cloud Rising 7/2');
    await expect(picks.nth(1)).toHaveText('Voting open');
  });

  test('has one button, into the featured race', async ({ page }) => {
    await openLanding(page);
    const button = page.locator('#big-race-day .hf-ctas__pick');
    await expect(button).toHaveCount(1);
    await expect(button).toContainText('Pick your horse');
    await expect(button).toHaveAttribute('href', /races\/feature\//);
  });

  // The drawings have four; the Wire leads them, at the client's request
  // (November 2026), as the hero's way to the news.
  test('offers five ways in, the Wire first', async ({ page }) => {
    await openLanding(page);
    const ways = page.locator('#big-race-day .hf-explore__link');
    await expect(ways).toHaveCount(5);
    await expect(ways.nth(0)).toContainText('The Fox’s Wire');
    for (const [index, path] of [/\/news\/$/, /\/races\/$/, /\/ai\/tools\/$/, /\/cubs\/$/, /\/news\/honest-record\/$/].entries()) {
      await expect(ways.nth(index)).toHaveAttribute('href', path);
    }
  });
});

// This one was on the live page, dropped by the redesign, and rebuilt in
// PR 9. Tested so it cannot go missing quietly a second time.
test.describe('features the redesign had dropped', () => {
  test('the AI Lab shows what the simulation found', async ({ page }) => {
    await openLanding(page);
    const terminal = page.locator('.al-terminal');
    await terminal.scrollIntoViewIfNeeded();
    await expect(terminal).toBeVisible();
    await expect(terminal).toContainText('RUNNERS LOADED');
    await expect(terminal).toContainText('TOP SIGNAL');
  });
});

// Production added these after the snapshot was taken; they were synced
// in. If the nav is ever regenerated from an older copy, this fails.
test.describe('nav matches production', () => {
  for (const [label, path] of [
    ['Fox Trail', '/trail/'],
    ['Dream Ticket', '/sly-mans-acca/'],
    ['Results', '/results/'],
    ['Accumulators', '/learn/accumulators/'],
  ]) {
    test(`${label} is in the desktop and mobile nav`, async ({ page }) => {
      await openLanding(page);
      const links = page.locator(`a[href$="${path}"]`);
      await expect(links.filter({ has: page.locator('.site-nav__di-name') })).toHaveCount(1);
      await expect(page.locator(`.mob-drawer a[href$="${path}"]`)).toHaveCount(1);
    });
  }
});

// The hero as drawn has no countdown of its own (see "the hero, as
// drawn"); landing.js still runs any .hf-countdown[data-race-iso].
test.describe('countdowns', () => {
  for (const [name, selector] of [
    ['day hub next off', '.day-hub-countdown[data-race-iso]'],
  ]) {
    test(`${name} countdown ticks`, async ({ page }) => {
      await openLanding(page, { clock: 'controlled' });
      const countdown = page.locator(selector).first();
      const read = () => countdown.locator('.hf-cd-hours, .hf-cd-mins, .hf-cd-secs').allTextContents();
      await page.clock.runFor(1_000);
      const before = await read();
      await page.clock.runFor(61_000);
      await expect.poll(read).not.toEqual(before);
    });
  }
});

test.describe('day hub', () => {
  test('course switcher shows one meeting at a time', async ({ page }) => {
    await openLanding(page);
    const hub = page.locator('#day-hub');
    const courses = hub.locator('[data-day-course]');
    const count = await courses.count();
    expect(count).toBeGreaterThan(1);

    for (let i = 0; i < count; i += 1) {
      const course = courses.nth(i);
      const slug = await course.getAttribute('data-day-course');
      await course.click();
      await expect(course).toHaveAttribute('aria-pressed', 'true');
      await expect(hub.locator(`[data-day-hub-meeting][data-meeting-slug="${slug}"]`)).toHaveClass(/\bis-active\b/);
      await expect(hub.locator('[data-day-hub-meeting].is-active')).toHaveCount(1);
    }
  });

  test('the handicap filter shows only handicaps, and All restores every race', async ({ page }) => {
    await openLanding(page);
    const hub = page.locator('#day-hub');
    const tiles = hub.locator('[data-day-races] [data-flags]');
    const total = await tiles.count();

    await hub.locator('[data-day-filter="handicap"]').click();
    await expect(hub.locator('[data-day-filter="handicap"]')).toHaveAttribute('aria-selected', 'true');
    const shown = await visibleFlags(tiles);
    expect(shown.length).toBeGreaterThan(0);
    for (const flags of shown) expect(flags).toContain('handicap');

    await hub.locator('[data-day-filter="all"]').click();
    expect((await visibleFlags(tiles)).length).toBe(total);
  });

  test('the Fox picks filter shows only races the Fox has picked', async ({ page }) => {
    await openLanding(page);
    const hub = page.locator('#day-hub');
    await hub.locator('[data-day-filter="fox"]').click();
    for (const flags of await visibleFlags(hub.locator('[data-day-races] [data-flags]'))) {
      expect(flags).toContain('fox');
    }
  });

  test('a filter never leaves the selected course blank', async ({ page }) => {
    await openLanding(page);
    const hub = page.locator('#day-hub');
    const filters = await hub.locator('[data-day-filter]').evaluateAll((els) => els.map((el) => el.dataset.dayFilter));
    const courses = await hub.locator('[data-day-course]').evaluateAll((els) => els.map((el) => el.dataset.dayCourse));

    for (const filter of filters) {
      await hub.locator(`[data-day-filter="${filter}"]`).click();
      for (const slug of courses) {
        await hub.locator(`[data-day-course="${slug}"]`).click();
        const showsRaces = await hub
          .locator('[data-day-hub-meeting].is-active [data-flags]:not([hidden])')
          .first()
          .isVisible();
        const showsEmptyMessage = await hub.locator('[data-day-empty]').isVisible();
        expect(showsRaces || showsEmptyMessage, `filter "${filter}" on course "${slug}"`).toBe(true);
      }
    }
  });
});

test.describe('tabs', () => {
  test('market intelligence switches between steamers and drifters', async ({ page }) => {
    await openLanding(page);
    const board = page.locator('.mi-board');
    const tabs = board.locator('[data-mi-tab]');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(1);

    for (let i = count - 1; i >= 0; i -= 1) {
      const tab = tabs.nth(i);
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(board).toHaveAttribute('data-mi-mode', await tab.getAttribute('data-mi-tab'));
    }
  });

  test('AI Chamber shows each model when its tab is chosen', async ({ page }) => {
    await openLanding(page);
    const chamber = page.locator('.ai-section--chamber');
    const tabs = chamber.locator('[data-ac-tab]');
    await expect(tabs).toHaveCount(3);

    for (let i = 2; i >= 0; i -= 1) {
      const tab = tabs.nth(i);
      const model = await tab.getAttribute('data-ac-tab');
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');

      const panel = chamber.locator(`#${await tab.getAttribute('aria-controls')}`);
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute('aria-labelledby', await tab.getAttribute('id'));
      await expect(panel.locator('[data-ac-model]')).toHaveText(new RegExp(model, 'i'));
    }
  });

  test('market intelligence lists different horses for steamers and drifters', async ({ page }) => {
    await openLanding(page);
    const board = page.locator('.mi-board');
    const horsesIn = (list) => board.locator(`${list} .mi-row__horse`).allTextContents();

    await board.locator('[data-mi-tab="steamers"]').click();
    const steamers = await horsesIn('.mi-list--steamers');
    await board.locator('[data-mi-tab="drifters"]').click();
    await expect(board.locator('.mi-list--drifters')).toBeVisible();
    await expect(board.locator('.mi-list--steamers')).toBeHidden();

    const drifters = await horsesIn('.mi-list--drifters');
    expect(drifters.length).toBeGreaterThan(0);
    expect(drifters).not.toEqual(steamers);
  });

  test('AI Chamber shows one model panel at a time', async ({ page }) => {
    await openLanding(page);
    const chamber = page.locator('.ai-section--chamber');
    const panels = chamber.locator('[role="tabpanel"]');
    await expect(panels).toHaveCount(3);

    await chamber.locator('[data-ac-tab="gemini"]').click();
    await expect(chamber.locator('#ac-panel-gemini')).toBeVisible();
    await expect(chamber.locator('#ac-panel-claude')).toBeHidden();
    await expect(chamber.locator('#ac-panel-chatgpt')).toBeHidden();
  });

  for (const [name, selector] of [
    ['AI Chamber', '.ai-section--chamber'],
    ['market intelligence', '.mi-board'],
  ]) {
    test(`${name} tabs move with the arrow keys`, async ({ page }) => {
      await openLanding(page);
      const tabs = page.locator(`${selector} [role="tab"]`);
      await tabs.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(tabs.nth(1)).toBeFocused();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    });
  }
});

test.describe('saturday draw', () => {
  test('with no field loaded, the draw button is disabled and says so', async ({ page }) => {
    await openLanding(page);
    await expect(page.locator('#drawBtn')).toBeDisabled();
    await expect(page.locator('#drawBtnText')).toHaveText('NO FIELD LOADED');
  });

  test('with a field loaded, drawing reveals one of the runners', async ({ page }) => {
    await openLanding(page, { runners: DRAW_FIELD, clock: 'real' });
    const button = page.locator('#drawBtn');
    await expect(button).toBeEnabled();
    await button.click();

    const horse = page.locator('#drawHorse');
    await expect(horse).toHaveClass(/\breveal\b/, { timeout: 10_000 });
    expect(DRAW_FIELD.map((runner) => runner.name)).toContain((await horse.textContent()).trim());
    await expect(page.locator('#drawBtnText')).toHaveText('DRAW AGAIN');
  });
});

test.describe('motion', () => {
  test('cards tilt under a mouse pointer and stay flat on touch screens', async ({ page }) => {
    await openLanding(page);
    const card = page.locator('.day-hub .day-card--featured').first();
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2);
    const transform = await card.evaluate((el) => el.style.transform);

    if (test.info().project.use.hasTouch) {
      expect(transform).toBe('');
    } else {
      expect(transform).toContain('rotateX');
    }
  });

  test.describe('with reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    // Without reduced motion, content below the fold stays hidden until it
    // is scrolled to; with it, everything shows once site.js has booted.
    test('reveal-on-scroll content is shown without scrolling', async ({ page }) => {
      await openLanding(page);
      const stillHidden = () =>
        page
          .locator('[data-reveal]')
          .evaluateAll((els) => els.filter((el) => Number(getComputedStyle(el).opacity) < 1).length);
      await expect.poll(stillHidden, { timeout: 5_000 }).toBe(0);
    });
  });
});
