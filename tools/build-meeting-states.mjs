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
// produces, at a laptop width and at a phone's, rather than writing
// markup of its own.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

import { startServer } from './serve.mjs';

const PORT = 4177;
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

const raw = readFileSync('meeting.html', 'utf8');
const newline = raw.indexOf(CR + LF) >= 0 ? CR + LF : LF;
const head = raw
  .slice(raw.indexOf('<link rel="stylesheet"'), raw.indexOf('</head>'))
  .split(CR + LF).join(LF);

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const server = await startServer({ root: process.cwd(), port: PORT });
const browser = await chromium.launch();

const STATES = [];
const add = (name, when, markup, { width } = {}) => {
  if (!markup) {
    console.warn(`  ! skipped (not on the page): ${name}`);
    return;
  }
  STATES.push({ name, when, markup, width });
};

/** A page at a width, with the clock pinned to the capture evening. */
async function open(file, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 768, hasTouch: width < 768 });
  await page.clock.setFixedTime(new Date('2026-10-09T21:30:00+01:00'));
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load' });
  await page.evaluate(async () => { await document.fonts.ready; });
  return page;
}

const outer = (page, selector) => page.evaluate((sel) => document.querySelector(sel)?.outerHTML ?? null, selector);
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
let page = await open('meeting.html', 1440, 900);

add('Masthead · results in', 'meeting_full.html: the course, the date, the figures, the chips; Pick Six as three stickers; the homepage picture under the gradients',
  await outer(page, '.mf-hero'));
add('Meeting tabs and race strip', '_meeting_switcher.html and the jump nav: the day\'s other meetings, and one chip a race (all run, so all --done)',
  (await outer(page, '.mf-switcher')) + (await outer(page, '.mf-jump')));
add('Race · results in, runners as a table', '_race.html with the result: the time, the name, the tags, the trip drawn as a ruler, the filters, Reveal winner; each runner a row with its form in colour, the favourite and the top rating marked',
  await outer(page, '.mf-race'));

await page.locator('[data-action="reveal-result"]').first().click();
await wait(page, 300);
add('Race head · winner revealed', 'meeting_full.js: the pill turned over (aria-pressed) and the winner named',
  await outer(page, '.mf-race .mf-race__head'));

await page.locator('.mfr-switch').first().click();
await wait(page, 300);
add('Race · comments folded away', 'meeting_racecard.js: the Comments switch sets data-mfr-compact on <html>; the rows are figures only',
  await page.evaluate(() => '<div data-mfr-compact-case>' + document.querySelectorAll('.mf-race')[1].outerHTML + '</div>'));
await page.locator('.mfr-switch').first().click();

await page.locator('.mfr-filter[data-filter="top-ai"]').first().click();
await wait(page, 300);
add('Race · filtered to Top AI', 'meeting_racecard.js: rows that do not match carry data-mfr-hidden; the filter is pressed',
  await outer(page, '.mf-race'));
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
  await page.evaluate(() => {
    const row = document.querySelector('.racecard__runner:has([data-mfr-shut])');
    return row ? row.outerHTML : null;
  }));

await page.evaluate(() => {
  const btn = document.querySelector('[data-action="add-to-slip"][data-mfr-shut]');
  if (btn) btn.click();
});
await wait(page, 300);
add('Message · a seventh race refused', 'meeting_slip.js stops the press before bet_slip.js hears it, and says why',
  await outer(page, '.mfr-toast.is-visible'));
await page.close();

// ── Over six: a slip filled where the limit is not kept ───────────────
page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  // bet_slip.js's own record of the day's slip, as the live page writes
  // it: seven picks, as a visitor could make on the live page today.
  const picks = [];
  for (let i = 0; i < 7; i += 1) picks.push({ runnerId: String(9000 + i), raceId: String(8000 + i), raceTime: `1${i}:00`, raceName: `Race ${i + 1}`, course: 'Chepstow', horseName: `Horse ${i + 1}`, oddsFractional: '5/1', oddsDecimal: 6 });
  window.localStorage.setItem('saturday:slip:2026-10-09', JSON.stringify(picks));
});
await page.clock.setFixedTime(new Date('2026-10-09T21:30:00+01:00'));
await page.goto(`http://127.0.0.1:${PORT}/meeting.html`, { waitUntil: 'load' });
await wait(page, 500);
add('Slip · seven picks, from elsewhere', 'the day\'s slip arrived with more than six (made at another meeting, before the limit): kept, counted over, a jockey\'s cap where no silks were seen; nothing more is taken until two are out',
  await outer(page, '#betSlip'));
await page.close();

// ── The evening before ────────────────────────────────────────────────
page = await open('meeting-upcoming.html', 1440, 900);
add('Masthead · before racing', 'meeting_full.html the evening before: the first off still to come',
  await outer(page, '.mf-hero'));
add('Race · before racing', '_race.html before the off: no numbers yet (no number column), most runners at SP, the AI verdict panel under the race',
  await outer(page, '.mf-race'));
add('AI verdict panel', 'chamber_verdict: the panel the site renders under a race before the off',
  await outer(page, '.cv'));
await page.close();

// ── The phone ─────────────────────────────────────────────────────────
page = await open('meeting.html', 390, 844);
add('Masthead · phone', 'under 768px: the live page\'s own column — eyebrow, date, name, Pick Six, figures, chips — with the horse at the right edge',
  await outer(page, '.mf-hero'), { width: 390 });
add('Runner · phone card', 'under 660px of room a runner is a card: silks, name, the AI tier, jockey and trainer, form, figures, Pick and Details',
  await page.evaluate(() => document.querySelector('.mf-race .racecard__runner')?.outerHTML ?? null), { width: 390 });
await page.locator('.mfr-more').first().click();
await wait(page, 300);
add('Runner · phone card, Details open', 'meeting_racecard.js: data-mfr-open on the row shows the comment and the AI verdict',
  await page.evaluate(() => document.querySelector('.mf-race .racecard__runner')?.outerHTML ?? null), { width: 390 });
await pick(page, 2);
add('Slip bar · phone', 'below 1024px the slip is a bar at the foot of the screen: the count out of six and the picks\' silks',
  await outer(page, '#slipHandle'), { width: 390 });
await page.locator('#slipHandle').click();
await wait(page, 400);
add('Slip sheet · phone, open', 'bet_slip.js opens the sheet (is-open); the ticket and the places inside it, the tap-outside backdrop behind',
  await outer(page, '#betSlip'), { width: 390 });
await page.close();

await browser.close();
server.close?.();

const html = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Meeting page states · Saturday Racing</title>
${head}
    <style>
      /* Page furniture only — the cases below use the real stylesheet. */
      .states-doc { max-width: 1480px; margin: 0 auto; padding: 48px 24px 96px; font-family: var(--font-body, system-ui); color: var(--c-ink, #11151f); }
      .states-doc > h1 { font-size: 36px; margin: 0 0 8px; }
      .states-doc__intro { color: var(--c-ink-70, #41474f); line-height: 1.7; max-width: 70ch; }
      .states-case { margin-top: 56px; border-top: 1px solid var(--c-rule, #e7e5dd); padding-top: 20px; }
      .states-case__name { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
      .states-case__when { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--c-gold-ink, #9c7b12); margin: 0 0 16px; }
      /* Paint containment keeps a case inside its own frame: the slip, the
         toast and the sheet's backdrop are fixed or sticky on the real
         page and would otherwise float across every case below them. */
      .states-frame { border: 1px solid var(--c-rule, #e7e5dd); border-radius: 12px; overflow: hidden; margin-top: 16px; padding: 16px; background: var(--c-paper, #fafaf7); position: relative; contain: layout paint; }
      .states-frame > .mf-hero { margin: 0; }
      .states-frame > .mf-slip, .states-frame > .mf-slip__handle { position: relative; inset: auto; transform: none; width: auto; max-width: 360px; margin: 0; }
      .states-frame > .mfr-toast { position: relative; inset: auto; transform: none; display: inline-flex; }
      /* A phone's case is shown at a phone's width. */
      .states-frame--phone { width: 390px; box-sizing: border-box; padding: 0; container-type: inline-size; }
      .states-frame--phone > .mf-hero { width: 100%; margin: 0; }
      .states-frame--phone > .mf-slip { max-width: none; }
      /* A runner's case stands in for its list. */
      .states-frame > .racecard__runner { container-type: inline-size; }
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
        are captured from it, not written here.
      </p>
${STATES.map((state) => `      <section class="states-case">
        <p class="states-case__name">${escape(state.name)}</p>
        <p class="states-case__when">${escape(state.when)}</p>
        <div class="states-frame${state.width ? ' states-frame--phone' : ''}">
${state.markup}
        </div>
      </section>`).join('\n')}
    </div>
  </body>
</html>
`;

writeFileSync('meeting-states.html', html.split(LF).join(newline), 'utf8');
console.log(`meeting-states.html: ${STATES.length} states rendered`);
