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

## Noise in the report

The remaining 14 `color-contrast` nodes are false positives. They are
headings and buttons whose text is painted with a gradient
(`background-clip: text`), so axe samples the element's own colour, which
sits behind the gradient, and reports foreground and background as nearly
the same — ratios like 1.01:1. The rendered text has real contrast. They
stay on the known list in `tools/quality-baseline.json` so that a genuine
new contrast failure still fails the run.
