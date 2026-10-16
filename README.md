# Saturday Racing — Design Sandbox

Self-contained snapshots of the live site, so you can work on it without Django, a database or any backend. The pages:

| Page | What it is |
| --- | --- |
| `index.html` | the home page, plus the navbar and footer that appear on every page |
| `trail.html` | [the Fox Trail](https://www.saturday-racing.com/trail/) — the day's tips on one board, live |
| `meeting.html` | [the meeting page](https://www.saturday-racing.com/races/meeting/newmarket/2026-10-09/full/) — every race at a meeting, every runner, and the Pick Six slip; Newmarket with the results in |
| `meeting-upcoming.html` | the same page the evening before: Newmarket's next card, no numbers yet, most runners at SP, an AI verdict under each race |
| `races.html` | [the day's races](https://www.saturday-racing.com/races/) — every meeting of the day and every race, the winners hidden until asked for; Friday 16 October mid-card, racing on |
| `races-tomorrow.html`, `races-yesterday.html` | the same page for the next day (Champions Day: 60 races at eight meetings, the busiest captured) and the day before (every result in) |
| `fox-*.html` | [Fox Signals](https://www.saturday-racing.com/fox-signals/board/) — the Fox's pick in every race and the market behind it: ten pages (the Board, Race Trace, Alerts, the Stable, Settings), as a visitor and as a member, on one recorded day |

Everything is baked into those files + the assets under `static/` — the same HTML, CSS, JS, images and fonts production ships. No template engine involved.

The trail is a **live** page: races settle while it is open. The sandbox replays a recorded day so that works here too, which is why it needs the Node server below rather than any static one. If you are working on the trail, start with **`docs/trail-brief.md`**; on the meeting page, with **`docs/meeting-brief.md`**; on the day's races, with **`docs/races-brief.md`**; on Fox Signals, with **`docs/fox-signals-brief.md`**.

---

## Quick start

```bash
npm install
npm run serve
```

Then open <http://localhost:8080/> for the home page, <http://localhost:8080/trail.html> for the trail, <http://localhost:8080/meeting.html> (or `meeting-upcoming.html`) for the meeting page, and <http://localhost:8080/races.html> (or `races-tomorrow.html`, `races-yesterday.html`) for the day's races.

You must serve through a local web server: opening the files with `file://` breaks the fonts and some images. Use `npm run serve` rather than any other static server — it also answers `/trail/live/`, which is what makes the trail's board move.

---

## What's in the bundle

```
saturday_landing/
├── README.md              this file
├── index.html             the landing page snapshot
├── trail.html             the Fox Trail snapshot (a fixture day: every cell variant)
├── meeting.html           the meeting page snapshot, with the results in
├── meeting-upcoming.html  the meeting page the evening before
├── races.html             the day's races, today mid-card (and races-tomorrow, races-yesterday)
├── states.html            every state the landing page can render
├── trail-states.html      every state the trail can render
├── meeting-states.html    every state the meeting page can render
├── races-states.html      every state the day's races page can render
├── fox-*.html             Fox Signals: ten pages built from the Django site
├── docs/                  the briefs, the integration map, the decisions
├── fixtures/              the recorded day the trail's live feed replays
├── partials/              states that live outside the pages themselves
├── mirror_site.py         re-run this to refresh the snapshot from production
├── static/
│   ├── css/               base + chrome CSS (site-wide styles)
│   ├── fonts/             Playfair Display + DM Sans (self-hosted)
│   ├── js/                site.js — nav + footer + shared JS
│   ├── img/               favicon + shared images
│   ├── public/            landing-page-specific CSS/JS/images
│   ├── grid/              the Fox Trail's own CSS + JS + images
│   ├── meeting/           the meeting page revamp's CSS + JS + images
│   ├── browse/            the day's races revamp's CSS + JS + images
│   ├── fox_signals/       Fox Signals' CSS + JS (the Django site's, byte for byte)
│   ├── races/             race picker + Pick 6 emblem CSS, and the meeting page's four production scripts
│   ├── letters/           LLaMa portrait
│   ├── news/              Sly Man portrait + fox mark
│   └── voting/            picks budget CSS
└── news/feed/             RSS feed (referenced by the head <link>)
```

**Do not touch** `mirror_site.py` — it's a one-shot helper for Vas to refresh the snapshot when production changes. If you re-run it accidentally, your changes will be overwritten.

---

## What you can edit (the scope)

The contract is **navbar, footer, and home page only**. In the bundle those translate to:

| What you're changing         | Which files to edit                                                    |
| ---------------------------- | ---------------------------------------------------------------------- |
| Home page **structure**      | `index.html` (main content between `<header>` and `<footer>`)          |
| Home page **styling**        | `static/public/css/landing.css`, `hero-fold.css`, `battle-section.css`, `landing_den_section.css`, `challenges-section.css`, `cubs-portrait.css`, `landing-anim.css`, `today-strip.css`, `editorial-shelf.css`, `market_movers.css`, `cub_hello.css`, `hero_tabs.css`, `day_hub.css`, `money_moves.css` |
| Home page **animations/JS**  | `static/public/js/landing.js`, `landing-anim.js`, `battle-fox-hero.js`, `day_hub.js`, `tv_static.js` |
| Navbar **structure + style** | `index.html` (the `<header>` block at the top) + `static/css/chrome.css` |
| Footer **structure + style** | `index.html` (the `<footer>` block at the bottom) + `static/css/chrome.css` |
| Shared JS (nav/footer)       | `static/js/site.js`                                                    |
| Fox Trail **structure**      | `trail.html` (the `<main class="trail">` block)                        |
| Fox Trail **styling**        | `static/grid/css/trail.css`                                            |
| Meeting page **structure**   | `meeting.html` / `meeting-upcoming.html` (the `<div class="mf-wrap">` block) |
| Meeting page **styling**     | `static/meeting/css/meeting.css`                                       |
| Meeting page **JS**          | `static/meeting/js/meeting_racecard.js`, `meeting_masthead.js`, `meeting_slip.js` |
| Day's races **structure**    | `races.html` / `races-tomorrow.html` / `races-yesterday.html` (the `<main>` block), through `tools/build-races.mjs` |
| Day's races **styling**      | `static/browse/css/browse.css`                                         |
| Day's races **JS**           | `static/browse/js/browse_nav.js`, `browse_track.js`                    |
| Fox Signals **styling**      | `static/fox_signals/css/fox_signals_v2.css` (and `fox_signals_shell.css`; read the brief first) |
| Fox Signals **JS**           | `static/fox_signals/js/*.js`                                           |
| Fonts / type scale           | `static/fonts/saturday-fonts.css` + `static/css/base.css`              |

**`static/grid/js/*.js`** — the trail's five scripts (`trail_live`, `trail_flip`, `trail_filter`, `trail_drawer`, `trail_nav`) are production code and come back unchanged. They key off attributes and classes in the markup; `docs/trail-brief.md` lists every one of them. Restyle freely, but keep the hooks. The revamp's own three (`trail_cards`, `trail_track`, `trail_course`) sit beside them; `docs/integration-map.md` says what they need.

**The day's races' spoiler script** — inline at the foot of `races*.html`, as it is in the template — is production code and comes back unchanged; `docs/races-brief.md` lists every hook it keys off. The pages' markup is the template's, plus the six changes `tools/build-races.mjs` makes (and `docs/integration-map.md` lists): build the pages with it rather than editing them by hand.

**Anything under `static/races/`, `static/letters/`, `static/news/`, `static/voting/`** — treat as read-only. Those are shared across the whole site and appear on the landing page for legitimate reasons (e.g. the `race_picker` CSS themes a widget the hero uses). Changing them affects other pages you can't see in this sandbox. The meeting page's four scripts (`static/races/js/racecard.js`, `racecard_collapse.js`, `bet_slip.js`, `meeting_full.js`) are production code and come back unchanged; `docs/meeting-brief.md` lists every hook they key off.

---

## What NOT to edit

- **`mirror_site.py`** — Vas's snapshot refresher. Not for you.
- **`news/feed/index.html`** — an RSS payload, incidentally captured. Ignore.
- **Absolute URLs in `index.html`** — anchor tags (`<a href="...">`) point at `https://www.saturday-racing.com/*` on purpose so nav clicks jump to the live site in preview. Don't change these to relative paths — they'll 404 in the sandbox.

---

## Delivering back

Push your changes to the private repo Vas shared with you and open PRs against `main`. He'll cherry-pick the CSS/JS/HTML diffs into the main Saturday Racing repo — no direct backend access needed from you.

Keep commits scoped ("Navbar mobile drawer refresh", "Footer newsletter block redesign", etc.) so review + integration stay clean.

**Important** — the home page in the real app is a Django template, not `index.html`. The structural HTML on the landing page belongs to a template at `public/templates/public/landing.html` in the main repo. If your work needs HTML *structure* changes (adding a new section, restructuring a card grid), flag them in your PR description as "STRUCTURAL — needs Vas to move into the Django template." Purely CSS/JS/copy tweaks integrate cleanly without any template work.

---

## States and integration

`states.html` (open it at <http://localhost:8080/states.html>) shows every state the live template can render beyond the page itself: the day hub when racing has finished, the hero after the race, each AI Chamber outcome, the empty Syndicates and Track record, the signed-in nav, footer and Welcome back strip, and more. Rebuild it with `node tools/build-states.mjs` after changing `index.html` or `partials/`; it is generated from the real markup so it cannot drift.

`trail-states.html` does the same for the Fox Trail: 23 states, including the ones that only exist while the page is running — the open drawer, a flipped cell, the filtered grid, the finished day. Rebuild it with `node tools/build-trail-states.mjs`, which drives the real page in a browser and captures what it produces.

`meeting-states.html` does the same for the meeting page: 20 states from both days and a phone — the slip empty, with three picks, full, over six and as the phone's sheet, a seventh race refused, a race filtered, the comments folded away, the winner revealed, the card before the off. Rebuild it with `node tools/build-meeting-states.mjs`.

`races-states.html` does the same for the day's races: 31 states from the three days, a tablet and a phone — each meeting state (live, to come, every result in, the day before), a winner hidden and revealed, Reveal all, the reveal track part-way and at the post, the AI's pick with and without a price, and the template's branches no capture caught (the big race, an abandoned meeting and race, a member's pick, the Fox's cubs, a day without racing) as marked stand-ins. Rebuild it with `node tools/build-races-states.mjs`; the pages themselves with `node tools/build-races.mjs`.

**The trail's live day.** `tools/serve.mjs` answers `/trail/live/` from `fixtures/trail-live-timeline.json`, a recorded day of 15 frames built from the app's own figures, one frame per poll. The page polls every 4 seconds here (`data-live-poll-ms`), against 45 in production. `?sim=reset` restarts the day, `?sim=last` jumps to the finished board, `?sim=7` to any frame, and every response carries an `X-Trail-Frame` header.

The `docs/` folder carries the decisions and the handover:

| File | What it is |
| --- | --- |
| `trail-brief.md` | **The Fox Trail revamp: scope, the states, the live day, and the hooks the page must keep** |
| `meeting-brief.md` | **The meeting page revamp: what it did, the states, the six-pick limit, and the hooks the page must keep** |
| `races-brief.md` | **The day's races revamp: what it did, the real days and every state, the fix to Reveal winner, and the hooks the page must keep** |
| `fox-signals-brief.md` | **Fox Signals: the ten pages, what is real and what is a stand-in, what you may change, the hooks, and how it goes back** |
| `integration-map.md` | How this becomes Django templates: section by section, with the context each one needs |
| `content-notes.md` | Which numbers are sample data, and the content decisions still open |
| `accessibility-notes.md` | What was fixed, the one open contrast decision, and why some axe findings are false positives |
| `restoration-notes.md` | What the redesign dropped: what came back, and what still needs a designer |
| `chrome-css-changes.md` | What the redesign actually changed in the site-wide stylesheet, ignoring reformatting |
| `image-provenance.md` | Every original image, its size, and whether it is AI-generated |

---

## Quality checks

Every PR must pass three checks. GitHub runs them automatically on each PR (`.github/workflows/quality.yml`); run them locally before you push.

One-time setup (Node 20 recommended, see `.nvmrc`):

```bash
npm ci
npx playwright install chromium
```

| Command | What it proves |
| --- | --- |
| `npm run check` | No debug code or localhost calls, every CSS `url()` resolves, images within 300 KB, no unused images, no new `!important`s, hardcoded token colours, off-scale breakpoints or unloaded fonts. |
| `npm test` | Every feature works at 375, 768, 1024 and 1440px: nav dropdowns and mobile drawer, countdowns, day hub filters and course switcher, tabs, Saturday Draw, tilt and reduced motion, the trail's board, filters, drawer and flip, the meeting page's sorting, filters, slip, six-pick limit, sheet and reveal, the day's races' tabs, reveals and track, no horizontal scroll, no new accessibility violations. |
| `npm run baseline` then `npm run test:visual` | **Advisory.** Screenshots each section at all four widths and compares them with the design reference commit (`tools/visual-baseline-ref`). |

`npm run verify` runs all of them in order. The first two must pass; the third is for review.

**Refactoring CSS?** `node tools/css-equivalence.mjs <ref>` compares the computed styles of every element against another commit, at all four widths. Use it when a change is meant to alter nothing that renders — swapping a colour for the variable holding the same value, merging duplicate keyframes — because it checks what the browser resolved rather than pixels, so rendering noise cannot hide a real change.

**Why the visual check is advisory.** It used to fail at random on the battle section and occasionally the phone hero. Neither was the renderer: the spec passed its hide rules to `toHaveScreenshot` as `style`, an option that does not exist, so the random TV-static canvas was compared pixel for pixel (the rules are now injected into the page); and the hero's lead line was sometimes spaced against a fallback font (`day_hub.js` now re-measures whenever a web font loads). Since then it has passed repeated full runs. Use it to look at what a change did (`test-results/` holds before, after and diff images); it can become a blocking gate once it has stayed clean for a while.

**Known issues are tracked, not ignored.**

- `tools/quality-baseline.json` lists the problems that existed when the checks were introduced. A new problem fails the run, and so does a listed problem that has been fixed, until you run `npm run check -- --update` and commit the shorter list.
- Feature tests for known defects are marked `knownIssue('PR n', …)`. They must fail today; when the fix lands, Playwright reports them as unexpectedly passing, so the marker comes out in the PR that fixes it.

**Intentional visual changes** fail `test:visual` by design. Say so in the PR description, attach the diff images from `test-results/`, and once the PR is approved move `tools/visual-baseline-ref` to the merged commit.

**A new page has no reference yet.** The meeting page's and the day's races' visual tests skip themselves while `tools/visual-baseline-ref` names a commit without `meeting.html` (or `races.html`), and say so; they start comparing once the reference moves to a commit that has it.

---

## Troubleshooting

**Fonts look wrong** — you're on `file://`. Kill the tab, run `python -m http.server 8080`, reopen at `http://localhost:8080/`.

**A section is blank** — the data in the snapshot is frozen at capture time. If the "next off" strip or "today's meetings" band looks empty, that's because at the moment Vas captured, those services had no data (Sunday afternoon, mid-week evening, etc.). Not a bug in your CSS.

**A link goes to the live site** — that's intentional. See "What NOT to edit" above.

---

## Contact

**Vas Rabani** · vasrabani@hotmail.co.uk
Ping on Upwork for engagement questions.
