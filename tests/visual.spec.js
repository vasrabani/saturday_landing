/*
 * Visual comparison against the design reference commit.
 *
 * ADVISORY, not a gate (see README).
 *
 * The battle section used to differ run to run on the same code. The
 * cause was not the rasteriser: the hide rules below were passed to
 * toHaveScreenshot as `style`, an option it does not have (it takes
 * `stylePath`, a file), so Playwright ignored them and compared the random
 * TV-static canvas pixel for pixel. They are now injected into the page.
 *
 * Use it to review a diff before and after a change, not as a pass/fail.
 */
import { test, expect } from '@playwright/test';
import { FIXED_CHROME, NON_DETERMINISTIC_ART, SECTIONS, openLanding } from './support/landing.js';
import { showsDesktopNav, showsDrawerNav } from './support/viewports.js';

const RANDOM_SEED = 20260825;

// Injected into the page before its screenshots, with page.addStyleTag:
// toHaveScreenshot has no `style` option, and silently ignores one. Hiding
// beats masking here: a section taller than the viewport is captured in
// strips, and mask rectangles are placed from one scroll position, so they
// land in the wrong strip. The same CSS is injected for the reference
// images and the comparison, so what is hidden is simply outside the
// comparison. Descendants are hidden too, because some of them (the nav's
// Login link) set their own visibility and would show through.
const hide = (selectors) =>
  `${selectors.flatMap((s) => [s, `${s} *`]).join(', ')} { visibility: hidden !important; }`;

// The site scrolls smoothly, so a scripted scrollTo would still be moving
// when the tile is captured. Sections scroll instantly instead.
const INSTANT_SCROLL = 'html { scroll-behavior: auto !important; }';

// Nav shots keep the fixed chrome, since the nav is the subject.
const NAV_STYLE = hide(NON_DETERMINISTIC_ART);
const SECTION_STYLE = [hide(FIXED_CHROME), NAV_STYLE, INSTANT_SCROLL].join('\n');

// Seeded Math.random so randomised effects paint identically every run.
function seedRandom(seed) {
  let state = seed;
  Math.random = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

// Load every image up front rather than when it scrolls into view, so
// waiting for `load` is enough and no scroll pass is needed. Scrolling a
// 17,000px page frame by frame is too slow on this machine.
function loadImagesEagerly() {
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.tagName === 'IMG') node.loading = 'eager';
      }
    }
  }).observe(document, { childList: true, subtree: true });
}

// The same for section backgrounds: defer-bg.js holds them until a section
// nears the screen, which would leave each capture racing its own images.
// Switching deferral off at DOMContentLoaded requests them all before the
// `load` event, so the screenshots show the finished page.
function loadBackgroundsEagerly() {
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.remove('bg-defer');
  });
}

// Everything painted and still: fonts loaded, and scroll reveals shown
// (they are keyed to scrolling, which screenshots never do).
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('revealed'));
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(seedRandom, RANDOM_SEED);
  await page.addInitScript(loadImagesEagerly);
  await page.addInitScript(loadBackgroundsEagerly);
  await openLanding(page, { waitUntil: 'load' });
  await settle(page);
});

test('nav bar', async ({ page }) => {
  await page.addStyleTag({ content: NAV_STYLE });
  await expect(page.locator('.site-nav')).toHaveScreenshot('nav.png');
});

test('nav menu open', async ({ page }) => {
  await page.addStyleTag({ content: NAV_STYLE });
  if (showsDrawerNav(page)) {
    await page.locator('#navHamburger').click();
    await page.locator('#mobileDrawer .mob-drawer__accordion-trigger').first().click();
    await expect(page).toHaveScreenshot('nav-drawer-open.png');
  } else {
    await page.locator('.site-nav__dropdown-trigger').first().click();
    await expect(page).toHaveScreenshot('nav-dropdown-open.png');
  }
});

// A section taller than the window is captured as a series of screen-sized
// tiles at fixed scroll positions, rather than as one tall element
// screenshot. Playwright builds those by scrolling and stitching, and this
// page paints differently as it scrolls (parallax, entry animations, lazy
// decoding), so no two stitched captures ever matched.
const MAX_TILES = 6;
const PAINT_SETTLE_MS = 250;

for (const section of SECTIONS) {
  test(`section: ${section.name}`, async ({ page }) => {
    await page.addStyleTag({ content: SECTION_STYLE });
    const height = await page
      .locator(section.selector)
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().height));
    const windowHeight = page.viewportSize().height;
    const tiles = Math.min(Math.ceil(height / windowHeight), MAX_TILES);

    for (let tile = 0; tile < tiles; tile += 1) {
      // Scroll by the section's own position, re-read every time: content
      // above can still be settling, which would drift a fixed target by a
      // few pixels and show up as a whole-tile difference.
      await page.evaluate(
        ([selector, offset]) => {
          const el = document.querySelector(selector);
          const target = Math.round(el.getBoundingClientRect().top + window.scrollY) + offset;
          window.scrollTo(0, target);
        },
        [section.selector, tile * windowHeight],
      );
      await page.waitForTimeout(PAINT_SETTLE_MS);
      const name = tiles === 1 ? `${section.name}.png` : `${section.name}-${tile + 1}.png`;
      await expect(page).toHaveScreenshot(name);
    }
  });
}
