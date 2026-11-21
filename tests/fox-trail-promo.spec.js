/*
 * The Fox Trail on the home page: what it has to keep doing.
 *
 * It sits between the editorial shelf and Today's racing, sells the
 * trail with the day's real numbers, shows a stretch of real trail
 * cards around the next race off, and sends the visitor to the trail.
 *
 * Behaviour tests, not design tests: every visual decision stays open.
 */
import { test, expect } from '@playwright/test';
import { openLanding } from './support/landing.js';

const section = (page) => page.locator('#fox-trail');

test('sits between the editorial shelf and Today\'s racing', async ({ page }) => {
  await openLanding(page);
  const order = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('main section, body > section, section')]
      .filter((s) => s.matches('.land-shelf, #fox-trail, #day-hub'))
      .map((s) => s.id || 'shelf');
    return ids;
  });
  expect(order).toEqual(['shelf', 'fox-trail', 'day-hub']);
});

test('is a named region with a heading', async ({ page }) => {
  await openLanding(page);
  await expect(page.getByRole('region', { name: /Every race\.\s*Every signal\.\s*One trail\./ })).toHaveCount(1);
});

test("gives the day's numbers", async ({ page }) => {
  await openLanding(page);
  const stats = section(page).locator('.ftp__stat');
  await expect(stats).toHaveCount(3);
  await expect(stats.nth(0)).toContainText('46');
  await expect(stats.nth(0)).toContainText('races');
  await expect(stats.nth(1)).toContainText('winners');
  await expect(stats.nth(2)).toContainText('hit rate');
});

test('links to the trail', async ({ page }) => {
  await openLanding(page);
  const cta = section(page).getByRole('link', { name: /Explore the Fox Trail/ });
  await expect(cta).toHaveAttribute('href', /trail/);
});

test('shows the next race off, once, and says which race it is', async ({ page }) => {
  await openLanding(page);
  const now = section(page).locator('.ftp-card--now');
  await expect(now).toHaveCount(1);
  await expect(now).toContainText('Next off');
  await expect(section(page).locator('.ftp__progress')).toContainText('Race 13 of 46');
});

test('every card names the race time, course and horse', async ({ page }) => {
  await openLanding(page);
  const cards = section(page).locator('.ftp-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    if (!(await card.isVisible())) continue;
    await expect(card.locator('.ftp-card__time')).toHaveText(/^\d{2}:\d{2}$/);
    await expect(card.locator('.ftp-card__course')).not.toBeEmpty();
    await expect(card.locator('.ftp-card__horse')).not.toBeEmpty();
  }
});

test('no horse name is cut short', async ({ page }) => {
  await openLanding(page, { waitUntil: 'load' });
  const cut = await page.evaluate(() => [...document.querySelectorAll('#fox-trail .ftp-card__horse')]
    .filter((e) => e.offsetParent && e.scrollHeight > e.clientHeight + 1)
    .map((e) => e.textContent));
  expect(cut).toEqual([]);
});

test('no horse or course name is broken inside a word, or cut short', async ({ page }) => {
  await openLanding(page, { waitUntil: 'load' });
  const bad = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#fox-trail .ftp-card__horse, #fox-trail .ftp-card__course').forEach((el) => {
      if (!el.offsetParent) return;
      if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) out.push(`cut: ${el.textContent}`);
      const text = el.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) return;
      const re = /\S+/g;
      let m;
      while ((m = re.exec(text.data))) {
        const range = document.createRange();
        range.setStart(text, m.index);
        range.setEnd(text, m.index + m[0].length);
        const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
        if (lines.size > 1) out.push(`split: ${m[0]}`);
      }
    });
    return out;
  });
  expect(bad).toEqual([]);
});

test('the next race off is on screen without scrolling the page sideways', async ({ page }) => {
  await openLanding(page, { waitUntil: 'load' });
  await section(page).scrollIntoViewIfNeeded();
  const now = section(page).locator('.ftp-card--now');
  await expect(now).toBeVisible();
  const [row, card] = await Promise.all([section(page).locator('.ftp__cards').boundingBox(), now.boundingBox()]);
  expect(card.x).toBeGreaterThanOrEqual(row.x - 1);
  expect(card.x + card.width).toBeLessThanOrEqual(row.x + row.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test('the cards can be scrolled from the keyboard', async ({ page }) => {
  await openLanding(page);
  await expect(section(page).locator('.ftp__cards')).toHaveAttribute('tabindex', '0');
});
