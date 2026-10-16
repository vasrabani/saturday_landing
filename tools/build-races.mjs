// Build the sandbox's three /races/ pages from captures of the live site.
//
//   node tools/build-races.mjs <folder>   rebuild from captures saved there
//                                          (today.html, tomorrow.html, yesterday.html)
//   node tools/build-races.mjs --live     capture the three pages now, and keep the
//                                          captures in <folder> if one is given too
//
//   races.html            /races/            the day it was captured (mid-card shows the most)
//   races-tomorrow.html   /races/tomorrow/   the next day's card, before racing
//   races-yesterday.html  /races/yesterday/  the day before, every result in
//
// Each page is the sandbox's own <head> and footer (as trail.html has
// them) round the live page's navigation, tour strip and main content,
// as the meeting pages were built: static files come from the folder,
// Home goes to the sandbox's home page and every other link to the live
// site. The live page's own navigation is kept because it carries the
// day (which section is current, the week's big race). Its stylesheets
// (races/css/main.css, pick6_emblem.css, ai_pick_chip.css) and its
// <style> block give way to static/browse/css/browse.css; its spoiler
// script stays as the template has it, with the revamp's two scripts
// after it.
//
// The revamp changes the template in six places (docs/integration-map.md,
// "The day's races: what to port"). They are made here, one function
// each, from the page's own markup, so what each one shows and where
// its data comes from can be read off this file:
//
//   1. The day: the eyebrow says whose races they are, and the days
//      either side are a tab away.
//   2. Two more figures in the masthead: the first off, and the results
//      in (when there are any).
//   3. Pick Six as three stickers, on a day with a race still to run.
//   4. The masthead band, with the meeting tabs moved out of it (so they
//      can stay pinned over the meetings).
//   5. Three notes after the meetings.
//   6. A fix: the winner's button loses its inline onclick, which stops
//      the press before the page's spoiler script can hear it.
//
// Everything else on the page is the live template's markup, unchanged.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.saturday-racing.com';
const LF = '\n';

/** The three days the site has, each with its live address and its page here. */
const DAYS = [
  { key: 'yesterday', label: 'Yesterday', path: '/races/yesterday/', page: 'races-yesterday.html' },
  { key: 'today', label: 'Today', path: '/races/', page: 'races.html' },
  { key: 'tomorrow', label: 'Tomorrow', path: '/races/tomorrow/', page: 'races-tomorrow.html' },
];

const SCRIPTS = [
  '  <script src="static/browse/js/browse_nav.js" defer></script>',
  '  <script src="static/browse/js/browse_track.js" defer></script>',
].join(LF);

const STATIC_HASHED = /(src|href)="\/static\/([^"?]+?)\.[0-9a-f]{12}(\.[a-z0-9]+)(?:\?[^"]*)?"/g;
const STATIC_PLAIN = /(src|href)="\/static\/([^"?]+)(?:\?[^"]*)?"/g;
// Every link into the site except Home ("/"), which stays the sandbox's own.
const SITE_LINK = /(href|action)="\/(?!static\/|\/)([^"]+)"/g;

function fail(message) {
  throw new Error(`build-races: ${message}`);
}

function check(condition, message) {
  if (!condition) fail(message);
}

/** The text between two markers; `fromStart` keeps the first marker itself. */
function between(text, start, end, { fromStart = false } = {}) {
  const at = text.indexOf(start);
  check(at >= 0, `"${start}" not found`);
  const from = fromStart ? at : text.indexOf(LF, at) + 1;
  const to = text.indexOf(end, from);
  check(to >= 0, `"${end}" not found after "${start}"`);
  return text.slice(from, to);
}

const words = (markup) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const toSite = (markup) => markup.replace(SITE_LINK, (_, attribute, path) => `${attribute}="${ORIGIN}/${path}"`);
const fromFolder = (markup) =>
  markup
    .replace(STATIC_HASHED, (_, attribute, path, extension) => `${attribute}="static/${path}${extension}"`)
    .replace(STATIC_PLAIN, (_, attribute, path) => `${attribute}="static/${path}"`);

function setMeta(head, attribute, name, value) {
  if (value == null) return head;
  const pattern = new RegExp(`(<meta\\s+${attribute}="${name}"\\s+content=")[^"]*(")`);
  return head.replace(pattern, (_, open, close) => open + value + close);
}

function metaOf(page, attribute, name) {
  const found = new RegExp(`<meta\\s+${attribute}="${name}"\\s+content="([^"]*)"`).exec(page);
  return found ? found[1] : null;
}

// ── The sandbox's shell, from trail.html ─────────────────────────────

const trailRaw = readFileSync(join(ROOT, 'trail.html'), 'utf8');
const EOL = trailRaw.includes('\r\n') ? '\r\n' : LF;
const trail = trailRaw.split('\r\n').join(LF);

const TRAIL_CSS = '<link rel="stylesheet" href="static/grid/css/trail.css">';
const SITE_JS = '  <script src="static/js/site.js" defer></script>';
const MAIN_OPEN = '  <main id="main-content" class="site-main" tabindex="-1">';
check(trail.split(TRAIL_CSS).length === 2, 'trail.html links trail.css once');
check(trail.includes(MAIN_OPEN), 'trail.html has the site <main>');

const shellHead = trail
  .slice(0, trail.indexOf('<body'))
  .replace(TRAIL_CSS, '<link rel="stylesheet" href="static/browse/css/browse.css">');
const shellChrome = between(trail, '<body', MAIN_OPEN, { fromStart: true });
const shellTail = trail.slice(trail.lastIndexOf(LF + '  </main>') + 1);
check(shellTail.split(SITE_JS).length === 2, 'trail.html loads site.js once, after </main>');

// ── The five template changes ────────────────────────────────────────

/** 1a. The eyebrow names the day's races: "Today" becomes "Today’s races". */
function eyebrow(main, day) {
  const before = `<div class="browse-eyebrow">${day.label}</div>`;
  check(main.includes(before), `the eyebrow reads "${day.label}"`);
  return main.replace(before, `<div class="browse-eyebrow">${day.label}’s races</div>`);
}

/** 1b. The three days, the page's own marked current. Here each goes to
 *  the sandbox's copy of that day, as Home goes to its home page; the
 *  template links the live addresses (DAYS[].path). */
function dayTabs(main, day) {
  const tabs = DAYS.map((other) => {
    const current = other.key === day.key ? ' aria-current="page"' : '';
    return `      <a class="browse-days__day" href="${other.page}"${current}>${other.label}</a>`;
  });
  const markup = ['    <nav class="browse-days" aria-label="Race days">', ...tabs, '    </nav>'].join(LF);
  const end = '  </header>';
  check(main.split(end).length === 2, 'the hero closes once');
  return main.replace(end, `${markup}${LF}${end}`);
}

/** 2. The first off (the day's earliest race) and the results in (the
 *  races with a result; left out when there are none). Both are counts
 *  the view already makes for each meeting. */
function figures(main) {
  const times = [...main.matchAll(/<div class="race-row__time">\s*(\d\d:\d\d)/g)].map((found) => found[1]).sort();
  check(times.length > 0, 'the page has races');
  const results = (main.match(/class="race-row\b[^"]*\brace-row--has-result\b/g) ?? []).length;
  const added = [`      <span>First off <strong>${times[0]}</strong></span>`];
  if (results) added.push(`      <span><strong>${results}</strong> ${results === 1 ? 'result' : 'results'} in</span>`);
  const stats = main.indexOf('<div class="browse-stats">');
  const end = main.indexOf('    </div>', stats);
  check(stats >= 0 && end > stats, 'the figures are in .browse-stats');
  return main.slice(0, end) + added.join(LF) + LF + main.slice(end);
}

/** 3. Pick Six as stickers, while the day has a race to run: today
 *  before the last race is off (there is a next-off banner) and
 *  tomorrow. It goes to the full card of the meeting that runs next
 *  (the first meeting, on a day not yet started), where the picking is. */
function pickSix(main, day) {
  const nextOff = /<a href="([^"]+)" class="browse-next-off">/.exec(main);
  if (day.key === 'yesterday' || (day.key === 'today' && !nextOff)) return { main, seal: null };

  let block = main.indexOf('<article class="meeting-block');
  if (nextOff) {
    const row = main.indexOf(`<a href="${nextOff[1]}"`, main.indexOf('<section class="meetings-paper"'));
    check(row > 0, `the next race (${nextOff[1]}) is on the card`);
    block = main.lastIndexOf('<article class="meeting-block', row);
  }
  const link = /class="pick6 pick6--compact"\s+href="([^"]+)"/.exec(main.slice(block));
  check(block >= 0 && link, 'the meeting has its Pick Six link');

  const seal = [
    `  <a class="browse-pick6" href="${link[1]}">`,
    '    <span class="browse-pick6__stamp" aria-hidden="true">',
    '      <svg class="browse-pick6__ring" viewBox="0 0 100 100" focusable="false">',
    '        <defs>',
    '          <path id="browse-pick6-over" d="M13.2,50 A36.8,36.8 0 0 1 86.8,50"/>',
    '          <path id="browse-pick6-under" d="M5.8,50 A44.2,44.2 0 0 0 94.2,50"/>',
    '        </defs>',
    '        <text><textPath href="#browse-pick6-over" startOffset="50%">PICK SIX</textPath></text>',
    '        <text><textPath href="#browse-pick6-under" startOffset="50%">CHALLENGE</textPath></text>',
    '        <circle cx="9.5" cy="50" r="1.7"/>',
    '        <circle cx="90.5" cy="50" r="1.7"/>',
    '      </svg>',
    '      6',
    '    </span>',
    '    <span class="browse-pick6__name">Pick Six</span>',
    '    <span class="browse-pick6__vs">vs The Fox</span>',
    '    <span class="browse-pick6__sub">Stack six. Beat the head tipster.</span>',
    '  </a>',
  ].join(LF);
  return { main, seal };
}

/** 4. The masthead band round the hero's container, the seal (3) last in
 *  it, and the meeting tabs moved out to sit between the band and the
 *  meetings. In the template the tabs are the container's last child,
 *  so their `position: sticky` has nowhere to stick. */
function masthead(main, seal) {
  const open = '<div class="container">';
  const start = main.indexOf(open);
  check(start >= 0 && main.indexOf('<header class="browse-hero">') > start, 'the hero is in the first container');
  const paper = main.indexOf('<section class="meetings-paper"');
  const close = main.lastIndexOf('</div>', paper >= 0 ? paper : main.length);
  check(close > start, 'the hero container closes before the meetings');

  let inside = main.slice(start + open.length, close);
  let nav = '';
  const navStart = inside.indexOf('<nav class="meeting-nav"');
  if (navStart >= 0) {
    const navEnd = inside.indexOf('</nav>', navStart) + '</nav>'.length;
    nav = inside.slice(navStart, navEnd);
    inside = inside.slice(0, navStart).trimEnd() + LF;
  }
  const band = [
    '<div class="browse-masthead">',
    open + inside.trimEnd(),
    ...(seal ? ['', seal] : []),
    '</div>',
    '</div>',
    ...(nav ? ['', nav] : []),
  ].join(LF);
  return main.slice(0, start) + band + main.slice(close + '</div>'.length);
}

/** 5. Three notes after the meetings: the spoilers, Pick Six, and that
 *  the site takes no bets. Fixed copy; not on a day without racing. */
function notes(main) {
  const close = '</section>';
  const paper = main.indexOf('<section class="meetings-paper"');
  if (paper < 0) return main;
  const end = main.indexOf(close, main.lastIndexOf('</article>')) + close.length;
  check(end > paper, 'the meetings close');
  const markup = [
    '',
    '',
    '<section class="browse-notes" aria-label="About this page">',
    '  <div class="container">',
    '    <div class="browse-notes__note browse-notes__note--reveal">',
    '      <h2 class="browse-notes__title">Results, your call</h2>',
    '      <p>Every winner stays hidden until you ask for it. Reveal one race, reveal a whole meeting, or keep the card spoiler-free while you catch up on the replays.</p>',
    '    </div>',
    '    <div class="browse-notes__note browse-notes__note--pick6">',
    '      <h2 class="browse-notes__title">Pick Six, beat the Fox</h2>',
    '      <p>Pick six horses from across the day’s racing and take on Mr Fox, our resident tipster. Pride on the line, nothing else.</p>',
    '    </div>',
    '    <div class="browse-notes__note browse-notes__note--free">',
    '      <h2 class="browse-notes__title">Free to play</h2>',
    '      <p>Saturday Racing takes no bets and handles no money. The racecards, the results and the game are free.</p>',
    '    </div>',
    '  </div>',
    '</section>',
  ].join(LF);
  return main.slice(0, end) + markup + main.slice(end);
}

/** 6. The winner's button without its inline onclick. The spoiler
 *  script listens on .meetings-paper for the press; the onclick
 *  (preventDefault and stopPropagation, so the press would not follow
 *  the race's link) stops it on the button itself, before it gets
 *  there, so "Reveal winner" does nothing on the live page (Reveal all,
 *  which has no onclick, works). The script already prevents the link
 *  from following, so the onclick has no work left to do. */
function winnerButtons(main) {
  const ONCLICK = /\s+onclick="event\.preventDefault\(\);event\.stopPropagation\(\);"/g;
  const buttons = (main.match(/<button type="button"\s+class="race-row__spoiler"/g) ?? []).length;
  const found = (main.match(ONCLICK) ?? []).length;
  check(found === buttons, `every winner's button has the onclick (${found} of ${buttons})`);
  return main.replace(ONCLICK, '');
}

// ── One page ─────────────────────────────────────────────────────────

function build(source, day) {
  const page = source.split('\r\n').join(LF);
  check(page.includes('<body class="page-racecard page-racecard-browse">'), `${day.path} is the races page`);

  let head = shellHead;
  const title = /<title>([\s\S]*?)<\/title>/.exec(page)[1];
  head = head.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`);
  head = setMeta(head, 'name', 'description', metaOf(page, 'name', 'description'));
  for (const name of ['og:title', 'og:description', 'og:url']) head = setMeta(head, 'property', name, metaOf(page, 'property', name));
  for (const name of ['twitter:title', 'twitter:description']) head = setMeta(head, 'name', name, metaOf(page, 'name', name));
  const canonical = /<link rel="canonical"\s+href="([^"]*)"/.exec(page);
  if (canonical) head = head.replace(/(<link rel="canonical"\s+href=")[^"]*(")/, (_, open, close) => open + canonical[1] + close);

  // The navigation, the drawer and the tour strip: the live page's own.
  const chrome = toSite(fromFolder(between(page, '<body', MAIN_OPEN, { fromStart: true })));
  check(!/clarity|googletagmanager/i.test(chrome) && !chrome.includes('"/static/'), 'the chrome loads nothing from outside');
  for (const hook of ['id="siteNav"', 'id="navHamburger"', 'id="mobileDrawer"', 'id="demoBanner"']) {
    check(chrome.split(hook).length === 2 && shellChrome.split(hook).length === 2, `the chrome has ${hook} once`);
  }

  // The main content, and the five changes.
  let main = between(page, MAIN_OPEN, LF + '  </main>');
  main = eyebrow(main, day);
  main = dayTabs(main, day);
  main = figures(main);
  const { seal } = pickSix(main, day);
  main = masthead(main, seal);
  main = notes(main);
  main = winnerButtons(main);
  main = toSite(main);
  check(!main.includes('="/static/') && !main.includes('silks.theracingapi.com'), 'the meetings load nothing from outside');

  // The template's spoiler script, as it is, then the revamp's.
  const spoilers = /<script>\s*\/\* Spoiler controls for the meetings-browse page\.[\s\S]*?<\/script>/.exec(page);
  check(spoilers, 'the page has its spoiler script');
  const tail = shellTail.replace(SITE_JS, [SITE_JS, spoilers[0], SCRIPTS].join(LF));

  return { html: head + chrome + MAIN_OPEN + LF + main + LF + tail, title, races: (main.match(/class="race-row[ "]/g) ?? []).length };
}

// ── The captures ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const live = args.includes('--live');
const folder = args.find((arg) => !arg.startsWith('--'));
check(live || folder, 'give a folder of captures, or --live (see the top of this file)');

for (const day of DAYS) {
  let source;
  if (live) {
    const response = await fetch(ORIGIN + day.path, { headers: { 'User-Agent': 'saturday-landing sandbox (tools/build-races.mjs)' } });
    check(response.ok, `${day.path} answered ${response.status}`);
    source = await response.text();
    if (folder) {
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, `${day.key}.html`), source, 'utf8');
    }
  } else {
    source = readFileSync(join(folder, `${day.key}.html`), 'utf8');
  }
  const { html, title, races } = build(source, day);
  writeFileSync(join(ROOT, day.page), html.split(LF).join(EOL), 'utf8');
  console.log(`${day.page.padEnd(21)} ${String(races).padStart(3)} races  ${words(title)}`);
}
