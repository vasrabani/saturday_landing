/*
 * The meeting page: what it has to keep doing.
 *
 * Every race at a meeting, every runner, and the accumulator slip. The
 * page's own scripts sort a column, filter on a phone, reveal a winner,
 * mark the race in view and run the slip; the revamp's scripts add the
 * filters at every width, the ticket, the six-pick limit and the rest.
 * The sandbox has two days of it: Friday with every result in, and
 * Saturday the evening before, with no numbers and few prices.
 *
 * These are behaviour tests, not design tests: they say what must still
 * work after a restyle, and they leave every visual decision open.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import {
  MASTHEAD_COLUMN_MAX_WIDTH, MEETING_SECTIONS, MEETING_TIME, openMeeting, openSlip, pick, races, rewriteMeeting, runnersOf, settled,
  showsSlipSheet, slipFromElsewhere, slipStorageKey, tickets,
} from './support/meeting.js';

const LOCAL_DEBUG_URL = /\/\/(localhost|127\.0\.0\.1)[:/]/;

test.describe('page health', () => {
  for (const day of ['results', 'upcoming']) {
    test(`${day}: loads without script errors or failed requests`, async ({ page }) => {
      const { problems } = await openMeeting(page, { day, waitUntil: 'load' });
      await page.waitForLoadState('networkidle');
      expect(problems).toEqual([]);
    });

    test(`${day}: does not scroll horizontally`, async ({ page }) => {
      await openMeeting(page, { day, waitUntil: 'load' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('calls no localhost, third-party or analytics endpoints', async ({ page }) => {
    const { offsite } = await openMeeting(page);
    await page.waitForLoadState('networkidle');
    expect(offsite.filter((url) => LOCAL_DEBUG_URL.test(url) || url.includes('clarity.ms'))).toEqual([]);
  });
});

test.describe('the page', () => {
  for (const section of MEETING_SECTIONS) {
    test(`renders ${section.name}`, async ({ page }) => {
      await openMeeting(page);
      const element = page.locator(section.selector).first();
      await expect(element).toBeVisible();
      expect((await element.boundingBox()).height).toBeGreaterThan(0);
    });
  }

  test('every runner shows its name, price, Pick, jockey and trainer', async ({ page }) => {
    await openMeeting(page);
    const race = races(page).first();
    const rows = runnersOf(race);
    expect(await rows.count()).toBeGreaterThan(5);
    for (const part of ['.racecard__name', '.racecard__odds', '[data-action="add-to-slip"]', '.racecard__jockey-name', '.racecard__trainer-name']) {
      const hidden = await race.locator(`.racecard__runner ${part}`).evaluateAll((els) => els.filter((el) => !el.getClientRects().length).length);
      expect(hidden, `${part} hidden`).toBe(0);
    }
  });
});

test.describe('masthead', () => {
  test('the course name is centred from 768px, and starts at the left edge below', async ({ page }) => {
    await openMeeting(page);
    const name = page.locator('.mf-hero__title-name');
    const box = await name.boundingBox();
    const width = page.viewportSize().width;
    if (width > MASTHEAD_COLUMN_MAX_WIDTH) {
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1.5);
    } else {
      // The live page's own column: everything hangs off the left gutter.
      const eyebrow = await page.locator('.mf-hero__eyebrow').boundingBox();
      expect(Math.abs(box.x - eyebrow.x)).toBeLessThanOrEqual(1);
      expect(box.x).toBeLessThan(40);
    }
  });

  test('Pick Six is one link to a race on the page, its three stickers inside the masthead', async ({ page }) => {
    await openMeeting(page);
    const link = page.locator('.mf-hero .pick6');
    await expect(link).toHaveCount(1);
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^#race-/);
    await expect(page.locator(href)).toHaveCount(1);
    // The band runs the full width of the window; the stickers are tilted,
    // so each is judged by its own bounding box against the band.
    const hero = await page.locator('.mf-hero').boundingBox();
    const width = page.viewportSize().width;
    for (const sticker of ['.pick6__num', '.pick6__lbl', '.pick6__sub']) {
      const box = await page.locator(`.mf-hero ${sticker}`).boundingBox();
      expect(box.x, sticker).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, sticker).toBeLessThanOrEqual(width);
      expect(box.y, sticker).toBeGreaterThanOrEqual(hero.y - 1);
      expect(box.y + box.height, sticker).toBeLessThanOrEqual(hero.y + hero.height + 1);
    }
  });
});

test.describe('race strip', () => {
  test('one chip a race, each going to a race on the page', async ({ page }) => {
    await openMeeting(page);
    const chips = page.locator('.mf-jump__chip[data-jump-target]');
    expect(await chips.count()).toBe(await races(page).count());
    const missing = await chips.evaluateAll((els) => els.filter((el) => !document.getElementById(el.dataset.jumpTarget)).length);
    expect(missing).toBe(0);
  });

  test('a chip lands its race below the pinned bars, and the strip marks it', async ({ page }) => {
    await openMeeting(page);
    const chip = page.locator('.mf-jump__chip[data-jump-target]').nth(2);
    const target = await chip.getAttribute('data-jump-target');
    await chip.click();
    await settled(page);
    const [top, under] = await page.evaluate((id) => [
      document.getElementById(id).getBoundingClientRect().top,
      document.querySelector('.mf-jump').getBoundingClientRect().bottom,
    ], target);
    expect(top).toBeGreaterThanOrEqual(under - 1);
    expect(top).toBeLessThanOrEqual(under + 40);
    await expect(chip).toHaveClass(/is-active/);
  });
});

test.describe('another meeting, in place', () => {
  const NOTE = 'mfr-meeting-turn';
  const tabsTop = (page) => page.locator('[data-mf-switcher]').evaluate((nav) => Math.round(nav.getBoundingClientRect().top));
  // The captured pages' tabs go to the live site, which is another
  // origin from here, and a turn is only kept in place between pages of
  // the same site. Serve the page with its tabs pointing at this one.
  const sameSite = (page) => page.route('**/meeting.html', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).split('https://www.saturday-racing.com/races/meeting/').join('/races/meeting/');
    await route.fulfill({ response, body });
  });
  // The page's clock is pinned (openMeeting), so a note's time is told by it.
  const noteAt = (page, ago, offset) => page.addInitScript(([key, at, offset]) => {
    sessionStorage.setItem(key, JSON.stringify({ at, offset }));
  }, [NOTE, MEETING_TIME.getTime() - ago, offset]);

  test('a tab pressed notes where the tabs stood, and looks chosen at once', async ({ page }) => {
    await sameSite(page);
    await openMeeting(page);
    const tab = page.locator('a.mf-switcher__chip[data-mfr-meeting]').first();
    // Hold the press where it is, to look at the page it leaves behind.
    await page.evaluate(() => document.addEventListener('click', (e) => {
      if (e.target.closest('a.mf-switcher__chip')) e.preventDefault();
    }));
    await page.locator('[data-mf-switcher]').evaluate((nav) =>
      window.scrollTo({ top: nav.getBoundingClientRect().top + window.scrollY - 150, behavior: 'instant' }));
    const stood = await tabsTop(page);
    await tab.click();
    const note = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), NOTE);
    expect(note.offset).toBe(stood);
    await expect(tab).toHaveAttribute('data-mfr-going', '');
    await expect(page.locator('[data-mf-switcher]')).toHaveAttribute('data-mfr-turning', '');
  });

  test('a page turned to from the tabs opens with its tabs where they stood', async ({ page }) => {
    await noteAt(page, 2_000, 150);
    await openMeeting(page);
    await expect.poll(() => tabsTop(page)).toBe(150);
    // The note is for one turn only.
    expect(await page.evaluate((key) => sessionStorage.getItem(key), NOTE)).toBeNull();
  });

  test('a page opened any other way starts at its top', async ({ page }) => {
    await openMeeting(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('an old note is not acted on', async ({ page }) => {
    await noteAt(page, 60_000, 150);
    await openMeeting(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('the two pages ask to cross-fade, with the tabs and the slip held still', async ({ page }) => {
    await openMeeting(page);
    const names = await page.evaluate(() => ({
      tabs: getComputedStyle(document.querySelector('.mf-switcher')).viewTransitionName,
      slip: getComputedStyle(document.querySelector('#betSlip')).viewTransitionName,
    }));
    // Browsers without view transitions report nothing: there the turn is a plain one.
    test.skip(names.tabs === undefined, 'no view transitions in this browser');
    expect(names).toEqual({ tabs: 'mf-meetings', slip: 'mf-slip' });
  });
});

test.describe('race strip: the keyboard', () => {
  test('a chip takes the focus to its race', async ({ page }) => {
    await openMeeting(page);
    const chip = page.locator('.mf-jump__chip[href^="#race-"]').nth(2);
    const id = (await chip.getAttribute('href')).slice(1);
    await chip.click();
    await expect(page.locator('#' + id)).toBeFocused();
  });
});

test.describe('runners', () => {
  test('every trip is spelt out, and its ruler is drawn to the same trip', async ({ page }) => {
    await openMeeting(page);
    const rulers = page.locator('.mf-race__meta .mfr-furlongs');
    expect(await rulers.count()).toBe(await races(page).count());
    const wrong = await rulers.evaluateAll((els) =>
      els.filter((el) => {
        const words = el.parentElement.textContent.trim();
        // "1m 4f", "2m 16y", "7f": eight furlongs to the mile, 220 yards to the furlong.
        const part = (unit) => +((new RegExp(`(\\d+)${unit}`).exec(words) || [])[1] || 0);
        const spelt = Math.round(part('m') * 8 + part('f') + part('y') / 220);
        const drawn = +el.style.getPropertyValue('--mfr-f');
        return /\d[mf]\d/.test(words) || !(drawn > 0) || drawn !== spelt || !el.getClientRects().length;
      }).length,
    );
    expect(wrong).toBe(0);
  });

  test('every run in the form knows its place, and the latest run is marked', async ({ page }) => {
    await openMeeting(page);
    const result = await page.locator('.racecard__form').evaluateAll((strips) => {
      let runs = 0;
      let unplaced = 0;
      let badLatest = 0;
      for (const strip of strips) {
        const boxes = Array.from(strip.querySelectorAll('.rcf')).filter((el) => !el.classList.contains('rcf--sep'));
        runs += boxes.length;
        unplaced += boxes.filter((el) => !/^([0-9]|x)$/.test(el.getAttribute('data-mfr-run') || '')).length;
        const latest = strip.querySelectorAll('[data-mfr-latest]');
        if (boxes.length && (latest.length !== 1 || latest[0] !== boxes[boxes.length - 1])) badLatest += 1;
      }
      return { runs, unplaced, badLatest };
    });
    expect(result.runs).toBeGreaterThan(100);
    expect(result.unplaced).toBe(0);
    expect(result.badLatest).toBe(0);
  });

  test('the favourite and the top rating are marked in every race', async ({ page }) => {
    await openMeeting(page);
    const unmarked = await races(page).evaluateAll((els) =>
      els.filter((race) => !race.querySelector('.racecard__runner[data-mfr-fav]') || !race.querySelector('.racecard__runner[data-mfr-top]')).length,
    );
    expect(unmarked).toBe(0);
  });

  test('upcoming: a runner with no number yet shows no "?"', async ({ page }) => {
    await openMeeting(page, { day: 'upcoming' });
    const unnumbered = page.locator('.racecard__runner[data-number="0"]');
    expect(await unnumbered.count()).toBeGreaterThan(50);
    // The template prints "?" in the number's place; nothing shows there.
    const questionMarks = await unnumbered.locator('.racecard__number').evaluateAll(
      (els) => els.filter((el) => el.getClientRects().length).length,
    );
    expect(questionMarks).toBe(0);
    // A race with any numbered runner keeps its number column. (On this
    // card every race has some, so none is marked; the next test makes
    // a card with none.)
    expect(await page.locator('[data-racecard][data-mfr-numbers="none"]').count()).toBe(0);
  });

  test('upcoming: a race in which no runner is numbered loses its number column', async ({ page }) => {
    // The captured card has a few numbers in every race; here it has none.
    await rewriteMeeting(page, 'upcoming', (html) => html.replace(/data-number="\d+"/g, 'data-number="0"'));
    await openMeeting(page, { day: 'upcoming' });
    const cards = page.locator('[data-racecard]');
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(page.locator('[data-racecard][data-mfr-numbers="none"]')).toHaveCount(await cards.count());
    const shown = await page.locator('.racecard__number, .racecard__col--number').evaluateAll((els) => els.filter((el) => el.getClientRects().length).length);
    expect(shown).toBe(0);
  });
});

test.describe('filters and sorting', () => {
  test('Top AI narrows a race to its three-star runners, and All restores it', async ({ page }) => {
    await openMeeting(page);
    const race = races(page).first();
    const shown = () => race.locator('.racecard__runner:not([data-mfr-hidden])').count();
    const before = await shown();
    await race.locator('.mfr-filter[data-filter="top-ai"]').click();
    const stars = await race.locator('.racecard__runner:not([data-mfr-hidden])').evaluateAll((rows) => rows.map((row) => +row.dataset.stars));
    expect(stars.length).toBeGreaterThan(0);
    expect(stars.filter((s) => s < 3)).toEqual([]);
    await race.locator('.mfr-filter[data-filter="all"]').click();
    expect(await shown()).toBe(before);
  });

  test('Sort by SR orders the runners by rating', async ({ page }) => {
    await openMeeting(page);
    const race = races(page).first();
    await race.locator('.mfr-filter[data-filter="sr-sort"]').click();
    const ratings = await runnersOf(race).evaluateAll((rows) => rows.map((row) => +row.dataset.sr || 0));
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });

  test('Steamers and Form up each keep only the runners they name', async ({ page }) => {
    await openMeeting(page);
    const race = races(page).first();
    const shown = () => race.locator('.racecard__runner:not([data-mfr-hidden])');
    await race.locator('.mfr-filter[data-filter="steamers"]').click();
    expect(await shown().count()).toBeGreaterThan(0);
    expect(await shown().locator(':scope:not(:has(.runner-market-chip--in))').count()).toBe(0);
    // Form up: the last three runs better than the three before, as
    // racecard_collapse.js scores them (letters count 9).
    await race.locator('.mfr-filter[data-filter="form-up"]').click();
    const trends = await shown().evaluateAll((rows) =>
      rows.map((row) => {
        const raw = (row.querySelector('.racecard__cell--form')?.textContent || '').replace(/[^0-9PFURS]/gi, '').slice(-6);
        const score = (ch) => (/[0-9]/.test(ch) ? parseInt(ch, 10) || 9 : 9);
        const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
        return mean(raw.slice(-6, -3).split('').map(score)) - mean(raw.slice(-3).split('').map(score));
      }),
    );
    expect(trends.length).toBeGreaterThan(0);
    expect(trends.filter((t) => !(t > 0.5))).toEqual([]);
  });

  test('the Comments switch folds every comment away, and back', async ({ page }) => {
    await openMeeting(page);
    const toggle = page.locator('.mfr-switch').first();
    // The phone card opens each comment from its own Details instead.
    test.skip(!(await toggle.isVisible()), 'no switch in the card layout');
    const html = page.locator('html');
    // It starts folded where a runner takes two lines (see below), so
    // bring it to "shown" first, whichever way it started.
    if ((await toggle.getAttribute('aria-checked')) === 'false') await toggle.click();
    await expect(html).not.toHaveAttribute('data-mfr-compact');
    await toggle.click();
    await expect(html).toHaveAttribute('data-mfr-compact', '');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(html).not.toHaveAttribute('data-mfr-compact');
  });

  test('comments start folded where a runner takes two lines, and shown in the table', async ({ page }) => {
    await openMeeting(page);
    const toggle = page.locator('.mfr-switch').first();
    test.skip(!(await toggle.isVisible()), 'no switch in the card layout');
    const room = await page.locator('.mf-races').evaluate((list) => list.clientWidth);
    const twoLines = room >= 660 && room < 1000;
    await expect(toggle).toHaveAttribute('aria-checked', String(!twoLines));
    // A reader's own choice wins over the room, and is kept.
    await toggle.click();
    await page.reload();
    await expect(page.locator('.mfr-switch').first()).toHaveAttribute('aria-checked', String(twoLines));
  });

  test('a filter puts a sorted column back to rest, so its next click starts again', async ({ page }) => {
    await openMeeting(page);
    const race = races(page).first();
    const head = race.locator('.racecard__col[data-sortable][data-col="sr"]');
    test.skip(!(await head.isVisible()), 'no column heads in this layout');
    const order = () => runnersOf(race).evaluateAll((rows) => rows.map((row) => row.dataset.runnerId));
    const card = await order();

    await head.click();
    const first = await head.getAttribute('aria-sort');
    expect(first).toMatch(/ascending|descending/);
    // racecard.js counts its own clicks on the head; the filter takes
    // the order over, so the head and that count both go back to rest.
    await race.locator('.mfr-filter[data-filter="top-ai"]').click();
    await expect(head).toHaveAttribute('aria-sort', 'none');
    await race.locator('.mfr-filter[data-filter="all"]').click();
    expect(await order()).toEqual(card);
    // A first click again, not a second.
    await head.click();
    await expect(head).toHaveAttribute('aria-sort', first);
  });

  test('a column head takes the order back from Sort by SR, and leaves a filter pressed', async ({ page }) => {
    await openMeeting(page);
    const race = races(page).first();
    const head = race.locator('.racecard__col[data-sortable][data-col="number"]');
    test.skip(!(await head.isVisible()), 'no column heads in this layout');
    const pressed = () => race.locator('.mfr-filter[aria-pressed="true"]').getAttribute('data-filter');

    // Sort by SR is an order: once a head sorts, it is no longer shown.
    await race.locator('.mfr-filter[data-filter="sr-sort"]').click();
    expect(await pressed()).toBe('sr-sort');
    await head.click();
    expect(await pressed()).toBe('all');
    // Top AI hides runners: the head sorts what is left, and it stays.
    await race.locator('.mfr-filter[data-filter="top-ai"]').click();
    await head.click();
    expect(await pressed()).toBe('top-ai');
  });

  test('a column head sorts on a click and on Enter', async ({ page }) => {
    await openMeeting(page);
    const head = races(page).first().locator('.racecard__col[data-sortable][data-col="sr"]');
    // The column heads belong to the table layout, which the race list
    // takes from 1000px of room; narrower, the rows carry their own labels.
    test.skip(!(await head.isVisible()), 'no column heads in this layout');
    await head.click();
    await expect(head).toHaveAttribute('aria-sort', /ascending|descending/);
    const first = await head.getAttribute('aria-sort');
    await head.focus();
    await page.keyboard.press('Enter');
    await expect(head).not.toHaveAttribute('aria-sort', first);
  });
});

test.describe('bet slip', () => {
  test('a pick becomes a ticket with the runner\'s silks, number, jockey and price', async ({ page }) => {
    await openMeeting(page);
    const [picked] = await pick(page, 1);
    await openSlip(page);
    await expect(page.locator('#slipLegs .mf-slip__leg')).toHaveCount(1);
    await expect.poll(async () => (await tickets(page))[0].silksLoaded).toBe(true);
    const [ticket] = await tickets(page);
    expect(ticket).toMatchObject({ horse: picked.horse, odds: picked.odds, number: picked.number, jockey: picked.jockey, silks: picked.silks });
    await expect(page.locator('.mfr-card__place[data-mfr-taken="true"]')).toHaveCount(1);
    await expect(page.locator('.mfr-card__count')).toHaveText('1 of 6 picks');
  });

  test('another runner in the same race replaces the pick; the ticket can be taken out', async ({ page }) => {
    await openMeeting(page);
    const [first] = await pick(page, 1);
    const race = races(page).first();
    const at = await runnersOf(race).evaluateAll(
      (rows, name) => rows.findIndex((row) => row.dataset.horseName !== name && Number.isFinite(parseFloat(row.dataset.oddsDecimal))),
      first.horse,
    );
    const other = runnersOf(race).nth(at);
    await other.locator('[data-action="add-to-slip"]').click();
    await expect(page.locator('#slipLegs .mf-slip__leg')).toHaveCount(1);
    await expect(page.locator('#slipLegs .mf-slip__leg-horse')).toHaveText(await other.getAttribute('data-horse-name'));
    await openSlip(page);
    await page.locator('#slipLegs .mf-slip__leg-remove').click();
    await expect(page.locator('#slipLegs .mf-slip__leg')).toHaveCount(0);
    await expect(page.locator('.mfr-card__count')).toHaveText('Up to six picks, one a race');
  });

  test('the stake changes the returns', async ({ page }) => {
    await openMeeting(page);
    await pick(page, 2);
    await openSlip(page);
    const returns = page.locator('#slipReturns');
    const before = await returns.textContent();
    await page.locator('#slipStake').fill('25');
    await expect(returns).not.toHaveText(before);
    await expect(returns).toHaveText(/^[£€][\d,]+\.\d\d$/);
  });

  test('six picks fill the slip; a seventh race is refused and the six stay', async ({ page }) => {
    await openMeeting(page);
    const picked = await pick(page, 6);
    expect(picked).toHaveLength(6);
    await expect(page.locator('.mfr-card__count')).toHaveText('6 of 6 · full');
    await expect(page.locator('#betSlip')).toHaveAttribute('data-mfr-six', 'full');

    // Pick is stood down in every race without a pick, and in no other.
    const taken = picked.map((p) => p.raceId);
    const seventh = page.locator(`.mf-race[id]${taken.map((id) => `:not([id="${id}"])`).join('')}`).first();
    await expect(seventh.locator('[data-action="add-to-slip"][data-mfr-shut]').first()).toHaveAttribute('aria-disabled', 'true');
    expect(await races(page).first().locator('[data-action="add-to-slip"][data-mfr-shut]').count()).toBe(0);

    const button = seventh.locator('.racecard__runner[data-odds-decimal]:not([data-odds-decimal=""]) [data-action="add-to-slip"]').first();
    const horse = await button.locator('xpath=ancestor::*[@data-horse-name][1]').getAttribute('data-horse-name');
    // The button is aria-disabled, which Playwright counts as not
    // pressable; a visitor can still press it, so the press is forced.
    await button.click({ force: true });
    await expect(page.locator('#slipLegs .mf-slip__leg')).toHaveCount(6);
    await expect(seventh).not.toHaveClass(/mf-race--has-selection/);
    await expect(page.locator('.mfr-toast')).toHaveClass(/is-visible/);
    await expect(page.locator('.mfr-toast')).toHaveText(`Six races is the most you can pick. Take one out to add ${horse}.`);

    // Taking one out frees a place, and the buttons come back.
    await openSlip(page);
    await page.locator('#slipLegs .mf-slip__leg-remove').first().click();
    await expect(page.locator('.mfr-card__count')).toHaveText('5 of 6 picks · one place left');
    await expect(page.locator('[data-action="add-to-slip"][data-mfr-shut]')).toHaveCount(0);
  });

  test('a slip that arrives with more than six is kept, counted over, and takes no more', async ({ page }) => {
    await openMeeting(page, { slip: slipFromElsewhere(7) });
    await expect(page.locator('#slipLegs .mf-slip__leg')).toHaveCount(7);
    await expect(page.locator('.mfr-card')).toHaveAttribute('data-mfr-state', 'over');
    await expect(page.locator('.mfr-card__count')).toHaveText('7 picks · 1 over the six · 7 at other meetings');
    // Every pick came from elsewhere: a jockey's cap stands in for silks.
    await expect(page.locator('#slipLegs .mfr-leg__silks .mfr-i--cap')).toHaveCount(7);
    // Nothing more is taken.
    const button = page.locator('.racecard__runner[data-odds-decimal]:not([data-odds-decimal=""]) [data-action="add-to-slip"]').first();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await button.click({ force: true });
    await expect(page.locator('#slipLegs .mf-slip__leg')).toHaveCount(7);
    await expect(page.locator('.mfr-toast')).toHaveText(/Six races is the most you can pick/);
    // Two out: back to six, then five with a place free.
    await openSlip(page);
    await page.locator('#slipLegs .mf-slip__leg-remove').first().click();
    await expect(page.locator('.mfr-card__count')).toHaveText('6 of 6 · full · 6 at other meetings');
    await page.locator('#slipLegs .mf-slip__leg-remove').first().click();
    await expect(page.locator('.mfr-card__count')).toHaveText('5 of 6 picks · one place left · 5 at other meetings');
    await expect(page.locator('[data-action="add-to-slip"][data-mfr-shut]')).toHaveCount(0);
  });

  test('the limit is the page\'s to set: data-pick-limit on the wrapper', async ({ page }) => {
    // The template can carry the day's limit; here it is two.
    await rewriteMeeting(page, 'results', (html) => html.replace('<div class="mf-wrap"', '<div class="mf-wrap" data-pick-limit="2"'));
    await openMeeting(page);
    await expect(page.locator('.mfr-card__place')).toHaveCount(2);
    await expect(page.locator('.mfr-card__count')).toHaveText('Up to two picks, one a race');
    await pick(page, 2);
    await expect(page.locator('.mfr-card__count')).toHaveText('2 of 2 · full');
    await expect(page.locator('#slipHandleCount')).toHaveAttribute('data-mfr-of', '/2');
    const third = page.locator('.mf-race[id]:not(.mf-race--has-selection) .racecard__runner[data-odds-decimal]:not([data-odds-decimal=""]) [data-action="add-to-slip"]').first();
    await third.click({ force: true });
    await expect(page.locator('#slipLegs .mf-slip__leg')).toHaveCount(2);
    await expect(page.locator('.mfr-toast')).toHaveText(/^Two races is the most you can pick/);
  });

  test('a pick made at another meeting keeps its silks; what was kept for an old day is cleared', async ({ page }) => {
    // meeting_slip.js keeps each pick's silks, number and jockey beside
    // the day's slip, under the slip's own key, so a pick made at another
    // meeting is still dressed here. Seeded as that meeting would leave it.
    const key = slipStorageKey();
    const day = /(\d{4}-\d{2}-\d{2})$/.exec(key)[1];
    const before = (days) => new Date(Date.parse(`${day}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
    const kitKey = (date) => `mfr-slip-kit:${key.replace(day, date)}`;
    const [elsewhere] = slipFromElsewhere(1);
    const silks = `static/meeting/img/silks/${readdirSync(join(process.cwd(), 'static', 'meeting', 'img', 'silks'))[0]}`;
    const id = [elsewhere.course, elsewhere.raceTime, elsewhere.horseName].map((s) => s.trim().toLowerCase()).join('|');
    await page.addInitScript((entries) => {
      for (const [name, value] of entries) window.localStorage.setItem(name, value);
    }, [
      [kitKey(day), JSON.stringify({ [id]: { silks, number: '4', jockey: 'A. Rider' } })],
      [kitKey(before(1)), '{}'],    // yesterday's: a visitor may go back to it
      [kitKey(before(30)), '{}'],   // a month old: no use to anyone
    ]);
    await openMeeting(page, { slip: [elsewhere] });

    await openSlip(page);
    await expect.poll(async () => (await tickets(page))[0]?.silksLoaded).toBe(true);
    const [ticket] = await tickets(page);
    expect(ticket).toMatchObject({ horse: elsewhere.horseName, number: '4', jockey: 'A. Rider', silks });
    const kept = await page.evaluate(() => Object.keys(window.localStorage).filter((name) => name.startsWith('mfr-slip-kit:')));
    expect(kept.sort()).toEqual([kitKey(before(1)), kitKey(day)].sort());
  });

  test('the sheet opens from the bar, and closes on Escape and on a tap outside', async ({ page }) => {
    test.skip(!showsSlipSheet(page), 'the slip is docked at this width');
    await openMeeting(page);
    const panel = page.locator('#betSlip');
    await page.locator('#slipHandle').click();
    await expect(panel).toHaveClass(/is-open/);
    await page.keyboard.press('Escape');
    await expect(panel).not.toHaveClass(/is-open/);
    await page.locator('#slipHandle').click();
    await expect(panel).toHaveClass(/is-open/);
    // A tap on the page above the sheet, below the fixed navigation.
    await page.locator('.mfr-slip-backdrop').click({ position: { x: 20, y: 200 } });
    await expect(panel).not.toHaveClass(/is-open/);
  });

  test('closing the sheet from inside it gives the keyboard back to the bar', async ({ page }) => {
    test.skip(!showsSlipSheet(page), 'the slip is docked at this width');
    await openMeeting(page);
    await page.locator('.racecard__runner:not([data-odds-decimal=""]) [data-action="add-to-slip"]').first().click();
    await page.locator('#slipHandle').click();
    await expect(page.locator('#betSlip')).toHaveClass(/is-open/);
    await page.locator('#slipStake').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#betSlip')).not.toHaveClass(/is-open/);
    await expect(page.locator('#slipHandle')).toBeFocused();
  });

  test('upcoming: a runner without a price cannot be picked', async ({ page }) => {
    await openMeeting(page, { day: 'upcoming' });
    const button = page.locator('.racecard__runner[data-odds-decimal=""] [data-action="add-to-slip"]').first();
    await button.click();
    await expect(page.locator('.mf-toast')).toHaveText(/No priced market/);
    await expect(page.locator('#slipLegs .mf-slip__leg')).toHaveCount(0);
  });

  test('upcoming: Pick on a runner without a price does not look ready', async ({ page }) => {
    await openMeeting(page, { day: 'upcoming' });
    const look = (selector) => page.locator(selector).first().evaluate((button) => {
      const style = getComputedStyle(button);
      return { edge: style.borderTopStyle, ink: style.color, cursor: style.cursor };
    });
    const unpriced = await look('.racecard__slip-btn--unpriced');
    const ready = await look('.racecard__slip-btn:not(.racecard__slip-btn--unpriced)');
    expect(unpriced.edge).toBe('dashed');
    expect(unpriced.cursor).toBe('not-allowed');
    expect(unpriced.ink).not.toBe(ready.ink);
    // Every button on a runner with no price carries the class.
    const bare = await page.locator('.racecard__runner[data-odds-decimal=""] .racecard__slip-btn:not(.racecard__slip-btn--unpriced)').count();
    expect(bare).toBe(0);
  });

  test('the same refusal is said again when the same runner is pressed twice', async ({ page }) => {
    await openMeeting(page, { slip: slipFromElsewhere(6) });
    const note = page.locator('.mfr-toast');
    const seventh = page.locator('.mf-race:not(.mf-race--has-selection) .racecard__runner:not([data-odds-decimal=""]) [data-action="add-to-slip"]').first();
    await seventh.click({ force: true });
    await expect(note).toHaveText(/is the most you can pick/);
    const said = [];
    await note.evaluate((node) => {
      window.__said = [];
      new MutationObserver(() => window.__said.push(node.textContent)).observe(node, { childList: true, characterData: true, subtree: true });
    });
    await seventh.click({ force: true });
    await expect.poll(() => page.evaluate(() => window.__said.filter(Boolean).length)).toBeGreaterThan(0);
    // Emptied, then said: that is what makes a status region speak again.
    expect(await page.evaluate(() => window.__said.includes(''))).toBe(true);
  });
});

test.describe('results', () => {
  test('Reveal winner turns the pill over', async ({ page }) => {
    await openMeeting(page);
    const pill = page.locator('[data-action="reveal-result"]').first();
    await expect(pill).toHaveAttribute('aria-pressed', 'false');
    await pill.click();
    await expect(pill).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('keyboard', () => {
  test('no runner row is a tab stop of its own', async ({ page }) => {
    // On a phone racecard_collapse.js makes every row one, for a compact
    // view this page does not show; Details is the way in.
    await openMeeting(page, { waitUntil: 'load' });
    await expect(page.locator('.racecard__runner[tabindex="0"]')).toHaveCount(0);
  });
});

test.describe('phone card', () => {
  test('Details opens a runner\'s comment', async ({ page }) => {
    await openMeeting(page);
    const row = runnersOf(races(page).first()).first();
    const button = row.locator('.mfr-more');
    // The button belongs to the card layout, under 660px of room.
    test.skip(!(await button.isVisible()), 'the runners are not cards in this layout');
    await expect(row.locator('.racecard__comment')).toBeHidden();
    await button.click();
    await expect(row).toHaveAttribute('data-mfr-open', 'true');
    await expect(row.locator('.racecard__comment')).toBeVisible();
  });
});
