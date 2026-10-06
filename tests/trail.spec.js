/*
 * The Fox Trail: what the page has to keep doing.
 *
 * The trail is not a still page. Races settle while it is open, the fox
 * marker moves, the counter ticks, cells flip to their result, the legend
 * filters the grid and a cell opens a drawer of the sources behind it.
 * The sandbox serves a recorded day (fixtures/trail-live-timeline.json)
 * so all of that runs here exactly as it does in production.
 *
 * These are behaviour tests, not design tests: they say what must still
 * work after a restyle, and they leave every visual decision open.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import {
  CELL_STATES, CELL_TIERS, TRAIL_SECTIONS, cellStates, openLegend, openTrail, raceCards, rewriteTrail,
} from './support/trail.js';

const LOCAL_DEBUG_URL = /\/\/(localhost|127\.0\.0\.1)[:/]/;

test.describe('page health', () => {
  test('loads without script errors or failed requests', async ({ page }) => {
    const { problems } = await openTrail(page, { live: false, waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });

  test('does not scroll horizontally', async ({ page }) => {
    await openTrail(page, { live: false, waitUntil: 'load' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('calls no localhost or third-party endpoints', async ({ page }) => {
    const { offsite } = await openTrail(page, { live: false });
    await page.waitForLoadState('networkidle');
    expect(offsite.filter((url) => LOCAL_DEBUG_URL.test(url))).toEqual([]);
  });
});

test.describe('the board', () => {
  for (const section of TRAIL_SECTIONS) {
    test(`renders ${section.name}`, async ({ page }) => {
      await openTrail(page, { live: false });
      // The legend is an off-canvas panel below 1280px; the rest of the
      // page is always on screen.
      if (section.name === 'trail-legend') await openLegend(page);
      await expect(page.locator(section.selector).first()).toBeVisible();
    });
  }

  test('every race is a cell the scripts can find', async ({ page }) => {
    await openTrail(page, { live: false });
    const cells = await cellStates(page);
    expect(cells.length).toBeGreaterThan(20);
    // data-race-id is how the live poller matches a cell to its race.
    expect(cells.filter((cell) => !cell.raceId)).toEqual([]);
    expect(cells.filter((cell) => !cell.state)).toEqual([]);
  });

  test('the sandbox day still shows every state and tier', async ({ page }) => {
    await openTrail(page, { live: false });
    const cells = await cellStates(page);
    const states = new Set(cells.map((cell) => cell.state));
    const tiers = new Set(cells.filter((cell) => cell.tier).map((cell) => Number(cell.tier)));
    expect([...CELL_STATES].filter((state) => !states.has(state)), 'states missing from the page').toEqual([]);
    expect([...CELL_TIERS].filter((tier) => !tiers.has(tier)), 'tiers missing from the page').toEqual([]);
  });

  test('exactly one cell is the fox marker', async ({ page }) => {
    await openTrail(page, { live: false });
    expect((await cellStates(page)).filter((cell) => cell.isNow)).toHaveLength(1);
  });
});

test.describe('legend filters', () => {
  test('a source filter narrows the grid, and clicking it again restores it', async ({ page }) => {
    await openTrail(page, { live: false });
    await openLegend(page);
    const grid = page.locator('#trailGrid');
    const button = page.locator('[data-filter-source]').first();
    const source = await button.getAttribute('data-filter-source');
    const before = (await cellStates(page)).filter((cell) => !cell.hidden).length;

    await button.click();
    await expect(grid).toHaveClass(/trail__grid--filtered/);
    const shown = await page.locator('#trailGrid article.cell:not(.cell--ghost)').evaluateAll(
      (cells, src) => cells.filter((cell) => (cell.dataset.sources || '').includes(src)).length,
      source,
    );
    expect(shown, `cells left for ${source}`).toBeGreaterThan(0);

    await button.click();
    await expect(grid).not.toHaveClass(/trail__grid--filtered/);
    expect((await cellStates(page)).filter((cell) => !cell.hidden).length).toBe(before);
  });

  test('a tier filter works the same way', async ({ page }) => {
    await openTrail(page, { live: false });
    await openLegend(page);
    const button = page.locator('[data-filter-tier]').first();
    await button.click();
    await expect(page.locator('#trailGrid')).toHaveClass(/trail__grid--filtered/);
    await button.click();
    await expect(page.locator('#trailGrid')).not.toHaveClass(/trail__grid--filtered/);
  });
});

test.describe('cell drawer', () => {
  test('opens on a cell, names its sources, and closes on Escape', async ({ page }) => {
    await openTrail(page, { live: false });
    const drawer = page.locator('#cellDrawer');
    // trail_drawer.js flags the open drawer on <body>, which is what the
    // CSS keys off; the drawer element itself does not change class.
    const body = page.locator('body');

    // Clicking a link or button inside a cell follows it instead; the
    // drawer opens from the cell's own surface, so aim at its corner.
    await page.locator('#trailGrid .cell[data-cell-index]').first().click({ position: { x: 6, y: 6 } });
    await expect(body).toHaveClass(/has-cell-drawer-open/);
    await expect(drawer.locator('[data-role="drawer-sources"]')).not.toBeEmpty();
    await expect(drawer.locator('[data-role="drawer-sources"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(body).not.toHaveClass(/has-cell-drawer-open/);
  });
});

test.describe('result flip', () => {
  test('the reveal toggle turns settled cells over and back', async ({ page }) => {
    await openTrail(page, { live: false });
    const toggle = page.locator('[data-role="reveal-toggle"]');
    const flipped = page.locator('#trailGrid .cell.is-flipped');
    const settled = await page.locator('#trailGrid .cell[data-settled="1"]').count();

    await expect(flipped).toHaveCount(0);
    await toggle.click();
    await expect(flipped).toHaveCount(settled);
    await expect(flipped.first()).toBeVisible();
    // Only settled races have a result to show.
    const states = await flipped.evaluateAll((cells) =>
      cells.map((cell) => (cell.className.match(/cell--(pending|live|won|placed|lost|void|no_fancy)/) || [])[1]));
    expect(states.filter((state) => ['pending', 'live'].includes(state))).toEqual([]);

    await toggle.click();
    await expect(flipped).toHaveCount(0);
  });
});

test.describe('course bar', () => {
  const part = (page, role) => page.locator(`[data-role="course-${role}"]`);

  test('steps one race at a time and says where it went', async ({ page }) => {
    await openTrail(page, { live: false });
    const cards = raceCards(page);
    await expect(part(page, 'number')).toHaveText('1');
    await expect(part(page, 'total')).toHaveText(String(await cards.count()));
    await expect(part(page, 'prev')).toBeDisabled();

    await part(page, 'next').click();
    await expect(part(page, 'number')).toHaveText('2');
    await expect(cards.nth(1)).toHaveClass(/cell--just-reached/);
    await expect(cards.nth(1)).toBeInViewport();
    // The button keeps the focus so it can be pressed again; a polite
    // status line says where the page went instead.
    await expect(part(page, 'next')).toBeFocused();
    await expect(part(page, 'status')).toHaveText(/^Race 2 of \d+, /);

    await part(page, 'prev').click();
    await expect(part(page, 'number')).toHaveText('1');
    await expect(part(page, 'prev')).toBeDisabled();
  });

  test('"Mr Fox" goes to the fox marker and takes the keyboard there', async ({ page }) => {
    await openTrail(page, { live: false });
    const fox = page.locator('#trailGrid .cell--now');
    await part(page, 'fox').click();
    await expect(fox).toBeFocused();
    await expect(fox).toBeInViewport();
    await expect(fox).toHaveClass(/cell--just-reached/);
  });

  test('the call under the introduction names the fox marker\'s race, and goes to it', async ({ page }) => {
    await openTrail(page, { live: false });
    const fox = page.locator('#trailGrid .cell--now');
    const time = (await fox.locator('.cell__time').textContent()).trim();
    const course = (await fox.locator('.cell__course').textContent()).trim();
    const call = page.locator('[data-role="next-race"]');
    await expect(call.locator('[data-role="next-name"]')).toHaveText(`${time} ${course}`);

    await call.click();
    await expect(fox).toBeFocused();
    await expect(fox).toBeInViewport();
  });

  test('arrow keys step from the card that has the focus', async ({ page }) => {
    await openTrail(page, { live: false });
    const cards = raceCards(page);
    await cards.nth(2).focus();
    await page.keyboard.press('ArrowRight');
    await expect(cards.nth(3)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(cards.nth(2)).toBeFocused();
  });

  test('arrow keys leave the page alone when nothing is focused and the board is out of sight', async ({ page }) => {
    await openTrail(page, { live: false });
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await expect(page.locator('#trailGrid')).not.toBeInViewport();
    const before = await page.evaluate(() => window.scrollY);

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400); // a step would have set the page scrolling by now
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  });

  test('the map has a tick a race, and a race with no pick counts as run once the fox marker is past it', async ({ page }) => {
    await openTrail(page, { live: false });
    const cells = (await cellStates(page)).filter((cell) => !cell.hidden);
    const fox = cells.findIndex((cell) => cell.isNow);
    const expected = cells.map((cell, i) => {
      if (cell.state === 'won' || cell.state === 'live') return cell.state;
      if (['placed', 'lost', 'void'].includes(cell.state)) return 'run';
      return cell.state === 'no_fancy' && i < fox ? 'run' : 'to come';
    });
    // The fixture has to put the rule to the test.
    expect(cells.some((cell, i) => cell.state === 'no_fancy' && i < fox), 'a race with no pick behind the fox marker').toBe(true);

    const ticks = page.locator('.course__tick');
    await expect(ticks).toHaveCount(cells.length);
    const shown = await ticks.evaluateAll((els) =>
      els.map((el) => ['won', 'run', 'live'].find((kind) => el.classList.contains(`is-${kind}`)) ?? 'to come'));
    expect(shown).toEqual(expected);
    await expect(ticks.nth(fox)).toHaveClass(/is-now/);
  });

  test('a link to a section the page does not have is put away', async ({ page }) => {
    // A past day is rendered without its spotlight.
    await rewriteTrail(page, (html) => html.replace(' id="trailSignals"', ''));
    await openTrail(page, { live: false });
    await expect(page.locator('.course__link[href="#trailSignals"]')).toHaveJSProperty('hidden', true);
    await expect(page.locator('.course__link[href="#trailRecord"]')).toHaveJSProperty('hidden', false);
  });

  test.describe('on a morning with nothing run yet', () => {
    const morning = (html) =>
      html.replace(/cell--(?:won|placed|lost|void|live)\b/g, 'cell--pending').replace(/ data-settled="1"/g, '');

    test('the reveal toggle waits for a result', async ({ page }) => {
      await rewriteTrail(page, morning);
      await openTrail(page, { live: false });
      await expect(page.locator('[data-role="reveal-toggle"]')).toBeDisabled();
    });

    test('a results choice kept from another day can still be switched off', async ({ page }) => {
      await rewriteTrail(page, morning);
      await openTrail(page, { live: false, revealed: true });
      const toggle = page.locator('[data-role="reveal-toggle"]');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle).toBeEnabled();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

test.describe('the track', () => {
  test('is drawn under the cards, with hoof prints as far as the fox marker', async ({ page }) => {
    await openTrail(page, { live: false, waitUntil: 'load' });
    const track = page.locator('[data-role="track"]');
    await expect(track).toHaveClass(/is-drawn/);
    await expect(track).toHaveCSS('pointer-events', 'none');
    expect(await track.locator('path').first().getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+H/);

    const prints = await track.locator('.track__hoof').count();
    const run = await track.locator('.track__hoof.is-run').count();
    expect(prints).toBeGreaterThan(0);
    // The fixture's fox marker is partway round.
    expect(run).toBeGreaterThan(0);
    expect(run).toBeLessThan(prints);
  });

  test('is drawn again when the board changes width', async ({ page }) => {
    await openTrail(page, { live: false, waitUntil: 'load' });
    await expect(page.locator('[data-role="track"]')).toHaveClass(/is-drawn/);
    const outline = () => page.locator('[data-role="track-rails"] path').first().getAttribute('d');
    const before = await outline();
    const { width, height } = page.viewportSize();
    await page.setViewportSize({ width: width - 48, height });
    await expect.poll(outline).not.toBe(before);
  });
});

test.describe('race cards', () => {
  test('a name that is one long word is sized to fit', async ({ page }) => {
    await openTrail(page, { live: false, waitUntil: 'load' });
    const name = page.locator('#trailGrid .cell__horse').first();
    const natural = await name.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    await name.evaluate((el) => { el.textContent = 'Sunriseontheboynewater'; });

    // Names are fitted again when the board changes width.
    const { width, height } = page.viewportSize();
    await page.setViewportSize({ width: width - 48, height });
    await expect
      .poll(() => name.evaluate((el) => el.style.getPropertyValue('--cell-horse-size')))
      .toMatch(/^\d+(\.5)?px$/);
    const fitted = await name.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fitted).toBeLessThan(natural);
    expect(fitted).toBeGreaterThanOrEqual(11);
  });

  test('cards in the window are there from the start, and the rest come up when reached', async ({ page }) => {
    await openTrail(page, { live: false });
    const cards = raceCards(page);
    const { height } = page.viewportSize();
    const atLoad = await cards.evaluateAll((els) =>
      els.map((el) => ({ top: el.getBoundingClientRect().top, opacity: getComputedStyle(el).opacity })));
    expect(atLoad.filter((card) => card.top < height && card.opacity !== '1')).toEqual([]);

    const last = cards.last();
    await expect(last).toHaveCSS('opacity', '0');
    await last.scrollIntoViewIfNeeded();
    await expect(last).toHaveClass(/is-seen/);
    await expect(last).toHaveCSS('opacity', '1');
  });

  test.describe('with reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('every card is on the board at once', async ({ page }) => {
      await openTrail(page, { live: false });
      const waiting = await raceCards(page).evaluateAll((els) =>
        els.filter((el) => getComputedStyle(el).opacity !== '1').length);
      expect(waiting).toBe(0);
      await expect(page.locator('main.trail')).not.toHaveClass(/trail--entrance/);
    });
  });
});

test.describe('a day with no race cards', () => {
  test('shows its notice without the course bar, the call or the course', async ({ page }) => {
    await openTrail(page, { live: false });
    // What the template renders on a day with no racing: the notice in
    // the frame, where the board would be.
    const notice = readFileSync(join(process.cwd(), 'partials', 'trail-empty.html'), 'utf8');
    await page.evaluate((html) => {
      document.getElementById('trailGrid').remove();
      document.querySelector('.trail__frame').insertAdjacentHTML('beforeend', html);
    }, notice);

    await expect(page.locator('.trail__empty')).toBeVisible();
    await expect(page.locator('.trail__course')).toBeHidden();
    await expect(page.locator('.trail__next')).toBeHidden();
    await expect(page.locator('.trail__frame')).toHaveCSS('padding-top', '0px');
    await expect(page.locator('.trail__frame')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });
});

test.describe('live day', () => {
  // These watch several polls go by, so they need more than the
  // default budget when the machine is busy with the other widths.
  test.slow();

  test('races settle, the counter moves and the fox follows', async ({ page }) => {
    await openTrail(page, { pollMs: 600 });
    const counter = page.locator('[data-role="pending-count"]');
    const before = { cells: await cellStates(page), pending: await counter.textContent() };

    await expect
      .poll(async () => (await cellStates(page)).filter((cell) => cell.state === 'pending').length,
        { timeout: 20_000 })
      .toBeLessThan(before.cells.filter((cell) => cell.state === 'pending').length);

    expect(await counter.textContent(), 'pending count').not.toBe(before.pending);

    // The marker is removed from the settled cell and added to the next
    // one, so poll for it rather than reading between the two.
    const foxBefore = before.cells.findIndex((cell) => cell.isNow);
    await expect
      .poll(async () => (await cellStates(page)).findIndex((cell) => cell.isNow), { timeout: 15_000 })
      .not.toBe(foxBefore);
    // Never two foxes: the marker belongs to one race at a time, and goes
    // altogether once the last race has run.
    const counts = [];
    for (let i = 0; i < 6; i += 1) {
      counts.push((await cellStates(page)).filter((cell) => cell.isNow).length);
      await page.waitForTimeout(400);
    }
    expect(Math.max(...counts), 'markers on the board at once').toBeLessThanOrEqual(1);
  });

  test('polling stops once the day is final', async ({ page }) => {
    // Jump straight to the last frame: every race settled, is_final true.
    await page.route('**/trail/live/**', (route) => route.continue({ url: `${new URL(route.request().url()).origin}/trail/live/?sim=last` }));
    const { polls } = await openTrail(page, { pollMs: 400 });
    await expect.poll(() => polls.length, { timeout: 15_000 }).toBeGreaterThan(0);
    const settled = polls.length;
    await page.waitForTimeout(3000);
    expect(polls.length, 'no further polls after is_final').toBeLessThanOrEqual(settled + 1);
  });

  test('once the day is run the bar, the call and the track all say so', async ({ page }) => {
    await page.route('**/trail/live/**', (route) => route.continue({ url: `${new URL(route.request().url()).origin}/trail/live/?sim=last` }));
    await openTrail(page, { pollMs: 400 });
    await expect(page.locator('#trailFreshness')).toHaveClass(/is-final/, { timeout: 15_000 });

    // The fox marker has left the board, and the way to it with it.
    await expect(page.locator('[data-role="course-fox"]')).toBeHidden();
    const gold = (await page.locator('[data-role="gold-count"]').textContent()).trim();
    await expect(page.locator('[data-role="next-lead"]')).toHaveText('The day is run:');
    await expect(page.locator('[data-role="next-name"]')).toHaveText(new RegExp(`^${gold} `));
    // No race is left "to come", with or without a pick...
    await expect(page.locator('.course__tick:not(.is-won):not(.is-run)')).toHaveCount(0);
    // ...and every hoof print on the track is behind the day.
    await expect(page.locator('.track__hoof:not(.is-run)')).toHaveCount(0);
    expect(await page.locator('.track__hoof').count()).toBeGreaterThan(0);
  });
});
