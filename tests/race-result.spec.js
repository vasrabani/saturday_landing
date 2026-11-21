/*
 * One race's full result: what it has to keep doing.
 *
 * The winner first; the finish drawn to scale; every runner in finishing
 * order with its price; how Saturday called it; the market; the race in
 * words; and the way on to the races either side.
 *
 * Behaviour tests, not design tests: every visual decision stays open.
 */
import { test, expect } from '@playwright/test';
import { openRaceResult } from './support/race-result.js';

const LOCAL_DEBUG_URL = /\/\/(localhost|127\.0\.0\.1)[:/]/;

test.describe('page health', () => {
  test('loads without script errors or failed requests', async ({ page }) => {
    const { problems } = await openRaceResult(page, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });

  test('does not scroll horizontally', async ({ page }) => {
    await openRaceResult(page, { waitUntil: 'load' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test('calls no localhost or debug endpoints', async ({ page }) => {
    const { offsite } = await openRaceResult(page);
    await page.waitForLoadState('networkidle');
    expect(offsite.filter((url) => LOCAL_DEBUG_URL.test(url))).toEqual([]);
  });

  test('has one main landmark', async ({ page }) => {
    await openRaceResult(page);
    await expect(page.locator('main')).toHaveCount(1);
  });
});

test.describe('the race and its winner', () => {
  test('names the race, and the winner with its price and connections', async ({ page }) => {
    await openRaceResult(page);
    await expect(page.locator('h1')).toContainText('Betfair Steeple Chase');
    const win = page.locator('.rr-win');
    await expect(win).toContainText('Grey Dawning');
    await expect(win).toContainText('11/10F');
    await expect(win).toContainText('Harry Skelton');
    await expect(win).toContainText('3¾ lengths');
  });

  test("picks out the open race among the meeting's, and it is in view", async ({ page }) => {
    await openRaceResult(page, { waitUntil: 'load' });
    const on = page.locator('.rr-races [aria-current="page"]');
    await expect(on).toHaveCount(1);
    await expect(on).toHaveText('15:00');
    const [row, pill] = await Promise.all([page.locator('.rr-races').boundingBox(), on.boundingBox()]);
    expect(pill.x).toBeGreaterThanOrEqual(row.x - 1);
    expect(pill.x + pill.width).toBeLessThanOrEqual(row.x + row.width + 1);
  });
});

test.describe('at the line', () => {
  test('one lane per finisher, in finishing order', async ({ page }) => {
    await openRaceResult(page);
    await expect(page.locator('.rr-lane .rr-lane__nm')).toHaveText(['Grey Dawning', 'Jagwar', 'Handstands', 'Salver', 'Affordale Fury']);
  });

  test('the winner is at the post and each horse behind is further from it', async ({ page }) => {
    await openRaceResult(page, { waitUntil: 'load' });
    const lanes = await page.locator('.rr-lane').evaluateAll((els) =>
      els.map((el) => {
        const track = el.querySelector('.rr-lane__track').getBoundingClientRect();
        const silk = el.querySelector('.rr-lane__silk').getBoundingClientRect();
        return { post: track.right, at: silk.left + silk.width / 2, left: track.left, silkLeft: silk.left };
      }),
    );
    expect(lanes[0].post - lanes[0].at).toBeLessThan(20);
    for (let i = 1; i < lanes.length; i += 1) expect(lanes[i].at).toBeLessThan(lanes[i - 1].at);
    for (const lane of lanes) expect(lane.silkLeft).toBeGreaterThanOrEqual(lane.left - 1);
  });

  test('a horse beyond the scale is marked as further back than drawn', async ({ page }) => {
    await openRaceResult(page);
    await expect(page.locator('.rr-lane--far .rr-lane__nm')).toHaveText(['Affordale Fury']);
    await expect(page.locator('.rr-lane--far .rr-lane__btn')).toHaveText('38L');
  });
});

test.describe('the full result', () => {
  test('every runner that started, finishers first, each with a price', async ({ page }) => {
    await openRaceResult(page);
    const rows = page.locator('.rr-tbl tbody tr');
    await expect(rows).toHaveCount(7);
    await expect(rows.locator('.res-pos')).toHaveText(['1st', '2nd', '3rd', '4th', '5th', 'PU', 'Fell']);
    for (const sp of await rows.locator('.rr-sp').allInnerTexts()) expect(sp).toMatch(/\d/);
  });

  test('lists the non-runner apart from the runners', async ({ page }) => {
    await openRaceResult(page);
    await expect(page.locator('.rr-nr')).toContainText('Frontal Assault');
    await expect(page.locator('.rr-tbl')).not.toContainText('Frontal Assault');
  });

  test('says how far each price moved from the racecard', async ({ page }) => {
    await openRaceResult(page);
    await expect(page.locator('.rr-tbl tbody tr').first().locator('.rr-move--in')).toHaveText('from 6/4');
    await expect(page.locator('.rr-tbl tbody tr').nth(1).locator('.rr-move--out')).toHaveText('from 6/1');
  });

  test('every horse links to its page', async ({ page }) => {
    await openRaceResult(page);
    const hrefs = await page.locator('.rr-tbl a.rr-horse__nm').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs).toHaveLength(7);
    for (const href of hrefs) expect(href).toMatch(/\/horses\/[a-z0-9-]+\/$/);
  });

  test('keeps each runner a compact card on a phone', async ({ page }) => {
    test.skip(page.viewportSize().width > 640, 'the table is a table above 640px');
    await openRaceResult(page, { waitUntil: 'load' });
    const heights = await page.locator('.rr-tbl tbody tr').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeLessThan(120);
  });
});

test.describe('around the result', () => {
  test('grades how Saturday called it, and the market', async ({ page }) => {
    await openRaceResult(page);
    await expect(page.locator('#rr-calls-h')).toBeVisible();
    await expect(page.locator('.res-v').first()).toContainText('Mr Fox');
    await expect(page.locator('.res-v').first().locator('.res-badge')).toHaveText('Won');
    await expect(page.locator('.rr-mkt dt')).toHaveText(['Favourite', 'Most backed', 'Drifted most', 'Biggest price placed']);
  });

  test('leads on to the races either side and back to the meeting', async ({ page }) => {
    await openRaceResult(page);
    await expect(page.locator('.rr-step--prev')).toContainText('14:25');
    await expect(page.locator('.rr-step--next')).toContainText('15:35');
    await expect(page.locator('.rr-steps__all')).toHaveAttribute('href', /\/results\/2026-11-21\/haydock\/$/);
  });
});
