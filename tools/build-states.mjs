// Build states.html: every state the Django template can render, on one
// page, taken from index.html so it cannot drift from the real markup.
//
//   node tools/build-states.mjs
//
// States the redesign has no markup for are listed as gaps, with what the
// template branch needs, rather than invented here.
import { readFileSync, writeFileSync } from 'node:fs';

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

const raw = readFileSync('index.html', 'utf8');
const newline = raw.indexOf(CR + LF) >= 0 ? CR + LF : LF;
const html = raw.split(CR + LF).join(LF);

/** Pull one element out of the page, matching its own closing tag. */
function extract(openingMatch, tag) {
  const start = html.indexOf(openingMatch);
  if (start < 0) throw new Error(`not found: ${openingMatch}`);
  const open = new RegExp(`<${tag}[\\s>]`, 'g');
  const close = new RegExp(`</${tag}>`, 'g');
  let depth = 0;
  let index = start;
  while (index < html.length) {
    open.lastIndex = index;
    close.lastIndex = index;
    const nextOpen = open.exec(html);
    const nextClose = close.exec(html);
    if (!nextClose) break;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      index = nextOpen.index + 1;
    } else {
      depth -= 1;
      index = nextClose.index + 1;
      if (depth === 0) return html.slice(start, nextClose.index + `</${tag}>`.length);
    }
  }
  throw new Error(`unbalanced ${tag} from ${openingMatch}`);
}

const head = html.slice(html.indexOf('<link rel="stylesheet"'), html.indexOf('</head>'));

const dayHub = extract('<section class="day-hub"', 'section');
const battle = extract('<section\n        class="section battle-section battle-section--rivalry"', 'section');
const market = extract('<section class="money-moves money-moves--intel"', 'section');

// ── States that exist in the markup ───────────────────────────────────
const STATES = [
  {
    name: 'Day hub · racing finished',
    when: '_day_hub.html sets .is-finished on a meeting whose last race has run',
    markup: dayHub
      .split('class="rp-meeting day-hub__rp-meeting')
      .join('class="rp-meeting day-hub__rp-meeting is-finished')
      .replace('>All races today<', '>Today&rsquo;s racing &mdash; finished<'),
  },
  {
    name: 'Battle · no pick yet',
    when: 'landing.html: {% if big_race.fox_pick %} … {% else %} Pick pending',
    markup: battle
      .replace('<span class="battle-card__pick-horse">Dark Cloud Rising</span>',
        '<span class="battle-card__pick-horse battle-card__pick-horse--pending">Pick pending</span>')
      .replace('<span class="battle-card__pick-odds">7/2</span>', '')
      .replace(/<strong data-count-up>\d+<\/strong> wins this season/g, '&mdash; wins this season'),
  },
  {
    name: 'Market intelligence · drifters',
    when: "the Drifters tab: .mi-board[data-mi-mode='drifters']",
    markup: market
      .replace('<aside class="mi-board"', '<aside class="mi-board" data-mi-mode="drifters"')
      // The tab strip is static here, so show the Drifters tab selected.
      .replace('class="mi-tab is-active" role="tab" aria-selected="true"', 'class="mi-tab" role="tab" aria-selected="false"')
      .replace('class="mi-tab" role="tab" aria-selected="false" aria-controls="mi-list" data-mi-tab="drifters"',
        'class="mi-tab is-active" role="tab" aria-selected="true" aria-controls="mi-list" data-mi-tab="drifters"'),
  },
];

// ── States the design does not cover yet ──────────────────────────────
const GAPS = [
  {
    name: 'Hero · result declared',
    when: 'hero_fold.html, hero.result — roughly 80 lines of the live template',
    needs: 'The hero after the race has run: winner, placed horses, and the spoiler reveal (landing.js initHeroResultSpoiler still looks for [data-hero-result]). The redesign has no resulted hero, so on a Saturday evening the page has nothing to show.',
  },
  {
    name: 'AI Chamber · four of five outcomes',
    when: "landing.html: ai_consensus.pattern is majority | unanimous | single | split | empty",
    needs: 'Only majority is designed. Unanimous (all three agree), single (one model has a pick), split (three different picks) and empty (fewer than two picks, which is what the snapshot day actually was) all need a layout for the .ac-split block.',
  },
  {
    name: 'Challenges · with challengers',
    when: 'challenges_section.html: {% if top_challengers %}',
    needs: 'Only the empty state is designed. The filled state lists challengers with avatar, silk colour and a W/L/D record, plus the standings rows.',
  },
  {
    name: 'Market intelligence · no data',
    when: '_money_moves.html hides the whole section when has_data is false',
    needs: 'Early in the morning there are no market moves. The old section removed itself; the redesign has no empty state, so it would render an empty board.',
  },
  {
    name: 'Nav and footer · signed in',
    when: 'base.html and partials/footer.html: {% if user.is_authenticated %}',
    needs: 'My profile and Sign out in place of Sign in and Join free, and the hero pick link pointing at the pick rather than the join page (data-picks-half-href).',
  },
];

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Landing page states · Saturday Racing</title>
${head}
    <style>
      /* Page furniture only — the sections below use the real stylesheets. */
      .states-doc { max-width: 1280px; margin: 0 auto; padding: 48px 24px 96px; font-family: var(--font-body, system-ui); color: var(--c-text-100, #eceef5); }
      .states-doc h1 { font-family: var(--font-display, Georgia, serif); font-size: 32px; margin-bottom: 8px; }
      .states-doc__intro { color: var(--c-text-55, #9aa0b5); max-width: 70ch; line-height: 1.6; }
      .states-case { margin-top: 56px; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 20px; }
      .states-case__name { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
      .states-case__when { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--c-gold, #d4af37); margin: 0 0 16px; }
      .states-case__needs { color: var(--c-text-55, #9aa0b5); line-height: 1.6; max-width: 70ch; margin: 0; }
      .states-case--gap { border-left: 3px solid var(--c-gold, #d4af37); padding-left: 16px; }
      .states-case__tag { display: inline-block; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #0b0b0f; background: var(--c-gold, #d4af37); padding: 2px 8px; border-radius: 4px; margin-bottom: 8px; }
      .states-frame { border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; overflow: hidden; margin-top: 16px; }
    </style>
  </head>
  <body class="page-landing">
    <div class="states-doc">
      <h1>Landing page states</h1>
      <p class="states-doc__intro">
        Every state the Django template can render, so they can be looked at
        rather than imagined. Generated from <code>index.html</code> by
        <code>node tools/build-states.mjs</code>, so it cannot drift from the
        real markup. Styles are the real ones; no page JavaScript runs here,
        so countdowns and tabs are static.
      </p>

      <h2>States that exist</h2>
${STATES.map((state) => `      <section class="states-case">
        <p class="states-case__name">${escape(state.name)}</p>
        <p class="states-case__when">${escape(state.when)}</p>
        <div class="states-frame">
${state.markup}
        </div>
      </section>`).join(LF)}

      <h2 style="margin-top:72px">States with no design yet</h2>
      <p class="states-doc__intro">
        Each of these is a branch the live template can take. Until they are
        designed, the page has nothing to render when the data looks like
        this.
      </p>
${GAPS.map((gap) => `      <section class="states-case states-case--gap">
        <span class="states-case__tag">Needs design</span>
        <p class="states-case__name">${escape(gap.name)}</p>
        <p class="states-case__when">${escape(gap.when)}</p>
        <p class="states-case__needs">${escape(gap.needs)}</p>
      </section>`).join(LF)}
    </div>
  </body>
</html>
`;

writeFileSync('states.html', page.split(LF).join(newline));
console.log(`states.html: ${STATES.length} states rendered, ${GAPS.length} gaps listed`);
