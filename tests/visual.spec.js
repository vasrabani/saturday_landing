/*
 * Visual comparison against the design reference commit.
 *
 * ADVISORY, not a gate (see README). Most sections compare cleanly, but a
 * few - battle, market intelligence, DEN - still differ run to run on the
 * same code. Their full-bleed art layers combine large blurs with
 * `mix-blend-mode`, and this page's images decode late, so the rasteriser
 * does not produce identical pixels twice. PR 3 (images) and PR 4 (the
 * title-clamp race) remove most of that; this becomes a CI gate after them.
 *
 * Use it to review a diff before and after a change, not as a pass/fail.
 */
import { test, expect } from '@playwright/test';
import { FIXED_CHROME, NON_DETERMINISTIC_ART, SECTIONS, openLanding } from './support/landing.js';
import { showsDesktopNav, showsDrawerNav } from './support/viewports.js';

const RANDOM_SEED = 20260825;

// Injected while a screenshot is taken. Hiding beats masking here: a
// section taller than the viewport is captured in strips, and mask
// rectangles are placed from one scroll position, so they land in the
// wrong strip. The same CSS is injected for the reference images and the
// comparison, so what is hidden is simply outside the comparison.
const hide = (selectors) => `${selectors.join(', ')} { visibility: hidden !important; }`;

// Nav shots keep the fixed chrome, since the nav is the subject.
const NAV_STYLE = hide(NON_DETERMINISTIC_ART);
const SECTION_STYLE = [hide(FIXED_CHROME), NAV_STYLE].join('\n');

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
  await openLanding(page, { waitUntil: 'load' });
  await settle(page);
});

test('nav bar', async ({ page }) => {
  await expect(page.locator('.site-nav')).toHaveScreenshot('nav.png', { style: NAV_STYLE });
});

test('nav menu open', async ({ page }) => {
  test.skip(!showsDrawerNav(page) && !showsDesktopNav(page), 'no nav menu at this width (known issue, PR 5)');
  if (showsDrawerNav(page)) {
    await page.locator('#navHamburger').click();
    await page.locator('#mobileDrawer .mob-drawer__accordion-trigger').first().click();
    await expect(page).toHaveScreenshot('nav-drawer-open.png', { style: NAV_STYLE });
  } else {
    await page.locator('.site-nav__dropdown-trigger').first().click();
    await expect(page).toHaveScreenshot('nav-dropdown-open.png', { style: NAV_STYLE });
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
      await expect(page).toHaveScreenshot(name, { style: SECTION_STYLE });
    }
  });
}
