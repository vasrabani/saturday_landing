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
import { FOX_PAGES, axis, openFox, pastTheEdges, shownRows } from './support/fox.js';

const LOCAL_DEBUG_URL = /\/\/(localhost|127\.0\.0\.1)[:/]/;

test.describe('page health', () => {
  for (const file of FOX_PAGES) {
    test(`${file} loads without script errors or failed requests, and does not scroll sideways`, async ({ page }) => {
      const { problems, offsite } = await openFox(page, file, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle');
      expect(problems).toEqual([]);
      expect(offsite.filter((url) => LOCAL_DEBUG_URL.test(url) || url.includes('clarity.ms'))).toEqual([]);
      expect(await pastTheEdges(page)).toEqual([]);
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

  test('a meeting chip narrows the Board in place, and the address keeps the choice', async ({ page }) => {
    await openFox(page, 'fox-board.html');
    const chip = page.locator('.fxv-tools a', { hasText: 'Hereford' });
    const kept = page.locator('.fxv-row:not([hidden])');
    await chip.click();
    await expect(kept).toHaveCount(6);
    expect(await kept.locator('.fxv-row__link').allTextContents()).toEqual(Array(6).fill('Hereford'));
    // Set aside means gone from the screen, not only marked.
    expect(await page.locator('.fxv-row[hidden]').evaluateAll((rows) => rows.every((row) => getComputedStyle(row).display === 'none'))).toBe(true);
    await expect(page.locator('.fxv-row[hidden]')).toHaveCount(32);
    await expect(chip).toHaveClass(/fxv-on/);
    expect(new URL(page.url()).searchParams.get('meeting')).toBe('Hereford');
    await page.locator('.fxv-tools a', { hasText: 'All meetings' }).click();
    await expect(kept).toHaveCount(38);
    expect(new URL(page.url()).search).toBe('');
  });

  test('the Board opens narrowed when its address says so, and the filters and the sort menu work together', async ({ page }) => {
    await openFox(page, 'fox-board.html?meeting=Leicester');
    const kept = page.locator('.fxv-row:not([hidden])');
    await expect(kept).toHaveCount(8);
    // Every race at Leicester is low: the level filter leaves none, and says so.
    await page.locator('.fxv-tools a', { hasText: 'High or medium only' }).click();
    await expect(kept).toHaveCount(0);
    await expect(page.locator('.fxv-empty')).toContainText('No races still to run at Leicester');
    expect(new URL(page.url()).searchParams.get('conviction')).toBe('notlow');
    expect(new URL(page.url()).searchParams.get('meeting')).toBe('Leicester');
    // Every meeting's: the races that are not low, and only those.
    await page.locator('.fxv-tools a', { hasText: 'All meetings' }).click();
    expect(await kept.count()).toBeGreaterThan(0);
    expect(await kept.evaluateAll((rows) => rows.every((row) => !/fxv-row--low/.test(row.className)))).toBe(true);
    await page.locator('.fxv-select').selectOption({ label: 'Sort: shortest price' });
    expect(new URL(page.url()).searchParams.get('sort')).toBe('price');
    // The level filter off again (it keeps one race to come), so the order
    // is read across every race to come; the fold is ordered on its own.
    await page.locator('.fxv-tools a', { hasText: 'High or medium only' }).click();
    expect(new URL(page.url()).searchParams.get('conviction')).toBeNull();
    const prices = await page.locator('.fxv-list > [role="list"] > .fxv-row:not([hidden]) .fxv-price').allTextContents();
    expect(prices.length).toBeGreaterThan(5);
    const dec = (p) => { const m = /^(\d+)\/(\d+)$/.exec(p.trim()); return m ? +m[1] / +m[2] + 1 : /^ev/i.test(p.trim()) ? 2 : Infinity; };
    expect(prices.map(dec)).toEqual([...prices.map(dec)].sort((a, b) => a - b));
    expect(new URL(page.url()).searchParams.get('sort')).toBe('price');
  });

  test('a Board the server narrowed is narrowed further in place, and widened by the server', async ({ page }) => {
    // The server answers ?meeting= with that meeting's races alone (the
    // sandbox's pages hold the whole day): played here by leaving the
    // other meetings' rows out of the page that address asks for.
    await page.route(/\/fox-board\.html\?meeting=Hereford$/, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/<article class="fxv-row[\s\S]*?<\/article>/g,
        (row) => (/class="fxv-row__link"[^>]*>\s*Hereford\s*</.test(row) ? row : ''));
      await route.fulfill({ response, body });
    });
    await openFox(page, 'fox-board.html?meeting=Hereford');
    const rows = page.locator('.fxv-row');
    await expect(rows).toHaveCount(6);
    await page.locator('.fxv-tools a', { hasText: 'High or medium only' }).click();
    expect(new URL(page.url()).searchParams.get('meeting')).toBe('Hereford');
    expect(new URL(page.url()).searchParams.get('conviction')).toBe('notlow');
    await expect(rows).toHaveCount(6);
    await page.locator('.fxv-tools a', { hasText: 'All meetings' }).click();
    await expect(rows).toHaveCount(38);
    expect(new URL(page.url()).searchParams.get('meeting')).toBeNull();
    expect(new URL(page.url()).searchParams.get('conviction')).toBe('notlow');
  });

  test('a press on a chosen filter clears it, and the sheet closes on a press elsewhere or Escape', async ({ page }) => {
    await openFox(page, 'fox-board.html');
    const kept = page.locator('.fxv-row:not([hidden])');
    const level = page.locator('.fxv-tools a', { hasText: 'High or medium only' });
    await level.click();
    await expect(level).toHaveClass(/fxv-on/);
    await level.click();
    await expect(level).not.toHaveClass(/fxv-on/);
    await expect(kept).toHaveCount(38);
    expect(new URL(page.url()).search).toBe('');
    // The sheet: a choice, the count on its word, the choice undone, the sheet dismissed.
    const sheet = page.locator('details.fxv-more');
    const word = sheet.locator('summary');
    await word.click();
    await expect(sheet).toHaveAttribute('open', '');
    const top = sheet.locator('a[data-dim="class"][data-value="top"]');
    await top.click();
    await expect(top).toHaveClass(/fxv-on/);
    await expect(word).toHaveAttribute('data-count', '1');
    await top.click();
    await expect(top).not.toHaveClass(/fxv-on/);
    await expect(word).toHaveAttribute('data-count', '');
    await expect(sheet).toHaveAttribute('open', '');
    await page.locator('.fxv-hero').click({ position: { x: 10, y: 10 } });
    await expect(sheet).not.toHaveAttribute('open', '');
    await word.click();
    await expect(sheet).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(sheet).not.toHaveAttribute('open', '');
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

test.describe('the other rooms', () => {
  test('the list of races and the alerts keep to the screen, every column and word in view', async ({ page }, testInfo) => {
    const width = testInfo.project.use.viewport.width;
    for (const file of ['fox-race-trace.html', 'fox-alerts.html']) {
      await openFox(page, file);
      // Nothing in the room reaches past the right edge of the screen.
      const over = await page.evaluate((w) => [...document.querySelectorAll('.fx-shell--v2 .fx-hub__col, .fx-shell--v2 .fx-alerts__signal > *, .fx-shell--v2 .fx-alerts__race-meta')]
        .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > w + 1).length, width);
      expect(over, file).toBe(0);
      expect(await pastTheEdges(page), file).toEqual([]);
    }
    // The signals column is on the screen in the list, and its count readable.
    await openFox(page, 'fox-race-trace.html');
    const count = page.locator('.fx-hub__row .fx-hub__col--signals .fx-chip').first();
    await expect(count).toBeVisible();
    expect((await count.boundingBox()).x + (await count.boundingBox()).width).toBeLessThanOrEqual(width);
  });

  test('the symbol in a signal\'s round mark sits in the middle of the circle', async ({ page }) => {
    // The symbol's ink, read from a picture of each mark, against the
    // circle's middle. The pixels are read in the page itself: a second
    // tab would send this one to the back, where its drawing can wait.
    const inkMiddle = (png) => page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const g = canvas.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data;
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        if ((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255 < 0.6) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
      return { dx: (x0 + x1 + 1) / 2 - img.width / 2, dy: (y0 + y1 + 1) / 2 - img.height / 2, w: img.width };
    }, png.toString('base64'));
    for (const [file, sel] of [['fox-race-visitor.html', '.fx-trace__signal-chip'], ['fox-alerts.html', '.fx-alerts__chip-kind']]) {
      // The page settled first: a font arriving mid-shot moves the marks.
      await openFox(page, file, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const marks = page.locator(sel + ':visible');
      const n = Math.min(await marks.count(), 5);
      expect(n, file).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const mark = marks.nth(i);
        // Shot from the middle of the screen: flush with its edge, a shot
        // can take in a row of what lies beyond the circle.
        await mark.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        const ink = await inkMiddle(await mark.screenshot());
        const scale = ink.w / (await mark.boundingBox()).width;
        // Up and down is what went wrong (the symbol sat 5px high). Side
        // to side a symbol may lean by its own drawing: the jockey's cap
        // has its peak to the right, so its ink sits ~1.5px right.
        expect(Math.abs(ink.dx / scale), file).toBeLessThanOrEqual(2);
        expect(Math.abs(ink.dy / scale), file).toBeLessThanOrEqual(1.5);
      }
    }
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
      lines.map((line) => Number(/(-?[\d.]+)\s*$/.exec(line.getAttribute('d').trim())[1])));
    const lowest = Math.max(...ys);
    const gridHeight = await chart.evaluate((svg) => svg.viewBox.baseVal.height);
    await page.mouse.move(box.x + box.width * 0.9, box.y + (lowest / gridHeight) * box.height);
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

  test('the chart opens with the market\'s story: the favourite, the most backed, the biggest drifter, the latest signal', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    const tiles = page.locator('.fx-tchart__tile');
    await expect(tiles).toHaveCount(3);
    await expect(tiles.nth(0)).toContainText('Favourite');
    await expect(tiles.nth(0)).toContainText('Bella Angelina');
    await expect(tiles.nth(0).locator('.fx-tchart__tile-price')).toHaveText('Evs');
    await expect(tiles.nth(1)).toContainText('Most backed');
    await expect(tiles.nth(1)).toContainText('Blue Point Gold');
    await expect(tiles.nth(2)).toContainText('drifting');
    // A press on a tile follows that runner, in the chart and the table.
    await tiles.nth(1).click();
    await expect(tiles.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.fx-tchart__svg')).toHaveClass(/fx-tchart__svg--dim/);
    await expect(page.locator('.fx-trace__runner.fx-focus-match')).toHaveCount(1);
  });

  test('on a replay the story opens with the winner', async ({ page }) => {
    await openFox(page, 'fox-race-replay.html');
    const first = page.locator('.fx-tchart__tile').first();
    await expect(first).toContainText('Winner');
    await expect(first).toContainText('Bombus Pascuorum');
  });

  test('every line runs on to its runner: the cloth, the name and the price', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    // The front of the market by default; the whole field for the asking.
    const ends = page.locator('.fx-tchart__end');
    await expect(ends).toHaveCount(4);
    await page.locator('.fx-tchart__field-toggle').click();
    await expect(ends).toHaveCount(9);
    await page.locator('.fx-tchart__field-toggle').click();
    await expect(ends).toHaveCount(4);
    const favourite = ends.filter({ has: page.locator('.fx-tchart__end-name', { hasText: 'Bella Angelina' }) });
    await expect(favourite.locator('.fx-tchart__end-cloth')).toHaveText('8');
    await expect(favourite.locator('.fx-tchart__end-price')).toHaveText('Evs');
  });

  test.describe('read from New York', () => {
    test.use({ timezoneId: 'America/New_York' });

    test('the hours run along the foot of the chart, in British time', async ({ page }) => {
      await openFox(page, 'fox-race.html');
      const hours = await page.locator('.fx-tchart__time').allTextContents();
      expect(hours.length).toBeGreaterThanOrEqual(4);
      expect(hours.every((hour) => /^\d\d:00$/.test(hour))).toBe(true);
      // The day's prices run from 09:00 to 17:05 at the course, whatever the reader's clock says.
      expect(hours).toContain('12:00');
      await expect(page.locator('.fx-tchart__readout-time')).toHaveText('17:05');
    });
  });

  test("a press on a signal's marker takes the replay to its moment and says what fired", async ({ page }) => {
    await openFox(page, 'fox-race.html');
    const marker = page.locator('.fx-tchart__marker[data-runner-id]').first();
    const minute = await marker.getAttribute('data-minute');
    // Mid-screen, clear of the pinned bars a phone keeps at the top.
    await page.locator('.fx-tchart__svg').evaluate((svg) => svg.scrollIntoView({ block: 'center' }));
    await marker.click();
    await expect(page.locator('#fx-tchart-scrub')).toHaveValue(minute);
    await expect(page.locator('.fx-tchart__readout-note')).toContainText(/Market leader|Steamer|Drifter|Jockey|Class/);
  });

  test('the keyboard keeps its place when the chart redraws', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    const end = page.locator('.fx-tchart__end').first();
    const id = await end.getAttribute('data-runner-id');
    await expect(end).toHaveAttribute('aria-label', /^Follow .+, number \d+, /);
    await end.focus();
    await page.keyboard.press('Enter');
    // Following the runner drew the ends again: the focus is on its new end.
    await expect(page.locator('.fx-tchart__end:focus')).toHaveAttribute('data-runner-id', id);
    await expect(page.locator(`.fx-tchart__end[data-runner-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
  });

  test('a race page left for another room comes back with its chart drawn', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    await page.locator('.fxv-nav__rooms a', { hasText: 'Board' }).click();
    await page.waitForURL(/fox-board/);
    await page.goBack();
    await expect(page.locator('.fx-tchart__end').first()).toBeVisible();
    await expect(page.locator('.fx-tchart__line').first()).toBeAttached();
  });

  test('the chart is a named group whose flags answer the keyboard', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    await expect(page.locator('.fx-tchart__svg')).toHaveAttribute('role', 'group');
    const marker = page.locator('.fx-tchart__marker[data-runner-id]').first();
    await expect(marker).toHaveAttribute('role', 'button');
    const minute = await marker.getAttribute('data-minute');
    await marker.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#fx-tchart-scrub')).toHaveValue(minute);
  });

  test('the prices stand in a column beside the chart, where no line crosses them', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    const svg = page.locator('.fx-tchart__svg');
    await expect(page.locator('.fx-tchart__gridlabel').first()).toBeVisible();
    const field = page.locator('.fx-tchart__field-toggle');
    for (const whole of [false, true]) {
      if (whole) {
        await field.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await field.click();
        await expect(field).toHaveAttribute('aria-pressed', 'true');
      }
      const plotLeft = (await svg.boundingBox()).x;
      const rights = await page.locator('.fx-tchart__gridlabel').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
      expect(rights.length).toBeGreaterThan(1);
      for (const right of rights) expect(right).toBeLessThanOrEqual(plotLeft + 0.5);
    }
  });

  test('in the runners table each cloth stands clear of its horse', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    const gaps = await page.locator('.fx-trace__runner').evaluateAll((rows) => rows.map((row) =>
      row.querySelector('.fx-trace__horse-name').getBoundingClientRect().left -
      row.querySelector('.fx-trace__rcol--num').getBoundingClientRect().right));
    expect(gaps.length).toBe(9);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(8);
  });

  test('the runners table marks the favourite, and which way each price has gone', async ({ page }) => {
    await openFox(page, 'fox-race.html');
    // The favourite's cloth is gold, as at its line's end on the chart.
    await expect(page.locator('.fx-trace__runner--fav')).toHaveCount(1);
    await expect(page.locator('.fx-trace__runner--fav .fx-trace__horse-name')).toContainText('Bella Angelina');
    // Shorter than it opened is in, longer is out: Blue Point Gold 17/2 to 11/2, Mr Keble 12/1 to 14/1.
    await expect(page.locator('.fx-trace__runner--in', { hasText: 'Blue Point Gold' })).toHaveCount(1);
    await expect(page.locator('.fx-trace__runner--out', { hasText: 'Mr Keble' })).toHaveCount(1);
  });

  test('the head of a race is whole on the narrowest phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openFox(page, 'fox-race.html');
    const head = await page.locator('.fx-trace__title-block').boundingBox();
    expect(head.x).toBeGreaterThanOrEqual(0);
    expect(head.x + head.width).toBeLessThanOrEqual(320);
    expect(await pastTheEdges(page)).toEqual([]);
  });

  test("on a tablet a replay's runners table has room for every name and finish", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openFox(page, 'fox-race-replay.html');
    const table = await page.locator('.fx-trace__runners').boundingBox();
    const names = await page.locator('.fx-trace__runner .fx-trace__horse-name').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    expect(names.length).toBeGreaterThan(0);
    for (const width of names) expect(width).toBeGreaterThan(80);
    const fins = await page.locator('.fx-trace__runner .fx-fin').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    for (const right of fins) expect(right).toBeLessThanOrEqual(table.x + table.width);
    expect(await pastTheEdges(page)).toEqual([]);
  });

  test('a finished race is a replay: the result, and where each runner finished', async ({ page }) => {
    await openFox(page, 'fox-race-replay.html');
    await expect(page.locator('.fx-replay__callout')).toContainText('Bombus Pascuorum');
    await expect(page.locator('.fx-trace__runners-head')).toContainText('Fin');
    await expect(page.locator('.fx-trace__runners .fx-fin--1')).toHaveCount(1);
  });
});
