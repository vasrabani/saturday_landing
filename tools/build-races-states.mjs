// Build races-states.html: every state the day's races page can render,
// on one page, so they can be looked at rather than imagined.
//
//   node tools/build-races-states.mjs
//
// Some of the page's states only exist once it is running: a winner
// revealed and a meeting's Reveal all are the spoiler script's, the
// reveal track and the marked tab the revamp's scripts'. So this drives
// the real pages in a browser — races.html (today, mid-card),
// races-tomorrow.html and races-yesterday.html — and captures what they
// produce, rather than writing markup of its own. The template's
// branches that no capture caught (the big race, an abandoned meeting or
// race, a member's pick, the Fox's cubs, a day without racing) are
// served from tests/support/races-branches.cjs, the same stand-ins the
// tests use, and each says so.
//
// A case is put back the way the page has it: a meeting's head or a
// race inside .meetings-paper and an .meeting-block, the sheet whose
// width lays it out (a container query). Most cases are inline. The
// ones that depend on the width of the window itself — the phone's and
// the tablet's — are each rendered in an <iframe> of their own, at
// their own width, with the same stylesheets.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { BRANCHES } = require('../tests/support/races-branches.cjs');

const PORT = 4178;
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const CAPTURED_AT = new Date('2026-10-16T15:43:00+01:00');
const LAPTOP = { width: 1440, height: 900 };
const TABLET = { width: 768, height: 1024 };
const PHONE = { width: 390, height: 844 };
const PAGES = { today: 'races.html', tomorrow: 'races-tomorrow.html', yesterday: 'races-yesterday.html' };
const STAND_IN = 'A stand-in: no capture had this branch (tests/support/races-branches.cjs). ';

const raw = readFileSync('races.html', 'utf8');
const newline = raw.indexOf(CR + LF) >= 0 ? CR + LF : LF;
const head = raw
  .slice(raw.indexOf('<link rel="stylesheet"'), raw.indexOf('</head>'))
  .split(CR + LF).join(LF);
const BODY_CLASS = /<body class="([^"]+)"/.exec(raw)[1];

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attribute = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
/** A meeting's head or a race, back inside a meeting sheet on the paper, as on the page. */
const onSheet = (markup) =>
  (markup ? `<section class="meetings-paper"><div class="container"><article class="meeting-block" data-meeting-block>${markup}</article></div></section>` : markup);
/** A whole meeting, back on the paper. */
const onPaper = (markup) => (markup ? `<section class="meetings-paper"><div class="container">${markup}</div></section>` : markup);

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

/** A page (or a branch of one) at a width, with the clock pinned to the capture. */
async function open(day, { width, height }, { branch } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 768, hasTouch: width < 768, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const file = PAGES[branch ? BRANCHES[branch].day : day];
  if (branch) {
    await page.route(`**/${file}`, async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, body: BRANCHES[branch].change(await response.text()) });
    });
  }
  await page.clock.setFixedTime(CAPTURED_AT);
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load' });
  await page.evaluate(async () => { await document.fonts.ready; });
  return page;
}

/** The markup, and the height, of the first element a selector finds. */
const outer = (page, selector) => page.evaluate((sel) => document.querySelector(sel)?.outerHTML ?? null, selector);
const tall = (page, selector) =>
  page.evaluate((sel) => Math.ceil(document.querySelector(sel)?.getBoundingClientRect().height ?? 0), selector);
/** Scroll a meeting to just below the pinned tabs, so its tab is the marked one. */
const toMeeting = async (page, n) => {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'start' }), `meeting-${n}`);
  await page.waitForTimeout(200);
};
const press = async (page, selector) => {
  await page.locator(selector).click();
  await page.waitForTimeout(150);
};

// ── Today, mid-card ───────────────────────────────────────────────────
let page = await open('today', LAPTOP);
add('Masthead · today, racing on', 'meetings_browse.html\'s hero with the day tabs and the two figures the revamp adds; the next race off, which the template shows on today\'s page while racing is on; Pick Six as stickers, on a day with a race to run',
  await outer(page, '.browse-masthead'));
await toMeeting(page, 2);
add('Meeting tabs · live and to come', 'the meeting switcher: a meeting live (the state line in red, its progress along the foot) and two to come (off in so long, off at); the meeting in view marked in ink by browse_nav.js',
  await outer(page, '.meeting-nav'));
add('Meeting head · live, three results in', 'the meeting\'s head while it runs: the live status line as a chip, Pick Six and Reveal all; browse_track.js\'s course along the foot, lit as far as the card has been run',
  onSheet(await outer(page, '#meeting-1 .meeting-block__header')));
add('Meeting head · first off to come', 'the status line before the meeting\'s first race; no result yet, so no Reveal all and no course',
  onSheet(await outer(page, '#meeting-4 .meeting-block__header')));
add('Race · a result in, the winner hidden', 'a race with its result: Reveal winner (the spoiler script\'s button) and the cubs\' chip; "Result" is kept for a screen reader',
  onSheet(await outer(page, '.race-row[href$="/races/6523/"]')));
await press(page, '.race-row[href$="/races/6523/"] [data-action="reveal-result"]');
add('Race · the winner revealed', 'the button pressed (aria-pressed): the winner\'s silks, name and price, the jockey and the trainer under them',
  onSheet(await outer(page, '.race-row[href$="/races/6523/"]')));
add('Race · before the off, the AI\'s pick and the cubs', 'a race still to run: the AI\'s pick with its price and confidence, and how many cubs picked in it',
  onSheet(await outer(page, '.race-row[href$="/races/6527/"]')));
add('Race · the AI\'s pick, no price yet', 'the AI chip without its odds',
  onSheet(await page.evaluate(() => Array.from(document.querySelectorAll('.race-row')).find((row) => row.querySelector('.ai-pick-chip') && !row.querySelector('.ai-pick-chip__odds'))?.outerHTML ?? null)));
await press(page, '#meeting-1 [data-action="reveal-meeting"]');
add('Meeting head · every result so far revealed', 'Reveal all pressed at a meeting part run: it reads Hide all, and the horse stops as far up the course as the results go (three races of nine)',
  onSheet(await outer(page, '#meeting-1 .meeting-block__header')));
await page.context().close();

// ── Yesterday, every result in ────────────────────────────────────────
page = await open('yesterday', LAPTOP);
add('Masthead · a finished day', 'yesterday\'s page: no next race off, and no Pick Six (nothing is left to pick)',
  await outer(page, '.browse-masthead'));
await toMeeting(page, 1);
add('Meeting tabs · every result in', 'every meeting finished: the state lines in green, the progress full',
  await outer(page, '.meeting-nav'));
add('Meeting head · every result in', 'the finished status line; the course lit end to end, the horse at the start',
  onSheet(await outer(page, '#meeting-1 .meeting-block__header')));
for (const n of [0, 2, 4]) await press(page, `#meeting-1 .race-row:nth-of-type(${n + 1}) [data-action="reveal-result"]`);
add('Meeting head · three of eight revealed', 'three winners shown, one at a time: the count says so and the horse is three races up the course',
  onSheet(await outer(page, '#meeting-1 .meeting-block__header')));
await press(page, '#meeting-1 [data-action="reveal-meeting"]');
add('Meeting head · every winner revealed', 'Reveal all pressed: Hide all, "All 8 revealed" in green, the horse at the post',
  onSheet(await outer(page, '#meeting-1 .meeting-block__header')));
await page.context().close();

// ── Tomorrow, the busiest day ─────────────────────────────────────────
page = await open('tomorrow', LAPTOP);
add('Masthead · the day before', 'tomorrow\'s page: no results figure, and Pick Six going to the first meeting',
  await outer(page, '.browse-masthead'));
add('Meeting head · before racing', 'the day before: no status line, no Reveal all, no course',
  onSheet(await outer(page, '#meeting-1 .meeting-block__header')));
add('Race · before racing', 'nothing to press yet but the Racecard link',
  onSheet(await outer(page, '#meeting-1 .race-row')));
await page.context().close();

// ── Branches no capture caught ────────────────────────────────────────
page = await open('tomorrow', LAPTOP, { branch: 'bigRace' });
add('Masthead · the big race', `${STAND_IN}Race.is_featured: the big-race banner as a pill under the figures, with an arrow`,
  await outer(page, '.browse-masthead'));
add('Meeting · the big race\'s', `${STAND_IN}m.is_featured: the meeting trimmed in gold under its flag; the big race on the gold wash, tagged`,
  onPaper(await outer(page, '#meeting-1')));
await page.context().close();

page = await open('today', LAPTOP, { branch: 'abandonedMeeting' });
await toMeeting(page, 5);
add('Meeting tabs · a meeting abandoned', `${STAND_IN}meeting-tab--abandoned: the course struck through, the state line saying so`,
  await outer(page, '.meeting-nav'));
add('Meeting head · abandoned', `${STAND_IN}meeting-block__status--abandoned`,
  onSheet(await outer(page, '#meeting-5 .meeting-block__header')));
add('Race · abandoned', `${STAND_IN}race-row--abandoned and abandoned-tag: still there to read, struck through, quiet`,
  onSheet(await outer(page, '#meeting-5 .race-row')));
await page.context().close();

page = await open('today', LAPTOP, { branch: 'yourPick' });
add('Race · your pick', `${STAND_IN}race-row__pick-chip, for a member signed in who has picked in the race`,
  onSheet(await outer(page, '.race-row[href$="/races/6536/"]')));
await page.context().close();

page = await open('today', LAPTOP, { branch: 'foxCubs' });
add('Race · the Fox\'s cubs', `${STAND_IN}race-row__crowd-chip--fox: a cub the Fox promoted has picked in the race`,
  onSheet(await outer(page, '.race-row[href$="/races/6527/"]')));
await page.context().close();

page = await open('today', LAPTOP, { branch: 'noRacing' });
add('Masthead · no racing', `${STAND_IN}browse-empty: the template's message in the masthead; no tabs, meetings or notes`,
  await outer(page, '.browse-masthead'));
await page.context().close();

// ── The notes ─────────────────────────────────────────────────────────
page = await open('today', LAPTOP);
add('Notes', 'three notes after the meetings (the revamp\'s): the spoilers, Pick Six, free to play',
  await outer(page, '.browse-notes'));
await page.context().close();

// ── Windows of their own: the tablet and the phone ────────────────────
page = await open('today', TABLET);
await toMeeting(page, 1);
add('Meeting · tablet', 'a sheet 640 to 860px wide: the time keeps its column, what there is to press goes under the race',
  onPaper(await outer(page, '#meeting-1')), { width: TABLET.width, height: (await tall(page, '#meeting-1')) + 48 });
await page.context().close();

page = await open('today', PHONE);
add('Masthead · phone', 'under 768px: the same column, the next race off on two lines, the stickers a size down',
  await outer(page, '.browse-masthead'), { width: PHONE.width, height: await tall(page, '.browse-masthead') });
await toMeeting(page, 1);
add('Meeting · phone', 'a sheet under 640px wide: the head one column, its buttons on a line; each race the time and class, the name, the figures, then a line of what there is to press, Racecard at its end',
  onPaper(await outer(page, '#meeting-1')), { width: PHONE.width, height: (await tall(page, '#meeting-1')) + 48 });
add('Notes · phone', 'the three notes one above another',
  await outer(page, '.browse-notes'), { width: PHONE.width, height: await tall(page, '.browse-notes') });
await page.context().close();

page = await open('tomorrow', PHONE);
await toMeeting(page, 3);
add('Meeting tabs · phone, the busiest day', 'eight meetings: the tabs scroll sideways inside the bar (never the page), the marked one kept in sight',
  await outer(page, '.meeting-nav'), { width: PHONE.width, height: await tall(page, '.meeting-nav') });
await page.context().close();

await browser.close();
server.close?.();

/** A case that needs a window of its own: the same stylesheets, its width. */
const framed = (state) => {
  const doc = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${head}
<style>
  /* The page's own ground; nothing pinned. */
  body { margin: 0; background: var(--c-paper, #fafaf7); }
  .meeting-nav { position: relative; top: auto; }
</style>
</head>
<body class="${BODY_CLASS}">${state.markup}</body>
</html>`;
  return `<iframe class="states-iframe" title="${attribute(state.name)}" height="${state.frame.height}" loading="lazy" srcdoc="${attribute(doc)}"></iframe>`;
};

const html = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Races page states · Saturday Racing</title>
${head}
    <style>
      /* Page furniture only — the cases below use the real stylesheet. */
      body.page-racecard-browse { background: var(--c-paper, #fafaf7); }
      .states-doc { max-width: 1480px; margin: 0 auto; padding: 48px 24px 96px; font-family: var(--font-body, system-ui); color: var(--c-ink, #11151f); }
      .states-doc > h1 { font-size: 36px; margin: 0 0 8px; }
      .states-doc__intro { color: var(--c-ink-70, #41474f); line-height: 1.7; max-width: 70ch; }
      .states-case { margin-top: 56px; border-top: 1px solid var(--c-rule, #e7e5dd); padding-top: 20px; }
      .states-case__name { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
      .states-case__when { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--c-gold-ink, #9c7b12); margin: 0 0 16px; }
      /* Paint containment keeps a case inside its own frame. */
      .states-frame { border: 1px solid var(--c-rule, #e7e5dd); border-radius: 12px; overflow: hidden; margin-top: 16px; background: var(--c-paper, #fafaf7); position: relative; contain: layout paint; }
      /* A window of its own: as wide as the window it stands for. */
      .states-frame--window { max-width: 100%; box-sizing: content-box; }
      .states-iframe { display: block; border: 0; width: 100%; }
      /* Inline, nothing is pinned: the tab bar stands where it is put. */
      .states-frame .meeting-nav { position: relative; top: auto; }
      .states-frame > .meetings-paper { padding-block: 16px; }
    </style>
  </head>
  <body class="${BODY_CLASS}">
    <div class="states-doc">
      <h1>Races page states</h1>
      <p class="states-doc__intro">
        Every state the day's races page can render, so each one can be
        designed rather than imagined. Generated from <code>races.html</code>,
        <code>races-tomorrow.html</code> and <code>races-yesterday.html</code>
        by <code>node tools/build-races-states.mjs</code>, which drives the
        real pages: the revealed winners, Reveal all, the reveal track and the
        marked tab are captured from them, not written here. The template's
        branches that none of the three days caught are marked
        <em>a stand-in</em>: their markup is the smallest change to a captured
        page that gives the template's own class names
        (<code>tests/support/races-branches.cjs</code>), to be checked against
        <code>meetings_browse.html</code> in the port. A case that depends on
        the width of the window (the phone's, the tablet's) is shown in a
        window of its own.
      </p>
${STATES.map((state) => `      <section class="states-case">
        <p class="states-case__name">${escape(state.name)}</p>
        <p class="states-case__when">${escape(state.when)}</p>
        ${state.frame
          ? `<div class="states-frame states-frame--window" style="width: ${state.frame.width}px">\n${framed(state)}\n        </div>`
          : `<div class="states-frame">\n${state.markup}\n        </div>`}
      </section>`).join('\n')}
    </div>
  </body>
</html>
`;

writeFileSync('races-states.html', html.split(LF).join(newline), 'utf8');
console.log(`races-states.html: ${STATES.length} states rendered (${STATES.filter((s) => s.frame).length} in windows of their own)`);
