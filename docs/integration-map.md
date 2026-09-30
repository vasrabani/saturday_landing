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
