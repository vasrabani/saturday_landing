# Integration map

Where each part of this snapshot lives in the Django site, and how a change
made here gets there. Two pages live here now.

- **The home page** (`index.html`). Ported and live since 2026-09-18, so
  this repo is its design workspace: a change made here is ported into
  the matching template by hand.
- **The Fox Trail** (`trail.html`). Snapshot taken 2026-09-30 for the
  revamp — see `trail-brief.md`. Nothing has been ported back yet.

Repositories:

- **Here:** `saturday_landing` — the static snapshots.
- **There:** the Saturday Racing app.
  - Home page: `public/templates/public/landing_v2.html`, one partial per
    section from `public/templates/public/components/v2/`, context from
    `public/views/landing.py`, assets under `public/static/public/v2/`.
  - Fox Trail: the `grid` app — `grid/templates/grid/trail.html` plus 12
    partials, `grid/views.py`, the board itself built by
    `grid/services/` (consolidator, trail, track_record, source adapters),
    assets under `grid/static/grid/`.

## In sync with production as of

Production **`c7faffb1` (2026-09-19)**. Two syncs brought production's
changes back into this snapshot, so the two match section for section.

**Second sync, to `c7faffb1`: image loading (production `b7ad01bd`, PERF-1).**
The hero photo is preloaded; the nine sections below the hero carry
`data-defer-bg`, and `static/public/css/defer-bg.css` with
`static/public/js/defer-bg.js` hold their CSS backgrounds (and the
footer's) until each comes near the screen; 61 images below the hero load
lazily; the nav portraits use 72px copies in `static/img/nav/`; and
`mi-steam-bg.webp` is recompressed. Production's two other changes since
the first sync are server-only and have nothing to bring across: the
gunicorn workers load the URLconf at start (`saturday/wsgi.py`), and the
market movers are no longer ranked on every page, with the landing's
market section cached for a minute.

**First sync, to `8abdc1e6` (2026-09-18), the switch-over:**

| Area | What production had that this snapshot didn't |
| --- | --- |
| Nav | The fit rules: the hamburger below 1280px, and `site.js` switching to it whenever the link row doesn't fit. A 220px budget for the race badge, now carrying the featured race's name. 8px link padding. The back link hidden on desktop. The date actually hiding at 1280px and wider |
| Signed in | Production's nav actions (picks pill, name chip capped at 150px, Sign out hidden at 1280px and wider) and footer links, plus the "Welcome back" strip, all on `states.html` |
| Editorial shelf | Four cards, as the service builds. The Bet of the Day line is the card's fixed tagline |
| Day hub | Filtered tiles really hide. "FOX →" only on races the Fox picked (every tile is now flagged `fox`, as "Fox has picked 26" says). Course buttons show race counts, not GB/IRE. The Class fact is a number. The Fox's tip shows odds, not a note. LIVE is solid red |
| Market intelligence | The narrative line, "Updated · steamers · drifters", the Steamers Board link, underdog watch, and empty lists that say so. With no moves at all the section is hidden |
| DEN | "Better bets", capitalised |
| AI Chamber | No confidence scores: there is no field behind them |
| AI Lab | Launch goes to the simulation; the terminal names the race in full |
| How it works | Tier 2 says "multiplied by 2", as the setting drives it. The tier cadence line keeps its own dark ink on phones |
| Saturday Draw | The two "tabs" are labels, not buttons. With no field loaded the button is disabled |
| Syndicates, News, Track record, final CTA | Rebuilt in the redesign's language (`lower.css`); News is new |

**Before designing, check for newer production changes:**

```bash
git log c7faffb1..main --oneline -- public/templates/public/landing_v2.html public/templates/public/components/v2 public/static/public/v2 templates/base/base.html templates/partials/footer.html static/css/chrome.css static/css/base.css static/js/site.js static/img
```

Anything that lists has to come back here first, or a change made here
will be ported on top of an old version of the section.

## Section by section

| Section here | Template there | Context |
| --- | --- | --- |
| Welcome back (signed in; `states.html`) | `components/v2/_cub_hello.html` | `cub_dashboard`, `picks_summary` |
| Today strip | `components/v2/_today_strip.html` | `today_summary`, `daily_featured` |
| Hero | `components/v2/hero_fold.html`, `_hero_switch.html` | `hero_day` or `hero_week`, by `hero_source` |
| Editorial shelf | `components/v2/_editorial_shelf.html` | `editorial_shelf` (`news/services/editorial_shelf.py`) |
| Day hub | `components/v2/_day_hub.html`, `_day_card_feature.html` | `day_hub` |
| Market intelligence | `components/v2/_money_moves.html` | `money_moves` |
| Battle | `components/v2/_battle.html` | `big_race`, `cub_tip`, the season wins |
| DEN | `components/v2/_den.html` | fixed content |
| AI Chamber | `components/v2/_ai_chamber.html`, `_ai_tab.html`, `_ai_panel.html`, `_ai_consensus.html` | `ai_analysis`, `ai_consensus` |
| AI Lab | `components/v2/_ai_lab.html` | `big_race`, `ai_analysis` |
| How it works | `components/v2/_how_it_works.html` | `scoring`, `SCORING_MATRIX` |
| Challenges | `components/v2/_challenges.html` | `top_challengers`, `big_race` |
| Saturday Draw | `components/v2/_draw.html` | `draw_runners`, `big_race` |
| Syndicates | `components/v2/_syndicates.html` | `top_syndicates_landing` |
| Build-up News | `components/v2/_news.html` | `breaking_news` |
| Track record | `components/v2/_track_record.html` | `previous_results` |
| Final call to action | `components/v2/_final_cta.html` | `big_race`, `days_to_go`, the runner count |
| Nav and footer | `templates/base/base.html`, `templates/partials/footer.html` | `user`, `featured`, `site_contact` |

The day hub's icons are shared includes in `components/v2/icons/`.

## The Fox Trail, part by part

| In the sandbox | Template there | Notes |
| --- | --- | --- |
| `trail.html` shell, masthead | `grid/templates/grid/trail.html` | `is_today`, `page_day`, `trail.*`; historic days come from `?date=` |
| Counter | `grid/_counter.html` | `trail.counter` from `compute_counter` |
| Freshness pill, live updates | `trail.html` + `grid/static/grid/js/trail_live.js` | polls `grid:trail_live`, the JSON in `grid/views.py` |
| The grid, one cell per race | `grid/_cell.html` | the biggest branch set on the page: state, tier, split, featured, backup, flagship, fox marker |
| Cell back (the result) | `grid/_cell_back.html` | shown by `trail_flip.js`; podium from the cell |
| Cell drawer | `grid/_drawer.html` | filled by `trail_drawer.js` from `#trailCellData` (`drawer_payloads`) |
| Legend and filters | `grid/_legend.html` | `trail_filter.js` reads `data-filter-source` / `data-filter-tier` |
| Spotlight | `grid/_spotlight.html` | `trail.spotlight` |
| Today's record | `grid/_track_record_today.html` | `trail.today_record`, bumped live by the poller |
| History | `grid/_track_record_history.html` | `trail.track_record` |
| Proposition | `grid/_proposition.html` | fixed copy |
| Anatomy panel | `grid/_trail_anatomy.html` | only on the not-published-yet day |
| Early signals banner | `grid/_early_signals_banner.html` | only before the card firms up |
| No racing / too early | `grid/_empty.html`, `grid/_empty_premature.html` | `partials/trail-empty*.html` here |
| Course bar | `grid/trail.html`, above the grid | new in the revamp: `trail_course.js`. The Reveal results toggle sits in it |
| The track under the cells | `grid/trail.html`, first child of `.trail__frame` | new in the revamp: an empty shell that `trail_track.js` draws into |
| "Next race" call | `grid/_proposition.html` | new in the revamp: rendered from the `is_now` cell, kept current by `trail_course.js` |

**The sandbox's day is a fixture.** `GRID_FORCE_FIXTURES=True` renders a
24-race demo day that exercises every cell state and tier, which is what
`trail.html` was snapshotted from (`grid/services/fixtures.py`). The
featured, backup and flagship cells are not in that day; they are
rendered separately into `partials/trail-cell-*.html`.

**The live feed is recorded.** `fixtures/trail-live-timeline.json` is a
day of the board settling, built by walking the fixture day forward and
recomputing `compute_counter` / `build_today_tier_record` at each step, so
every number in it is the app's own. `tools/serve.mjs` replays it.

**One production change went with the snapshot:** `trail_live.js` reads
its poll interval from `data-live-poll-ms`, falling back to 45s, so the
sandbox can replay a day in minutes. Port that line back with the revamp.

## The Fox Trail revamp: what to port

The racecourse board. The stylesheet is rewritten, three scripts and an
image folder are new, and the five production scripts are untouched.

**Files.** Each goes to the same name under `grid/static/grid/`. Every
`url()` in `trail.css` points inside that folder (`../img/…`), so the
stylesheet depends on nothing outside the app.

| File | What it is |
| --- | --- |
| `css/trail.css` | The whole page, rewritten. No `!important`; page-level steps only at 768, 1024 and 1280px; the cards, the board and the course bar size themselves with container queries |
| `js/trail_cards.js` | New. Fits a one-word horse name to its card, and brings cards up as the reader reaches them |
| `js/trail_track.js` | New. Draws the track under the cards, from where the grid has laid them |
| `js/trail_course.js` | New. The course bar, and the "next race" call under the introduction |
| `img/silk-*.svg` (8), `img/horseshoe.svg`, `img/fox.svg` | New. CSS masks, under 1 KB each |
| `img/turf.webp`, `img/lawn.webp` | New. Two grass tiles, 29 KB each |

The three scripts load with `defer` after `trail_nav.js`, in the order
above. They read the classes the template and the poller already set on
the cells, and read again when a cell's class changes; none of them calls
another script, and none changes a cell's markup.

Browser support is the site's own. Container queries are new to the site,
but they are older than `color-mix()`, which `chrome.css` already relies
on; without them the board falls back to a single column.

**Markup. STRUCTURAL — needs moving into the Django templates.**

| Template | Change |
| --- | --- |
| `grid/trail.html` | The `.trail__reveal` wrapper becomes `<nav class="trail__course" data-role="course">`, the course bar. The Reveal results button is inside it with its hooks as they were; only its two words are shorter (see `content-notes.md`) |
| `grid/trail.html` | `.trail__frame` gains `id="trailCourse"` and, as its first child, the `.trail__track` shell |
| `grid/trail.html` | The `☰` glyph comes out of `.trail__nav-trigger-icon`: the stylesheet draws the icon. Three `<script defer>` tags |
| `grid/_legend.html` | The `ⓘ` glyph comes out of `.trail__legend-head-icon`. Each row's label is split into `.trail__legend-name`, `.trail__legend-sep` and `.trail__legend-hint`, so a name and its hint can take a line each. The words are the same |
| `grid/_proposition.html` | Each silk and its name are wrapped in `.trail__proposition-pair`, so a line never breaks between the two. A new last paragraph, `.trail__next`: the call to the next race |
| `grid/_spotlight.html` | `id="trailSignals"` on the section |
| `grid/_track_record_history.html` | `id="trailRecord"` on the aside |

`_cell.html`, `_cell_back.html`, `_drawer.html`, `_counter.html`,
`_track_record_today.html`, the two empty states, the anatomy panel and
the early-signals banner are restyled only. Their markup is as it was.

**What the template fills in.** `trail_course.js` rewrites all of these
when it loads and keeps them current, so they only have to be right for
the first paint and for a reader without JavaScript.

| Hook | Value |
| --- | --- |
| `[data-role="course-total"]` | how many races the board has (the cells, not the `cell--ghost` seats) |
| `[data-role="course-number"]`, `[data-role="course-race"]` | `1`, and the first race's time and course |
| `[data-role="next-lead"]` | "Running now:" when the `is_now` cell is live, "First race:" when it is the first cell, otherwise "Next race:" |
| `[data-role="next-name"]`, `[data-role="next-more"]` | the `is_now` cell's time and course, and its horse |

Once the day is over there is no `is_now` cell: the call then reads "The
day is run: 8 gold" with "walk the course" after it, the count being the
masthead's own. The words are `data-*` attributes on the markup
(`data-next`, `data-first`, `data-live`, `data-done`, `data-walk` on the
call; `data-say` on the bar's status line), in the way `data-on` and
`data-off` already carry the toggle's.

**Days with no cards.** On a day with no racing the template renders
`_empty.html` inside `.trail__frame`; on a day too early for the card it
renders neither the frame nor the legend. In both cases the page has no
`.cell[data-race-id]`, and the stylesheet keys off that: the frame drops
its racecourse, and the course bar and the call hide themselves if they
are there. So they need no template condition of their own, though
leaving them out on those days is tidier. Both pages were checked with
the live site's markup for such a day (`?date=` on a day without racing,
and on a date still to come), since the sandbox has those states only as
bare partials; that is also where the anatomy panel was checked.

**A past day.** Rendered without the freshness pill, today's record, the
spotlight or a fox marker. Nothing needs a condition for that: with no
`is_now` cell the call reads "The day is run", the bar's "Mr Fox" button
is hidden, and `trail_course.js` puts away any section link whose section
is not on the page (here "Signals"). Checked with the live site's markup
for a finished Saturday of 44 races.

**Words that are not in the template.** The confidence word in a cell's
top corner (Whisper, Nod, Chorus, Smoker) and the Live and Void plaques
are CSS `content`, keyed on classes the template and the poller already
set (`cell--tier-N`, `cell__glyph--live`, `cell__glyph--void`). That way
the poller needed no change. If they should be text in `_cell.html`
instead, it is one `<span>` and a few lines of CSS.

**Hidden, not removed.** These are still in the markup, and the poller
still writes some of them; the stylesheet hides them because the new
design says the same thing another way: `.cell__mark`, `.cell__star`,
`.cell__crown`, `.cell__finish`, `.cell__glyph--placed`,
`.cell__glyph--pending`, `.cell__back-title`, `.smoker__flame`, and the
emoji inside `.cell__now-glyph`. Taking them out of the templates is
optional, and for the glyphs would need the poller changed to match.

**What the new scripts need.** As with the contract in `trail-brief.md`:
lose one of these and that script quietly does nothing.

| Hook | Used for |
| --- | --- |
| `#trailGrid`, `.cell[data-race-id]`, `.cell__time`, `.cell__course`, `.cell__horse` | reading the day off the board |
| `cell--now`, `cell--live/won/placed/lost/void` | where the fox marker is, and what has been run |
| `[data-role="course"]`, `course-prev`, `course-next`, `course-map`, `course-number`, `course-total`, `course-race`, `course-status`, `course-fox` | the course bar |
| `[data-role="next-race"]`, `next-lead`, `next-name`, `next-more` | the call to the next race |
| `[data-role="track"]`, `track-rails`, `track-turf`, `track-hoofs`, `track-start-line`, `track-start`, `track-post`, `track-post-label` | the track |
| `#trailCourse`, `#trailSignals`, `#trailRecord` | the bar's links to the page's sections |
| `[data-role="gold-count"]` | the tally the finished day's call quotes |
| `body.has-cell-drawer-open`, `body.trail-nav-lock` | the arrow keys stand down behind an open panel |

They set, and only the stylesheet reads: `is-drawn` on the track,
`is-seen` on a cell, `trail--entrance` on `main.trail`,
`cell--just-reached` on a cell, `--cell-horse-size` on a horse's name,
and `is-won`, `is-run`, `is-live`, `is-now`, `is-current` on the map's
ticks. The track's width comes from `--trail-track-band` in the
stylesheet.

**One thing in `site.js`.** It scrolls every in-page `#` link to 76px
from the top of the window, which is under the header whenever the tour
banner shows and under the course bar here. The trail's own links step
round it; the lasting fix is for `site.js` to honour the target's
`scroll-margin-top`.

## Porting a change

1. **Files:** a changed stylesheet, script or image goes to the same name
   under `public/static/public/v2/`, apart from `chrome.css`, `base.css`
   and `site.js`, which are site-wide and live in `static/`. `npm run check`
   already guarantees every `url()` resolves, which is what breaks the
   deploy if it doesn't.
2. **Markup:** rebuild the change in the section's partial, keeping every
   `{% if %}` branch it already has. `states.html` shows those branches
   (fourteen states), so check the change against each one, not just the
   page.
3. **Sample data here, real data there.** Anything this snapshot shows that
   has no field in the view's context is a decision, not a port. List it
   in `docs/content-notes.md` rather than inventing the field.

## Things that will bite

- **Absolute URLs.** Every link here points at `https://www.saturday-racing.com/...`
  because the sandbox has no URL resolver. In Django they are `{% url %}`
  tags.
- **`chrome.css`, `base.css` and `site.js` are site-wide.** A nav or footer
  change lands on all 141 templates that extend the base, not just this
  page. See "Checked on other page types" below.
- **`collectstatic` reads `url()` inside comments.** That is what broke the
  deploy before; `npm run check` now catches it.
- **Sample data is sample data.** Every horse, price and count here is
  invented. `docs/content-notes.md` says which numbers have no field
  behind them.
- **Images were resized to twice their painted size.** If a section is used
  bigger anywhere else, re-export rather than upscale.
- **Backgrounds below the hero load late on purpose.** A new section that
  paints a CSS background image needs `data-defer-bg` on its `<section>`,
  or it will load with the first screen and slow the hero down. The hero
  itself must not have it. `states.html` shows every background at once
  (it leaves the switch out), and the visual test turns deferral off so
  its screenshots show the finished page.

## Checked on other page types

On 2026-09-18, eleven live production page types were loaded at 375, 768,
1024 and 1440px: once as they are, and once with this `chrome.css` and
`base.css` swapped in (plus, in a second pass, this footer's markup). The
page types were the racecard list, a single racecard, results, the news
index, an article, Fox Trail, Learn (Accumulators), Bet of the Day, The
Honest Record, sign-in and the LLaMa Letters.

- **Nav: safe everywhere.** Same 60px height on every page, no horizontal
  scroll. The nav fit rules that came back in this sync were built against
  those pages, signed in and out.
- **Footer: fixed here, would have broken three pages.** The new footer set
  no font, line height or colour of its own, so it inherited each page's:
  serif on Bet of the Day and Learn, tighter spacing on the racecards.
  `.sf--branded` now sets its own type (base.css's body values), and all
  eleven pages compute identical footer styles.
- **768px only: the page gutter changes.** `.container` padding at exactly
  768px (iPad portrait) goes from 24px to 48px, the same as every wider
  screen already had.

## What to check when a change is ported

Run the same checks against the Django page that this repo runs against
the snapshot:

- Every feature at 375, 768, 1024 and 1440px (`tests/features.spec.js` is
  the list).
- axe with no new violations (`docs/accessibility-notes.md` records the one
  open contrast decision).
- The section against `states.html` for each branch it can take.
