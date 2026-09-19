// Build states.html: every state the Django template can render, on one
// page, taken from index.html so it cannot drift from the real markup.
//
//   node tools/build-states.mjs
//
// States the redesign has no markup for are listed as gaps, with what the
// template branch needs, rather than invented here.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

// States with no markup in index.html live in partials/, so the Django
// port has real HTML to copy rather than a screenshot to work from.
const partial = (name) => readFileSync(join('partials', `${name}.html`), 'utf8').split(CR + LF).join(LF);

// The chamber's consensus block sits inside a model panel, so each variant
// is shown in that panel with the majority block swapped out.
const chamberPanel = extract(`<article${LF}              class="ac-panel"`, 'article');
const splitStart = chamberPanel.indexOf('<div class="ac-split">');
// Past the dissent card's own closing tag, then past the block's.
const splitEnd = chamberPanel.indexOf('</div>', chamberPanel.indexOf('</div>', chamberPanel.indexOf('ac-split__card--break')) + 1) + '</div>'.length;
// The panel is wrapped back in its section: ai_chamber.css defines the
// section's colours as custom properties on .ai-section--chamber, so a
// panel shown outside it loses its gold.
const chamberWith = (variant) =>
  '<section class="section ai-section ai-section--chamber"><div class="container"><div class="ac-layout">'
  + chamberPanel.slice(0, splitStart) + partial(variant).trim() + chamberPanel.slice(splitEnd)
  + '</div></div></section>';

const challenges = extract('<section class="chal-section chal-section--duel section"', 'section');
// The filled state replaces everything from the arena to the end of the
// standings block.
const challengesFilled = () => {
  const start = challenges.indexOf('<div class="chal-live__arena">');
  const end = challenges.indexOf('</div>', challenges.indexOf('chal-live__standings-empty')) + '</div>'.length;
  const tail = challenges.indexOf('</div>', end) + '</div>'.length;
  return challenges.slice(0, start) + partial('challenges-filled').trim() + challenges.slice(tail);
};

// With no moves at all, production hides the whole section. Early in the
// day one list can still be empty while the other has moves: that list
// says so, and the tabs switch to the message like any other list.
const marketNoDrifters = () => {
  const start = market.indexOf('<ol class="mi-list mi-list--drifters">');
  const end = market.indexOf('</ol>', start) + '</ol>'.length;
  return (market.slice(0, start)
    + '<p class="mi-list mi-list--drifters mi-list__empty">No drifters yet today.</p>'
    + market.slice(end))
    .replace('&middot; 14 drifters', '&middot; 0 drifters');
};

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
    name: 'Hero · the race has been run',
    when: 'hero_fold.html: {% if hero.result %} — the state every Saturday evening',
    markup: partial('hero-resulted'),
  },
  {
    name: 'AI Chamber · unanimous',
    when: "ai_consensus.pattern == 'unanimous' — all three models agree",
    markup: chamberWith('ai-consensus-unanimous'),
  },
  {
    name: 'AI Chamber · one model has a pick',
    when: "ai_consensus.pattern == 'single'",
    markup: chamberWith('ai-consensus-single'),
  },
  {
    name: 'AI Chamber · three-way split',
    when: "ai_consensus.pattern == 'split' — three models, three horses",
    markup: chamberWith('ai-consensus-split'),
  },
  {
    name: 'AI Chamber · waiting (no consensus yet)',
    when: 'the {% else %} branch — fewer than two picks, as on the captured day',
    markup: chamberWith('ai-consensus-empty'),
  },
  {
    name: 'Challenges · Cubs are challenging',
    when: 'challenges_section.html: {% if top_challengers %}',
    markup: challengesFilled(),
  },
  {
    name: 'Market intelligence · no drifters yet',
    when: "_money_moves.html: {% if money_moves.top_drifters %} … {% else %}, on the Drifters tab (with no moves at all the section is hidden)",
    markup: marketNoDrifters()
      .replace('<aside class="mi-board"', '<aside class="mi-board" data-mi-mode="drifters"')
      .replace('class="mi-tab is-active" role="tab" aria-selected="true"', 'class="mi-tab" role="tab" aria-selected="false"')
      .replace('class="mi-tab" role="tab" aria-selected="false" aria-controls="mi-list" data-mi-tab="drifters"',
        'class="mi-tab is-active" role="tab" aria-selected="true" aria-controls="mi-list" data-mi-tab="drifters"'),
  },
  {
    name: 'Syndicates · none yet',
    when: '_syndicates.html: {% if top_syndicates_landing %} … {% else %}',
    markup: partial('syndicates-empty'),
  },
  {
    name: 'Track record · no results yet',
    when: '_track_record.html: {% if previous_results %} … {% else %}',
    markup: partial('track-record-empty'),
  },
  {
    name: 'Final call to action · days to go',
    when: '_final_cta.html: days_to_go > 0 (the page shows race day)',
    markup: partial('final-cta-days-to-go'),
  },
  {
    name: 'Signed in · nav, footer and the Welcome back strip',
    when: 'base.html, partials/footer.html and _cub_hello.html: {% if user.is_authenticated %}',
    markup: partial('signed-in-chrome'),
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

// Every branch the live template can take now has markup.
const GAPS = [];

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

${GAPS.length === 0 ? '' : `      <h2 style="margin-top:72px">States with no design yet</h2>
      <p class="states-doc__intro">
        Each of these is a branch the live template can take. Until they are
        designed, the page has nothing to render when the data looks like
        this.
      </p>`}
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
