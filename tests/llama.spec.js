/*
 * The LLaMa Index: what it has to keep doing.
 *
 * Every horse running on a day, A to Z, across every meeting: a list a
 * reader searches, narrows and sorts to find a horse, and picks from
 * into the day's Pick Six slip (the meeting page's slip and scripts).
 *
 * These are behaviour tests, not design tests: they say what must still
 * work after a restyle, and they leave every visual decision open.
 */
import { test, expect } from '@playwright/test';
import { INDEX_SLIP_KEY, openIndex, pickFromRaces, pickable, rows, search, shown, shownRows } from './support/llama.js';

const LOCAL_DEBUG_URL = /\/\/(localhost|127\.0\.0\.1)[:/]/;
const count = (page, key) => page.locator(`[data-li-count="${key}"]`).innerText().then(Number);

test.describe('page health', () => {
  test('loads without script errors or failed requests', async ({ page }) => {
    const { problems } = await openIndex(page, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });

  test('does not scroll horizontally', async ({ page }) => {
    await openIndex(page, { waitUntil: 'load' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test('calls no localhost, third-party or analytics endpoints', async ({ page }) => {
    const { offsite } = await openIndex(page);
    await page.waitForLoadState('networkidle');
    expect(offsite.filter((url) => LOCAL_DEBUG_URL.test(url) || url.includes('clarity.ms'))).toEqual([]);
  });
});

test.describe('the list', () => {
  test('is every horse, A to Z, a leading "The" aside', async ({ page }) => {
    await openIndex(page);
    const names = (await shown(page)).map((row) => row.liName);
    expect(names.length).toBeGreaterThan(200);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
    await expect(page.locator('[data-li-readout]')).toHaveText(`${names.length} horses`);
  });

  test('a letter heads its horses', async ({ page }) => {
    await openIndex(page);
    const wrong = await page.evaluate(() => {
      let letter = null;
      const bad = [];
      for (const node of document.querySelector('[data-li-list]').children) {
        if (node.matches('[data-li-heading]')) letter = node.getAttribute('data-li-heading');
        else if (node.dataset.liLetter !== letter) bad.push(node.dataset.horseName);
      }
      return bad;
    });
    expect(wrong).toEqual([]);
  });

  test('a row says where and when the horse runs, and links to that race', async ({ page }) => {
    await openIndex(page);
    const row = rows(page).first();
    await expect(row.locator('.li-race__time')).toHaveText(/^\d{1,2}:\d{2}$/);
    await expect(row.locator('.li-where__of')).toHaveText(/^race \d+ of \d+$/);
    await expect(row.locator('a.li-race')).toHaveAttribute('href', new RegExp(`/races/meeting/.+/full/#race-${await row.getAttribute('data-race-id')}$`));
  });

  test('a run horse and a non-runner cannot be picked', async ({ page }) => {
    await openIndex(page);
    for (const state of ['run', 'nr']) {
      const closed = page.locator(`.li-row--${state}`);
      expect(await closed.count()).toBeGreaterThan(0);
      await expect(closed.locator('[data-action="add-to-slip"]:not([disabled])')).toHaveCount(0);
    }
  });
});

test.describe('finding a horse', () => {
  test('the search narrows the list as it is typed, by horse, jockey, trainer or course', async ({ page }) => {
    await openIndex(page);
    const target = (await shown(page))[40];
    await search(page, target.horseName.toUpperCase());
    const found = await shown(page);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((row) => row.liFind.includes(target.horseName.toLowerCase()))).toBe(true);
    await expect(page.locator('[data-li-readout]')).toHaveText(new RegExp(`^${found.length} of \\d+ horses$`));

    await search(page, target.liCourse.split('-')[0]);
    expect((await shown(page)).length).toBeGreaterThan(found.length);
  });

  test('a search with no answer says so, and can be cleared', async ({ page }) => {
    await openIndex(page);
    const all = await shownRows(page).count();
    await search(page, 'zzzqqq');
    await expect(shownRows(page)).toHaveCount(0);
    await expect(page.locator('[data-li-empty]')).toBeVisible();
    await page.locator('[data-li-clear]').click();
    await expect(shownRows(page)).toHaveCount(all);
    await expect(page.locator('[data-li-search]')).toHaveValue('');
  });

  for (const [key, passes] of [
    ['signal', (row) => row.liSignals.trim() !== ''],
    ['steamer', (row) => row.liMove === 'steamer' || row.liSignals.split(' ').includes('steamer')],
    ['topai', (row) => Number(row.liStars) >= 4],
    ['torun', (row) => row.liState === 'to_run'],
  ]) {
    test(`the "${key}" filter shows its horses and counts them`, async ({ page }) => {
      await openIndex(page);
      const all = await shown(page);
      const chip = page.locator(`[data-li-filter="${key}"]`);
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      const found = await shown(page);
      expect(found.length).toBe(all.filter(passes).length);
      expect(found.every(passes)).toBe(true);
      expect(await count(page, key)).toBe(found.length);
      await chip.click();                                   // pressed again, it comes off
      await expect(shownRows(page)).toHaveCount(all.length);
    });
  }

  test('the counts follow the search', async ({ page }) => {
    await openIndex(page);
    const before = await count(page, 'torun');
    await search(page, 'york');
    const found = await shown(page);
    expect(await count(page, 'all')).toBe(found.length);
    expect(await count(page, 'torun')).toBe(found.filter((row) => row.liState === 'to_run').length);
    expect(await count(page, 'torun')).toBeLessThan(before);
  });

  test('a course shows only its horses', async ({ page }) => {
    await openIndex(page);
    const select = page.locator('select[data-li-course]');
    const course = await select.locator('option').nth(1).getAttribute('value');
    await select.selectOption(course);
    const found = await shown(page);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((row) => row.liCourse === course)).toBe(true);
  });

  for (const [key, inOrder] of [
    ['time', (a, b) => a.liTime <= b.liTime],
    ['sr', (a, b) => Number(a.liSr) >= Number(b.liSr)],
    ['signals', (a, b) => a.liSignals.split(' ').filter(Boolean).length >= b.liSignals.split(' ').filter(Boolean).length],
    ['price', (a, b) => (Number(a.oddsDecimal) > 1 ? Number(a.oddsDecimal) : Infinity) <= (Number(b.oddsDecimal) > 1 ? Number(b.oddsDecimal) : Infinity)],
  ]) {
    test(`sorted by ${key}, the letters go and the order holds`, async ({ page }) => {
      await openIndex(page);
      await page.locator('[data-li-sort]').selectOption(key);
      const found = await shown(page);
      expect(found.slice(1).every((row, i) => inOrder(found[i], row))).toBe(true);
      await expect(page.locator('[data-li-heading]:not([hidden])')).toHaveCount(0);
      await expect(page.locator('[data-li-az]')).toBeHidden();

      await page.locator('[data-li-sort]').selectOption('name');
      await expect(page.locator('[data-li-az]')).toBeVisible();
      expect((await shown(page))[0].liLetter).toBe('A');
    });
  }

  test('a letter goes to its horses and is marked', async ({ page }) => {
    await openIndex(page);
    const link = page.locator('[data-li-jump="M"]');
    await link.click();
    await expect(link).toHaveAttribute('aria-current', 'true', { timeout: 10_000 });
    const gap = await page.evaluate(() =>
      document.querySelector('#li-M').getBoundingClientRect().top - document.querySelector('[data-li-tools]').getBoundingClientRect().bottom);
    expect(Math.abs(gap)).toBeLessThanOrEqual(2);
  });

  test('a letter with no horse showing stands back', async ({ page }) => {
    await openIndex(page);
    const target = (await shown(page))[0];
    await search(page, target.horseName);
    const off = page.locator('[data-li-jump][data-li-off]');
    expect(await off.count()).toBeGreaterThan(15);
    await expect(page.locator(`[data-li-jump="${target.liLetter}"]`)).not.toHaveAttribute('data-li-off', '');
  });

  test('what is chosen is kept in the address and read back from it', async ({ page }) => {
    await openIndex(page);
    await search(page, 'york');
    await page.locator('[data-li-filter="torun"]').click();
    await page.locator('[data-li-sort]').selectOption('price');
    await expect(page).toHaveURL(/[?&]q=york\b/);
    await expect(page).toHaveURL(/[?&]f=torun\b/);
    await expect(page).toHaveURL(/[?&]s=price\b/);
    const found = (await shown(page)).map((row) => row.runnerId);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-li-count="signal"]:not(:empty)').waitFor();
    await expect(page.locator('[data-li-search]')).toHaveValue('york');
    await expect(page.locator('[data-li-filter="torun"]')).toHaveAttribute('aria-pressed', 'true');
    expect((await shown(page)).map((row) => row.runnerId)).toEqual(found);
  });

  test('"/" goes to the search', async ({ page }) => {
    await openIndex(page);
    await page.keyboard.press('/');
    await expect(page.locator('[data-li-search]')).toBeFocused();
  });

  test('Details opens a horse and closes it', async ({ page }) => {
    await openIndex(page);
    const row = page.locator('.li-row').filter({ has: page.locator('.li-cell--note') }).first();
    const button = row.locator('[data-li-more]');
    await expect(row.locator('.li-cell--note')).toBeHidden();
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(row.locator('.li-cell--note')).toBeVisible();
    await expect(row.locator('.li-cell--ratings')).toBeVisible();
    await button.click();
    await expect(row.locator('.li-cell--note')).toBeHidden();
  });
});

test.describe('the slip', () => {
  test('a pick here is a pick in the day\'s slip', async ({ page }) => {
    await openIndex(page);
    const [picked] = await pickFromRaces(page, 1);
    expect(picked.inSlip).toBe(true);
    const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), INDEX_SLIP_KEY);
    expect(stored).toHaveLength(1);
    expect(String(stored[0].raceId)).toBe(picked.raceId);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator(`#${picked.id}`)).toHaveClass(/racecard__runner--in-slip/);
  });

  test('one horse a race: a second pick in the race takes the first one\'s place', async ({ page }) => {
    await openIndex(page);
    const [picked] = await pickFromRaces(page, 1);
    const other = page.locator(`.li-row--to_run[data-race-id="${picked.raceId}"]:not(#${picked.id})`).first();
    await other.locator('[data-action="add-to-slip"]').evaluate((button) => button.click());
    await expect(other).toHaveClass(/racecard__runner--in-slip/);
    await expect(page.locator(`#${picked.id}`)).not.toHaveClass(/racecard__runner--in-slip/);
    await expect(page.locator('.li-row.racecard__runner--in-slip')).toHaveCount(1);
  });

  test('six picks and no more', async ({ page }) => {
    await openIndex(page);
    const picked = await pickFromRaces(page, 7);
    expect(picked.map((pick) => pick.inSlip)).toEqual([true, true, true, true, true, true, false]);
    await expect(page.locator('.li-row.racecard__runner--in-slip')).toHaveCount(6);
  });

  test('a row never puts its Pick button outside itself', async ({ page }) => {
    await openIndex(page);
    const row = pickable(page).first();
    const [box, button] = [await row.boundingBox(), await row.locator('[data-action="add-to-slip"]').boundingBox()];
    expect(button.x + button.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    expect(button.x).toBeGreaterThanOrEqual(box.x);
  });

  test('the docked slip stands clear of the pinned tools', async ({ page }) => {
    test.skip(page.viewportSize().width < 1024, 'the slip is a bar at the foot of the screen under 1024px');
    await openIndex(page);
    await page.locator('[data-li-jump="M"]').click();
    await expect(page.locator('[data-li-jump="M"]')).toHaveAttribute('aria-current', 'true', { timeout: 10_000 });
    const gap = await page.evaluate(() =>
      document.querySelector('#betSlip').getBoundingClientRect().top - document.querySelector('[data-li-tools]').getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(0);
  });
});
