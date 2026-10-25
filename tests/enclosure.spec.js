/*
 * The Enclosure: what it has to keep doing.
 *
 * The phone app a corporate client's guests use on their race day:
 * Home, the Card and each race, the Feed, the Corporate Cup, a guest's
 * own page and other guests', and the host's Steward's Room.
 *
 * These are behaviour tests, not design tests: they say what must still
 * work after a restyle, and they leave every visual decision open. They
 * hold on to the hooks the scripts use (data-role, data-*-endpoint), the
 * links between the tabs, and what the page says, not on class names.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { SCENARIOS, openEnclosure, pagesOf, pastTheEdges } from './support/enclosure.js';

test.describe('page health', () => {
  for (const scenario of SCENARIOS) {
    test(`every ${scenario} page loads without script errors or missing files, and does not scroll sideways`, async ({ page }) => {
      test.setTimeout(240_000);
      for (const file of pagesOf(scenario)) {
        const { problems } = await openEnclosure(page, `${scenario}/${file}`, { waitUntil: 'load' });
        expect(problems, file).toEqual([]);
        expect(await pastTheEdges(page), file).toEqual([]);
        page.removeAllListeners('pageerror');
        page.removeAllListeners('response');
      }
    });
  }

  test('everything a page polls or posts to has its recorded answer', async ({ request }) => {
    for (const scenario of SCENARIOS) {
      for (const file of pagesOf(scenario)) {
        const markup = readFileSync(join('enclosure', scenario, file), 'utf8');
        const endpoints = [...markup.matchAll(/data-(?:live|pick|note|photo)-endpoint="([^"]+)"|data-endpoint="([^"]+)"/g)]
          .map((match) => match[1] ?? match[2]);
        for (const endpoint of new Set(endpoints)) {
          const response = await request.get(`/enclosure/${scenario}/${endpoint}`);
          expect(response.ok(), `${scenario}/${file} -> ${endpoint}`).toBe(true);
          expect(Object.keys(await response.json()).length, endpoint).toBeGreaterThan(0);
        }
      }
    }
  });
});

test.describe('the tabs', () => {
  test('the bottom nav moves between Home, Card, Feed and Cup, and marks where you are', async ({ page }) => {
    await openEnclosure(page, 'race-day/index.html');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const [label, file] of [['Card', 'card.html'], ['Feed', 'feed.html'], ['Cup', 'cup.html'], ['Home', 'index.html']]) {
      await nav.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`/race-day/${file}$`));
      await expect(page.locator(`.enc-nav [data-tab="${file === 'index.html' ? 'home' : file.slice(0, -5)}"]`)).toHaveClass(/is-active/);
    }
  });

  test('the host has the Steward\'s Room in place of Home', async ({ page }) => {
    await openEnclosure(page, 'steward/steward.html');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link', { name: 'Steward' })).toHaveAttribute('href', 'steward.html');
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveCount(0);
    await expect(page.locator('main')).toContainText('Steward');
  });

  test('a visitor with no invitation is offered the sign-in page', async ({ page }) => {
    await openEnclosure(page, 'visitor/index.html');
    await page.locator('[data-role="avatar-open"]').click();
    await page.getByRole('link', { name: /Sign in/ }).first().click();
    await expect(page).toHaveURL(/\/visitor\/signin\.html$/);
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  });
});

test.describe('the Card', () => {
  test('lists the nine races, each opening its own page', async ({ page }) => {
    await openEnclosure(page, 'race-day/card.html');
    const races = page.locator('main a[href^="race-"]');
    await expect(races).toHaveCount(9);
    await races.nth(5).click();
    await expect(page).toHaveURL(/\/race-6\.html$/);
    await expect(page.locator('h1')).toContainText('Power Logistics Nursery');
  });

  test('a race page steps to the race either side', async ({ page }) => {
    await openEnclosure(page, 'race-day/race-4.html');
    await page.locator('[data-role="race-next"]').click();
    await expect(page).toHaveURL(/\/race-5\.html$/);
    await page.locator('[data-role="race-prev"]').click();
    await expect(page).toHaveURL(/\/race-4\.html$/);
  });

  test('a settled race shows the result and cannot be picked', async ({ page }) => {
    await openEnclosure(page, 'race-day/race-1.html');
    const runners = page.locator('[data-role="runner"]');
    await expect(runners).toHaveCount(12);
    for (const runner of await runners.all()) await expect(runner).toBeDisabled();
    await expect(page.locator('[data-role="field"]')).toContainText('1st');
  });

  test('an open race takes a pick: tap a horse, confirm, and the pick and balance come back', async ({ page }) => {
    await openEnclosure(page, 'race-day/race-8.html');
    const runner = page.locator('[data-role="runner"]', { hasText: 'Charlie Boyo' });
    await expect(runner).toBeEnabled();
    await runner.click();
    const posted = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/race-8.pick.json'));
    await page.locator('[data-role="pick"] [data-role="submit"]').click();
    await posted;
    await expect(page.locator('[data-role="pick"]')).toContainText('Charlie Boyo');
    await expect(page.locator('[data-role="runner"][aria-pressed="true"]')).toContainText('Charlie Boyo');
  });

  test('the races still to run show LLaMa\'s read, the last race (with no Letter) does not', async ({ page }) => {
    await openEnclosure(page, 'race-day/race-8.html');
    await expect(page.locator('[data-role="letter"]')).toContainText('Predicted');
    await openEnclosure(page, 'race-day/race-9.html');
    await expect(page.locator('[data-role="letter"]')).not.toContainText('Predicted');
  });
});

test.describe('the Feed', () => {
  test('the filters move between All, Racing, Comments and Photos', async ({ page }) => {
    await openEnclosure(page, 'race-day/feed.html');
    const chips = page.getByRole('navigation', { name: 'Filter feed' });
    for (const [label, file] of [['Racing', 'feed-racing.html'], ['Comments', 'feed-comments.html'], ['Photos', 'feed-photos.html'], ['All', 'feed.html']]) {
      await chips.getByRole('link', { name: new RegExp(label) }).click();
      await expect(page).toHaveURL(new RegExp(`/${file}$`));
      await expect(chips.locator('[aria-current="true"]')).toContainText(label);
    }
  });

  test('the camera button opens the sheet, and a note goes to the Feed', async ({ page }) => {
    await openEnclosure(page, 'race-day/feed.html');
    await page.locator('[data-role="note-open"]').click();
    const sheet = page.locator('#enc-note-sheet');
    await expect(sheet).toBeVisible();
    await sheet.locator('[data-role="text"]').fill('Who else is on the favourite in the next?');
    const posted = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/note.json'));
    await sheet.locator('[data-mode-form="note"] [type="submit"]').click();
    await posted;
    await expect(page.locator('[data-role="stream"]')).toContainText('Who else is on the favourite in the next?');
  });

  test('a photo opens full size', async ({ page }) => {
    await openEnclosure(page, 'race-day/feed-photos.html');
    await page.locator('[data-role="photo-lightbox"]').first().click();
    await expect(page.locator('[data-role="lightbox-img"]')).toBeVisible();
  });
});

test.describe('the Cup', () => {
  test('names the viewer\'s place and links each named guest to their picks', async ({ page }) => {
    await openEnclosure(page, 'day-done/cup.html');
    await expect(page.locator('main')).toContainText('of 11');
    const named = page.locator('main a[href^="guest-"]').first();
    const name = (await named.innerText()).split('\n')[0];
    // The Standings sit at the foot of the page, under the bottom nav
    // until scrolled past it, as a thumb would.
    await named.dispatchEvent('click');
    await expect(page).toHaveURL(/\/guest-\d+\.html$/);
    await expect(page.locator('main')).toContainText(name.trim().split(' ')[0]);
  });
});
