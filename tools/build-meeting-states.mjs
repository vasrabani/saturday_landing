// Build meeting-states.html: every state the meeting page can render, on
// one page, so they can be looked at rather than imagined.
//
//   node tools/build-meeting-states.mjs
//
// Most of the page's states only exist once it is running: the slip is
// filled by bet_slip.js as runners are picked, the ticket and the six
// places by meeting_slip.js, the filters and the phone card's Details by
// meeting_racecard.js, a winner by meeting_full.js. So this drives the
// real page in a browser — meeting.html for the day with results in,
// meeting-upcoming.html for the evening before — and captures what it
// produces, rather than writing markup of its own.
//
// A case is put back the way the page has it. A race or a runner goes
// inside a .mf-races, the race list, which is the container its layout
// measures (table, two lines or a card: a container query named
// `races`); the slip goes outside it, as on the page. Most cases are
// inline. The ones that depend on the width of the window itself — the
// phone's masthead, card, bar and sheet, which meeting.css sets by media
// query — and the one that depends on an attribute on <html> (the
// comments folded away) are each rendered in an <iframe> of their own,
// at their own width, with the same stylesheets.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

import { startServer } from './serve.mjs';

const PORT = 4177;
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const CAPTURED_AT = new Date('2026-10-09T21:30:00+01:00');
const PHONE = { width: 390, height: 844 };
// The slip, fixed to the foot of a phone's screen, keeps clear of the
// navigation (60px) and a 24px margin above itself; a window that shows
// it whole is that much taller than the slip.
const ABOVE_THE_SLIP = 60 + 24 + 12;

const raw = readFileSync('meeting.html', 'utf8');
const newline = raw.indexOf(CR + LF) >= 0 ? CR + LF : LF;
const head = raw
  .slice(raw.indexOf('<link rel="stylesheet"'), raw.indexOf('</head>'))
  .split(CR + LF).join(LF);
// bet_slip.js keeps the day's slip under this key; the over-six case
// seeds it the way the live page would have left it.
const STORAGE_KEY = /data-storage-key="([^"]+)"/.exec(raw)[1];

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attribute = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
/** A race or a runner, back inside the race list its layout measures. */
const inRaces = (markup) => (markup ? `<div class="mf-races">${markup}</div>` : markup);

const server = await startServer({ root: process.cwd(), port: PORT });
const browser = await chromium.launch();

const STATES = [];
/** A case: inline, or (with a `frame`) in an iframe of that width and height. */
const add = (name, when, markup, frame = null) => {
  if (!markup) {
    console.warn(`  ! skipped (not on the page): ${name}`);
    return;
  }
  STATES.push({ name, when, markup, frame });
};

/** A page at a width, with the clock pinned to the capture evening. */
async function open(file, { width, height }, { seed } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 768, hasTouch: width < 768 });
  if (seed) await context.addInitScript(seed.script, seed.arg);
  const page = await context.newPage();
  await page.clock.setFixedTime(CAPTURED_AT);
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load' });
  await page.evaluate(async () => { await document.fonts.ready; });
  return page;
}

/** The markup, and the height, of the nth element a selector finds (the first by default). */
const outer = (page, selector, nth = 0) =>
  page.evaluate(([sel, i]) => document.querySelectorAll(sel)[i]?.outerHTML ?? null, [selector, nth]);
const tall = (page, selector, nth = 0) =>
  page.evaluate(([sel, i]) => Math.ceil(document.querySelectorAll(sel)[i]?.getBoundingClientRect().height ?? 0), [selector, nth]);
const wait = (page, ms) => page.waitForTimeout(ms);

/**
 * Press Pick on the first priced runner of races not yet picked in,
 * until the slip holds n picks. (A second press on a picked runner
 * would take it out again, so races with a pick are passed over.)
 */
const pick = (page, n) =>
  page.evaluate(async (count) => {
    const priced = (row) => Number.isFinite(parseFloat(row.dataset.oddsDecimal));
    const picks = () => document.querySelectorAll('#slipLegs .mf-slip__leg').length;
    for (const race of document.querySelectorAll('.mf-race[id]')) {
      if (picks() >= count) break;
      if (race.classList.contains('mf-race--has-selection')) continue;
      const row = Array.from(race.querySelectorAll('.racecard__runner')).find(priced);
      if (!row) continue;
      row.querySelector('[data-action="add-to-slip"]').click();
      await new Promise((r) => setTimeout(r, 60));
    }
    // bet_slip.js's "Added…" shows for 1.8s; let it go before a capture.
    await new Promise((r) => setTimeout(r, 2200));
  }, n);

// ── The laptop: the day with results in ───────────────────────────────
const LAPTOP = { width: 1440, height: 900 };
let page = await open('meeting.html', LAPTOP);

add('Masthead · results in', 'the meeting template: the course, the date, the figures, the chips; Pick Six as three stickers; the homepage picture under the gradients',
  await outer(page, '.mf-hero'));
add('Meeting tabs and race strip', 'the meeting switcher and the jump nav: the day\'s other meetings, and one chip a race (all run, so all --done)',
  (await outer(page, '.mf-switcher')) + (await outer(page, '.mf-jump')));
add('Race · results in, runners as a table', 'the race partial with the result: the time, the name, the tags, the trip drawn as a ruler, the filters, Reveal winner; each runner a row with its form in colour, the favourite and the top rating marked',
  inRaces(await outer(page, '.mf-race')));

await page.locator('[data-action="reveal-result"]').first().click();
await wait(page, 300);
add('Race head · winner revealed', 'meeting_full.js: the pill turned over (aria-pressed) and the winner named',
  inRaces(await outer(page, '.mf-race .mf-race__head')));

await page.locator('.mfr-switch').first().click();
await wait(page, 300);
add('Race · comments folded away', 'meeting_racecard.js: the Comments switch sets data-mfr-compact on <html>; the rows are figures only',
  inRaces(await outer(page, '.mf-race', 1)),
  { width: 1200, height: (await tall(page, '.mf-race', 1)) + 24, compact: true });
await page.locator('.mfr-switch').first().click();

await page.locator('.mfr-filter[data-filter="top-ai"]').first().click();
await wait(page, 300);
add('Race · filtered to Top AI', 'meeting_racecard.js: rows that do not match carry data-mfr-hidden; the filter is pressed',
  inRaces(await outer(page, '.mf-race')));
await page.locator('.mfr-filter[data-filter="all"]').first().click();

add('Slip · empty', 'bet_slip.js: nothing picked; meeting_slip.js: six open places on the rail',
  await outer(page, '#betSlip'));

await pick(page, 3);
add('Slip · three picks', 'bet_slip.js writes each pick; meeting_slip.js dresses it with its silks, number cloth and jockey, and takes three places',
  await outer(page, '#betSlip'));

await pick(page, 6);
add('Slip · full, six picks', 'six places taken; the count reads full; every Pick in a race without a pick is stood down (data-mfr-shut)',
  await outer(page, '#betSlip'));
add('Pick stood down', 'the slip is full: the button stays pressable, with a tooltip saying why',
  inRaces(await outer(page, '.racecard__runner:has([data-mfr-shut])')));

await page.evaluate(() => document.querySelector('[data-action="add-to-slip"][data-mfr-shut]')?.click());
await wait(page, 300);
add('Message · a seventh race refused', 'meeting_slip.js stops the press before bet_slip.js hears it, and says why',
  await outer(page, '.mfr-toast.is-visible'));
await page.context().close();

// ── Over six: a slip filled where the limit is not kept ───────────────
page = await open('meeting.html', LAPTOP, {
  seed: {
    // bet_slip.js's own record of the day's slip, as the live page writes
    // it: seven picks, as a visitor could make on the live page today.
    script: (key) => {
      const picks = [];
      for (let i = 0; i < 7; i += 1) {
        picks.push({ runnerId: String(9000 + i), raceId: String(8000 + i), raceTime: `1${i}:00`, raceName: `Race ${i + 1}`, course: 'Chepstow', horseName: `Horse ${i + 1}`, oddsFractional: '5/1', oddsDecimal: 6 });
      }
      window.localStorage.setItem(key, JSON.stringify(picks));
    },
    arg: STORAGE_KEY,
  },
});
await wait(page, 500);
add('Slip · seven picks, from elsewhere', 'the day\'s slip arrived with more than six (made at another meeting, before the limit): kept, counted over, a jockey\'s cap where no silks were seen; nothing more is taken until two are out',
  await outer(page, '#betSlip'));
await page.context().close();

// ── The evening before ────────────────────────────────────────────────
page = await open('meeting-upcoming.html', LAPTOP);
add('Masthead · before racing', 'the meeting template the evening before: the first off still to come',
  await outer(page, '.mf-hero'));
add('Race · before racing', 'the race partial before the off: no numbers yet, most runners at SP, the AI verdict panel under the race',
  inRaces(await outer(page, '.mf-race')));
add('AI verdict panel', 'chamber_verdict: the panel the site renders under a race before the off',
  inRaces(await outer(page, '.cv')));
await page.context().close();

// ── The phone ─────────────────────────────────────────────────────────
// These depend on the window's width (meeting.css sets the phone's
// masthead, bar and sheet by media query), so each has a window of its
// own, a phone wide.
page = await open('meeting.html', PHONE);
add('Masthead · phone', 'under 768px: the live page\'s own column — eyebrow, date, name, Pick Six, figures, chips — with the horse at the right edge',
  await outer(page, '.mf-hero'), { width: PHONE.width, height: (await tall(page, '.mf-hero')) + 16 });
add('Runner · phone card', 'under 660px of room a runner is a card: silks, name, the AI tier, jockey and trainer, form, figures, Pick and Details',
  inRaces(await outer(page, '.mf-race .racecard__runner')),
  { width: PHONE.width, height: (await tall(page, '.mf-race .racecard__runner')) + 16 });
await page.locator('.mfr-more').first().click();
await wait(page, 300);
add('Runner · phone card, Details open', 'meeting_racecard.js: data-mfr-open on the row shows the comment and the AI verdict',
  inRaces(await outer(page, '.mf-race .racecard__runner')),
  { width: PHONE.width, height: (await tall(page, '.mf-race .racecard__runner')) + 16 });
await pick(page, 2);
add('Slip bar · phone', 'below 1024px the slip is a bar at the foot of the screen: the count out of six and the picks\' silks',
  await outer(page, '#betSlip'), { width: PHONE.width, height: (await tall(page, '#slipHandle')) + ABOVE_THE_SLIP });
await page.locator('#slipHandle').click();
await wait(page, 400);
add('Slip sheet · phone, open', 'bet_slip.js opens the sheet (is-open); the ticket and the places inside it, the tap-outside backdrop behind',
  (await outer(page, '#betSlip')) + (await outer(page, '.mfr-slip-backdrop')),
  { width: PHONE.width, height: (await tall(page, '#betSlip')) + ABOVE_THE_SLIP });
await page.context().close();

await browser.close();
server.close?.();

/** A case that needs a window of its own: the same stylesheets, its width. */
const framed = (state) => {
  const doc = `<!doctype html>
<html lang="en-GB"${state.frame.compact ? ' data-mfr-compact' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${head}
<style>
  /* The page's own ground and gutters; none of its space above or below. */
  body { margin: 0; background: var(--c-paper, #fafaf7); }
  .states-wrap { padding-block: 0; }
</style>
</head>
<body class="page-meeting-full"><div class="mf-wrap states-wrap">${state.markup}</div></body>
</html>`;
  return `<iframe class="states-iframe" title="${attribute(state.name)}" height="${state.frame.height}" loading="lazy" srcdoc="${attribute(doc)}"></iframe>`;
};

const html = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Meeting page states · Saturday Racing</title>
${head}
    <style>
      /* Page furniture only — the cases below use the real stylesheet.
         The meeting page is a paper page (its .site-main paints the
         ground), so the doc and the frames match it: a case should look
         the way it does in situ. */
      body.page-meeting-full { background: var(--c-paper, #fafaf7); }
      .states-doc { max-width: 1480px; margin: 0 auto; padding: 48px 24px 96px; font-family: var(--font-body, system-ui); color: var(--c-ink, #11151f); }
      .states-doc > h1 { font-size: 36px; margin: 0 0 8px; }
      .states-doc__intro { color: var(--c-ink-70, #41474f); line-height: 1.7; max-width: 70ch; }
      .states-case { margin-top: 56px; border-top: 1px solid var(--c-rule, #e7e5dd); padding-top: 20px; }
      .states-case__name { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
      .states-case__when { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--c-gold-ink, #9c7b12); margin: 0 0 16px; }
      /* Paint containment keeps a case inside its own frame: the slip and
         the toast are fixed or sticky on the real page and would otherwise
         float across every case below them. */
      .states-frame { border: 1px solid var(--c-rule, #e7e5dd); border-radius: 12px; overflow: hidden; margin-top: 16px; padding: 16px; background: var(--c-paper, #fafaf7); position: relative; contain: layout paint; }
      /* A window of its own: as wide as the window it stands for (the
         width is set on the frame; the iframe fills it), narrower only
         where this page is. */
      .states-frame--window { padding: 0; max-width: 100%; box-sizing: content-box; }
      .states-iframe { display: block; border: 0; width: 100%; }
      /* Inline, the frame is the page: its type and measure, no gutters
         of its own, and what the page pins standing where it is put. */
      .states-wrap { padding: 0; max-width: none; }
      .states-wrap > .mf-hero { margin: 0; }
      .states-wrap > .mf-slip { position: relative; inset: auto; transform: none; width: auto; max-width: 360px; max-height: none; margin: 0; }
      .states-wrap > .mfr-toast { position: relative; inset: auto; transform: none; display: inline-flex; }
    </style>
  </head>
  <body class="page-meeting-full">
    <div class="states-doc">
      <h1>Meeting page states</h1>
      <p class="states-doc__intro">
        Every state the meeting page can render, so each one can be designed
        rather than imagined. Generated from <code>meeting.html</code> and
        <code>meeting-upcoming.html</code> by
        <code>node tools/build-meeting-states.mjs</code>, which drives the real
        page — the slip, the filters, the revealed winner and the phone card
        are captured from it, not written here. A case that depends on the
        width of the window (the phone's) or on the page's own state (the
        comments folded away) is shown in a window of its own.
      </p>
${STATES.map((state) => `      <section class="states-case">
        <p class="states-case__name">${escape(state.name)}</p>
        <p class="states-case__when">${escape(state.when)}</p>
        ${state.frame
          ? `<div class="states-frame states-frame--window" style="width: ${state.frame.width}px">\n${framed(state)}\n        </div>`
          : `<div class="states-frame"><div class="mf-wrap states-wrap">\n${state.markup}\n        </div></div>`}
      </section>`).join('\n')}
    </div>
  </body>
</html>
`;

writeFileSync('meeting-states.html', html.split(LF).join(newline), 'utf8');
console.log(`meeting-states.html: ${STATES.length} states rendered (${STATES.filter((s) => s.frame).length} in windows of their own)`);
