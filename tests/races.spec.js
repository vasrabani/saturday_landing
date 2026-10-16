/*
 * The day's races (/races/, /races/tomorrow/, /races/yesterday/): what
 * the page has to keep doing.
 *
 * Every meeting of the day and every race, with the winners hidden
 * until the reader asks. The page's own script reveals a winner or a
 * whole meeting and remembers it; the revamp's two scripts mark the
 * meeting in view, land a tab's meeting below the pinned bars, and move
 * the reveal track's horse. The sandbox has the three days the site
 * has: today mid-card, tomorrow (the busiest day captured) and
 * yesterday with every result in; the template's branches that none of
 * them caught are served from tests/support/races-branches.cjs.
 *
 * The assertions are on what the reader sees: whether a thing is
 * displayed, where it is, whether it can be pressed, and what it says.
 */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  MEETING_MEDIUM_MIN, MEETING_WIDE_MIN, RACES_PAGES, RACES_SECTIONS, box, meetings, openRaces, racesOf, scrollToMeeting, settled, tabOf,
} from './support/races.js';

const DAYS = Object.keys(RACES_PAGES);
const GOLD = 'rgb(212, 175, 55)';
const INK = 'rgb(17, 21, 31)';

/** How far up its course a meeting's horse stands, from 0 (the start) to 1 (the post). */
const horseAt = (meeting) =>
  meeting.locator('.rbr-track__lane').evaluate((lane) => {
    const horse = lane.querySelector('.rbr-track__horse').getBoundingClientRect();
    const track = lane.getBoundingClientRect();
    return (horse.left - track.left) / (track.width - horse.width - 8);
  });

/** The bottom of the site's pinned chrome: the navigation, and the tour strip when it shows. */
const chromeBottom = (page) =>
  page.evaluate(() => {
    const bottoms = ['#siteNav', '#demoBanner']
      .map((sel) => document.querySelector(sel))
      .filter((el) => el && el.getClientRects().length)
      .map((el) => el.getBoundingClientRect().bottom);
    return Math.max(...bottoms);
  });

test.describe('page health', () => {
  for (const day of DAYS) {
    test(`${day}: loads without script errors or failed requests`, async ({ page }) => {
      const { problems } = await openRaces(page, { day });
      await page.waitForLoadState('networkidle');
      expect(problems).toEqual([]);
    });

    test(`${day}: does not scroll horizontally`, async ({ page }) => {
      await openRaces(page, { day });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('asks nothing of any other server', async ({ page }) => {
    const { offsite } = await openRaces(page);
    await page.waitForLoadState('networkidle');
    expect(offsite).toEqual([]);
  });

  for (const section of RACES_SECTIONS) {
    test(`renders ${section.name}`, async ({ page }) => {
      await openRaces(page);
      const element = page.locator(section.selector).first();
      await expect(element).toBeVisible();
      expect((await element.boundingBox()).height).toBeGreaterThan(0);
    });
  }
});

test.describe('masthead', () => {
  const FIGURES = {
    today: { eyebrow: 'Today’s races', title: 'Friday 16 October 2026', figures: ['43 races', '5 meetings', 'First off 13:20', '8 results in'] },
    tomorrow: { eyebrow: 'Tomorrow’s races', title: 'Saturday 17 October 2026', figures: ['60 races', '8 meetings', 'First off 12:55'] },
    yesterday: { eyebrow: 'Yesterday’s races', title: 'Thursday 15 October 2026', figures: ['40 races', '5 meetings', 'First off 12:55', '40 results in'] },
  };

  for (const day of DAYS) {
    test(`${day}: names the day and its figures`, async ({ page }) => {
      await openRaces(page, { day });
      const want = FIGURES[day];
      await expect(page.locator('.browse-eyebrow')).toHaveText(want.eyebrow);
      await expect(page.locator('h1.browse-title')).toHaveText(want.title);
      const figures = page.locator('.browse-stats > span');
      await expect(figures).toHaveText(want.figures);
      for (const figure of await figures.all()) await expect(figure).toBeVisible();
    });
  }

  test('the days either side are a tab away, the one on show marked in gold', async ({ page }) => {
    await openRaces(page, { day: 'tomorrow' });
    const days = page.locator('.browse-days__day');
    await expect(days).toHaveText(['Yesterday', 'Today', 'Tomorrow']);
    expect(await days.evaluateAll((links) => links.map((a) => a.getAttribute('href')))).toEqual(['races-yesterday.html', 'races.html', 'races-tomorrow.html']);
    await expect(page.locator('.browse-days__day[aria-current="page"]')).toHaveText('Tomorrow');
    for (const link of await days.all()) {
      const current = (await link.getAttribute('aria-current')) === 'page';
      expect(await link.evaluate((a) => getComputedStyle(a).backgroundColor) === GOLD).toBe(current);
      expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
  });

  test('the Steam of the Day picture lies under the masthead', async ({ page }) => {
    const loaded = page.waitForResponse((response) => response.url().endsWith('/static/browse/img/masthead.webp') && response.status() === 200);
    await openRaces(page);
    await loaded;
    const art = await page.locator('.browse-masthead').evaluate((el) => getComputedStyle(el, '::before').backgroundImage);
    expect(art).toContain('masthead.webp');
  });

  test('today: the next race off, its time and countdown, going to its racecard', async ({ page }) => {
    await openRaces(page);
    const next = page.locator('.browse-masthead .browse-next-off');
    await expect(next).toBeVisible();
    await expect(next).toHaveAttribute('href', 'https://www.saturday-racing.com/races/6536/');
    await expect(next.locator('.browse-next-off__title')).toContainText('Uttoxeter');
    await expect(next.locator('.browse-next-off__time')).toContainText('15:47');
    await expect(next.locator('.browse-next-off__countdown')).toHaveText('in 3m');
  });

  test('no next race off on a day that is not today', async ({ page }) => {
    for (const day of ['tomorrow', 'yesterday']) {
      await openRaces(page, { day });
      await expect(page.locator('.browse-next-off')).toHaveCount(0);
    }
  });

  const PICK_SIX = {
    today: 'https://www.saturday-racing.com/races/meeting/uttoxeter/2026-10-16/full/',
    tomorrow: 'https://www.saturday-racing.com/races/meeting/ascot/2026-10-17/full/',
  };
  for (const [day, href] of Object.entries(PICK_SIX)) {
    test(`${day}: Pick Six goes to the card of the meeting that runs next, its stickers inside the masthead`, async ({ page }) => {
      await openRaces(page, { day });
      const link = page.locator('.browse-masthead .browse-pick6');
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toBeVisible();
      const band = await box(page.locator('.browse-masthead'));
      const width = page.viewportSize().width;
      for (const sticker of ['.browse-pick6__stamp', '.browse-pick6__name', '.browse-pick6__sub']) {
        const part = await box(link.locator(sticker));
        expect(part.left, sticker).toBeGreaterThanOrEqual(0);
        expect(part.right, sticker).toBeLessThanOrEqual(width);
        expect(part.top, sticker).toBeGreaterThanOrEqual(band.top);
        expect(part.bottom, sticker).toBeLessThanOrEqual(band.bottom);
      }
    });
  }

  test('yesterday: no Pick Six in the masthead, the day being run', async ({ page }) => {
    await openRaces(page, { day: 'yesterday' });
    await expect(page.locator('.browse-pick6')).toHaveCount(0);
  });

  test('the big race: a pill under the figures, its meeting trimmed in gold, its line on the wash', async ({ page }) => {
    await openRaces(page, { branch: 'bigRace' });
    const pill = page.locator('.browse-masthead .browse-featured-banner');
    await expect(pill).toBeVisible();
    for (const part of ['__label', '__title', '__meta']) await expect(pill.locator(`.browse-featured-banner${part}`)).toBeVisible();
    const after = await pill.evaluate((el) => getComputedStyle(el, '::after').maskImage || getComputedStyle(el, '::after').webkitMaskImage);
    expect(after).toContain('arrow-right.svg');
    const figures = await box(page.locator('.browse-stats'));
    expect((await box(pill)).top).toBeGreaterThan(figures.bottom);

    const meeting = meetings(page).first();
    await expect(meeting.locator('.meeting-block__featured-flag')).toBeVisible();
    expect(await meeting.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(GOLD);
    const race = meeting.locator('.race-row--featured');
    await expect(race.locator('.featured-tag')).toBeVisible();
    expect(await race.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(250, 241, 215)');
  });

  test('a day without racing: the template\'s message in the masthead, and no tabs, meetings or notes', async ({ page }) => {
    await openRaces(page, { branch: 'noRacing' });
    const empty = page.locator('.browse-masthead .browse-empty');
    await expect(empty).toBeVisible();
    await expect(empty.locator('.browse-empty__title')).toBeVisible();
    await expect(page.locator('.browse-days__day')).toHaveCount(3);
    for (const absent of ['.meeting-nav', '.meetings-paper', '.browse-notes', '.browse-pick6']) await expect(page.locator(absent)).toHaveCount(0);
  });
});

test.describe('meeting tabs', () => {
  test('one tab a meeting, in page order, each going to its meeting', async ({ page }) => {
    await openRaces(page);
    const tabs = page.locator('.meeting-nav .meeting-tab');
    const ids = await meetings(page).evaluateAll((blocks) => blocks.map((b) => `#${b.id}`));
    expect(await tabs.evaluateAll((links) => links.map((a) => a.getAttribute('href')))).toEqual(ids);
  });

  test('every tab says how its meeting stands, and is at least 44px tall', async ({ page }) => {
    await openRaces(page);
    for (const tab of await page.locator('.meeting-nav .meeting-tab').all()) {
      await expect(tab.locator('.meeting-tab__name')).toBeVisible();
      await expect(tab.locator('.meeting-tab__state')).toBeVisible();
      expect((await tab.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    // A meeting under way draws its progress along the tab's foot; one
    // not yet started has none to draw.
    await expect(tabOf(page, 1).locator('.meeting-tab__meter-fill')).toBeVisible();
    await expect(tabOf(page, 4).locator('.meeting-tab__meter')).toBeHidden();
  });

  test('stay pinned under the site\'s navigation while the meetings go by', async ({ page }) => {
    await openRaces(page);
    const bar = page.locator('.meeting-nav');
    for (const n of [3, 5]) {
      await scrollToMeeting(page, n);
      await expect(bar).toBeInViewport();
      expect(Math.abs((await box(bar)).top - (await chromeBottom(page)))).toBeLessThanOrEqual(1);
    }
  });

  test('the tab of the meeting in view is the marked one, in ink', async ({ page }) => {
    await openRaces(page);
    for (const n of [2, 4]) {
      await scrollToMeeting(page, n);
      await expect(page.locator('.meeting-nav [aria-current="true"]')).toHaveCount(1);
      await expect(tabOf(page, n)).toHaveAttribute('aria-current', 'true');
      // The tab fades to its ink (a 0.14s transition), so its colour is
      // read until it has settled, not at the instant it is marked.
      await expect.poll(() => tabOf(page, n).evaluate((a) => getComputedStyle(a).backgroundColor)).toBe(INK);
    }
  });

  test('at the top of the page no meeting but the first can be the marked one', async ({ page }) => {
    await openRaces(page);
    const marked = page.locator('.meeting-nav [aria-current]');
    expect(await marked.count()).toBeLessThanOrEqual(1);
    if (await marked.count()) await expect(marked).toHaveAttribute('href', '#meeting-1');
  });

  test('a tab lands its meeting below the bar, and takes the keyboard to it', async ({ page }) => {
    await openRaces(page);
    await tabOf(page, 4).click();
    await settled(page);
    const bar = await box(page.locator('.meeting-nav'));
    const name = page.locator('#meeting-4 .meeting-block__name');
    const top = (await box(name)).top;
    expect(top).toBeGreaterThanOrEqual(bar.bottom);
    expect(top).toBeLessThanOrEqual(bar.bottom + 48);
    await expect(name).toBeFocused();
    expect(new URL(page.url()).hash).toBe('#meeting-4');
    await expect(tabOf(page, 4)).toHaveAttribute('aria-current', 'true');
  });

  test('the busiest day: eight tabs; more than fit scroll inside the bar, never the page, and the marked one is kept in sight', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRaces(page, { day: 'tomorrow' });
    await expect(page.locator('.meeting-nav .meeting-tab')).toHaveCount(8);
    const fits = await page.locator('.meeting-nav').evaluate((bar) => bar.scrollWidth <= bar.clientWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    if (page.viewportSize().width >= 1280) expect(fits).toBe(true);
    await scrollToMeeting(page, 8);
    await expect(tabOf(page, 8)).toHaveAttribute('aria-current', 'true');
    const bar = await box(page.locator('.meeting-nav'));
    await expect.poll(async () => {
      const tab = await box(tabOf(page, 8));
      return tab.left >= bar.left - 1 && tab.right <= bar.right + 1;
    }).toBe(true);
  });
});

test.describe('winners', () => {
  test('Reveal winner shows one race\'s winner, and the page stays where it is', async ({ page }) => {
    await openRaces(page, { day: 'yesterday' });
    const url = page.url();
    const button = meetings(page).first().locator('[data-action="reveal-result"]').first();
    await expect(button.locator('.race-row__spoiler-face--revealed')).toBeHidden();
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button.locator('.race-row__spoiler-name')).toBeVisible();
    await expect(button.locator('.race-row__spoiler-sp')).toBeVisible();
    await expect(button.locator('.race-row__spoiler-connections')).toBeVisible();
    await expect(button.locator('.race-row__spoiler-face--hidden')).toBeHidden();
    expect(page.url()).toBe(url);
  });

  test('a revealed winner is remembered, and hides again when pressed', async ({ page }) => {
    await openRaces(page, { day: 'yesterday' });
    const first = () => meetings(page).first().locator('[data-action="reveal-result"]').first();
    await first().click();
    await expect(first()).toHaveAttribute('aria-pressed', 'true');
    await page.reload({ waitUntil: 'load' });
    await expect(first().locator('.race-row__spoiler-name')).toBeVisible();
    await first().click();
    await expect(first().locator('.race-row__spoiler-face--hidden')).toBeVisible();
    await expect(first().locator('.race-row__spoiler-name')).toBeHidden();
  });

  test('Reveal all shows every winner at the meeting, and Hide all hides them', async ({ page }) => {
    await openRaces(page, { day: 'yesterday' });
    const meeting = meetings(page).first();
    const toggle = meeting.locator('[data-action="reveal-meeting"]');
    // What the button says on screen: one face shows at a time.
    await expect(toggle).toHaveText('Reveal all', { useInnerText: true });
    await toggle.click();
    await expect(toggle).toHaveText('Hide all', { useInnerText: true });
    const names = meeting.locator('.race-row__spoiler-name');
    for (const name of await names.all()) await expect(name).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveText('Reveal all', { useInnerText: true });
    for (const name of await names.all()) await expect(name).toBeHidden();
  });

  test('the track counts the winners shown, and the horse goes up the course to the post', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRaces(page, { day: 'yesterday' });
    const meeting = meetings(page).first();
    const count = meeting.locator('.rbr-track__count');
    await expect(count).toHaveText('0 of 8 revealed');
    expect(await horseAt(meeting)).toBeLessThan(0.02);
    const buttons = meeting.locator('[data-action="reveal-result"]');
    await buttons.nth(0).click();
    await buttons.nth(3).click();
    await expect(count).toHaveText('2 of 8 revealed');
    expect(await horseAt(meeting)).toBeCloseTo(2 / 8, 1);
    await meeting.locator('[data-action="reveal-meeting"]').click();
    await expect(count).toHaveText('All 8 revealed');
    expect(await horseAt(meeting)).toBeGreaterThan(0.97);
    await expect(meeting.locator('.rbr-track')).toHaveAttribute('data-rbr-done', '');
  });

  test('a meeting part run: the horse stops as far up the course as the results go', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRaces(page);
    const meeting = meetings(page).first();
    const count = meeting.locator('.rbr-track__count');
    await expect(count).toHaveText('0 of 3 revealed');
    await meeting.locator('[data-action="reveal-meeting"]').click();
    await expect(count).toHaveText('All 3 revealed');
    expect(await horseAt(meeting)).toBeCloseTo(3 / 9, 1);
    await expect(meeting.locator('.rbr-track')).not.toHaveAttribute('data-rbr-done', '');
  });

  test('winners revealed on an earlier visit are counted as the page opens', async ({ page }) => {
    await openRaces(page, { day: 'yesterday', revealed: ['6479', '6480'] });
    await expect(meetings(page).first().locator('.rbr-track__count')).toHaveText('2 of 8 revealed');
  });

  test('no track and no Reveal all at a meeting with no result yet', async ({ page }) => {
    await openRaces(page, { day: 'tomorrow' });
    await expect(page.locator('.rbr-track')).toHaveCount(0);
    await expect(page.locator('[data-action="reveal-meeting"]')).toHaveCount(0);
    await openRaces(page);
    await expect(page.locator('#meeting-4 .rbr-track')).toHaveCount(0);
  });

  test('the winner\'s button, Reveal all and the meeting\'s Pick Six are at least 44px tall', async ({ page }) => {
    await openRaces(page, { day: 'yesterday' });
    const pressable = page.locator('#meeting-1').locator('[data-action="reveal-result"], [data-action="reveal-meeting"], .meeting-block__header .pick6');
    expect(await pressable.count()).toBe(10);
    for (const control of await pressable.all()) {
      expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('races', () => {
  for (const day of DAYS) {
    test(`${day}: every race's name is shown whole`, async ({ page }) => {
      await openRaces(page, { day });
      const cut = await page.locator('.race-row__name').evaluateAll((names) =>
        names.filter((h3) => h3.scrollWidth > h3.clientWidth + 1 || getComputedStyle(h3).whiteSpace === 'nowrap').map((h3) => h3.textContent.trim()));
      expect(cut).toEqual([]);
    });
  }

  test('every race is a link to its racecard, and says Racecard at every width', async ({ page }) => {
    await openRaces(page);
    const rows = page.locator('.meetings-paper .race-row');
    const hrefs = await rows.evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBe(43);
    expect(hrefs.every((href) => /^https:\/\/www\.saturday-racing\.com\/races\/\d+\/$/.test(href))).toBe(true);
    const unseen = await page.locator('.race-row__cta').evaluateAll((ctas) => ctas.filter((cta) => !cta.getClientRects().length).length);
    expect(unseen).toBe(0);
  });

  test('the time, the race and what there is to press sit as the meeting\'s width allows', async ({ page }) => {
    await openRaces(page);
    const meeting = meetings(page).first();
    const width = (await box(meeting)).width;
    const race = racesOf(meeting).nth(4);
    const [time, name, meta, right] = await Promise.all(
      ['.race-row__time', '.race-row__name', '.race-row__meta', '.race-row__right'].map((sel) => box(race.locator(sel))),
    );
    if (width >= MEETING_WIDE_MIN) {
      expect(time.right).toBeLessThanOrEqual(name.left);
      expect(right.left).toBeGreaterThanOrEqual(name.right);
    } else if (width >= MEETING_MEDIUM_MIN) {
      expect(time.right).toBeLessThanOrEqual(name.left);
      expect(right.top).toBeGreaterThanOrEqual(meta.bottom - 1);
      expect(Math.abs(right.left - name.left)).toBeLessThanOrEqual(1);
    } else {
      expect(time.bottom).toBeLessThanOrEqual(name.top + 1);
      expect(right.top).toBeGreaterThanOrEqual(meta.bottom - 1);
    }
  });

  test('the AI\'s pick and the cubs show their words, with line icons for the emoji', async ({ page }) => {
    await openRaces(page);
    const race = page.locator('.race-row[href$="/races/6527/"]');
    const ai = race.locator('.ai-pick-chip');
    for (const part of ['__eyebrow', '__name', '__odds', '__conf']) await expect(ai.locator(`.ai-pick-chip${part}`)).toBeVisible();
    await expect(ai.locator('.ai-pick-chip__name')).toHaveText('Classyfied');
    await expect(race.locator('.race-row__crowd-chip-count')).toHaveText('1');
    for (const [glyph, icon] of [['.ai-pick-chip__icon', 'bolt.svg'], ['.race-row__crowd-chip-icon', 'paw.svg']]) {
      const drawn = await race.locator(glyph).evaluate((el) => ({
        text: getComputedStyle(el).fontSize,
        mask: getComputedStyle(el, '::before').maskImage || getComputedStyle(el, '::before').webkitMaskImage,
      }));
      expect(drawn.text, glyph).toBe('0px');
      expect(drawn.mask, glyph).toContain(icon);
    }
  });

  test('"Result" is kept for a screen reader and not drawn', async ({ page }) => {
    await openRaces(page, { day: 'yesterday' });
    const tag = page.locator('.result-tag').first();
    await expect(tag).toHaveText(/Result/);
    const size = await tag.boundingBox();
    expect(size.width).toBeLessThanOrEqual(1);
    expect(size.height).toBeLessThanOrEqual(1);
  });

  test('a member\'s pick shows on its race, signed in', async ({ page }) => {
    await openRaces(page, { branch: 'yourPick' });
    const chip = page.locator('.race-row[href$="/races/6536/"] .race-row__pick-chip');
    await expect(chip).toBeVisible();
    await expect(chip.locator('.race-row__pick-chip-eyebrow')).toHaveText('Your pick');
    await expect(chip.locator('.race-row__pick-chip-name')).toHaveText('Rula Bula');
  });

  test('the cubs\' chip takes the Fox\'s colour when a cub he promoted has picked', async ({ page }) => {
    await openRaces(page, { branch: 'foxCubs' });
    const fox = await page.locator('.race-row__crowd-chip--fox').evaluate((el) => getComputedStyle(el).backgroundColor);
    const plain = await page.locator('.race-row__crowd-chip:not(.race-row__crowd-chip--fox)').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fox).not.toBe(plain);
  });

  test('an abandoned race is still there to read, struck through and tagged', async ({ page }) => {
    await openRaces(page, { branch: 'abandonedRace' });
    const race = page.locator('.race-row--abandoned');
    await expect(race).toHaveCount(1);
    await expect(race.locator('.abandoned-tag')).toBeVisible();
    const name = race.locator('.race-row__name > span').first();
    await expect(name).toBeVisible();
    expect(await name.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain('line-through');
  });

  test('an abandoned meeting: its tab struck through, its line saying so, every race tagged', async ({ page }) => {
    await openRaces(page, { branch: 'abandonedMeeting' });
    const tab = tabOf(page, 5);
    await expect(tab.locator('.meeting-tab__state')).toHaveText('Abandoned');
    expect(await tab.locator('.meeting-tab__name').evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain('line-through');
    const meeting = page.locator('#meeting-5');
    await expect(meeting.locator('.meeting-block__status')).toContainText('Abandoned');
    const tags = meeting.locator('.abandoned-tag');
    await expect(tags).toHaveCount(await racesOf(meeting).count());
    for (const tag of await tags.all()) await expect(tag).toBeVisible();
  });
});

test.describe('notes and footer', () => {
  test('three notes after the meetings: side by side from 768px, one above another on a phone', async ({ page }) => {
    await openRaces(page);
    const notes = page.locator('.browse-notes .browse-notes__note');
    await expect(notes).toHaveCount(3);
    const tops = [];
    for (const note of await notes.all()) {
      await expect(note.locator('.browse-notes__title')).toBeVisible();
      tops.push((await box(note)).top);
    }
    if (page.viewportSize().width >= 768) expect(new Set(tops).size).toBe(1);
    else expect(tops[0] < tops[1] && tops[1] < tops[2]).toBe(true);
    expect(tops[0]).toBeGreaterThan((await box(page.locator('.meetings-paper'))).bottom - 1);
  });

  test('the footer opens with the horse on this page', async ({ page }) => {
    await openRaces(page);
    const art = await page.locator('.sf__shell').evaluate((el) => getComputedStyle(el, '::before').backgroundImage);
    expect(art).toContain('horse.svg');
  });
});

test.describe('design rules', () => {
  test('every :hover rule waits for a pointer that hovers', async () => {
    const css = readFileSync('static/browse/css/browse.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const outside = [];
    const blocks = [];
    let start = 0;
    for (let i = 0; i < css.length; i += 1) {
      if (css[i] === '{') {
        blocks.push(css.slice(start, i).trim());
        start = i + 1;
      } else if (css[i] === '}') {
        blocks.pop();
        start = i + 1;
      } else if (css[i] === ';') {
        start = i + 1;
      }
      if (css[i] === '{' && blocks[blocks.length - 1].includes(':hover')) {
        const inHover = blocks.slice(0, -1).some((prelude) => /@media[^{]*\(hover:\s*hover\)/.test(prelude));
        if (!inHover) outside.push(blocks[blocks.length - 1]);
      }
    }
    expect(outside).toEqual([]);
  });

  // chrome.css already cuts every animation and transition on the site to
  // 0.01ms for a reader who asks for less motion; browse.css stops this
  // page's own (the beats, the horse, the winner's entrance) outright.
  // Either way, nothing may take long enough to be seen.
  test('with reduced motion nothing on the page moves', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRaces(page);
    const moving = await page.evaluate(() => {
      const SEEN = 0.01; // seconds
      const seconds = (value) => Math.max(...value.split(',').map(parseFloat));
      const found = [];
      for (const el of document.querySelectorAll('.browse-masthead *, .meeting-nav *, .meetings-paper *')) {
        for (const pseudo of [null, '::before', '::after']) {
          const style = getComputedStyle(el, pseudo);
          const name = `${el.getAttribute('class') ?? el.tagName}${pseudo ?? ''}`;
          if (style.animationName !== 'none' && seconds(style.animationDuration) > SEEN) found.push(`${name} animates`);
          if (style.transitionProperty !== 'none' && seconds(style.transitionDuration) > SEEN) found.push(`${name} transitions`);
        }
      }
      return found;
    });
    expect(moving).toEqual([]);
  });
});
