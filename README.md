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

## Troubleshooting

**Fonts look wrong** — you're on `file://`. Kill the tab, run `python -m http.server 8080`, reopen at `http://localhost:8080/`.

**A section is blank** — the data in the snapshot is frozen at capture time. If the "next off" strip or "today's meetings" band looks empty, that's because at the moment Vas captured, those services had no data (Sunday afternoon, mid-week evening, etc.). Not a bug in your CSS.

**A link goes to the live site** — that's intentional. See "What NOT to edit" above.

---

## Contact

**Vas Rabani** · vasrabani@hotmail.co.uk
Ping on Upwork for engagement questions.
