# Integration map

How to get this redesign into the Django site. Written for whoever does the
port, which is a template job: the CSS, JS and images move across as files,
and the HTML has to be rebuilt as templates against real context.

Repositories:

- **Here:** `saturday_landing` — the static snapshot.
- **There:** the Saturday Racing app. The landing page is
  `public/templates/public/landing.html` plus the partials it includes, and
  its context comes from `public/views/landing.py`.

## In sync with production as of

The nav, `chrome.css`, `base.css` and the page head match production at
**`6140974c` (2026-09-17)**. The snapshot was taken on 2026-08-27; these
production changes were brought across since:

| Commit | Change |
| --- | --- |
| `a965c5f8` | Fox Trail in News, under new "Today's Edge" and "Read" section headers |
| `0d5fe25a` | Accumulators under a "Learn" subhead in The Honest Record |
| `b7b100c2` | Dream Ticket in News |
| `288460ca` | Results in Races |
| `6b1f4547` | The demo banner's height published as `--banner-h` |
| `a8f3728d` | `paper.css` linked between `base.css` and `chrome.css` |
| `290bac43` | `og:image` default removed — `og-image.png` never existed, and the manifest backend 500s on it |

**Before porting, check for newer ones:**

```bash
git log 6140974c..main --oneline -- templates/base/base.html static/css/chrome.css static/css/base.css
```

Anything that lists has to be merged into this version of `chrome.css`,
not overwritten by it.

## Order of work

1. **Files first** (no template work): `static/public/css/*`,
   `static/public/js/*`, `static/public/img/*` and `static/js/site.js`.
   Copy, then `collectstatic`. `tools/check.mjs` already guarantees every
   `url()` resolves, which is what used to break that step.
2. **Site chrome** (`static/css/chrome.css`, `base.css`): these style every
   page, not just the landing page. Read `docs/chrome-css-changes.md` — it
   lists the 50 rules added, 36 changed and 1 removed, ignoring the
   reformatting, so the nav and footer changes can be reviewed on their own.
3. **Section by section**, in the order below. Each one is: rebuild the
   markup in its partial, keep every `{% if %}` branch the partial already
   has, and check it against `states.html` as well as the page.
4. **Check every branch.** `states.html` renders all eleven states the
   template can take, so each one can be compared rather than imagined.

## Section by section

| Section here | Template there | Context | Notes |
| --- | --- | --- | --- |
| Today strip | `components/_today_strip.html` | `today_summary`, `daily_featured` | 9 branches. The hero tab toggle (`_hero_tabs.html`) was dropped by the redesign — decide before porting |
| Hero | `components/hero_fold.html` | `hero_day`, `hero_week`, `hero_source` | 44 branches, the most in the page. The resulted state is now designed (`partials/hero-resulted.html`); the race strip is still missing |
| Editorial shelf | `components/_editorial_shelf.html` | `editorial_shelf` (`news/services/editorial_shelf.py`) | The service builds 4 cards; the design shows 6 |
| Day hub | `components/_day_hub.html` | `day_hub` (`landing.py`) | 33 branches. Keep `.is-finished`, and `data-flags` on each race tile — the filters read them. GB/IRE labels have no field |
| Market intelligence | `components/_money_moves.html` | `money_moves` | 16 branches. Drifters now needs its own list, not the steamers recoloured. When `has_data` is false, either keep hiding the section as production does or use `partials/market-empty.html` |
| Battle | `landing.html` (inline, ~100 lines) | `big_race`, `fox_wins`, `cub_wins`, `cub_tip`, `rivalry_caption` | Keep `data-count-up` on the win counts and the `Pick pending` branch |
| DEN | `components/_landing_den_section.html` | fixed demo content | Closest to unchanged |
| AI Chamber | `landing.html` (inline) | `ai_consensus`, `ai_analysis` | One panel per model, `role="tabpanel"`, one visible. All five `ai_consensus.pattern` branches now have markup in `partials/ai-consensus-*.html`. Per-model confidence scores still have no field |
| AI Lab | `landing.html` (inline) | `big_race`, `ai_analysis` | The terminal was dropped; its data (race name, runner count, top signal) is shown nowhere else |
| How it works | `landing.html` (inline) | `daily_pick_limit` | The copy now says six picks a day; keep it tied to the variable |
| Challenges | `components/challenges_section.html` | `top_challengers`, `big_race` | 7 branches. The filled state is now designed (`partials/challenges-filled.html`), standings rows included |
| Syndicates, Track record, final CTA | `landing.html` (inline) | `top_syndicates_landing`, results context | Restored in PR 7, still in the pre-redesign look |
| Footer | `templates/partials/footer.html` | `site_contact`, `user.is_authenticated` | Signed-in nav and footer are in `partials/signed-in-chrome.html`. Use `{% url %}`, not the absolute URLs used here |

## Things that will bite

- **Absolute URLs.** Every link here points at `https://www.saturday-racing.com/...`
  because the sandbox has no URL resolver. In Django they are `{% url %}`
  tags. `docs/content-notes.md` lists the ones that were wrong.
- **`chrome.css` is site-wide.** The nav and footer restyle lands on all
  141 templates that extend the base, not just this page. It has only been
  looked at on the landing page so far: check three or four other page
  types before it ships.
- **The nav gap fix belongs on production regardless** of this port: between
  901px and 1024px the live site currently shows no navigation at all
  (PR 4).
- **`collectstatic` reads `url()` inside comments.** That is what broke the
  deploy before (PR 1); `npm run check` now catches it.
- **Sample data is sample data.** Every horse, price and count here is
  invented. `docs/content-notes.md` says which numbers have no field behind
  them at all.
- **Images were resized to twice their painted size** (PR 2). If a section
  is used bigger anywhere else, re-export rather than upscale.

## What to check when a section is ported

Run the same checks against the Django page that this repo runs against the
snapshot:

- Every feature at 375, 768, 1024 and 1440px (`tests/features.spec.js` is
  the list).
- axe with no new violations (`docs/accessibility-notes.md` records the one
  open contrast decision).
- The section against `states.html` for each branch it can take.
