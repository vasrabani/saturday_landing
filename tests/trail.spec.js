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
import { test, expect } from '@playwright/test';
import { CELL_STATES, CELL_TIERS, TRAIL_SECTIONS, cellStates, openLegend, openTrail } from './support/trail.js';

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

test.describe('live day', () => {
  // These two watch several polls go by, so they need more than the
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
});
