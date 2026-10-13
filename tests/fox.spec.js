/*
 * Fox Signals: what it has to keep doing.
 *
 * The Board (the day's races and the Fox's pick in each), Race Trace
 * (one race's market through the day), Alerts, the Stable and Settings,
 * as a visitor and as a member.
 *
 * These are behaviour tests, not design tests: they say what must still
 * work after a restyle, and they leave every visual decision open.
 */
import { test, expect } from '@playwright/test';
import { FOX_PAGES, axis, openFox, shownRows } from './support/fox.js';

const LOCAL_DEBUG_URL = /\/\/(localhost|127\.0\.0\.1)[:/]/;

test.describe('page health', () => {
  for (const file of FOX_PAGES) {
    test(`${file} loads without script errors or failed requests, and does not scroll sideways`, async ({ page }) => {
      const { problems, offsite } = await openFox(page, file, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle');
      expect(problems).toEqual([]);
      expect(offsite.filter((url) => LOCAL_DEBUG_URL.test(url) || url.includes('clarity.ms'))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('the Board', () => {
  test('opens on the next race, with the finished ones folded away', async ({ page }) => {
    await openFox(page, 'fox-board.html');
    await expect(page.locator('.fxv-done__bar')).toContainText('28 finished races');
    await expect(page.locator('.fxv-row')).toHaveCount(38);
    await expect(shownRows(page)).toHaveCount(10);
    await expect(shownRows(page).first()).toContainText('Next off');
  });

  test('the fold opens to show the finished races, with their results', async ({ page }) => {
    await openFox(page, 'fox-board.html');
    await page.locator('.fxv-done__bar').click();
    await expect(shownRows(page)).toHaveCount(38);
    await expect(page.locator('.fxv-done .fxv-result').first()).toBeVisible();
  });

  test('a visitor is shown the level of conviction and asked to sign up for the figure', async ({ page }) => {
    await openFox(page, 'fox-board.html');
    const row = shownRows(page).first();
    await expect(row.locator('[data-fx-mask="conviction"]')).toBeVisible();
    await expect(row.locator('.fxv-conv__cta')).toHaveAttribute('href', /members\/register/);
    await expect(page.locator('.fxv-conv__fill')).toHaveCount(0);
  });

  test('a member is shown the figure, its bar and the track record', async ({ page }) => {
    await openFox(page, 'fox-board-member.html');
    const row = shownRows(page).first();
    await expect(row.locator('.fxv-conv__pct')).toHaveText(/^\d+$/);
    await expect(row.locator('.fxv-conv__fill')).toHaveCount(1);
    await expect(row.locator('.fxv-conv__note')).toContainText('wins');
    await expect(page.locator('[data-fx-mask]')).toHaveCount(0);
  });

  test('a row holds no link inside a link, and its course is the way into the race', async ({ page }) => {
    await openFox(page, 'fox-board-member.html');
    expect(await page.locator('.fxv-row a a').count()).toBe(0);
    await expect(shownRows(page).first().locator('.fxv-row__link')).toHaveAttribute('href', /fox-race/);
  });

  test('a member can star a race', async ({ page }) => {
    await openFox(page, 'fox-board-member.html');
    // By its race, not by its state: the state is what changes.
    const raceId = await shownRows(page).locator('[data-fx-star][aria-pressed="false"]').first().getAttribute('data-fx-star');
    const star = page.locator(`[data-fx-star="${raceId}"]`);
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/fox-board-member\.html/);
  });

  test('a visitor who presses a members\' room is asked to sign up, and stays on the page', async ({ page }) => {
    await openFox(page, 'fox-board.html');
    await page.locator('[data-fx-locked-tab="stable"]').click();
    await expect(page.locator('#fx-nudge')).toBeVisible();
    await expect(page).toHaveURL(/fox-board\.html/);
  });
});

test.describe('the rooms', () => {
  test('a press on a room changes the page in place, and Back returns', async ({ page }) => {
    await openFox(page, 'fox-board-member.html');
    await page.evaluate(() => { window.__stayed = true; });
    await page.locator('.fxv-nav__rooms a', { hasText: 'Alerts' }).click();
    await expect(page).toHaveURL(/fox-alerts\.html/);
    await expect(page.locator('.fxv-nav__rooms a.fxv-on')).toContainText('Alerts');
    await page.locator('.fxv-nav__rooms a', { hasText: 'Stable' }).click();
    await expect(page).toHaveURL(/fox-stable\.html/);
    await page.goBack();
    await expect(page).toHaveURL(/fox-alerts\.html/);
    // No page was loaded on the way: the window is the one we marked.
    expect(await page.evaluate(() => window.__stayed)).toBe(true);
  });

  test('the Stable lists the member\'s starred races for today as Board rows', async ({ page }) => {
    await openFox(page, 'fox-stable.html');
    await expect(page.locator('.fxv-row')).toHaveCount(2);
    await expect(page.locator('.fxv-row [data-fx-star][aria-pressed="true"]')).toHaveCount(2);
  });
});

test.describe('Race Trace', () => {
  test('draws a line for every runner and lists every runner\'s price', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    await expect(page.locator('.fx-tchart__line')).toHaveCount(9);
    await page.locator('.fx-tchart__readout-list').evaluate((list) => list.classList.add('is-open'));
    await expect(page.locator('.fx-tchart__readout-cell')).toHaveCount(9);
  });

  test('prices read as fractional odds, and the button turns them to decimal and back', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    const now = page.locator('.fx-trace__runner [data-cell="odds"] [data-price]').first();
    expect((await axis(page)).every((label) => label.includes('/'))).toBe(true);
    await expect(now).toHaveText(/\//);
    await page.locator('#fx-tchart-odds-toggle').click();
    expect((await axis(page)).every((label) => /^\d+\.\d\d$/.test(label))).toBe(true);
    await expect(now).toHaveText(/^\d+\.\d\d$/);
    await page.locator('#fx-tchart-odds-toggle').click();
    await expect(now).toHaveText(/\//);
  });

  test('the table gives each runner\'s first price beside its latest', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    const favourite = page.locator('.fx-trace__runner', { hasText: 'Bella Angelina' });
    await expect(favourite.locator('[data-cell="opened"]')).toHaveAttribute('data-frac', '5/6');
    await expect(favourite.locator('[data-cell="odds"]')).toHaveAttribute('data-frac', 'Evs');
  });

  test('pointing at a line says whose it is and its price there', async ({ page }, testInfo) => {
    test.skip(testInfo.project.use.hasTouch, 'a finger cannot hover; a tap is covered by the chart script itself');
    await openFox(page, 'fox-race.html');
    const chart = page.locator('.fx-tchart__svg');
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.boundingBox();
    // The favourite's line runs along the bottom of the chart.
    const ys = await page.locator('.fx-tchart__line').evaluateAll((lines) =>
      lines.map((line) => Number(/,([\d.]+)\s*$/.exec(line.getAttribute('d').trim())[1])));
    const lowest = Math.max(...ys);
    await page.mouse.move(box.x + box.width * 0.9, box.y + (lowest / 260) * box.height);
    await expect(page.locator('.fx-tchart__tip')).toBeVisible();
    await expect(page.locator('.fx-tchart__tip-name')).toContainText('Bella Angelina');
  });

  test('a member opens a signal to its evidence; a visitor is asked once to sign up', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    await expect(page.locator('details.fx-trace__signal-details').first()).toBeVisible();
    await expect(page.locator('.fx-trace__signal-evidence-cta')).toHaveCount(0);
    await openFox(page, 'fox-race-visitor.html');
    await expect(page.locator('.fx-trace__signal-evidence-cta')).toHaveCount(1);
    await expect(page.locator('details.fx-trace__signal-details')).toHaveCount(0);
  });

  test('a finished race is a replay: the result, and where each runner finished', async ({ page }) => {
    await openFox(page, 'fox-race-replay.html');
    await expect(page.locator('.fx-replay__callout')).toContainText('Bombus Pascuorum');
    await expect(page.locator('.fx-trace__runners-head')).toContainText('Fin');
    await expect(page.locator('.fx-trace__runners .fx-fin--1')).toHaveCount(1);
  });
});
