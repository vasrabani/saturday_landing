# Accessibility notes

What `npm test` still reports, and why it is still there. Everything else
axe checks for at WCAG 2.1 AA passes at all four widths.

## Fixed

| Was | Fix |
| --- | --- |
| `definition-list`, `dlitem` — the day hub's fact lists nested `dt`/`dd` two levels deep inside the `dl`, so neither was announced as a description list | The label row is now the `dt` itself, giving `dl > div > (dt, dd)`. The class carries the styling, so the layout is unchanged |
| Scoring table column headers had no `scope`, and the table lost its name when the redesign dropped the heading above it | `scope="col"` on each column header, plus a visually hidden `<caption>` |
| The hero skipped from `h1` to `h3` | The duel cards are `h2`, directly under the hero's `h1` |
| The Saturday Draw had two buttons with `role="tab"`, one of them disabled, and no tab panels behind them | They label which race the draw covers, so the tab roles are gone and the active one uses `aria-current` |
| The market intelligence tabs had no panel to control | The list they switch is now a labelled `tabpanel` |
| Tabs could not be operated from the keyboard | `SaturdayTabs` (PR 3) implements the WAI-ARIA pattern: arrow keys, Home, End, roving `tabindex` |
| Course meta text ("GB · 6") at 2.89:1, and the NEXT badge at 4.07:1 | Same colours, less transparent and a shade deeper: about 4.9:1 and 5.4:1 |

## Still open: one real contrast failure, and a decision for you

**`.day-hub__grid-kicker` — "TODAY'S CARD", gold `#c9a227` on the cream
card, 2.2:1 against a required 4.5:1.** This is small bold text, so it needs
the full ratio. It is not fixed here because the fix is a brand decision
rather than a code one: gold on cream cannot reach 4.5:1 without going
dark enough to read brown. The options, in the order I would consider them:

1. Keep the gold but put the kicker on the dark background used elsewhere.
2. Darken to about `#6f5410`, which passes but no longer reads as the
   brand gold on cream.
3. Make it larger and heavier (18.66px bold or more), which only needs
   3:1 — a design change, but it keeps the colour.

## The Fox Trail

What the revamp changed. The trail brings its cards up as the reader
scrolls down to them, so `npm test` opens it with reduced motion, where
every card is on the board at once: axe scans the whole board, not just
the first screen of it.

| Was | Now |
| --- | --- |
| 35 contrast failures in the trail's own content at 1440px, 28 on a phone: the tier names on the gold strips (1.9:1 to 2.5:1), course names, prices, the spotlight and track-record small print, the legend's headings | One, below. Text is the paper palette's ink; where gold carries words it is a darker gold (`--trail-gold-ink`) that keeps 4.5:1 on every ground it is used on |
| The card drawer and the phone legend opened underneath the fixed nav (`z-index: 60` against the nav's 200), and the drawer's background was a variable that is never defined, so the board showed through it | Both open over the nav, on the page's ground |
| The legend's rows and arrows and the drawer's close button had their focus outline taken off, leaving a faint tint | One ink ring, on every control |
| No way along the board from the keyboard except Tab through every card | Left and right arrows step race by race in the order they are run, from a card or the course bar; the bar's buttons say where they went (a polite status line) |

The known list in `tools/quality-baseline.json` is as it was: `trail.html`
still reports `color-contrast` at all four widths. What stands behind that
entry is now one node on the trail (below) and, from 768px up, the site
nav (`.site-nav__wordmark-sub`, and `.site-nav__date` at 1024px), which
this work does not touch.

**Still open on the trail: one contrast failure, and a decision for you.**
The race number on the saddle cloth of a beaten or void race is white on
`--c-ink-40` grey: 2.5:1, in small bold type. It is the approved design,
and the old page had a void race's number at 2.6:1 (white on orange). The
card's `aria-label` carries the number for a screen reader; this is about
sighted readers. The options, in the order I would take them:

1. A darker cloth, `--trail-ink-soft`: 6.3:1, and the cloth still reads
   as a faded version of the black one.
2. Keep the cloth and print the number in ink: 7.2:1, but it is then the
   only cloth without a white number.
3. Leave it: the number is the least important thing on a card whose race
   is over.

Two more that axe cannot measure, because the plates are drawn as
pseudo-elements: the white "B" on the gold silk (2.6:1) and "PW" on the
grey one (2.2:1). The letters repeat what the silk's pattern, its tooltip
and the legend already say, so they are a reinforcement rather than the
only way to read a signal; a dark letter on those two plates would pass
if you want them to.

## Noise in the report

The remaining 14 `color-contrast` nodes are false positives. They are
headings and buttons whose text is painted with a gradient
(`background-clip: text`), so axe samples the element's own colour, which
sits behind the gradient, and reports foreground and background as nearly
the same — ratios like 1.01:1. The rendered text has real contrast. They
stay on the known list in `tools/quality-baseline.json` so that a genuine
new contrast failure still fails the run.
