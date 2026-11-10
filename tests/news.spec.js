/*
 * The Fox's Wire (/news/, its articles and the LLaMa Letters): what the
 * pages have to keep doing.
 *
 * A front page in the format of a national news site, in the site's own
 * theme: the site's nav as a glowing midnight bar with the logo in its
 * own band under it, the masthead, the top stories, then §1 to §7 on
 * white between two midnight bands, and the 10:00 Card last, joined to
 * the site's footer. Upright type only. The Wire's five scripts place
 * the nav's menus, search the stories, step the rail of silks, write
 * "3 hrs ago" and sign readers up to the Card; the sandbox server
 * answers the search and the sign-up as the Django views will.
 *
 * The assertions are on what the reader sees: whether a thing is
 * displayed, where it is, whether it can be pressed, and what it says.
 */
import { test, expect } from '@playwright/test';
import { ARTICLES, FRONT_PAGE, LETTERS, NEWS_PAGES, NEWS_SECTIONS, box, openNews } from './support/news.js';

const WHITE = 'rgb(255, 255, 255)';
const MIDNIGHT = 'rgb(11, 11, 15)';
const PHONE_MAX = 767;

const isPhone = (page) => page.viewportSize().width <= PHONE_MAX;

test.describe('page health', () => {
  for (const path of NEWS_PAGES) {
    test(`${path}: loads without script errors or failed requests`, async ({ page }) => {
      const { problems } = await openNews(page, { path });
      await page.waitForLoadState('networkidle');
      expect(problems).toEqual([]);
    });
  }

  test('no page scrolls sideways', async ({ page }) => {
    for (const path of NEWS_PAGES) {
      await openNews(page, { path });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('asks nothing of any other server', async ({ page }) => {
    const { offsite } = await openNews(page);
    await page.waitForLoadState('networkidle');
    expect(offsite).toEqual([]);
  });

  test('every picture loads', async ({ page }) => {
    for (const path of [FRONT_PAGE, ARTICLES[0], LETTERS[0]]) {
      await openNews(page, { path });
      // Lazy pictures load as they come near the screen: bring each one there.
      const broken = await page.evaluate(async () => {
        const pictures = Array.from(document.querySelectorAll('main img'));
        for (const img of pictures) {
          img.loading = 'eager';
          if (!img.complete) await new Promise((done) => { img.addEventListener('load', done); img.addEventListener('error', done); });
        }
        return pictures.filter((img) => !img.naturalWidth).map((img) => img.getAttribute('src'));
      });
      expect(broken, path).toEqual([]);
    }
  });

  test('every link to another news page here finds it', async ({ page, request }) => {
    for (const path of [FRONT_PAGE, ARTICLES[3], LETTERS[2]]) {
      await openNews(page, { path });
      const local = await page.locator('main a[href], .wire-drawer a[href]').evaluateAll((links) =>
        [...new Set(links.map((a) => a.href).filter((href) => href.startsWith(window.location.origin)))]);
      for (const href of local) expect((await request.get(href)).status(), `${path} -> ${href}`).toBe(200);
    }
  });

  test('nothing is set in italic', async ({ page }) => {
    for (const path of [FRONT_PAGE, ARTICLES[3], LETTERS[0]]) {
      await openNews(page, { path });
      const italic = await page.evaluate(() =>
        Array.from(document.querySelectorAll('body, body *'))
          .filter((el) => getComputedStyle(el).fontStyle !== 'normal')
          .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '')));
      expect(italic, path).toEqual([]);
    }
  });
});

test.describe('header', () => {
  test('the site nav comes first, with News as the current section', async ({ page }) => {
    await openNews(page);
    const nav = page.locator('#siteNav');
    expect((await box(nav)).top).toBe(0);
    await expect(nav.locator('.site-nav__link.active')).toHaveCount(1);
    await expect(nav.locator('.site-nav__link.active')).toContainText('News');
    expect(await nav.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(MIDNIGHT);
  });

  test('the logo stands in its own band under the bar, not in the bar', async ({ page }) => {
    await openNews(page, { tour: false });
    await expect(page.locator('#siteNav .site-nav__brand')).toBeHidden();
    const band = page.locator('.wire-mast');
    const logo = band.locator('.wire-brand');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('aria-label', 'Saturday Racing home');
    expect((await box(band)).top).toBe((await box(page.locator('#siteNav'))).bottom);
  });

  test('the masthead: title, tagline, date line and the next race off', async ({ page }) => {
    await openNews(page);
    const mast = page.locator('.wire-mast');
    await expect(mast.locator('h1.wire-mast__title')).toHaveText('The Fox’s Wire');
    await expect(mast.locator('.wire-mast__tag')).toHaveText('Racing without the fluff. Published every race day, before the first off.');
    await expect(mast.locator('.wire-mast__date')).toHaveText('Saturday · 31 October 2026');
    await expect(mast.locator('.wire-mast__vol')).toHaveText('Vol. II · No. 304');
    await expect(mast.locator('.wire-mast__next')).toHaveText(/Next off\s*Off 11:20 · Newmarket/);
    await expect(mast.locator('.wire-stamp')).toHaveAttribute('aria-label', 'Every day, 10 AM');
  });

  test('the title and the logo sit on the centre line, the stamp clear of the title', async ({ page }) => {
    await openNews(page);
    const middle = page.viewportSize().width / 2;
    for (const selector of ['.wire-mast__title', '.wire-brand', '.wire-mast__date']) {
      const width = await page.locator(selector).evaluate((el) => {
        // The text itself, not its box: the title's box is the full width.
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        return { left: r.left, right: r.right };
      });
      expect(Math.abs((width.left + width.right) / 2 - middle), selector).toBeLessThanOrEqual(2);
    }
    // The stamp sits in the logo's row: wherever it is level with the
    // title's words, it is above the title's line.
    const stamp = await box(page.locator('.wire-stamp'));
    const line = await box(page.locator('.wire-mast__title'));
    const words = await page.locator('.wire-mast__title').evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { left: r.left, right: r.right };
    });
    const level = stamp.left < words.right && stamp.right > words.left;
    if (level) expect(stamp.bottom).toBeLessThanOrEqual(line.top);
  });

  test('article and letter pages keep the logo band and their own headline', async ({ page }) => {
    for (const path of [ARTICLES[0], LETTERS[0]]) {
      await openNews(page, { path });
      await expect(page.locator('.wire-mast .wire-brand'), path).toBeVisible();
      await expect(page.locator('.wire-mast h1'), path).toHaveCount(0);
      await expect(page.locator('main h1'), path).toHaveCount(1);
      await expect(page.locator('main h1'), path).toHaveClass(/wire-art__title/);
    }
  });
});

test.describe('nav on the news pages', () => {
  test('the links show at every width, scrolling sideways when they do not fit', async ({ page }) => {
    await openNews(page);
    const links = page.locator('#siteNav .site-nav__links');
    await expect(links).toBeVisible();
    await expect(page.locator('#navHamburger')).toBeHidden();
    const fits = await links.evaluate((el) => el.scrollWidth <= el.clientWidth);
    if (!fits) {
      await links.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      expect(await links.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    }
  });

  test('search and Login stay at the bar\'s right edge; Join Free gives way on a phone', async ({ page }) => {
    await openNews(page);
    const width = page.viewportSize().width;
    for (const selector of ['.wire-search-toggle', '.site-nav__login-btn']) {
      const control = page.locator(`#siteNav ${selector}`);
      await expect(control).toBeVisible();
      expect((await box(control)).right).toBeLessThanOrEqual(width);
    }
    await expect(page.locator('#siteNav .site-nav__join-btn')).toBeVisible({ visible: !isPhone(page) });
  });

  test('a menu opens under its own item, on the screen, and Escape closes it', async ({ page }) => {
    await openNews(page);
    const drops = page.locator('#siteNav .site-nav__dropdown');
    const count = await drops.count();
    for (const index of [0, count - 1]) {
      const drop = drops.nth(index);
      const trigger = drop.locator('.site-nav__dropdown-trigger');
      await trigger.evaluate((el) => el.scrollIntoView({ inline: 'nearest' }));
      await trigger.click();
      const menu = drop.locator('.site-nav__dropdown-menu');
      await expect(menu).toHaveCSS('opacity', '1');
      const at = await box(menu);
      const under = await box(trigger);
      const nav = await box(page.locator('#siteNav'));
      expect(Math.round(at.top - nav.bottom + 0.5)).toBeGreaterThanOrEqual(0);
      expect(at.left).toBeGreaterThanOrEqual(8);
      expect(at.right).toBeLessThanOrEqual(page.viewportSize().width - 8);
      if (at.left > 8 && at.right < page.viewportSize().width - 8) expect(Math.abs(at.left - under.left)).toBeLessThanOrEqual(1);
      await page.keyboard.press('Escape');
      // A pointer resting on the item holds its menu open on purpose, as
      // hovering opens it; away from the bar, Escape has closed it.
      await page.mouse.move(page.viewportSize().width / 2, page.viewportSize().height - 1);
      await expect(menu).toHaveCSS('opacity', '0');
    }
  });

  test('on a desktop a menu also opens on hover, and stays open on the way down to it', async ({ page }) => {
    test.skip(page.viewportSize().width < 1024, 'a touch screen has no hover');
    await openNews(page);
    const drop = page.locator('#siteNav .site-nav__dropdown').nth(1);
    const menu = drop.locator('.site-nav__dropdown-menu');
    await drop.locator('.site-nav__dropdown-trigger').hover();
    await expect(menu).toHaveCSS('opacity', '1');
    // Straight down from the item to its first entry, in small steps.
    const from = await drop.locator('.site-nav__dropdown-trigger').boundingBox();
    const to = await menu.locator('.site-nav__dropdown-item').first().boundingBox();
    await page.mouse.move(from.x + 12, to.y + to.height / 2, { steps: 12 });
    await expect(menu).toHaveCSS('opacity', '1');
    await page.mouse.move(page.viewportSize().width / 2, page.viewportSize().height - 1);
    await expect(menu).toHaveCSS('opacity', '0');
  });
});

test.describe('front page', () => {
  test('§1 to §7 in order, then the 10:00 Card', async ({ page }) => {
    await openNews(page);
    const ids = await page.locator('main > section[id]').evaluateAll((sections) => sections.map((s) => s.id));
    expect(ids).toEqual(['lead', 'cases', 'pin', 'fold', 'archive', 'movers', 'record', 'card']);
    const heads = await page.locator('main > section .wire-sec__head').evaluateAll((all) =>
      all.map((head) => `${head.querySelector('.wire-sec__num')?.textContent ?? ''} ${head.querySelector('.wire-sec__title').textContent.trim()}`));
    expect(heads).toEqual(['§1 The Lead', '§2 The Case Files', '§3 The Pin', '§4 The Fold', '§5 The Back Issues', '§6 Market Movers', '§7 The Honest Record']);
    for (const section of NEWS_SECTIONS) await expect(page.locator(section.selector).first(), section.name).toBeVisible();
  });

  test('white pages, with The Pin and the Card on midnight bands', async ({ page }) => {
    await openNews(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(WHITE);
    const grounds = await page.locator('main > section[id]').evaluateAll((sections) =>
      Object.fromEntries(sections.map((s) => [s.id, getComputedStyle(s).backgroundColor])));
    for (const [id, ground] of Object.entries(grounds)) {
      expect(ground, id).toBe(['pin', 'card'].includes(id) ? MIDNIGHT : 'rgba(0, 0, 0, 0)');
    }
  });

  test('the Card closes the page and the footer joins it, with no gap or hairline', async ({ page }) => {
    await openNews(page);
    const card = await box(page.locator('#card'));
    const footer = page.locator('footer.sf--branded');
    expect((await box(footer)).top - card.bottom).toBe(0);
    await expect(footer).toHaveCSS('border-top-width', '0px');
  });

  test('a page that ends on white keeps its space above the footer', async ({ page }) => {
    await openNews(page, { path: ARTICLES[1] });
    const last = await box(page.locator('main > :last-child'));
    expect((await box(page.locator('footer.sf--branded'))).top - last.bottom).toBe(48);
  });

  test('the lead story and the six beside it', async ({ page }) => {
    await openNews(page);
    await expect(page.locator('.wire-top__lead .wire-card__title')).toHaveText('The Deep Dive: Bet365 Charlie Hall Steeple Chase (Grade 2) (GBB Race) — Wetherby 14:55');
    await expect(page.locator('.wire-top__left .wire-card, .wire-top__right .wire-card')).toHaveCount(6);
    await expect(page.locator('.wire-top__lead a')).toHaveAttribute('href', /^article\/2026\/the-deep-dive-/);
  });
});

test.describe('front page: what it says', () => {
  test('a drifter shows its move as a minus, a steamer as a plus', async ({ page }) => {
    await openNews(page);
    const moves = (col) => page.locator(`.wire-movers__col--${col} .wire-ranks__pct`).allTextContents();
    for (const move of await moves('in')) expect(move).toMatch(/^\+\d+%$/);
    const out = await moves('out');
    expect(out.length).toBeGreaterThan(0);
    for (const move of out) expect(move).toMatch(/^\u2212\d+%$/);
  });

  test('no story appears twice in the sections', async ({ page }) => {
    await openNews(page);
    const links = await page.locator('#cases a[href], #fold a[href]').evaluateAll((all) =>
      all.map((a) => new URL(a.href).pathname));
    const twice = links.filter((href, i) => links.indexOf(href) !== i);
    expect(twice).toEqual([]);
  });

  test('The Fold carries no race paper filed weeks before the day', async ({ page }) => {
    await openNews(page);
    const filed = await page.locator('#fold .wire-fold__foot span:first-child').allTextContents();
    for (const when of filed.map((t) => t.trim()).filter(Boolean)) expect(when).toBe('Filed 31 Oct');
    await expect(page.locator('#fold a[href*="/papers/"]')).toHaveCount(0);
  });

  test('the Back Issues give each desk its latest piece, the desk head the rest', async ({ page }) => {
    await openNews(page);
    const desks = page.locator('#archive .wire-archive__desk');
    expect(await desks.count()).toBeGreaterThan(1);
    for (const desk of await desks.all()) {
      await expect(desk.locator('.wire-archive__list li')).toHaveCount(1);
      await expect(desk.locator('.wire-archive__head a[href]')).toHaveCount(1);
    }
  });

  test('on a touch screen every link and button takes a press 44px across', async ({ page }) => {
    test.skip(!test.info().project.use.hasTouch, 'a touch screen only');
    test.setTimeout(120_000);
    for (const path of [FRONT_PAGE, ARTICLES[2], LETTERS[0]]) {
      await openNews(page, { path, tour: false });
      // A press 21px from a control's centre, in each direction, lands on
      // the control (its area may be larger than it is drawn) or on
      // another control beside it; never on nothing.
      const short = await page.evaluate(async () => {
        const CONTROL = 'a[href], button, summary, label, input, select, textarea';
        const found = [];
        for (const el of document.querySelectorAll('main a[href], main button')) {
          if (!el.checkVisibility()) continue;
          el.scrollIntoView({ block: 'center' });
          await new Promise(requestAnimationFrame);
          const r = el.getBoundingClientRect();
          if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) continue;
          if (r.width >= 44 && r.height >= 44) continue;
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          const misses = [[x, y - 21], [x, y + 21], [x - 21, y], [x + 21, y]]
            .filter(([px, py]) => px > 0 && px < innerWidth && py > 0 && py < innerHeight)
            .filter(([px, py]) => {
              const hit = document.elementFromPoint(px, py);
              return !hit || !(el.contains(hit) || hit.closest(CONTROL));
            });
          if (misses.length) found.push(`${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) || el.getAttribute('aria-label')} (${Math.round(r.width)}×${Math.round(r.height)})`);
        }
        return found;
      });
      expect(short, path).toEqual([]);
    }
  });
});

test.describe('the rail of silks', () => {
  test('the arrows step the rail, each hiding at its end; a phone swipes it', async ({ page }) => {
    await openNews(page);
    const rail = page.locator('[data-wire-rail]');
    const track = rail.locator('.wire-rail__track');
    const prev = rail.locator('.wire-rail__arrow--prev');
    const next = rail.locator('.wire-rail__arrow--next');
    await expect(rail.locator('.wire-rail__item')).toHaveCount(5);
    if (isPhone(page)) {
      await expect(prev).toBeHidden();
      await expect(next).toBeHidden();
      expect(await track.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      return;
    }
    const scrolls = await track.evaluate((el) => el.scrollWidth > el.clientWidth + 4);
    await expect(prev).toBeHidden();
    await expect(next).toBeVisible({ visible: scrolls });
    if (!scrolls) return;
    await next.click();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await expect(prev).toBeVisible();
  });

  test('the arrows follow the rail when the window changes size', async ({ page }) => {
    test.skip(page.viewportSize().width < 1280, 'all five horses fit only on a wide screen');
    await openNews(page);
    const next = page.locator('[data-wire-rail] .wire-rail__arrow--next');
    await expect(next).toBeHidden();
    const size = page.viewportSize();
    // Narrower than 1280px the rail shows four horses, so the fifth is a step away.
    await page.setViewportSize({ width: 1100, height: size.height });
    await expect(next).toBeVisible();
    await page.setViewportSize(size);
    await expect(next).toBeHidden();
  });
});

test.describe('times', () => {
  test('a filing time from the past week reads how long ago it was', async ({ page }) => {
    await openNews(page);
    const time = page.locator('time[data-wire-ago]').first();
    await expect(time).toHaveAttribute('datetime', '2026-10-30T08:17:02+00:00');
    await expect(time).toHaveText('1 day ago');
  });
});

test.describe('search', () => {
  test('opens from the bar, asks the server, and lists what it finds', async ({ page }) => {
    await openNews(page);
    const toggle = page.locator('[data-wire-search-open]');
    await toggle.click();
    const panel = page.locator('#wire-search');
    await expect(panel).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const box_ = page.locator('#wire-search-q');
    await expect(box_).toBeFocused();
    expect(await page.locator('main').evaluate((el) => el.inert)).toBe(true);

    const asked = page.waitForRequest((r) => new URL(r.url()).pathname === '/news/search/');
    await box_.fill('ascot');
    expect(new URL((await asked).url()).searchParams.get('q')).toBe('ascot');
    const results = panel.locator('[data-wire-search-results] a');
    await expect(results).toHaveCount(6);
    await expect(results.first()).toHaveAttribute('href', '/letters/ascot-2026-10-31/1250/');
    await expect(results.first().locator('span')).toHaveText('LLaMa Letters · 12:50 Ascot');
  });

  test('the search button and the close button are 44px to press', async ({ page }) => {
    await openNews(page);
    const toggle = page.locator('[data-wire-search-open]');
    await toggle.click();
    // Measured once the panel has slid in: mid-slide its box sits on fractions of a pixel.
    await expect(page.locator('#wire-search')).toHaveCSS('transform', 'none');
    for (const button of [toggle, page.locator('#wire-search .wire-drawer__close')]) {
      const { width, height } = await button.boundingBox();
      expect(Math.round(Math.min(width, height))).toBeGreaterThanOrEqual(44);
    }
  });

  test('says when nothing matches, and when the server does not answer', async ({ page }) => {
    await openNews(page);
    await page.locator('[data-wire-search-open]').click();
    const results = page.locator('[data-wire-search-results]');
    await page.locator('#wire-search-q').fill('zzzz');
    await expect(results).toHaveText('No stories match that.');
    await page.route('**/news/search/**', (route) => route.abort());
    await page.locator('#wire-search-q').fill('fox');
    await expect(results).toHaveText('Search is not answering just now. Try again in a moment.');
  });

  test('Escape, the close button and the shade all close it, giving the keyboard back', async ({ page }) => {
    await openNews(page);
    const toggle = page.locator('[data-wire-search-open]');
    const panel = page.locator('#wire-search');
    const shade = page.locator('.wire-scrim');
    const closers = [
      () => page.keyboard.press('Escape'),
      () => panel.locator('.wire-drawer__close').click(),
    ];
    // The panel is 420px wide; on a narrower screen it covers the shade.
    if (page.viewportSize().width > 420) {
      closers.push(async () => {
        await expect(shade).toBeVisible();
        await page.mouse.click(page.viewportSize().width - 4, page.viewportSize().height / 2);
      });
    }
    for (const close of closers) {
      await toggle.click();
      await expect(panel).toBeVisible();
      await close();
      await expect(panel).toBeHidden();
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(await page.locator('main').evaluate((el) => el.inert)).toBe(false);
    }
  });
});

test.describe('the 10:00 Card', () => {
  test('a good address is posted to the server, with its token, and thanked', async ({ page }) => {
    await openNews(page);
    const form = page.locator('[data-wire-card]');
    await expect(form).toHaveAttribute('action', '/news/card/subscribe/');
    await form.locator('input[type="email"]').fill('reader@example.com');
    const sent = page.waitForRequest((r) => new URL(r.url()).pathname === '/news/card/subscribe/');
    await form.locator('button[type="submit"]').click();
    const posted = new URLSearchParams((await sent).postData());
    expect(posted.get('email')).toBe('reader@example.com');
    expect(posted.get('csrfmiddlewaretoken')).toBe('sandbox');
    const status = page.locator('[data-wire-card-status]');
    await expect(status).toHaveText('You\'re on the list. The next Card comes to reader@example.com at 10:00 on the next race day.');
    await expect(status).toHaveAttribute('data-state', 'ok');
    await expect(form.locator('input[type="email"]')).toHaveValue('');
  });

  test('the browser holds back an address that is not one', async ({ page }) => {
    await openNews(page);
    let posted = false;
    page.on('request', (r) => { if (new URL(r.url()).pathname === '/news/card/subscribe/') posted = true; });
    const form = page.locator('[data-wire-card]');
    await form.locator('input[type="email"]').fill('not an address');
    await form.locator('button[type="submit"]').click();
    expect(await form.locator('input[type="email"]').evaluate((el) => el.validity.valid)).toBe(false);
    expect(posted).toBe(false);
  });

  test('shows the server\'s reason for a no, and says so when it cannot be reached', async ({ page }) => {
    await openNews(page);
    const form = page.locator('[data-wire-card]');
    const status = page.locator('[data-wire-card-status]');
    await page.route('**/news/card/subscribe/', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'That address is already on the list.' }) }));
    await form.locator('input[type="email"]').fill('reader@example.com');
    await form.locator('button[type="submit"]').click();
    await expect(status).toHaveText('That address is already on the list.');
    await expect(status).toHaveAttribute('data-state', 'error');
    await page.unroute('**/news/card/subscribe/');
    await page.route('**/news/card/subscribe/', (route) => route.abort());
    await form.locator('button[type="submit"]').click();
    await expect(status).toHaveText('The Card could not be reached just now. Try again in a moment.');
  });
});

test.describe('article pages', () => {
  test('the side boxes sit beside the story, dropping under it on narrower screens', async ({ page }) => {
    await openNews(page, { path: ARTICLES[3] });
    const main = await box(page.locator('.wire-art__main'));
    const side = await box(page.locator('.wire-art__side'));
    if (page.viewportSize().width >= 1024) expect(side.left).toBeGreaterThan(main.right);
    else expect(side.top).toBeGreaterThanOrEqual(main.bottom);
  });

  test('More from The Fox’s Wire links four more stories', async ({ page }) => {
    await openNews(page, { path: LETTERS[2] });
    const more = page.locator('#more-title');
    await expect(more).toHaveText('More from The Fox’s Wire');
    await expect(page.locator('.wire-grid--4 .wire-card')).toHaveCount(4);
  });
});
