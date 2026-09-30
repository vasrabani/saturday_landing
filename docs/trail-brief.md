# Brief: revamp the Fox Trail

The page: `trail.html` in this repo, live at
<https://www.saturday-racing.com/trail/>. Run the sandbox and open
<http://localhost:8080/trail.html>.

## What the page is for

Every day the site publishes tips from several sources — Sly Man's Bet of
the Day, Top Rated, Horses to Watch, Steamers, LLaMa Letters, the Featured
Tip, and Mr Fox's Pick Winner as a fallback. The trail puts the whole day
on one board: one cell per race, showing which horse the sources agree on,
how many of them agree (the confidence tier), and how it turned out.

It is a **live** page. Races settle while a reader has it open: cells
change state, the fox marker moves to the next race, the counter and the
day's record tick up. It also carries a track record, a legend that
doubles as a filter, a spotlight, and a drawer that opens on a cell to
show the sources behind that pick.

## Scope

**You are free to rethink the layout**, including how the board works on a
phone. This is a revamp, not a reskin. What must not change is what the
page *does* — every state below still has to be designed, and the hooks
listed under "the contract" still have to be there.

Five pieces, each its own pull request, in this order:

1. **The grid and its cells** — the heart of it: states, tiers, sources.
2. **The drawer and the card flip** — a cell's detail, and its result.
3. **The masthead** — counter, spotlight, track record.
4. **Legend, empty states, the historic view.**
5. **Phones** — across all of it.

## The design language is already decided

The site's home page was redesigned this year and is live. Open
`index.html` in this sandbox: the trail should look like it belongs to the
same site. Type, colour, spacing and the button and card treatments come
from there. The trail is a cream page where the landing is dark, so match
the system, not the palette exactly.

## Every state has to be designed

Open <http://localhost:8080/trail-states.html>. It lists **23 states**,
generated from the real page, and is the single most important thing in
this brief: last time round, states that were not on screen during design
were the bulk of the rework.

They include: all seven cell states (pending, live, won, placed, lost,
void, no tip), all four confidence tiers, a 2v2 split cell, the featured
race, a Pick Winner backup cell, the flagship badges, "you are here", the
open drawer, a flipped cell, the filtered grid, the finished day, the day
with no racing, and the day before the card is published.

Rebuild `trail-states.html` after changing the page:

```bash
node tools/build-trail-states.mjs
```

## The day runs in the sandbox

`trail_live.js` polls `/trail/live/` and paints what comes back. The
sandbox server replays a **recorded day** (`fixtures/trail-live-timeline.json`,
15 frames, built from the app's own figures) one frame per poll, so the
board really does settle while you work on it.

- The page polls every 4 seconds here (`data-live-poll-ms` on `main.trail`);
  production polls every 45.
- `http://localhost:8080/trail/live/?sim=reset` starts the day again.
- `?sim=last` jumps to the finished day; `?sim=7` to any frame.
- Each response carries an `X-Trail-Frame` header, so you can see where
  you are in the recording.

Design the moving states, not just the still ones: a race settling, the
fox arriving at the next race, the counter bumping, the day going final.

## The contract: what the JavaScript needs

Five scripts drive this page (`static/grid/js/`). Restyle freely, but keep
these hooks or the page stops working — silently, because nothing throws.

| Hook | Used for |
| --- | --- |
| `main.trail[data-live-url]`, `[data-is-today]`, `[data-generated-at]` | the poller |
| `#trailGrid`, `article.cell[data-race-id][data-cell-index]` | matching a race to its cell |
| `cell--pending/live/won/placed/lost/void/no_fancy` | cell state |
| `cell--tier-1..4`, `cell--split`, `cell--featured`, `cell--backup`, `cell--flagship-bod`, `cell--flagship-lead` | cell variants |
| `cell--now`, `.cell__now` | the fox marker the poller moves |
| `cell--just-updated`, `cell--just-won`, `cell--fox-arriving` | the moment a cell changes |
| `data-sources`, `data-flagship`, `data-settled` | filtering |
| `[data-filter-source]`, `[data-filter-tier]`, `trail__grid--filtered` | the legend filters |
| `[data-role="reveal-toggle"]`, `is-flipped` | the result flip |
| `#cellDrawer`, `[data-role="drawer-*"]`, `body.has-cell-drawer-open` | the drawer |
| `#trailFreshness`, `is-stale`, `is-final` | the freshness pill |
| `[data-role="gold-count"]`, `[data-role="live-count"]`, `[data-role="pending-count"]`, `[data-role="today-record"]`, `is-just-bumped` | the counter and record |
| `#trailCellData`, `#trailStreakData` | the data the page is built from |

If a hook is in the way of the design you want, say so in the pull
request and we will change it on both sides. Do not rename it quietly.

## Do not touch

- **The nav, the footer, `static/css/chrome.css` and `static/css/base.css`.**
  They are on all 141 pages of the site.
- **`index.html` and the landing page's assets.** Different job.
- **The five `static/grid/js/*.js` files**, other than by agreement: they
  are production code and come back unchanged.

## Budgets and standards

- **Images:** 300 KB each, maximum. WebP, sized to how big they actually
  appear (2× for retina). No new font files.
- **CSS:** use the variables in `static/css/base.css` rather than typing
  values out. Keep the trail's styles in `static/grid/css/`.
- **Breakpoints:** the trail currently uses eight different widths
  (400, 520, 640, 720, 900, 960, 1080, 1600). If you restructure, settle
  on the site's scale: 768 and 1024, plus 1280 for the nav.
- **Accessibility:** `npm test` runs axe at four widths. Today the page
  reports colour contrast only; do not add new violations. The filters,
  the flip and the drawer must work from the keyboard, and the drawer
  must close on Escape and return focus.
- **Performance:** the page is a grid of up to 45 cells that repaint as
  races settle. Avoid layout thrash in hover and animation.

## Running it

```bash
npm install
npm run serve      # http://localhost:8080/trail.html
npm run check      # static checks: must pass
npm test           # features + accessibility, four widths: must pass
npm run test:visual  # screenshot comparison: advisory, look at the diffs
```

`npm run check` and `npm test` are the gate. A pull request that fails
either will come back.

## Before you hand over

- [ ] Every state in `trail-states.html` designed, and the page rebuilt
- [ ] The recorded day watched end to end: settling, the fox moving, the
      counter, the finished board
- [ ] No debug code, no calls to localhost
- [ ] Images 300 KB or less, nothing unused left behind
- [ ] Colours, fonts and spacing from the `base.css` variables
- [ ] No formatting-only changes to files you did not otherwise change
- [ ] Every hook in the contract still present
- [ ] `npm run check` and `npm test` pass at all four widths
- [ ] Checked at 375, 768, 1024 and 1440px
- [ ] Scoped commits, one pull request per piece, structural changes
      listed in the description

## After you hand over

Each piece is ported into the Django templates on our side
(`docs/integration-map.md` says where every part of this page lives). The
faster your markup keeps the hooks and the states, the faster it ships.
