// Build trail-states.html: every state the Fox Trail can render, on one
// page, so they can be looked at rather than imagined.
//
//   node tools/build-trail-states.mjs
//
// Unlike the landing's states page, some of the trail's states only exist
// once the page is running: the drawer is filled from #trailCellData by
// JavaScript, the flip toggle turns settled cells over, the filters hide
// cells, and the live poller settles the day. So this drives the real
// page in a browser and captures what it produces, rather than writing
// markup of its own.
//
// The states the fixture day cannot show — the featured ribbon, a Pick
// Winner backup cell, the flagship badges, and the three whole-page
// states — come from partials/trail-*.html, rendered from the Django
// templates (scripts/render_trail_partials.py in the app repo).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

import { startServer } from './serve.mjs';

const PORT = 4176;
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

const raw = readFileSync('trail.html', 'utf8');
const newline = raw.indexOf(CR + LF) >= 0 ? CR + LF : LF;
const head = raw
  .slice(raw.indexOf('<link rel="stylesheet"'), raw.indexOf('</head>'))
  .split(CR + LF).join(LF);

const partial = (name) => readFileSync(join('partials', `${name}.html`), 'utf8').split(CR + LF).join(LF);
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const server = await startServer({ root: process.cwd(), port: PORT });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

// The live poller would settle races underneath the captures. Freeze the
// day where the page was rendered, then step it on purpose at the end.
await page.route('**/trail/live/**', (route) => route.abort());
await page.goto(`http://127.0.0.1:${PORT}/trail.html`, { waitUntil: 'load' });
await page.evaluate(async () => { await document.fonts.ready; });

/** One cell of the grid, by whatever makes it the case we want. */
const cellHtml = (selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(`#trailGrid ${sel}`);
    return el ? el.outerHTML : null;
  }, selector);

const STATES = [];
const add = (name, when, markup) => {
  if (!markup) {
    console.warn(`  ! skipped (not on the page): ${name}`);
    return;
  }
  STATES.push({ name, when, markup });
};

// ── One cell per state ────────────────────────────────────────────────
const CELL_STATES = [
  ['pending', 'the race has not run'],
  ['live', 'the race is off'],
  ['won', 'our pick won'],
  ['placed', 'our pick placed (2nd or 3rd)'],
  ['lost', 'our pick was beaten'],
  ['void', 'the race was abandoned'],
  ['no_fancy', 'no source backed anything'],
];
for (const [state, meaning] of CELL_STATES) {
  add(`Cell · ${state}`, `_cell.html: cell.state == '${state}' — ${meaning}`,
    await cellHtml(`.cell--${state}`));
}

// ── One cell per confidence tier ──────────────────────────────────────
const TIERS = [[1, 'Whisper — one source'], [2, 'Nod — two agree'],
               [3, 'Chorus — three agree'], [4, 'Smoker — four or more']];
for (const [tier, meaning] of TIERS) {
  add(`Cell · tier ${tier}`, `_cell.html: cell.consensus.tier == ${tier} — ${meaning}`,
    await cellHtml(`.cell--tier-${tier}`));
}

add('Cell · 2v2 split', '_cell.html: cell.is_split — the sources disagree two against two',
  await cellHtml('.cell--split'));
add('Cell · you are here', '_cell.html: cell.is_now — the next unsettled race, today only',
  await cellHtml('.cell--now'));

// ── States that need the page running ─────────────────────────────────
// The drawer: filled by trail_drawer.js from #trailCellData.
await page.click('#trailGrid .cell[data-cell-index]');
await page.waitForTimeout(400);
add('Drawer · open on a cell',
  'trail_drawer.js fills #cellDrawer from #trailCellData and adds .is-open',
  await page.evaluate(() => document.getElementById('cellDrawer')?.outerHTML));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// The flip: one chip turns every settled cell over to its result face.
const flip = await page.$('[data-role="reveal-toggle"]');
if (flip) {
  await flip.click();
  await page.waitForTimeout(900);
  add('Cell · flipped to the result',
    'trail_flip.js adds .is-flipped to settled cells — _cell_back.html is the back face',
    await cellHtml('.cell.is-flipped'));
  await flip.click();
  await page.waitForTimeout(600);
}

// The filters: a legend row narrows the grid to one source or tier.
const filterBtn = await page.$('[data-filter-source]');
if (filterBtn) {
  await filterBtn.click();
  await page.waitForTimeout(400);
  add('Grid · filtered to one source',
    'trail_filter.js adds .trail__grid--filtered and hides cells that do not match',
    await page.evaluate(() => {
      const legend = document.querySelector('.trail__legend')?.outerHTML ?? '';
      const grid = document.getElementById('trailGrid')?.outerHTML ?? '';
      return legend + grid;
    }));
  await filterBtn.click();
  await page.waitForTimeout(300);
}

// The finished day: the recording's last frame, applied by the poller.
await page.unroute('**/trail/live/**');
const timeline = JSON.parse(readFileSync(join('fixtures', 'trail-live-timeline.json'), 'utf8'));
await page.route('**/trail/live/**', (route) =>
  route.fulfill({ contentType: 'application/json', body: JSON.stringify(timeline.frames.at(-1)) }));
await page.evaluate(() => document.querySelector('main.trail').setAttribute('data-live-poll-ms', '300'));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);
add('Day · every race settled',
  'the poller sees is_final and stops — counter, freshness pill and grid at the end of the day',
  await page.evaluate(() => {
    const masthead = document.querySelector('.trail__masthead')?.outerHTML ?? '';
    const grid = document.getElementById('trailGrid')?.outerHTML ?? '';
    return masthead + grid;
  }));

await browser.close();
server.close?.();

// ── States rendered from the Django templates ─────────────────────────
add('Cell · featured race', '_cell.html: cell.is_featured — Sly Man’s Featured Tip, one race a day',
  partial('trail-cell-featured'));
add('Cell · Pick Winner backup', '_cell.html: cell.is_backup — the machine fallback, no editorial source backed it',
  partial('trail-cell-backup'));
add('Cell · flagship badges', '_cell.html: consensus.flagship_kind == ‘bod’ (left) and ‘lead’ (right)',
  partial('trail-cell-flagship'));
add('Day · no racing', '_empty.html: the day has no qualifying card',
  partial('trail-empty'));
add('Day · too early', '_empty_premature.html: the card is not published yet',
  partial('trail-empty-premature'));
add('Banner · early signals', '_early_signals_banner.html: signals are in before the card firms up',
  partial('trail-early-signals'));

const html = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fox Trail states · Saturday Racing</title>
${head}
    <style>
      /* Page furniture only — the cases below use the real stylesheets.
         The trail is a cream page, so the doc and the frames match it:
         a case should look the way it does in situ. */
      .states-doc { max-width: 1280px; margin: 0 auto; padding: 48px 24px 96px; font-family: var(--font-body, system-ui); color: #1a1712; }
      .states-doc h1 { font-family: var(--font-display, Georgia, serif); font-size: 36px; margin: 0 0 8px; }
      .states-doc__intro { color: rgba(26,23,18,0.72); line-height: 1.7; max-width: 70ch; }
      .states-case { margin-top: 56px; border-top: 1px solid rgba(26,23,18,0.14); padding-top: 20px; }
      .states-case__name { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
      .states-case__when { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #8a6d1f; margin: 0 0 16px; }
      /* Paint containment keeps a case inside its own frame: the drawer
         and the cell overlays are fixed/absolute on the real page and
         would otherwise float across every case below them. */
      .states-frame { border: 1px solid rgba(26,23,18,0.14); border-radius: 12px; overflow: hidden; margin-top: 16px; padding: 16px; background: #f4efe4; position: relative; contain: layout paint; }
      .states-frame:has(.cell-drawer) { min-height: 560px; }
      /* Cells are grid children on the real page; give them a box to sit in. */
      .states-frame > .cell { max-width: 320px; }
      .states-frame > .cell + .cell { margin-top: 16px; }
    </style>
  </head>
  <body class="page-trail">
    <div class="states-doc">
      <h1>Fox Trail states</h1>
      <p class="states-doc__intro">
        Every state the trail can render, so each one can be designed
        rather than imagined. Generated from <code>trail.html</code> and
        the partials by <code>node tools/build-trail-states.mjs</code>,
        which drives the real page — the drawer, the flip and the filters
        are captured from it, not written here. The page itself is a
        fixture day that already carries every cell state and tier.
      </p>
${STATES.map((state) => `      <section class="states-case">
        <p class="states-case__name">${escape(state.name)}</p>
        <p class="states-case__when">${escape(state.when)}</p>
        <div class="states-frame">
${state.markup}
        </div>
      </section>`).join('\n')}
    </div>
  </body>
</html>
`;

writeFileSync('trail-states.html', html.split(LF).join(newline), 'utf8');
console.log(`trail-states.html: ${STATES.length} states rendered`);
