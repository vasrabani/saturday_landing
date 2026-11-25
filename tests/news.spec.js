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
import { ARTICLES, FRONT_PAGE, LETTERS, NEWS_PAGES, NEWS_SECTIONS, SIGNAL_BOARD, WATCHLIST, box, openNews } from './support/news.js';

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
    for (const path of [FRONT_PAGE, ARTICLES[0], WATCHLIST, SIGNAL_BOARD, LETTERS[0]]) {
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
    for (const path of [FRONT_PAGE, ARTICLES[3], WATCHLIST, SIGNAL_BOARD, LETTERS[2]]) {
      await openNews(page, { path });
      const local =await page.locator('main a[href], .wire-drawer a[href]').evaluateAll((links) =>
        [...new Set(links.map((a) => a.href).filter((href) => href.startsWith(window.location.origin)))]);
      for (const href of local) expect((await request.get(href)).status(), `${path} -> ${href}`).toBe(200);
    }
  });

  test('nothing is set in italic', async ({ page }) => {
    // Horses to Watch sets Sly's own words, his take and his verdict, in
    // italic as quotes, and Top Rated his line on the Top Signal
    // (wire_article.css); nothing else on any page is.
    const quotes = {
      [WATCHLIST]: '.wire-pick__lead, .wire-verdict > p:not([class])',
      [SIGNAL_BOARD]: '.wire-tr-hero__quote',
    };
    for (const path of [FRONT_PAGE, ARTICLES[3], WATCHLIST, SIGNAL_BOARD, LETTERS[0]]) {
      await openNews(page, { path });
      const italic =await page.evaluate((allowed) =>
        Array.from(document.querySelectorAll('body, body *'))
          .filter((el) => getComputedStyle(el).fontStyle !== 'normal')
          .filter((el) => !(allowed && el.closest(allowed)))
          .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '')), quotes[path] ?? '');
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
    for (const path of [FRONT_PAGE, ARTICLES[2], WATCHLIST, SIGNAL_BOARD, LETTERS[0]]) {
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

/*
 * Sly Man's Horses to Watch, light: "Your afternoon" under the Wire's
 * floodlit photograph, the five as white stops barred in their signal's
 * colour, each going to its card and opening its full case; each card a
 * photographed head (silks, name, price, the signal's chip, connections,
 * result) bordered in the signal's colour, then Sly's take, his full case
 * behind "Sly's full case", and Pick, kept in this browser for the page.
 */
test.describe('Horses to Watch', () => {
  const nameOf = (text) => text.replace(/^\s*\d+\s*/, '').trim();
  const NONE_PICKED = 'Make your picks: press Pick on any horse below';

  test('Your afternoon: the five in order of the off, each in its signal’s colour, each going to its card', async ({ page }) => {
    await openNews(page, { path: WATCHLIST, tour: false });
    const order = page.locator('.wire-htw-order');
    // The Wire's floodlit photograph heads it.
    expect(await order.evaluate((el) => getComputedStyle(el, '::before').backgroundImage)).toContain('lead.webp');
    const stops = order.locator('.wire-htw-stop');
    await expect(stops).toHaveCount(5);

    const seen = await stops.evaluateAll((items) => items.map((li) => ({
      time: li.querySelector('.wire-htw-stop__when b').textContent.trim(),
      name: li.querySelector('.wire-htw-stop__name').textContent.trim(),
      price: li.querySelector('.wire-htw-stop__price').textContent.trim(),
      result: li.querySelector('.wire-tr-result')?.textContent.trim() ?? '',
      bar: getComputedStyle(li.querySelector('a'), '::before').backgroundColor,
      target: li.querySelector('a').getAttribute('href'),
    })));
    const times = seen.map((stop) => stop.time);
    expect(times).toEqual([...times].sort());

    // Each stop agrees with the card it goes to: name, price, result, and
    // the signal's colour (the stop's bar, the card's border).
    for (const stop of seen) {
      const card = page.locator(`.wire-pick${stop.target}`);
      await expect(card, stop.target).toHaveCount(1);
      expect(nameOf(await card.locator('.wire-pick__name').textContent())).toBe(stop.name);
      await expect(card.locator('.wire-tr-price b')).toHaveText(stop.price);
      await expect(card.locator('.wire-pick__stamp')).toHaveText(stop.result);
      await expect(card.locator('.wire-pick__silk img')).toHaveAttribute('alt', `${stop.name} silks`);
      await expect(card).toHaveCSS('border-top-color', stop.bar);
    }
  });

  test('on a phone the five read as a timetable, a row each; wider, they share one row', async ({ page }) => {
    await openNews(page, { path: WATCHLIST, tour: false });
    // Laid-out positions (offsetTop): the stops slide in one after another,
    // which moves where they are drawn, not where they sit.
    const { rows, overflow } = await page.locator('.wire-htw-order__list').evaluate((ol) => ({
      rows: new Set([...ol.children].map((li) => li.offsetTop)).size,
      overflow: ol.scrollWidth - ol.clientWidth,
    }));
    expect(overflow).toBeLessThanOrEqual(0);
    expect(rows).toBe(isPhone(page) ? 5 : 1);
  });

  // A stop's link is in-page: site.js glides there itself and leaves the
  // address alone; the page's script opens the card's full case. site.js
  // measures the card while its rise into view still holds it 28px low, so
  // the card can come to rest up to that much higher than site.js meant.
  test('a stop glides to its horse’s card and opens Sly’s full case', async ({ page }) => {
    await openNews(page, { path: WATCHLIST, tour: false });
    const stop = page.locator('.wire-htw-stop a').first();
    const card = page.locator(await stop.getAttribute('href'));
    const more = card.locator('.wire-pick__more');
    expect(await more.evaluate((details) => details.open)).toBe(false);
    await stop.click();
    await expect.poll(() => more.evaluate((details) => details.open)).toBe(true);
    await expect.poll(() => card.evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      const bar = document.querySelector('#siteNav').getBoundingClientRect().bottom;
      return top >= bar - 30 && top < bar + 60;
    })).toBe(true);
  });

  test('a card opened by its own address opens its full case, the others stay closed', async ({ page }) => {
    await openNews(page, { path: `${WATCHLIST}#pick-3`, tour: false });
    const open = await page.locator('.wire-pick__more').evaluateAll((all) =>
      all.filter((details) => details.open).map((details) => details.closest('.wire-pick').id));
    expect(open).toEqual(['pick-3']);
  });

  test('a card: a photographed head, Sly’s take, and his full case behind its pill', async ({ page }) => {
    await openNews(page, { path: WATCHLIST, tour: false });
    const photos = new Set();
    for (const card of await page.locator('.wire-pick').all()) {
      photos.add(await card.evaluate((el) => getComputedStyle(el).getPropertyValue('--wire-htw-photo').trim()));
      const silks = await box(card.locator('.wire-pick__silk img'));
      const name = await box(card.locator('.wire-pick__name'));
      const price = await box(card.locator('.wire-tr-price b'));
      const lead = await box(card.locator('.wire-pick__lead'));
      expect(silks.right).toBeLessThan(name.left);
      expect(price.left).toBeGreaterThan(name.left);
      expect(lead.top).toBeGreaterThan(Math.max(silks.bottom, name.bottom));
      expect(await card.locator('.wire-pick__lead').evaluate((el) => getComputedStyle(el, '::after').content)).toBe(`"Sly's take"`);

      // The full case waits behind its pill; the racecard is inside it.
      const more = card.locator('.wire-pick__more');
      await expect(more.locator('summary')).toHaveText("Sly's full case");
      await expect(card.locator('.wire-pick__case')).toBeHidden();
      await more.locator('summary > span').click();
      await expect(card.locator('.wire-pick__case')).toBeVisible();
      const racecard = card.locator('.wire-pick__links a').first();
      await expect(racecard).toHaveText(/View the racecard/);
      expect((await box(racecard)).height).toBeGreaterThanOrEqual(44);
    }
    // Each card its own photograph.
    expect(photos.size).toBe(5);
  });

  test('Pick: a pick shows on its card, its stop and the tally, and is still there when the page is opened again', async ({ page }) => {
    await openNews(page, { path: WATCHLIST, tour: false });
    const tally = page.locator('.wire-htw-order__picks');
    await expect(tally).toHaveText(NONE_PICKED);
    await expect(page.locator('.wire-pick__pick')).toHaveCount(5);

    const card = page.locator('.wire-pick').nth(1);
    const id = await card.getAttribute('id');
    const pick = card.locator('.wire-pick__pick');
    await expect(pick).toHaveAttribute('aria-pressed', 'false');
    await pick.click();
    await expect(pick).toHaveAttribute('aria-pressed', 'true');
    await expect(pick).toHaveText('Picked');
    await expect(card).toHaveClass(/is-picked/);
    await expect(page.locator('.wire-htw-stop').filter({ has: page.locator(`a[href="#${id}"]`) })).toHaveClass(/is-picked/);
    await expect(tally).toHaveText('Your picks: 1 of 5');
    // A pick does not open the card.
    expect(await card.locator('.wire-pick__more').evaluate((details) => details.open)).toBe(false);

    // Kept in this browser for this page.
    await page.reload();
    await expect(page.locator(`#${id} .wire-pick__pick`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.wire-htw-order__picks')).toHaveText('Your picks: 1 of 5');

    // And taken back.
    await page.locator(`#${id} .wire-pick__pick`).click();
    await expect(page.locator(`#${id} .wire-pick__pick`)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.wire-htw-order__picks')).toHaveText(NONE_PICKED);
  });

  test('the result shows once, under the price', async ({ page }) => {
    await openNews(page, { path: WATCHLIST, tour: false });
    for (const card of await page.locator('.wire-pick').all()) {
      await expect(card.locator('.wire-pick__stamp')).toBeVisible();
      await expect(card.locator('.wire-pick__links > .wire-tr-result')).toBeHidden();
      const stamp = await box(card.locator('.wire-pick__stamp'));
      const price = await box(card.locator('.wire-tr-price'));
      expect(stamp.top).toBeGreaterThanOrEqual(price.bottom - 1);
      expect(Math.abs(stamp.right - price.right)).toBeLessThan(4);
    }
  });
});

/*
 * Sly Man's Top Rated in its new dress (Friday 20 November): a contents
 * line to each part; the Top Signal as a photographed card, its six
 * signals behind a pill; Sly's column; the Signal Board, every horse a
 * photographed card in its kind's colour, with Pick, a slot each under the
 * scoreboard, Sly's Fold in one press and the board read strongest first
 * or by race time; picks kept in this browser for the page.
 */
test.describe('Top Rated', () => {
  const NONE_PICKED = 'Make your picks: press Pick on any horse below';
  const rows = (page) => page.locator('.wire-tr-board > .wire-tr-row:not(.wire-tr-row--head)');
  const names = (page) => rows(page).evaluateAll((all) =>
    all.map((row) => row.querySelector('.wire-tr-row__name a').textContent.trim()));

  test('a contents line leads to each part of the page', async ({ page }) => {
    await openNews(page, { path: SIGNAL_BOARD, tour: false });
    const links = page.locator('.wire-tr-jump a');
    await expect(links).toHaveText(['Top Signal', 'Sly’s take', 'Signal Board', 'Ratings', 'Consensus', 'The Money']);
    for (const href of await links.evaluateAll((all) => all.map((a) => a.getAttribute('href')))) {
      await expect(page.locator(href), href).toHaveCount(1);
    }
    // In-page, so site.js glides there itself: the board comes up under the bar.
    await links.nth(2).click();
    await expect.poll(() => page.locator('#tr-signal-board').evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      const bar = document.querySelector('#siteNav').getBoundingClientRect().bottom;
      return top >= bar - 30 && top < bar + 60;
    })).toBe(true);
  });

  test('the Top Signal: a photographed card with its count, and its six signals behind a pill', async ({ page }) => {
    await openNews(page, { path: SIGNAL_BOARD, tour: false });
    const card = page.locator('.wire-tr-hero__card');
    expect(await card.evaluate((el) => getComputedStyle(el, '::before').backgroundImage)).toContain('tr/hero.webp');
    await expect(page.locator('.wire-tr-hero__count')).toHaveText('2 of 6 signals agree');
    const more = page.locator('.wire-tr-hero__more');
    await expect(more.locator('summary')).toHaveText('The six signals');
    await expect(more.locator('.wire-tr-lights')).toBeHidden();
    await more.locator('summary').click();
    await expect(more.locator('.wire-tr-lights')).toBeVisible();
    await expect(more.locator('.wire-tr-light')).toHaveCount(6);
    await expect(more.locator('a.wire-tr-go')).toHaveText(/View the racecard/);
  });

  test('the Signal Board: every horse a photographed card of its own, bordered in its kind’s colour', async ({ page }) => {
    await openNews(page, { path: SIGNAL_BOARD, tour: false });
    expect(await page.locator('.wire-tr-panel').evaluate((el) => getComputedStyle(el, '::before').backgroundImage)).toContain('tr/board.webp');
    await expect(rows(page)).toHaveCount(8);
    const seen = await rows(page).evaluateAll((all) => all.map((row) => ({
      photo: getComputedStyle(row).getPropertyValue('--tr-photo').trim(),
      kind: row.querySelector('.wire-tr-badge').className,
      border: getComputedStyle(row).borderTopColor,
    })));
    expect(new Set(seen.map((row) => row.photo)).size).toBe(8);
    // One colour per kind, and no two kinds share one.
    const colourOf = {};
    for (const { kind, border } of seen) {
      colourOf[kind] ??= border;
      expect(border, kind).toBe(colourOf[kind]);
    }
    expect(new Set(Object.values(colourOf)).size).toBe(Object.keys(colourOf).length);
  });

  test('Pick: a pick shows on its card, its slot and the tally, and is still there when the page is opened again', async ({ page }) => {
    await openNews(page, { path: SIGNAL_BOARD, tour: false });
    const tally = page.locator('.wire-tr-panel__tally');
    await expect(tally).toHaveText(NONE_PICKED);
    // The Top Signal and the eight on the board.
    await expect(page.locator('.wire-tr-pick')).toHaveCount(9);

    const row = rows(page).nth(2);
    const pick = row.locator('.wire-tr-pick');
    await expect(pick).toHaveAttribute('aria-pressed', 'false');
    await pick.click();
    await expect(pick).toHaveAttribute('aria-pressed', 'true');
    await expect(pick).toHaveText('Picked');
    await expect(row).toHaveClass(/is-picked/);
    await expect(page.locator('.wire-tr-slots a').nth(2)).toHaveClass(/is-picked/);
    await expect(tally).toHaveText('Your picks: 1 of 8');

    // Kept in this browser for this page.
    await page.reload();
    await expect(rows(page).nth(2).locator('.wire-tr-pick')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.wire-tr-panel__tally')).toHaveText('Your picks: 1 of 8');

    // And taken back.
    await rows(page).nth(2).locator('.wire-tr-pick').click();
    await expect(page.locator('.wire-tr-panel__tally')).toHaveText(NONE_PICKED);
  });

  test('a horse picked on the Top Signal is picked on the board as well', async ({ page }) => {
    await openNews(page, { path: SIGNAL_BOARD, tour: false });
    const name = (await page.locator('.wire-tr-hero__name a').textContent()).trim();
    await page.locator('.wire-tr-hero .wire-tr-pick').click();
    const row = rows(page).filter({ has: page.locator('.wire-tr-row__name a', { hasText: name }) });
    await expect(row).toHaveCount(1);
    await expect(row).toHaveClass(/is-picked/);
    await expect(row.locator('.wire-tr-pick')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.wire-tr-panel__tally')).toHaveText('Your picks: 1 of 8');
  });

  test('Sly’s Fold in one press: every horse two signals or more agree on', async ({ page }) => {
    await openNews(page, { path: SIGNAL_BOARD, tour: false });
    const fold = await rows(page).evaluateAll((all) =>
      all.filter((row) => row.querySelectorAll('.wire-tr-pips .is-on').length >= 2).map((row) => row.id));
    expect(fold.length).toBeGreaterThan(0);
    const button = page.locator('.wire-tr-fold');
    await expect(button).toHaveText(`Pick Sly’s Fold (${fold.length})`);
    await button.click();
    for (const id of fold) await expect(page.locator(`#${id}`)).toHaveClass(/is-picked/);
    await expect(button).toBeDisabled();
    await expect(button).toHaveText('Sly’s Fold is in your picks');
    await expect(page.locator('.wire-tr-panel__tally')).toHaveText(`Your picks: ${fold.length} of 8`);
  });

  test('the board reads strongest first or by race time', async ({ page }) => {
    await openNews(page, { path: SIGNAL_BOARD, tour: false });
    const strongest = await names(page);
    const byTime = page.locator('.wire-tr-sort button[data-sort="time"]');
    await expect(page.locator('.wire-tr-sort button[data-sort="rank"]')).toHaveAttribute('aria-pressed', 'true');
    await byTime.click();
    await expect(byTime).toHaveAttribute('aria-pressed', 'true');
    const times = await rows(page).evaluateAll((all) => all.map((row) =>
      row.querySelector('.wire-tr-row__sub').textContent.match(/\d{1,2}:\d{2}/)[0].padStart(5, '0')));
    expect(times).toEqual([...times].sort());
    await page.locator('.wire-tr-sort button[data-sort="rank"]').click();
    expect(await names(page)).toEqual(strongest);
  });

  test('with a horse picked, a floating tally leads back to the board while the board is out of sight', async ({ page }) => {
    await openNews(page, { path: SIGNAL_BOARD, tour: false });
    const dock = page.locator('.wire-tr-dock');
    await expect(dock).not.toHaveClass(/is-on/);
    await rows(page).first().locator('.wire-tr-pick').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(dock).toHaveClass(/is-on/);
    await expect(dock).toContainText('Your picks');
    await expect(dock).toHaveAttribute('href', '#tr-signal-board');
    await page.locator('.wire-tr-panel__picks').scrollIntoViewIfNeeded();
    await expect(dock).not.toHaveClass(/is-on/);
  });
});
