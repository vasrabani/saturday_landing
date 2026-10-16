# The day's races: the revamp, and the contract it keeps

The pages: `races.html`, `races-tomorrow.html` and `races-yesterday.html`
in this repo, live at <https://www.saturday-racing.com/races/>,
`/races/tomorrow/` and `/races/yesterday/`. Run the sandbox and open
<http://localhost:8080/races.html> (Friday 16 October 2026 at 15:43, racing
on: three meetings live, two to come, eight results in),
<http://localhost:8080/races-tomorrow.html> (Saturday 17 October, Champions
Day: 60 races at eight meetings, the evening before) and
<http://localhost:8080/races-yesterday.html> (Thursday 15 October, every
result in). Every state is on <http://localhost:8080/races-states.html>.

The design is the prototype at <https://saturday-races-prototype.vercel.app/>,
which was drawn on 13 October's page with every result in; this is that
design on the live template's own markup, carried to every state the
template has.

## What the page is for

The day's racing at a glance: every meeting, every race with its time,
class, trip, going, prize and field, and where the day stands (who is
racing now, the next off, how many results are in). From it a reader
goes to a racecard, or to a meeting's full card to make their Pick Six.
The results are hidden until the reader asks, so the page can be read
while catching up on replays.

The page is the Django template `races/templates/races/racecard/meetings_browse.html`,
its own `<style>` block, the stylesheets `races/css/main.css`,
`pick6_emblem.css` and `ai_pick_chip.css`, and one script of its own,
inline at the foot of the template: the spoiler controls (Reveal winner,
Reveal all, remembered in `localStorage` under `sr_revealed_races`). That
script is unchanged.

**What each control is for**, since that decides how it behaves:

| Control | For | So |
| --- | --- | --- |
| Yesterday · Today · Tomorrow | moving between the three days the site has | plain links; nothing to keep, as the reveals are remembered per race |
| The meeting tabs | finding a meeting on a long page, and seeing how the day stands | they never leave the page; they stay pinned while the meetings go by, and mark the one in view |
| Reveal winner, Reveal all | seeing a result when the reader chooses | remembered on the device, as before |
| Pick Six (the stickers) | starting the day's Pick Six | it goes to the full card of the meeting that runs next, and stands down on a day with nothing left to run |
| The reveal track | how much of a meeting's card the reader has caught up with | it follows the reveals; it is not a control |

## What the revamp did

**The look.** One stylesheet, `static/browse/css/browse.css`, takes the
place of the three page-level stylesheets and the template's `<style>`
block. A night masthead with the homepage's Steam of the Day picture
across the band under the meeting page's gradients, ending on a double
gold rule; the meetings as white sheets on the site's paper, each with a
night head; the races as the lines of a timetable. The palette is the
site's own (paper.css, base.css), with the meeting page's values where
the site has no token, so the two pages agree. Playfair Display for the
date and the courses, DM Sans for everything else, nothing italic.

**The masthead.** "Today's races" over the date; the figures with the
first off and the results in added; Yesterday · Today · Tomorrow as a
pill with the day on show in gold; the next race off as a pill with a
beat on its dot, its time and countdown; the big race, when there is
one, as a gold-edged pill; and Pick Six as the meeting page's three
stickers (the stamp lettered "Pick Six" and "Challenge", the green badge,
the gold line).

**The meeting tabs** are a white bar pinned under the site's navigation
the whole way down the meetings. Each tab is the course and the
template's line on how it stands (red while live, green when every
result is in, struck through if abandoned) with the meeting's progress
along its foot. The meeting in view is the ink tab. More tabs than fit
scroll sideways inside the bar; the marked one is kept in sight. A tab
lands its meeting just below the bar and takes the keyboard to its name.
(`browse_nav.js`.)

**Each meeting** is a sheet with a night head: the course, its races and
first off, how it stands as one chip, and Pick Six and Reveal all as
pills. Once a meeting has a result, a course runs along the foot of the
head: a tick a race, lit as far as the card has been run, and a gold
horse that goes a race up the course for each winner revealed and stands
at the post when the card is run and every winner shown. (`browse_track.js`.)

**Each race** is a line: the time and class, the name (never cut: it
wraps), the trip, going, prize and field, and on the right what there is
to read or press — the winner's button, the AI's pick, a member's pick,
the cubs — above the Racecard link. The whole line is still the link to
the racecard. A revealed winner shows its silks, name and price with the
jockey and trainer under them. The big race's line is on the gold wash
with its tag; an abandoned race is struck through and quiet.

**Three notes** after the meetings say what the page does: results your
call, Pick Six against the Fox, free to play. **The footer** opens with
the horse between two hairlines, on this page only.

**A fix.** On the live page, Reveal winner on a single race does nothing:
the button's inline `onclick` stops the press before the spoiler script,
which listens on the meetings, can hear it (Reveal all, which has no
`onclick`, works). Checked on 16 October on `/races/yesterday/`: the
button's `aria-pressed` stayed `false`. The `onclick` comes out of the
template; the script already stops the press from following the race's
link. `tests/races.spec.js` presses it.

## Real days

Designed against the busiest day captured and checked against the
emptiest, not one fixture:

- **The busiest:** Champions Day, 60 races at eight meetings
  (`races-tomorrow.html`). The eight tabs fit one row from 1280px and
  scroll inside the bar below that. At 1440px the page's main content is
  6,631px tall against the live page's 8,678px (a race line 79px against
  102px); on a 375px phone 13,101px against 13,830px.
- **The emptiest:** a day with no racing, which the template renders as
  its own message in the masthead and nothing under it (a stand-in, below).
- **A day running** (`races.html`: live meetings, meetings to come, a
  next off, results in some meetings and not others) and **a day done**
  (`races-yesterday.html`).

The masthead is taller than the live page's (the first meeting starts
686px down at 1440px, against 423px): the picture, the day tabs and Pick
Six are the design, and the tabs pinned under the navigation give the
reader the meetings from anywhere on the page.

## Every state is designed

The template's branches, read off its own `<style>` block (which says
what drives each) and the three captures. The ones no capture had are
stand-ins: the smallest change to a captured page that gives the
template's class names (`tests/support/races-branches.cjs`), so they can
be designed and tested now, and checked against the real template in the
port.

| State | What drives it | Where it is here |
| --- | --- | --- |
| The next race off | today, while a race is to come | `races.html` |
| A meeting live / to come / every result in | the view's meeting state | `races.html`, `races-yesterday.html` |
| A meeting the day before (no status line) | tomorrow | `races-tomorrow.html` |
| A race with its result: the winner hidden, and revealed | a result synced | `races.html`, `races-yesterday.html` |
| The AI's pick, with its price and without | the AI's verdict | `races.html` |
| The cubs' count | `crowd_counts` | `races.html` |
| The cubs' count in the Fox's colour | `fox_counts` | stand-in `foxCubs` |
| A member's pick (signed in) | the cub's vote | stand-in `yourPick` |
| The big race: banner, meeting, line | `Race.is_featured`, `m.is_featured` | stand-in `bigRace` |
| An abandoned meeting; an abandoned race | the meeting's / race's state | stand-ins `abandonedMeeting`, `abandonedRace` |
| No racing | no meetings | stand-in `noRacing` |
| Signed in (the navigation) | the site's chrome | `states.html` |

`races-states.html` shows each of them, and each running state (a winner
revealed, Reveal all pressed, the track part-way and at the post, the
marked tab), at a laptop's width, and the phone's and the tablet's in
windows of their own. Rebuild it with `node tools/build-races-states.mjs`.

## The contract: what the scripts need

**The spoiler script (the template's, unchanged)** listens for presses on
`.meetings-paper`. It needs `[data-meeting-block]` on each meeting,
`[data-action="reveal-result"][data-spoiler][data-race-id]` on each
winner's button, `[data-action="reveal-meeting"]` on Reveal all, and
`aria-pressed` on both; the faces `.race-row__spoiler-face--hidden` /
`--revealed` and `.meeting-block__reveal-all-face--hidden` / `--revealed`
are shown and hidden by the stylesheet from `aria-pressed`.

**`browse_nav.js`** needs `.meeting-nav`, its `a.meeting-tab[href="#meeting-n"]`,
the `.meeting-block` with that id and its `.meeting-block__name`. It
sets `aria-current="true"` on the tab of the meeting in view,
`tabindex="-1"` on a meeting's name when a tab takes the keyboard there,
and `--rbr-nav` (the bar's height) on `<body>`.

**`browse_track.js`** needs `.meetings-paper`, each `[data-meeting-block]`
with its `.meeting-block__header`, the `[data-spoiler]` buttons and their
`aria-pressed`, and the `.race-row` lines (an abandoned one,
`.race-row--abandoned`, is not counted). It adds `.rbr-track` to the head
of each meeting with a result, sets `--rbr-races`, `--rbr-run` and
`--rbr-at` on its lane, and `data-rbr-done` once the horse is at the post.

Neither changes the template's markup beyond those, and neither calls
the other or the spoiler script: the track reads `aria-pressed` through
a `MutationObserver`, so it follows every reveal (one race, a meeting,
the remembered ones on load) whichever script runs first.

## Do not touch

- The spoiler script, inline in the template. It is production code;
  the revamp's scripts sit beside it.
- `static/js/site.js`, `static/css/chrome.css`, `base.css`, `paper.css`:
  site-wide. The page's one reach into the chrome is the footer's horse,
  a rule in `browse.css` scoped to this page.
- `static/races/`: shared with other pages.

## Budgets and standards

- `img/masthead.webp` 293 KB (the 300 KB budget), the icons under 1 KB
  each, the horse 5 KB.
- No `!important`; media queries only at 768 and 1024px; a meeting's
  layout by container queries on the meeting (640 and 860px).
- Every `:hover` inside `@media (hover: hover)`; everything pressable at
  least 44px tall; reduced motion stops the beats, the horse and the
  winner's entrance.
- No new axe findings: the three pages fire only the shared navigation's
  `color-contrast` (the known one), from 768px.

## Running it

```bash
npm run serve
```

Then <http://localhost:8080/races.html>, `races-tomorrow.html`,
`races-yesterday.html` and `races-states.html`.

The three pages are built from captures of the live site by
`node tools/build-races.mjs <folder>` (or `--live`, to capture them
again); the template changes below are made there, one function each,
so the tool is also their specification. `node tools/build-races-states.mjs`
rebuilds the states page after either changes.

## Trade-offs, made knowingly

- **Five additions and one fix in the template.** The day tabs, two
  figures, the Pick Six stickers, the masthead band (with the tabs moved
  out of it) and the notes are markup; everything else is style or
  script. `docs/integration-map.md` lists them.
- **The meeting tabs move.** In the template they are the hero
  container's last child, so the `position: sticky` they already have
  can never stick. Out of it, they do.
- **The track is added by a script**, so it appears with the script,
  after the first paint, in the heads of meetings with a result only.
  Nothing else on the page moves when it does; a template shell for it
  (as the trail's track has) is the alternative if that is ever seen.
- **Hidden, not removed:** the "✓ Result" tag (kept for a screen reader:
  the winner's button says the same), the tabs' beat (their state line
  has its own dot), the compact Pick Six's stamp, number and fox, and the
  emoji, which are line icons here. The connections' hover card is
  written out under the winner instead, so a phone shows it; it keeps
  its `role="tooltip"`.
- **The countdown** is the template's words when the page was made ("in
  3m"); nothing ticks it, as before.
- **Pick Six** stands down in the masthead on a finished day, while each
  finished meeting keeps the template's own Pick Six link: the stickers
  are a call to play; the meeting's link goes to its full card, which
  has the results too.
- **The winner's button names the winner to a screen reader** (its
  `aria-label` carries the horse, the price and the jockey) before it is
  pressed. That is the template's, and `docs/accessibility-notes.md` has
  the fix.
