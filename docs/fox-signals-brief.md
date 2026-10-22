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
Django site answers (`?meeting=Hereford`, `?conviction=notlow`,
`?sort=price`); since 19 October `board_filters.js` answers them in the
page as well, so they work here, and on the Django site a press no
longer needs the round trip (see "The Board's filters" below). Every
race on the Board opens `fox-race.html`, whichever race it is: only two
races have a copy.

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
  `.fx-tchart__readout-time`, `.fx-tchart__readout-list`. The script
  also makes, beside the chart, `.fx-tchart__axis` (the prices, each a
  `.fx-tchart__gridlabel`), `.fx-tchart__aiaxis`, `.fx-tchart__times`
  (the hours, `.fx-tchart__time`) and `.fx-tchart__ends` (a
  `.fx-tchart__end[data-runner-id]` button at each line's end), and a
  `.fx-tchart__ends-lines` group in the chart; a marker is
  `.fx-tchart__marker[data-minute]`, with `data-runner-id` when it is
  a runner's.
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
- **Alerts** lists every signal of the day: 225 on this one.

Known debt the checks already list for these files (`npm run check`), so
they can only shrink, all of it in `fox_signals_shell.css`: two
`!important`, the gold typed as `#d4af37` in fourteen places where
`--c-gold` holds it, and media queries at 720px, which is off the
site's scale (767/768, 1023/1024, 1279/1280).

## The Board's design (17 October)

A restyle in `fox_signals_v2.css` alone (sections 1, 4 and 5): no
markup, no script, so it goes back by copying the file.

- **The masthead is an evening at the races, drawn**, on all ten pages.
  meeting.css's photograph (a square, made for its 300 to 500px
  masthead) showed only the rider's face in these shorter ones, and
  drawn whole it sat to one side. In its place, across the window's
  width: the night sky with the Fox's signals traced in gold (price
  lines with a glowing node where a signal fired, faded behind the
  words), the sun gone down behind the words, floodlights at each side,
  and along the foot, below the figures, the field in running past the
  rail on the turf, the site's own horse, backlit. The field is a group
  of three repeated only as often as it fits whole, so no horse is cut
  at the window's edge. On a phone the words keep to the left and the
  evening is to their right: one floodlight at the edge, the signals in
  the top corner, three runners. The race pages' band has the same
  evening, lower, with two runners to a stretch of rail. The drawings
  are data in the stylesheet (no image file); the masthead grew by
  about 25px for the course. Checked: no word on a horse or a
  floodlight on the ten pages at 14 widths, and every word at least
  4.5:1 against the lightest pixel behind it.
- **The Fox's pick is his note.** Each pick is a card on the gold wash,
  stamped at its left edge with the Fox's mark (the footer's own) in
  gold on the ink. The ring round the mark is the race's level of
  conviction, green, gold or silver, as the row's edge is; a visitor is
  shown the level, so nothing is given away. The horse and its rating
  share the first line, the signals the second.
- **Each signal has a mark** by its `data-kind` (price cut, drifting,
  coordinated move, going suits, class drop, jockey upgrade, market
  leader; a dot for any other), the strongest on gold, then the count
  of the rest. A row with three long signals takes a third line rather
  than cut a word.
- **The price is on a bookmaker's board:** gold figures on the ink, the
  same width in every row. A finished race's result hangs under it:
  green for a win, silver for a place. A race the Fox won keeps a green
  edge on its note and a green ring on the seal.
- **Conviction is a race on a short course.** The figure is on a saddle
  cloth in the level's colours (green with white figures, gold or
  silver with ink ones), stitched inside its edge. Beside it, the site's
  horse (the homepage's) stands as far along the course as the figure
  takes him, the run behind him in the level's colour, past a pole at
  each quarter to the winning post, a gold disc, at a hundred. The
  course is the same length in every row at each width, so the column
  reads down like a field in running; the track record is the line
  under it. A visitor's cloth is padlocked but keeps the level's
  colours (the level is shown, the figure is not), and the horse waits
  at the start of a dashed course, the prompt under it; on a card, the
  padlocked cloth and the prompt share one line. A finished race's
  cloth is faded and its horse grey. All of it is background and masks
  on the existing spans, nothing positioned, so a press on the course is
  a press on the race; the prompt keeps a 44px press under a finger.
- **Widths:** the columns from 1280px; two lines a race from 1024px
  (the race beside its conviction, the note and its board under it); a
  card a race below that, the note the card's width with its board in
  the corner. Breakpoints only at 767/768, 1023/1024 and 1279/1280.
- The drawings (the seal, the signal marks, the horse, the padlock and
  the masthead's evening) are data in the stylesheet, so it needs no
  image files beside it. The rooms that do not fit the phone's pill row
  fade at its edge.

## Race Trace's chart (18 October)

The chart a race opens to, drawn as the field at the post, the picture
the Board's conviction course and the masthead's rail already use: ink
on white, hairlines, gold for what matters, and the site's own horse.
Its title says what it shows ("How the market ran").
`race_trace_chart.js` draws what it needs and `fox_signals_v2.css`
(section 3) styles it; no markup changed, so both go back by copying
the files.

- **The market in three facts, before the chart:** the favourite (the
  winner, on a replay) with its price and where it opened; the most
  backed; the biggest drifter (the favourite's own drift is on its
  fact, so the next drifter is "also drifting"). The facts are ruled
  apart, not boxed, a row each on a phone. A move is measured as the change in the
  price's share of the market, so 5/6 to evens outranks 250/1 to
  300/1. A press on a runner's fact follows that runner; on the
  signal's, replays its moment. The caption's facts are in words
  ("Prices from 09:00 to 17:05 · 9 runners · 12 signals") and its
  switches are plain words, underlined in gold when on.
- **The chart shows the front of the market:** the four shortest at
  the latest price (every runner, in a field of six or fewer), their
  lines ink and stepping (a price holds until the next is set, so a
  line runs level and then up or down). The favourite's line is gold
  (the market leader); on a replay the winner's is gold instead, and
  the shell's glow on it is turned off. "Whole field · 9" in the
  caption draws the outsiders, lighter, with their horses; a followed
  outsider is drawn whether or not the field is shown. The price scale
  fits the runners on the chart, so the front of the market has the
  height until the field is asked for.
- **Each line ends in its horse at the post:** the site's horse (the
  homepage's, as on the Board) standing at the winning post at its
  market height, its saddle cloth, name and price beside it; the
  favourite's horse is gold. Where lines end together the horses are
  pushed apart and a hairline joins each to its line. A press on one
  follows that runner: the others fade, its row in the table lights.
  On a replay the end carries where the horse finished. A tablet shows
  the horse, the cloth and the price; a phone the horse and the cloth.
- **The winning post is the replay's cursor**, an ink post with a gold
  disc at the latest price; drag the replay and the post goes back
  along the course, the field with it. The prices down the side are
  on the Board's price tags, gold figures on the ink. A phone keeps
  them in a 40px column of their own at the left (until 19 October it
  wrote them inside the chart, where a line at a nearby price ran
  through them), and its replay slider spans the plot alone.
- **The saddle cloth** is the runner's number, white on the ink, on a
  small cloth, not a coloured disc: the same in the facts, at the
  lines' ends, in the ring, in the runners table and the value edge.
  The favourite's (the winner's, on a replay) is gold, as is the
  runner followed. The terminal's hue per runner is no longer drawn on
  the paper.
- **Time along the foot:** the hours, each with a tick on the
  baseline, named every hour where there is room, else every second.
  The times are the course's (Europe/London), as the page's times are,
  whatever the reader's clock: the scrubbed time, the hours and the
  `?at=` link all say British time (they said the reader's).
- **A signal is a course flag on its runner's line** where it fired, a
  pole and a pennant, green where a price came in, red where one went
  out, grey for a market leader (on the time axis when it is about
  the whole race). Only the favourite's flags fly by default; follow a
  runner and its flags fly instead; show the whole field and they all
  do. A press on a flag takes the replay to that moment, the flag's
  foot turns gold, and the ring says what fired there. Signals that
  fired within a few pixels of each other on one line are one pole
  with two pennants, standing for all of them.
- **The ring at the scrubbed time**, shown only while the replay is
  away from the latest price or a runner is followed (at the latest
  price it would say what the lines' ends say): the time in the
  display face, then every runner with a price, shortest first, as a
  ruled list in columns, the favourite tagged, each price green with an arrow where
  it has shortened since it opened and red where it has drifted. A
  followed runner's card adds where it opened, its AI figure, how many
  of its signals had fired and how long before the latest price the
  moment is. A phone shows the list in one column, the front four and
  a button for the rest.
- **The replay slider runs under the plot**, its thumb under the post,
  "Replay" in the price gutter. The legend of runners is hidden on
  every screen: the horses at the post are pressed instead (the
  caption says so), and its markup and script stay for the terminal.
- **The words beside the chart are HTML**, placed by measuring the
  chart's box (the chart is stretched to its box, which would size
  text drawn inside it by the window): the prices, the hours, the
  ends, the AI axis, the tip. The chart's grid is taller under 1280px
  (1000×340), under 1024px (1000×400) and under 768px (500×440), and
  the stylesheet gives the box the same shape at each width.
- **Under the chart:** each price in the runners table is green or
  red by the way it has gone; a signal's edge is green, red or a
  hairline by its tone. Section titles, the table's head and the
  signal chips ("Coordinated", not "COORDINATED") are written as the
  Board writes them.
- Fixed in passing: the AI overlay button showed on a race with no AI
  data (the shell's `display` rule beat the `hidden` attribute).
  The runners table's finish pills ("1st", "2nd", "3rd") were the
  terminal's gold, silver and bronze as text, under 2:1 on the paper;
  the gradient on the winner's row had hidden that from the checks.
  They take the podium's readable colours.

## The rest of the race page (18 October)

The head, the value edge, the runners table and the signals, in the
Board's language, all under `.fx-shell--v2` in `fox_signals_v2.css`
over the terminal's stylesheet; no markup changed.

- **The head is a racecard's:** the site's horse in gold before the
  time and the course, the race's name under them, the facts as words
  with a dot between ("Class 4 · Good · 9 runners · 882 price checks"),
  the star as the Board's; the races either side as a matched pair of
  cards under the head on every page (a finished race's result and
  verdict come after them): "Previous race" or "Next race" over the
  time and the course, the arrow at the outer edge.
- **The value edge in words:** each runner a row, its saddle cloth, the
  AI's chance and the market's as two bars (gold and ink) with their
  figures, the price, and the gap as "Market keener by 6.4 pts" rather
  than "-6.4pp" (the script reads the figures and hands them to the
  stylesheet; "Mkt" is written out). The two groups are headed in
  words with a green or red dot. A visitor's rows keep the cloth, the
  name and the price, and the sign-up line is the Board's.
- **The signals are one ruled list**, each led by the Board's own mark
  for its kind (the script reads the chip's word into `data-kind`):
  a price cut green, a drift red, a market leader gold, the rest ink.
  The chip's word stays in the page for a screen reader. The evidence
  under a signal and a visitor's sign-up line are set in the same
  language.
- **The runners table:** the favourite's cloth is gold, as on the
  chart; the chart's caption is one sentence on how to read it ("Each
  line is a runner's price from 09:00 to 17:05: the lower the line,
  the shorter the price. Flags are the Fox's signals. Press a horse to
  follow it.").
- **Under a finger**, everything pressable is 44px: the back link, the
  star, the chart's switches (pills on a touch screen, plain words with
  a pointer), the pause, the horses at the post, the flags, the replay's
  thumb, the names in the table. A phone's runners table keeps the
  jockey on the line under the horse (the terminal dropped it); the
  facts in the head take two tidy lines; a finished race's scorecard
  ("3 of 6 signals cashed") and each signal's outcome ("Fired",
  "Missed") are words, and the winner's line reads as a sentence.
- A finished race's result above the chart sits flat on the gold wash;
  its verdict (who the AI and the market went for, and how each fared)
  is a card in the same words, and the "replay" word in the eyebrow a
  quiet gold pill.

## The site's type (19 October)

The site pairs Playfair Display, for headlines, card titles and odds
(the homepage's headline and race cards, its odds chips, the footer's
line), with DM Sans for everything else. The Fox pages are now set the
same way (`fox_signals_v2.css`, section 6): Playfair at 700 with
lining figures for the masthead's title, the race's title, the section
headings, the Fox's horse and every price, on the Board and the race
page; DM Sans for the labels, the facts and the body; nothing heavier
than 700. The Board's tools are a strip of tabs on a hairline (the
chosen meeting in ink with a gold rule under it) and words for the
level switch, "More filters" and the sort, in place of two rows of
pills; the choices inside the sheet stay pills.

## The other rooms (19 October)

Race Trace's list, Alerts, a runner's page and Settings keep the
terminal's markup; `fox_signals_v2.css` section 7 sets them in the
Board's language over the shell's rules, and lays them out for a phone,
where the shell had squeezed a six-column table into the screen (the
Signals and Events columns off its right edge) and let the alerts'
chips run into their titles.

- **Race Trace's list:** a table from 768px, headed as the Board's,
  the count of signals a gold pill; a card a race on a phone (the time
  at the left; the course and its class; the race's name in full with
  the going; "10 runners"; the signals' count at the right).
- **Alerts:** the figures and legends in words; each signal led by the
  Board's mark for its kind (from the `data-kind` the page already
  carries; the chip's word is kept for a screen reader), its strength
  as a word, the time at the right; on a phone the mark, the strength
  and the time share the first line and the words take the width. A
  race's line wraps instead of running into its field.
- **A runner:** the saddle cloth, the name in the serif, the figures in
  words; the chart on the paper in the site's gold and ink, with
  non-scaling lines and a line under it saying which line is which.
  Its axis labels are drawn in the chart's own units, so their size
  is set per width (13 units across a desktop, 16 on a tablet, 32 on
  a phone, where the chart is also drawn to its own proportions, the
  prices lifted just above their lines and three of the six hours
  kept). On a phone a signal's kind sits above its words.
- **The room pills:** `fox_v2_turn.js` scrolls the strip so the
  current room's pill is in view, on load and after a turn (on a phone
  it could start under the strip's fade).
- **Settings:** legends and the button in the Board's words.
- **A signal's mark:** at the top of its card, beside the title, and
  its symbol in the middle of the circle. The circle keeps the kind's
  word for a screen reader at size 0; the shell's grid gave that word
  a row of its own and pushed the symbol 5px up, so the symbol is laid
  over it (race pages and Alerts).
- **The race page's table on a phone:** the cloth has a 32px column
  (the shell's 24px held the 26px cloth 4px from the name), so each
  name stands 12px clear of its number; the head shares the columns.

## The Board's filters (19 October)

`static/fox_signals/js/board_filters.js`, new, on the two Board pages.
A press on a meeting chip, a filter or the sort menu keeps the rows
that match and puts them in order at once, writes the choice into the
address (`?meeting=Leicester&conviction=notlow`), and Back undoes it; a
page opened at such an address starts narrowed. Choices add up: a
meeting and a level together keep the rows that are both; "All
meetings" clears the meeting alone, and a press on a chip already
chosen clears it. The "More filters" sheet closes on a press anywhere
else or on Escape, and its word carries the count of its filters that
are on. The finished races' fold says "2 of
28 finished races" and folds away when none match; when no race to come
matches, a note says so with the way back. Rows are read as they are
(the course, the level, the facts line, the price, a member's
conviction figure); nothing is fetched. Without the script the links
work as before, and on the Django site the server still answers the
address on a full load.

**STRUCTURAL:** `fox-board.html` and `fox-board-member.html` load the
script after `board_star.js` (the template is `board_v2.html`, or the
shell). `fox_v2_turn.js` lets it arrive late (`LATE_OK`), so a turn to
the Board from another room stays in place; that is the only change to
that file.

## The Board, the same day

A quieter pass on the Board's own pieces: the price boards and the
Fox's seal are flat ink (no gradients, no drop shadows), the saddle
cloth of the conviction figure has no stitched outline, and the
names, times, prices and results are set at 700, not 800.

## Before the merge (22 October)

A review of the branch before it went to `main` changed these:

- **The Board's filters on the server.** Django answers the filters'
  addresses by sending only the matching rows, so a Board it narrowed
  (a reload, a shared link, Back) can be narrowed further in place, but
  a wider choice (another meeting, "All meetings") is fetched from the
  server, through the page-turn script (`window.fxvTurn` is now a
  function as well as the flag the sort menu's `onchange` reads).
  `board_filters.js` tells the two apart by the rows: a page with rows
  its address leaves out holds the whole day (the sandbox, a static
  host). The time order is read from each row's `<time>`; only the
  control's own dimension is read from its link; the empty note comes
  only with a filter set, never over the server's own; the fold's count
  of Fox winners follows the filter; the chosen chip carries
  `aria-current`, and a status line says what a press left.
- **The race page and page turns.** `fox_v2_turn.js` swaps rooms only
  when neither page runs a script that cannot start late. The race
  page's chart cannot (it draws on its own page and keeps a clock and a
  poll), so a race page is reached and left by an ordinary page load.
  Before, the Board's pill and then Back swapped a race page in with an
  empty chart, and a race page left by a swap kept polling.
- **The chart.** On a replay the winner is always drawn, wherever it
  stood in the market; a redraw hands the keyboard's focus to the end,
  fact or flag that replaces the one it was on; the ends keep the
  followed runner's highlight through a resize or a change of odds;
  each end is named for a screen reader ("Follow …, number …, 8/11");
  the chart and its facts are named groups (the chart was an image,
  which may not hold its flags' buttons); the facts beside the
  favourite are the next runner backed or drifting when the favourite
  is the one that moved most.
- **Layout.** Below 1024px the race page is one column, as on a phone
  (beside the rail a tablet left the runners table 420px: on a replay
  the names went to nothing and ran over the figures), and the value
  edge's two lists are one. The race's head keeps the shell's
  alignment on a phone (it sat at the right, and past the left edge at
  320px). On a phone a horse's name wraps instead of being cut.
- **Touch.** 44px to press for the Board's tabs, switches, sheet and
  sort menu, and for the race page's back link, chart switches, pause,
  replay slider and flags (the chart script's hit width follows: 44).
- **Clean-up.** The non-runner reshuffle mark sits with the other signal
  marks on `.fxv-wrap` (the Board's chips could not reach it), the
  flags' keyboard ring is the darker gold, and rules and code that
  nothing used are gone (the legend's styles, the signal tile, the hour
  line). The tests that could not fail now can: the level filter's,
  the price order's, the table's colours, the British hours (read from
  New York), and "does not scroll sideways", which measured a page that
  clips its own overflow and now measures every element.
- **Accessibility.** A missed signal on a replay keeps its ink, and a
  weak chip's grey is the site's ink-3; links inside the Alerts'
  sentences are underlined. `docs/accessibility-notes.md` has a Fox
  Signals section.

## Rebuilding (Vas)

The pages are rebuilt from the Django site, which also copies the seven
assets across (`board_filters.js` joined them on 22 October, so it has
to be in the Django site before the next rebuild):

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
