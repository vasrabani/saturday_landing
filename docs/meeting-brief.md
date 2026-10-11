# The meeting page: the revamp, and the contract it keeps

The page: `meeting.html` and `meeting-upcoming.html` in this repo, live at
<https://www.saturday-racing.com/races/meeting/newmarket/2026-10-09/full/>
and the same path for the next day. Run the sandbox and open
<http://localhost:8080/meeting.html> (Friday 9 October 2026, every result
in) and <http://localhost:8080/meeting-upcoming.html> (Saturday 10 October,
the evening before: no numbers yet, most runners at SP, an AI verdict
under each race). Every state is on <http://localhost:8080/meeting-states.html>.

## What the page is for

Every race at a meeting, every runner, and the accumulator slip. A
visitor reads the card race by race — form, ratings, prices, the comment
and the AI verdict on each runner — and builds a Pick Six slip from it:
one horse in each of up to six races, across the day's meetings. The
slip is kept on the device; a member submits it to the server.

The page is the site's own markup and scripts: `racecard.js` (sorting,
the vote buttons), `racecard_collapse.js` (the phone card),
`bet_slip.js` (the slip) and `meeting_full.js` (the race strip, the next
off, Reveal winner). None of them changed. What changed is what the page
looks like and what sits on top of it.

## What the revamp did

**The look.** One stylesheet, `static/meeting/css/meeting.css`, takes the
place of the six page-level stylesheets and the page's `<style>` block.
The site's paper palette under the races; the brand gold, green and red
each with one job; DM Sans throughout, nothing italic. The masthead is
the homepage's own picture across the whole band under gradients in the
site's night colour, the course's name in the middle, Pick Six as three
stickers (a round stamp lettered with the link's own words, a tilted
green badge, a tilted gold pill). On a phone the masthead is the live
page's own column: eyebrow, date, name, Pick Six, figures, chips, with
the horse at the right edge.

**The runners.** A table where the race list has 1000px of room, two
lines a runner between 660 and 1000px, a card under that — decided by a
container query on `.mf-races`, not the window. Each runner's form in a
colour for every place (gold, silver and bronze medals, then emerald,
sapphire, amethyst, slate, ruby for a run not finished; the latest run
marked), prices on a pale gold tint with the favourite a shade deeper,
the top Saturday Rating marked, number cloths, the trip spelt out and
drawn as a ruler, the five phone-only filters at every width, a
Comments switch, and Details on the phone card.

**The slip, as a betting ticket.** Each pick with its runner's silks,
number cloth and jockey and its price on a tear-off stub; a dark returns
board; under the head, the slip's six places on a rail to the winning
post, filling in the order picked. Docked beside the races from 1024px,
a bar at the foot of the screen below that, opening as a sheet that
closes on Escape or a tap outside.

**Six picks at most.** `bet_slip.js` takes any number of picks; the
server applies the daily limit when a member submits (`daily_pick_limit`,
six). Here the limit is kept on the page too: a press that would put a
seventh race in the slip is stopped before `bet_slip.js` hears it, with
a message saying why; Pick in every race not yet picked stands down,
still pressable, with a tooltip. Changing the horse in a race already
picked, and taking a pick out, go through as ever. A slip that arrives
with more than six (made where the limit is not kept) is not cut down:
the card says how many are over, and nothing more is taken until they
are out.

**Nothing removed.** Every feature of the live page is there: sorting by
column (and from the keyboard now), the filters, the vote buttons, the
slip's stake, currency, copy, reset and undo, Reveal winner, the race
strip's "you are here", the meeting tabs, the previous and next
meetings. Two of the site's own phone-only pieces are hidden because the
page says the same thing at every width now: `racecard_collapse.js`'s
filter bar and compact rows (the filters above each race, the Details
button) and its AI tier ribbon (the tier under each runner's name).

## Every state is designed

Open <http://localhost:8080/meeting-states.html>: **20 states**,
generated from the real pages — the masthead on both days and on a
phone, the tabs and strip, a race with results, with the winner
revealed, filtered, and with the comments folded away, a race before the
off with its AI verdict panel, the slip empty, with three picks, full,
over six and as the phone's sheet, a Pick stood down, the refusal
message, and the phone card closed and open. Rebuild it after changing
the pages:

```bash
node tools/build-meeting-states.mjs
```

## The contract: what the scripts need

The four production scripts key off the classes and attributes in the
template, and the revamp's three (`static/meeting/js/`) read them too.
Restyle freely, but keep these hooks, or the page stops working —
silently, because nothing throws.

| Hook | Used for |
| --- | --- |
| `.mf-wrap[data-storage-key]` | `bet_slip.js`: the day's slip in localStorage; `meeting_slip.js` keeps each pick's silks beside it |
| `.mf-race[id]`, `#race-<id>` | the race strip's targets, the slip's places, the six-pick limit (`mf-race--has-selection`) |
| `.racecard__runner[data-runner-id][data-race-id][data-horse-name][data-course][data-race-time][data-odds-decimal][data-odds-fractional][data-number][data-stars][data-sr][data-nr]` | `bet_slip.js` builds a pick from the row; `meeting_racecard.js` reads the tier, the rating, the price and the number; `meeting_slip.js` matches a pick to its row on course, time and horse |
| `[data-action="add-to-slip"]`, `.racecard__runner--in-slip`, `.mf-race--has-selection` | the Pick button and what `bet_slip.js` marks |
| `#betSlip`, `#slipHandle`, `#slipHandleCount`, `#slipBody`, `#slipLegs`, `.mf-slip__leg`, `.mf-slip__leg-where`, `.mf-slip__leg-time`, `.mf-slip__leg-horse`, `.mf-slip__leg-odds`, `.mf-slip__leg-remove`, `#slipType`, `#slipHint`, `#slipTotals`, `#slipStake`, `#slipReturns`, `.mf-slip__cur`, `#slipCopy`, `#slipClear`, `.mf-toast` | the slip, as `bet_slip.js` writes and reads it |
| `img.racecard__silk`, `.racecard__jockey-name` | what a ticket copies from the row |
| `.racecard__col[data-sortable][data-col]`, `aria-sort` | sorting (`racecard.js`), and the keyboard sort |
| `.racecard__form .rcf`, `.rcf--sep`, `.rcf--dnf` | the form's colours (`data-mfr-run`, `data-mfr-latest`) and `racecard_collapse.js`'s form trend |
| `.racecard__cell--comment .racecard__comment`, `.racecard__comment--empty`, `.racecard__comment--ai`, `.rc-spotlight`, `.rc-spotlight__body` | the comments switch, Details, and a verdict said once |
| `.mf-race__meta > span` (the trip, the first plain span), `.mf-race__tag`, `.mf-race__cta` | the labels |
| `.mf-switcher__chip`, `.mf-switcher__course`, `.mf-switcher__count` | the tabs; where a pick from another meeting goes |
| `[data-mf-jump]`, `.mf-jump__chip[data-jump-target]`, `is-active` | the race strip (`meeting_full.js` and `meeting_masthead.js`) |
| `[data-spoiler][data-action="reveal-result"]`, `aria-pressed` | Reveal winner |
| `.pick6`, `.pick6__num`, `.pick6__lbl`, `.pick6__stamp`, `.pick6__sub` | the stickers; the stamp's lettering is the link's own two words |
| `.cv`, `.cv-hero`, `.cv-ring` | the AI verdict panel before racing |
| `--nav-h`, `--banner-h` (on `body`, measured by the tour strip's script) | where the page's pinned things start |

What the revamp's scripts set, and only the stylesheet reads: an
`mfr-` class on every element they add, and on the page's own elements
a `data-mfr-*` attribute (`run`, `latest`, `once`, `numbers`, `open`,
`hidden`, `fav`, `top`, `compact` on `<html>`, `taken`, `state`, `shut`,
`six`, `of`, `nudge`), `--mfr-f` on a ruler and `--mfr-strip` on `body`.
A `data-mfr-*` attribute, never a class: the page's own scripts find
their elements by class.

If a hook is in the way of the design you want, say so in the pull
request and we will change it on both sides. Do not rename it quietly.

## Do not touch

- **The nav, the footer, `static/css/chrome.css` and `static/css/base.css`.**
  They are on all 141 pages of the site. Two things the live chrome does
  on this page are left as they are for that reason: the tour strip's
  sentence ends in "…" on a narrow phone, and the race badge on a tablet
  cuts the featured race's name at 220px.
- **The four `static/races/js/*.js` files** are production code and come
  back unchanged. `static/races/`, `static/voting/` and the rest of the
  shared folders are read-only.

## Budgets and standards

- **Images:** the masthead picture is the homepage's own (108 KB, WebP);
  the icons are line SVGs under 1 KB each; the silks are copies of what
  the live page loads from the silks service, for a sandbox that asks
  no other server for anything.
- **CSS:** the variables in `static/css/base.css` and `static/css/paper.css`
  wherever the value is the site's own; no `!important`; page-level
  steps only at 768, 1024 and 1280px, and container queries inside them.
- **Accessibility:** `npm test` runs axe at four widths. What fires is
  the template's own ARIA (three rules) and the shared nav's contrast,
  all on the known list; `accessibility-notes.md` has the fix for each,
  and nothing the revamp adds fires a rule. Sorting, the filters, the
  switch, Details, the slip and its sheet all work from the keyboard;
  the sheet closes on Escape.
- **Performance:** the page is up to 190 runners with a comment each. The
  scripts read the page once and set attributes; nothing runs on scroll
  but the strip's "you are here", on a frame.

## Running it

```bash
npm install
npm run serve        # http://localhost:8080/meeting.html
npm run check        # static checks: must pass
npm test             # features + accessibility, four widths: must pass
npm run test:visual  # screenshot comparison: advisory, look at the diffs
```

`tests/meeting.spec.js` is the list of what the page has to keep doing.

## Before you hand over

- [ ] Every state in `meeting-states.html` designed, and the page rebuilt
- [ ] Both days checked: results in, and the evening before
- [ ] The slip tried to the limit: six in, a seventh refused, one out
- [ ] No debug code, no calls to localhost
- [ ] Colours, fonts and spacing from the `base.css` / `paper.css` variables
- [ ] No formatting-only changes to files you did not otherwise change
- [ ] Every hook in the contract still present
- [ ] `npm run check` and `npm test` pass at all four widths
- [ ] Checked at 375, 768, 1024 and 1440px
- [ ] Scoped commits, structural changes listed in the pull request

## After you hand over

The page is ported into the Django template on our side:
`docs/integration-map.md` says what goes where, what the template has
to change (the stylesheet links and three `<script>` tags, nothing
else), and what to check once it is in.
