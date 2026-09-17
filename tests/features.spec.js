import { test, expect } from '@playwright/test';
import { HIDDEN_SECTIONS, SECTIONS, knownIssue, openLanding } from './support/landing.js';
import { DESKTOP_NAV_MIN_WIDTH, DRAWER_NAV_MAX_WIDTH, showsDesktopNav, showsDrawerNav } from './support/viewports.js';

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

  for (const section of HIDDEN_SECTIONS) {
    test(`renders ${section.name}`, async ({ page }) => {
      knownIssue('PR 7', `${section.name} is commented out as TEMP HIDDEN`);
      await openLanding(page);
      await expect(page.locator(section.selector).first()).toBeVisible();
    });
  }
});

test.describe('navigation', () => {
  test('a way to navigate is visible at every width', async ({ page }) => {
    if (!showsDrawerNav(page) && !showsDesktopNav(page)) {
      knownIssue('PR 4', `no nav between ${DRAWER_NAV_MAX_WIDTH + 1} and ${DESKTOP_NAV_MIN_WIDTH - 1}px (also on the live site)`);
    }
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

test.describe('countdowns', () => {
  for (const [name, selector] of [
    ['hero', '.hf-countdown[data-race-iso]'],
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
