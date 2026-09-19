# Saturday Racing — Landing Page Sandbox

A self-contained snapshot of the live landing page at <https://www.saturday-racing.com/>. Iterate on the **navbar, footer, and home page** without needing Django, a database, or any backend.

Everything you see when you visit the live site is baked into `index.html` + the assets under `static/` — the same HTML, CSS, JS, images and fonts production ships. No template engine involved.

---

## Quick start

```bash
python -m http.server 8080
```

Then open <http://localhost:8080/>. You should see the exact home page from production.

You must serve through a local web server. Opening `index.html` with `file://` will break the fonts and probably a few images because of browser CORS on local files. Node users: `npx http-server -p 8080` works identically.

---

## What's in the bundle

```
saturday_landing/
├── README.md              this file
├── index.html             the landing page snapshot
├── mirror_site.py         re-run this to refresh the snapshot from production
├── static/
│   ├── css/               base + chrome CSS (site-wide styles)
│   ├── fonts/             Playfair Display + DM Sans (self-hosted)
│   ├── js/                site.js — nav + footer + shared JS
│   ├── img/               favicon + shared images
│   ├── public/            landing-page-specific CSS/JS/images
│   ├── races/             race picker + Pick 6 emblem CSS
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
| Fonts / type scale           | `static/fonts/saturday-fonts.css` + `static/css/base.css`              |

**Anything under `static/races/`, `static/letters/`, `static/news/`, `static/voting/`** — treat as read-only. Those are shared across the whole site and appear on the landing page for legitimate reasons (e.g. the `race_picker` CSS themes a widget the hero uses). Changing them affects other pages you can't see in this sandbox.

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

The `docs/` folder carries the decisions and the handover:

| File | What it is |
| --- | --- |
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
| `npm test` | Every feature works at 375, 768, 1024 and 1440px: nav dropdowns and mobile drawer, countdowns, day hub filters and course switcher, tabs, Saturday Draw, tilt and reduced motion, no horizontal scroll, no new accessibility violations. |
| `npm run baseline` then `npm run test:visual` | **Advisory.** Screenshots each section at all four widths and compares them with the design reference commit (`tools/visual-baseline-ref`). |

`npm run verify` runs all of them in order. The first two must pass; the third is for review.

**Refactoring CSS?** `node tools/css-equivalence.mjs <ref>` compares the computed styles of every element against another commit, at all four widths. Use it when a change is meant to alter nothing that renders — swapping a colour for the variable holding the same value, merging duplicate keyframes — because it checks what the browser resolved rather than pixels, so rendering noise cannot hide a real change.

**Why the visual check is advisory.** Most sections compare cleanly, but a few (battle, market intelligence, DEN) differ between runs of identical code: their full-bleed art layers combine large blurs with `mix-blend-mode`, so the same frame is never painted twice. Use it to look at what a change did (`test-results/` holds before, after and diff images), not as pass/fail. It becomes a blocking gate once the noise is gone: PR 2 cut the image weight and PR 3 fixed the race-title clamp, so this is due a re-check.

**Known issues are tracked, not ignored.**

- `tools/quality-baseline.json` lists the problems that existed when the checks were introduced. A new problem fails the run, and so does a listed problem that has been fixed, until you run `npm run check -- --update` and commit the shorter list.
- Feature tests for known defects are marked `knownIssue('PR n', …)`. They must fail today; when the fix lands, Playwright reports them as unexpectedly passing, so the marker comes out in the PR that fixes it.

**Intentional visual changes** fail `test:visual` by design. Say so in the PR description, attach the diff images from `test-results/`, and once the PR is approved move `tools/visual-baseline-ref` to the merged commit.

---

## Troubleshooting

**Fonts look wrong** — you're on `file://`. Kill the tab, run `python -m http.server 8080`, reopen at `http://localhost:8080/`.

**A section is blank** — the data in the snapshot is frozen at capture time. If the "next off" strip or "today's meetings" band looks empty, that's because at the moment Vas captured, those services had no data (Sunday afternoon, mid-week evening, etc.). Not a bug in your CSS.

**A link goes to the live site** — that's intentional. See "What NOT to edit" above.

---

## Contact

**Vas Rabani** · vasrabani@hotmail.co.uk
Ping on Upwork for engagement questions.
