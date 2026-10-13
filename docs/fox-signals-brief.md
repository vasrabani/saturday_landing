# Fox Signals: the pages, what you may change, and how it goes back

Fox Signals is the site's market-intelligence section: the Fox's pick in
every race of the day, how sure he is, and the betting market behind each
race through the day. It is live at
<https://www.saturday-racing.com/fox-signals/board/>.

Unlike the landing page, the trail and the meeting page, Fox Signals was
built in the Django site and copied here, not the other way round. The
ten `fox-*.html` pages in this repo are the markup the Django templates
produce, under the same stylesheets and scripts, byte for byte. Your work
here is copied back into the Django site when it is done.

Run the sandbox (`npm install`, `npm run serve`) and open
<http://localhost:8080/fox-board.html>.

## The pages

Every page is one recorded day: Tuesday 13 October 2026, with the clock
stopped at 17:10. Thirty-eight races at five meetings; 28 have finished,
the 17:17 is next off, and the 18:00 at Wolverhampton is the race that is
"live".

| Page | What it is | Seen as |
| --- | --- | --- |
| `fox-board.html` | The Board: every race of the day and the Fox's pick in each | a visitor |
| `fox-board-member.html` | The same, with what members are shown | a member |
| `fox-race-trace.html` | Race Trace: the day's races, to open one | a visitor |
| `fox-race.html` | One race, before the off: the market chart, runners, signals | a member |
| `fox-race-visitor.html` | The same race | a visitor |
| `fox-race-replay.html` | A finished race: the result, the verdict, the chart as a replay | a member |
| `fox-runner.html` | One runner of the live race | a member |
| `fox-alerts.html` | Alerts: every signal of the day, by race | a member |
| `fox-stable.html` | The Stable: the races the member has starred | a member |
| `fox-settings.html` | Settings: the member's preferences | a member |

The difference between the two readers matters. A **visitor** (not signed
in) is shown the level of conviction but not the figure, no value edge
and no evidence behind a signal; in their place is a prompt to sign up.
Stable and Settings are members' rooms: a visitor who presses them gets
the sign-up prompt. A **member** is shown everything.

The room pills change the page without loading it (`fox_v2_turn.js`
fetches the next page and swaps it in). Here that works between these
files. The Board's meeting chips, filters and sort menu are links the
Django site answers; here they reload the same page and nothing narrows,
because there is no server to do the narrowing. Every race on the Board
opens `fox-race.html`, whichever race it is: only two races have a copy.

## What is real and what is a stand-in

Real, as recorded from the live site that day: the races, the picks,
their prices, the level of conviction, the results, the signals on each
race, and for the two races with a page, every runner and every price
move of the day.

Stand-ins, made up by the build tool the same way every time, because a
visitor is not shown them and so they could not be recorded:

- the conviction **figures** (kept inside the recorded level; two races
  are raised to "high" so that level is on the page);
- the track record under each figure ("wins 24% of 515");
- the evidence that opens under a signal;
- the member's three starred races;
- on races without their own page, the signals' wording and the runners
  other than the pick.

Do not read meaning into those numbers, and do not design around a
particular one.

## The files

```
fox-*.html                              the ten pages (built; see "Rebuilding")
static/fox_signals/css/fox_signals_v2.css     the design: masthead, pills, the Board, the rooms' palette
static/fox_signals/css/fox_signals_shell.css  the rooms' own layout, and the old dark design
static/fox_signals/js/fox_v2_turn.js          the pills change the page in place
static/fox_signals/js/race_trace_chart.js     the market chart, the runners table's prices, the signals rail
static/fox_signals/js/board_star.js           starring a race
static/fox_signals/js/signup_nudge.js         the sign-up prompt
static/meeting/css/meeting.css                the masthead, the tokens and the chips (the meeting page's)
fixtures/fox-signals-day.json           the recorded day
fixtures/fox-race-live.json             what each race page's once-a-minute refresh returns
tools/build-fox-signals.py              builds the pages (Vas runs it)
tools/harvest-fox-signals.py            records a day from the live site (Vas runs it)
tests/fox.spec.js                       what the pages must keep doing
```

How the design is put together, which decides where a change belongs:

- **The Board** has its own markup (`.fxv-*`) and is styled only by
  `fox_signals_v2.css`, section 4.
- **The other rooms** (Race Trace, Alerts, Stable, Settings) keep the
  markup of the old dark "terminal" design (`.fx-*`) and its stylesheet,
  `fox_signals_shell.css`. That stylesheet draws everything from a
  palette of custom properties on `.fx-shell`, and `fox_signals_v2.css`
  section 3 hands it the site's paper palette. So those rooms are the old
  layout in the new colours and typeface. This is the part with the most
  room for design work.
- **The masthead, the paper, the gold and the chips** are the meeting
  page's (`meeting.css`, the `--mfr-*` tokens and `.mf-hero`,
  `.mfr-filter`). Use the tokens; do not edit `meeting.css` for Fox
  Signals, because the meeting page and the LLaMa Index wear it too.

## What you may change

| What | Where |
| --- | --- |
| The look of the Board | `static/fox_signals/css/fox_signals_v2.css` |
| The look of the other rooms | `static/fox_signals/css/fox_signals_v2.css`, section 3 (preferred), or `fox_signals_shell.css` |
| Chart, table and rail behaviour | `static/fox_signals/js/race_trace_chart.js` |
| Markup | the `fox-*.html` pages, **with a note in the PR** (see "How it goes back") |

Two things to keep in mind:

- **`fox_signals_shell.css` also styles the old dark design**, which is
  still in the Django site as the rollback. A rule changed there changes
  both. Where you can, put the v2 rule in `fox_signals_v2.css` under
  `.fx-shell--v2`, which only the new design carries. If a rule in
  `fox_signals_shell.css` has to change, say so in the PR.
- **Do not edit** `meeting.css`, `static/css/*`, `static/js/site.js` or
  the shell of the pages (navigation, footer) for this work.

## The hooks the scripts need

The scripts find the page by these. Restyle anything; keep the hooks.

**Every page** (`fox_v2_turn.js`, `signup_nudge.js`)

- `.fxv-wrap` wraps the whole of a Fox Signals page: it is what is
  swapped when a pill is pressed. It carries `data-active-tab`, and
  `data-fx-anon-preview="1"` for a visitor.
- `.fxv-hero` and `.fxv-nav`; the room pills are `.fxv-nav__rooms a`,
  the chosen one `.fxv-on`.
- A members' room, to a visitor: `data-fx-locked-tab="stable|settings"`.
- The sign-up prompt: `#fx-nudge`, `[data-fx-nudge-cta]`,
  `[data-fx-nudge-dismiss]`; anything masked for a visitor carries
  `data-fx-mask`.

**The Board** (`board_star.js`, `fox_v2_turn.js`)

- A race is `.fxv-row` with `data-race-id`; `.fxv-row__link` is its way
  into the race and its box is the whole row (`::after`). A row must not
  be a link itself, nor hold a link inside a link.
- The star: `[data-fx-star]` with `aria-pressed`; `.fx-board__star--on`
  when starred; its icon `.fx-board__star-glyph` switches between
  `.mfr-i--star` and `.mfr-i--star-fill`.
- Controls taken over by the in-place change: `.fxv-tools a`,
  `.fxv-empty a`, and the sort menu `.fxv-select`.
- The finished races: `details.fxv-done`.

**Race Trace** (`race_trace_chart.js`)

- `.fx-trace` with `data-race-id` and `data-live-url`; the chart's data
  is the JSON in `#fx-trace-data`.
- The chart: `.fx-tchart__svg` and its groups `.fx-tchart__grid`,
  `__ai-axis`, `__lines`, `__ai-lines`, `__markers`, and
  `.fx-tchart__cursor`; the script draws inside them. The price strip:
  `.fx-tchart__readout-time`, `.fx-tchart__readout-list`.
- Controls, by id: `fx-tchart-scrub`, `fx-tchart-ai-toggle`,
  `fx-tchart-odds-toggle`, `fx-tchart-live`, `fx-tchart-live-age`,
  `fx-tchart-live-pause`, `fx-tchart-copy`, `fx-tchart-focus-hint`.
- The legend: `.fx-tchart__legend-item[data-runner-id]`,
  `.fx-tchart__legend-btn`; on a replay, `.fx-tchart__podium-chip`.
- The runners table: `.fx-trace__runner[data-runner-id]`, with cells
  `data-cell="opened"`, `"odds"` and `"spark"`. A price cell carries its
  fractional price in `data-frac` and prints it in `[data-price]`;
  `.fx-trace__from [data-from]` is the phone's "from 5/1".
- What the once-a-minute refresh replaces, by id: `fx-signal-rail`,
  `fx-event-rail`, `fx-vedge-container`. `[data-signals-more]` and
  `[data-readout-more]` are the phone's "show all" buttons.

`tests/fox.spec.js` checks the behaviour these carry. If a test fails
after a restyle, a hook has moved.

## How it goes back

The four scripts and two stylesheets are kept **byte for byte** the same
as the Django site's (`fox_signals/static/fox_signals/…` there,
`static/fox_signals/…` here, same file names). A change to them goes
back by copying the file.

The pages do not go back: they are output. Their markup is written by
Django templates, so a change to a page's **structure** has to be made
again in the template. If your work changes markup, edit the `fox-*.html`
page so it can be seen and tested here, and list each change in the PR
under "STRUCTURAL", saying which page and what moved. These are the
templates behind the pages:

| Page | Django template (`fox_signals/templates/fox_signals/`) |
| --- | --- |
| masthead, pills, wrapper | `_shell_v2.html`, `_shell_pill.html` |
| `fox-board*.html` | `board_v2.html`, `_board_row_v2.html`, `_board_filter_row_v2.html` |
| `fox-race-trace.html` | `race_trace_hub.html` |
| `fox-race*.html` | `race_trace_detail.html`, `_signal_rail.html`, `_event_rail.html`, `_value_edge_panel.html`, `_runner_sparkline.html` |
| `fox-runner.html` | `runner_trace_detail.html` |
| `fox-alerts.html` | `alerts.html` |
| `fox-stable.html` | `stable.html` (its rows are `_board_row_v2.html`) |
| `fox-settings.html` | `settings.html` |
| the sign-up prompt | `_signup_nudge.html` |

The same markup appears on more than one page (a Board row on the Board
and in the Stable; the masthead and pills on all ten). Change it the same
way everywhere it appears, or say in the PR which copy is the one to
follow.

## Where it stands, and what is worth looking at

The Board and Race Trace were each reviewed on the live site on 13
October and fixed up; the Board was graded 7/10 and Race Trace 8/10 as a
visitor sees them. What those reviews left open:

- **The other rooms are a recolour, not a redesign.** Race Trace, Alerts,
  Stable and Settings are the terminal's dense layout in the paper
  palette. Short labels are still written in capitals ("DRIFT", "GOOD TO
  SOFT"), where the Board says signals in words.
- **Race Trace on a phone** is long (about 5,000px), and six chart
  controls stack above the chart.
- **The signals rail** is one line per runner per kind of signal, in
  order of the runners' prices. It is still a long list on a busy race.
- **The Board between about 720px and 1080px** is the two-line layout;
  it has had less attention than the phone and desktop ones.
- **Alerts** lists every signal of the day: 225 on this one.

Known debt the checks already list for these files (`npm run check`), so
they can only shrink: two `!important`, the gold typed as `#d4af37` in
fourteen places where `--c-gold` holds it, and media queries at 719, 720
and 1079px, which are off the site's scale (767/768, 1023/1024,
1279/1280).

## Rebuilding (Vas)

The pages are rebuilt from the Django site, which also copies the six
assets across:

```bash
<django-venv>/python tools/build-fox-signals.py \
    --django C:/path/to/saturday --settings saturday.settings_dev
```

Any database with its migrations run will do: the recorded day is loaded
inside a transaction that is rolled back, and nothing is written. Run it
after the templates or assets change in the Django site. It overwrites
the ten pages, so merge the developer's markup changes into the templates
first.

To record a different day (rarely):
`python tools/harvest-fox-signals.py --races <id>,<id> --clock HH:MM`,
with one race that will still be to run at the clock time and one that
will have finished.
