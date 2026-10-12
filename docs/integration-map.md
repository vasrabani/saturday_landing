# Integration map

Where each part of this snapshot lives in the Django site, and how a change
made here gets there. Three pages live here now.

- **The home page** (`index.html`). Ported and live since 2026-09-18, so
  this repo is its design workspace: a change made here is ported into
  the matching template by hand.
- **The Fox Trail** (`trail.html`). Snapshot taken 2026-09-30 for the
  revamp — see `trail-brief.md`. Nothing has been ported back yet.
- **The meeting page** (`meeting.html`, `meeting-upcoming.html`). Snapshots
  of Newmarket taken 2026-10-09 and 2026-10-10 for the revamp — see
  `meeting-brief.md`. Nothing has been ported back yet.

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
  - Meeting page: the `races` app — the full-field meeting template and
    the racecard component it includes, the view behind
    `/races/meeting/<course>/<date>/full/`, assets under
    `races/static/races/` (`css/racecard.css`, `racecard_prices.css`,
    `meeting_full.css`, `pick6_emblem.css`, `ai_pick_chip.css`,
    `chamber_verdict.css`; `js/racecard.js`, `racecard_collapse.js`,
    `bet_slip.js`, `meeting_full.js`) and `voting/static/voting/`.

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
image folder are new, and four of the five production scripts are
untouched. The fifth, `trail_flip.js`, carries one fix that production
needs too (below).

**Files.** Each goes to the same name under `grid/static/grid/`. Every
`url()` in `trail.css` points inside that folder (`../img/…`), so the
stylesheet depends on nothing outside the app.

| File | What it is |
| --- | --- |
| `css/trail.css` | The whole page, rewritten. No `!important`; page-level steps only at 768, 1024 and 1280px; the cards, the board and the course bar size themselves with container queries |
| `js/trail_cards.js` | New. Fits a one-word horse name to its card, and brings cards up as the reader reaches them |
| `js/trail_track.js` | New. Draws the track under the cards, from where the grid has laid them |
| `js/trail_course.js` | New. The course bar, and the "next race" call under the introduction |
| `js/trail_flip.js` | One fix. A race settled by the poller is marked `data-settled="1"` whether or not results are showing, so the Results toggle turns it. Before, a race that settled while the toggle was off stayed on its pick when the toggle was switched on |
| `img/silk-*.svg` (8), `img/horseshoe.svg`, `img/fox.svg` | New. CSS masks, under 1 KB each |
| `img/turf.webp`, `img/lawn.webp` | New. Two grass tiles, 29 KB each |

The three scripts load with `defer` after `trail_nav.js`, in the order
above. They read the classes the template and the poller already set on
the cells, and read again when a cell's class changes; none of them calls
another script, and none changes a cell's markup. `tests/trail.spec.js`
says what each of the three has to keep doing.

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
| `grid/trail.html` | The Previous button starts with `aria-disabled="true"`, not `disabled`: the script holds the step buttons back that way so one that runs out of races keeps the keyboard's focus |
| `grid/trail.html` | `data-density="long"` on `#trailGrid` when the day has more than 30 races (see "Long days") |
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

**After the first look on real data (12 October).** Four changes asked
for once the board was in the staff preview:

| What | Where |
| --- | --- |
| A bigger Start sign, carrying the first race ("Start · 13:15 Ascot") | `trail.css`; `trail_track.js` fills `[data-role="track-start-race"]`, a new span inside the sign in `grid/v2/trail.html`, which the template renders too |
| Arrows along the course in place of the hoof prints, each turned to point at the next race | `trail_track.js` sets `--turn` on each `.track__hoof`; `trail.css` draws the arrow. The class keeps its name |
| A chequered flag on every race that is run, whatever became of the pick | `trail.css` only: after the time on a card with room, before the course on a narrow one |
| The horse's own silks beside its name, in place of the signal's jacket | `grid/_cell.html` gains `.cell__silk` as the first child of `.cell__pick--primary`: an `<img>` of the racing data's silks, or a `<span class="cell__silk--drawn">` with `--silk-1` and `--silk-2` when it gives only two colours. The app adds `TrailCell.silk`, matched to the runner by name. A pick with no runner, or a runner with no colours of its own, has no `.cell__silk` and keeps the jacket. The signals' jackets along the foot are unchanged |

`_cell.html` is shared with the live board, whose stylesheet hides
`.cell__silk`. Here the fixture day's silks are the meeting page's
(`static/meeting/img/silks/`), with three drawn from colours and one
pick left without.

**A course filter, and a label on days that are not today.** Two
things taken from an outside review of the page.

| What | Where |
| --- | --- |
| Filter the board by course | `grid/_cell.html`: `data-course="<slug>"` on the article. `grid/v2/_legend.html`: a "Courses" block above "Signals", one `.trail__legend-row--course` per course with `data-filter-course`, `data-filter-label` and its number of races in `.trail__legend-count`; the view lists the day's courses in the order they first run. `trail_filter.js` (shared with the previous board) marks the matching cells `cell--in-filter`, since the stylesheet cannot know the day's courses |
| "Archive · final results" and a link to today, on a past day | `grid/_counter.html`, where the live pill stands on today's page: `.trail__freshness--archive` and `.trail__today-link`. A day still to come gets the link and "Not yet run" |

**Other days.** Under the date in `grid/_counter.html`, a
`<nav class="trail__days">`: a link to the race day before this one
(`rel="prev"`), a form with a date field (`data-role="day-form"`,
`method="get"` to the trail, `name="date"`), and a link to the race day
after (`rel="next"`), which today's page does not have. The app finds
the nearest days that had racing, so neither link lands on an empty
board; the field's `min` is the first day the trail has and its `max` is
today. `js/trail_day.js` is new and loads on every state of the page,
empty days included: it hides the field behind a calendar button and
goes to a day as soon as one is chosen. Without it the form is a date
field and a Go button.

**Long days.** The fixture day has 24 races; a busy day has 45 to 50.
With `data-density="long"` on the grid the board goes one more abreast
from three up (six at 1440px, four on a tablet) and keeps less lawn
between its rows. Measured with the 47 races of 12 October 2026 in the
grid, the board is 2,099px tall at 1440px, where without the attribute it
is 2,800px and the page it replaces is 1,572px. The template sets the
attribute past 30 races; `tests/trail.spec.js` ("a long day") runs the
fixture day twice over to cover it.

**Phones read straight.** Two abreast, every row runs left to right: a
row that ran back only put the later race first. The track is drawn all
the same, as one course down the page. From three abreast the rows
snake, as the live page's do.

**The cards are counted among themselves.** The rows that run back are
placed with `:nth-child(… of .cell)`, so an element in the grid that is
not a card cannot shift them.

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

## The meeting page, part by part

| In the sandbox | Template there | Notes |
| --- | --- | --- |
| `meeting.html` shell, masthead | the full-field meeting template | the course, the date, `race_count`, `runner_count`, the first off, the going / type / track / headline chips; the `<style>` block in its head is replaced by `meeting.css` |
| Pick Six | `pick6_emblem` include | the emblem's own markup; `meeting_masthead.js` letters the stamp from `.pick6__lbl` and `.pick6__stamp` |
| Meeting tabs | the meeting switcher partial | the day's meetings, `?r` counts; `meeting_masthead.js` rewords "8r" |
| Race strip | the jump nav, `data-mf-jump` | one chip a race: `--next`, `--done`, `--featured`; `meeting_full.js` marks the race in view, `meeting_masthead.js` corrects it for big fields |
| One race | the race partial | time, name, tags, the trip and class, prize, runners, Reveal winner, the Race card link; `meeting_racecard.js` adds the filters above it |
| The runners | the racecard component | one `.racecard__runner` a horse with its `data-*`; the table's column heads; the comment and the AI verdict rows |
| AI verdict panel | `chamber_verdict` include, before the off | restyled only |
| The slip | the bet slip partial | `bet_slip.js` fills `#slipLegs`; `meeting_slip.js` dresses each leg and keeps the six places under the head |
| Previous / next meeting | the paddles at the foot | restyled only |

**The sandbox's days are captures, not fixtures.** Both pages are the live
page as it was, with the silks the live page loads from
`silks.theracingapi.com` copied into `static/meeting/img/silks/` (named by
the sha1 of the live URL), so the sandbox asks no other server for
anything. The Friday page has every result in; the Saturday page is the
evening before, with no numbers, most runners at SP and the AI verdict
panels — between them, every state the template can take, apart from a
race running now, which neither capture caught.

## The meeting page revamp: what to port

One stylesheet, three scripts and an image folder are new; the four
production scripts are untouched; the template changes are the asset
links.

**Files.** Each goes under `races/static/races/` with the folder's name
dropped (`static/meeting/css/meeting.css` → `races/static/races/css/meeting.css`,
and so on). Every `url()` in `meeting.css` points inside the folder
(`../img/…`), so the stylesheet depends on nothing outside the app once
the picture is beside it.

| File | What it is |
| --- | --- |
| `css/meeting.css` | The whole page, replacing six stylesheets and the template's `<style>` block. No `!important`; page-level steps only at 768, 1024 and 1280px; the runners choose table, two lines or a card by a container query on `.mf-races` |
| `js/meeting_racecard.js` | New. The labels, the form's colours, the numbers, the line under a runner's name, Details, the filters and the Comments switch, the favourite and the top rating, sorting from the keyboard |
| `js/meeting_masthead.js` | New. The stamp's lettering, "8 races", the strip's rows and height, "you are here" for big fields, jumps that land below the pinned bars |
| `js/meeting_slip.js` | New. The ticket, the six places, the bar's silks, the sheet's backdrop and Escape, the six-pick limit |
| `img/icons/*.svg` (22) | New. CSS masks, under 1 KB each |
| `img/masthead.webp` | The homepage's hero picture (108 KB), a copy so the stylesheet points inside its folder |

The three scripts load with `defer` after `meeting_full.js`, in the
order above. They read the classes and attributes the template and the
production scripts already set, and none of them changes a production
element's markup beyond adding an element beside it or an attribute to
it. `tests/meeting.spec.js` says what each has to keep doing.

Browser support is the site's own. Container queries and `:has()` are
new to this page (Chrome / Edge 105, Safari 16, Firefox 121); without
them a runner's cells stack in one column, readable but plain, the way
the trail's board falls back to one column.

**Markup. STRUCTURAL — needs moving into the Django template.**

| Template | Change |
| --- | --- |
| the full-field meeting template, `<head>` | The six page-level stylesheet links (`racecard`, `racecard_prices`, `meeting_full`, `pick6_emblem`, `ai_pick_chip`, `chamber_verdict`) become one, `races/css/meeting.css`; the page-local `<style>` block comes out. `base`, `paper`, `chrome` and `picks_budget` stay |
| the full-field meeting template, before `</body>` | Three `<script defer>` tags after `meeting_full.js` |
| the full-field meeting template, `.mf-wrap` | Optional: `data-pick-limit="{{ daily_pick_limit }}"`, so the page's six follows the setting; without it the scripts assume six |
| the site's chrome, on this page only | `body.page-meeting-full` sets `--max-w: 1520px` and `--page-gutter: 24px`, which `chrome.css` reads: the nav, the tour strip and the footer take the page's column here. Deliberate; drop the two lines to give the frame back its 1280px and 48px |

Nothing else in the template changes: every element the revamp adds, it
adds itself (the filters, the Details button, the rulers, the number
cloths, the ticket's silks, the six places, the backdrop, the message).
If any of those should be in the template instead — the filters and the
Details button are the natural candidates — it is one block of markup
each, and the script already checks before adding one.

**The six-pick limit and the server.** The limit on the page is the same
six the server applies when a member submits (`daily_pick_limit`). It is
kept in `meeting_slip.js` rather than `bet_slip.js` so that
`bet_slip.js` comes back unchanged; moving the gate into `bet_slip.js`'s
own click handler (before `addOrReplace`) would be a six-line change and
would make the stood-down buttons' state part of `render()`. Either way
the server's check on submit stays as it is.

**What the new scripts need.** As with the contract in `meeting-brief.md`:
lose one of these and that script quietly does nothing.

| Hook | Used for |
| --- | --- |
| `.mf-race[id]`, `.racecard__runner` and its `data-*` (`runner-id`, `race-id`, `horse-name`, `course`, `race-time`, `odds-decimal`, `odds-fractional`, `number`, `stars`, `sr`, `nr`) | the filters, the marks, the numbers, the ticket, the limit |
| `.racecard__form .rcf`, `rcf--sep`, `rcf--dnf` | the form's colours |
| `.mf-race__meta > span` (the trip), `.mf-race__tag`, `.mf-race__cta`, `.mf-switcher__count` | the labels |
| `.pick6__num`, `.pick6__lbl`, `.pick6__stamp` | the stamp's lettering |
| `[data-mf-jump]`, `.mf-jump__chip[data-jump-target]` | the strip |
| `#betSlip`, `#slipHandle`, `#slipHandleCount`, `#slipLegs`, `.mf-slip__head`, `.mf-slip__leg` and its `-where`, `-time`, `-horse`, `-info` | the ticket and the places. A ticket is matched to its runner on the course `bet_slip.js` writes as the first text of `-where`, the time and the horse; `data-course`, `data-race-time` and `data-horse-name` on the `<li>`, one line in `render()`, would make that explicit, and the script prefers them when present |
| `img.racecard__silk`, `.racecard__jockey-name` | what a ticket copies |
| `[data-action="add-to-slip"]`, `.mf-race--has-selection`, `.mf-toast` | the limit |
| `a.mf-switcher__chip[href]`, `.mf-switcher__course` | where a place goes for a pick made at another meeting |

They set, and only the stylesheet reads: `mfr-` classes on what they add;
`data-mfr-run`, `data-mfr-latest`, `data-mfr-once`, `data-mfr-numbers`,
`data-mfr-open`, `data-mfr-hidden`, `data-mfr-fav`, `data-mfr-top`,
`data-mfr-compact` (on `<html>`), `data-mfr-taken`, `data-mfr-state`,
`data-mfr-shut`, `data-mfr-six`, `data-mfr-of`, `data-mfr-nudge` on the
page's own elements; `--mfr-f` on a ruler; `--mfr-strip` on `body`.

**Hidden, not removed.** Still in the markup, and `racecard_collapse.js`
still writes some of them; the stylesheet hides them because the page
says the same thing at every width now: `.rc-mob-filterbar`,
`.rc-mob-compact`, `.rc-ribbon`, `.rc-mob-snackbar`,
`.rc-mob-picks-counter`, and the "?" the template prints for a runner
with no number yet. Taking them out of the template is optional.

**One thing in `site.js`, again.** It scrolls every in-page `#` link to
76px from the top of the window, which here is under the tour strip and
the race strip. `meeting_masthead.js` steps round it for the race
links; the lasting fix is the one the trail asked for, `site.js`
honouring the target's `scroll-margin-top`.
