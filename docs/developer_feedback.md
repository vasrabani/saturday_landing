# Fox Trail and meeting page: what happened next, and what to take from it

For Deepanshu. Written 13 October 2026.

Both of your redesigns are live on <https://www.saturday-racing.com>:
the Fox Trail since 12 October and the full-field meeting page since
13 October. This page says what was done to each between your merge and
going live, what has been built on top of them since, and what is worth
carrying into the next piece of work.

The detailed reviews are still where they were:
[`fox_trail_feedback.md`](fox_trail_feedback.md) and
[`meeting_feedback.md`](meeting_feedback.md). You were asked to hold off
on the fixes so they could be done in one pass with the port; nothing
below is work you were expected to have done already.

## In short

| | Fox Trail | Meeting page |
| --- | --- | --- |
| Your merge | `d3a6abd`, 6 October | PR #8, `0df61d2`, 11 October |
| Review | 12 October | 12 October, **8 / 10** |
| Live for everyone | 12 October | 13 October |
| Your design kept? | Yes: the board, the cards, the course bar, the drawer | Yes: one stylesheet, three scripts, the slip as a ticket |

The designs went live as you drew them. What changed was at the edges:
real-sized days, states the captures did not have, and a few behaviours
readers asked for once they were using the pages.

## The Fox Trail

### Fixed from the review (`fix/trail-real-days`)

- **A real day fits.** The board was designed on 24 races; a real day is
  about twice that. Days over 30 races now use a denser layout.
- **Phones read straight down.** The snake that reverses every other row
  is for wide screens only; on a phone the cards are in race order.
- **The Results toggle** now counts races that settled while the page
  was open.
- **The smaller points:** 44px buttons on the course bar,
  `aria-disabled` in place of `disabled` on Previous/Next, arrow keys
  only when the board has the focus, hover rules kept to pointers that
  hover.

Two points in that review were mine to correct, not yours: the Pick
Winner card was already designed, and "no current race means the day is
over" was right all along. Both are marked as corrections in the review.

### Added after it went on in front of readers

- A bigger START, and arrows along the track showing which way it runs.
- A chequered flag on a race that has been run and its result declared.
- The horse's silks on each card, in place of the tipster's jacket.
- Gold, silver and bronze cards for first, second and third.
- A filter by course, and a label when the day shown is not today.
- Previous and next day, and a date picker, in the masthead.

None of these needed the design reworked. That is to its credit: a
layout that takes six additions without being rebuilt was a sound one.

## The meeting page

### Fixed from the review (`fix/meeting-before-port`)

- **A Pick that cannot be picked no longer looks like one that can.**
  Runners with no price have a dashed, stood-down button.
- **Comments start folded at laptop width**, where a runner takes two
  lines, until the reader opens them. A 13-runner race at 1024px was
  about 3,500px long.
- **Focus** goes back to the bar when the sheet closes, and to the race
  when a strip chip is pressed.
- **The ticket** is rebuilt only when the picks change, not on every
  keystroke in the stake.
- **Touch targets** are 44px, hover rules are kept to pointers that
  hover, and the refusal at six picks is announced every time.

### Settled in the port

- The states the two captured days did not have (a closed race, a
  non-runner, a runner with no price, a member's Submit) are now covered
  by tests in the app, against the real templates.
- Sorting by OR works. That was the production script's fault, not
  yours, as the review said.

### Added after it went on in front of readers

- **Choosing another meeting no longer loads a new page.** The tabs
  fetch the other meeting and swap it in, so a reader can build a Pick
  Six across the day's meetings without losing their place. This was the
  one real gap: the brief did not say it in so many words, but the Pick
  Six is one slip for the whole day, so a selector that leaves the page
  works against it.

## What has been built on your work since

**The LLaMa Index** (`/llama-index/`, live 13 October, under Races in the
menu) lists every horse running on a day, A to Z, with search, filters
and signals. It is not a new design: it loads your `meeting.css`, uses
your slip and `meeting_slip.js` unchanged, and its rows are laid out on
the same idea as your race list (a container query on the list, not a
media query on the window). A pick made there lands in the same slip as
one made on a meeting's page.

It is in this repo as `llama-index.html`, with `tests/llama.spec.js`,
so that a change to `meeting.css` or the slip that breaks it fails here.
Two things to know if you work on the meeting page again:

- `static/meeting/js/meeting_form.js` is new. The colours of a horse's
  form moved out of `meeting_racecard.js` into it, because both pages
  need them. Load it before `meeting_racecard.js`.
- `--mfr-strip` is now read by a second page. The index sets it to the
  height of its own pinned tools, which is how the docked slip and the
  toast stand clear of them. Keep using the variable, not a fixed
  number.

## Learning and development

What you already do well, and should keep doing exactly as you do:

- **The handoff.** Green CI, a PR description that says what changed and
  why, a brief, porting notes, the trade-offs written down. It scored
  9.5, and it made both ports quick and low-risk.
- **Leaving production code alone.** The four production scripts came
  back byte for byte, with everything new beside them. That made the
  port safe to do behind a switch and safe to roll back.
- **CSS discipline.** No `!important`, the site's tokens, container
  queries where the room belongs to the list.

Four habits to add. Each one comes from something that actually cost
time on these two pages.

1. **Design against the biggest real day, not the fixture.** The trail
   was drawn on 24 races and met 47. Before starting, ask for (or
   capture) the busiest day on record and the emptiest, and keep both
   open while designing.

2. **List every branch of the template and put each on the states
   page.** Go through the template `{% if %}` by `{% if %}`: closed
   race, non-runner, no price, signed in, race in progress. Both
   captured meeting days had a Pick on every runner, so styles were
   written for markup that had never been seen, and one test asserted
   something a real afternoon breaks.

3. **Test what the reader sees, not what the code set.** This one is
   mine, and it is here because it is the most useful of the four. On
   the LLaMa Index my tests checked that filtered rows had the `hidden`
   attribute. They did. A CSS rule of mine outweighed it, so every row
   stayed on the screen, and the tests passed while the search visibly
   did nothing. The owner found it on the live site. The tests now ask
   what is displayed. When you assert on a state, assert on the thing a
   person would look at: is it visible, where is it, can it be pressed.

4. **Ask what the feature is for before building its controls.** The
   meeting selector was built as navigation, which is what it looked
   like on the old page. What it is for is choosing where the next of
   six picks comes from. A two-line question at the start ("does picking
   carry across meetings?") would have changed the build. When a control
   sits next to something stateful, such as a slip, a basket or a form,
   ask whether using the control should keep that state on screen.

And three smaller ones, which came up on both pages:

- Aim for 44px on anything a thumb presses.
- Put every `:hover` rule inside `@media (hover: hover)`.
- When something closes or moves, say where the keyboard focus goes.

## If you pick either page up again

- Start from `main`. Both pages have moved a long way since your
  branches.
- `docs/integration-map.md` says where each part lives in the app and
  what has been ported; it is up to date for all four pages.
- `npm run check` and `npm test` cover the trail, the meeting page and
  the index. A few page-load tests time out when the machine is busy;
  run them again on their own before treating one as a failure.
- The old (v1) trail and meeting page are still in the app behind a
  switch, as a way back. They will be removed once the new ones have run
  cleanly for a while; nothing here depends on them.
