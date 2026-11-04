# The Fox's Wire: the redesign, and the contract it keeps

The pages: `news/index.html`, the five articles it leads with under
`news/article/2026/`, and the six LLaMa Letters for Ascot under
`letters/ascot-2026-10-31/`, live at <https://www.saturday-racing.com/news/>,
`/news/article/…` and `/letters/…`. Run the sandbox and open
<http://localhost:8080/news/>: the morning of Saturday 31 October 2026,
before the first race.

The design is the prototype at <https://saturday-racing-news-prototype.vercel.app/>,
built from captures of those pages that morning; this is that design in
the site's own shell (its head, nav, footer and scripts, as every page
here has them), with the search and the 10:00 Card talking to the server.

## What the page is for

The day's racing news in one place, read top to bottom like a paper:
the day's lead story and the LLaMa Letters beside it, then the desks'
work in numbered sections, the price moves, the record, and the morning
email to sign up for. From it a reader goes to a story, a racecard or a
desk's archive.

The live page is the news app's index template with its own stylesheet,
`news/css/paper.css` ("The Fox's Wire · /news/ broadsheet redesign": dark
cinematic editorial, Georgia body). This redesign replaces that
stylesheet and the index's markup; the article and letter templates get
the same treatment.

## What the redesign did

A front page in the format of a national news site, in Saturday Racing's
own theme. Upright type only: no italic anywhere, from the copy, a
browser default or a synthesised slant.

| Part | What it is |
| --- | --- |
| The bar | The site's nav, first on the page, on the Enclosure's glowing midnight: cream links, the slanted gold tab on News, a search button, Join Free and Login. On a narrow screen the links scroll sideways under a finger instead of folding into the menu button |
| The logo band | The winning post and the gold serif wordmark, centred under the bar. On every news page |
| The masthead | Front page only: the 10:00 stamp in its corner (its legend turns slowly), the title, the tagline, the date line with the volume and number, and the next race off |
| Top stories | The lead in the middle, with the LLaMa Letters in the columns either side |
| Desk pills | LLaMa Letters, Bet of the Day and the Fox Trail, each with its desk's portrait |
| §1 The Lead | The day's Horses to Watch: headline and deck, then the five horses as a rail of silks |
| §2 The Case Files | The live page's four case cards |
| §3 The Pin | The Fox's race of the week on a midnight band, its picture framed in gold |
| §4 The Fold | The three long reads in equal columns |
| §5 The Back Issues | Older editions by desk, in five ruled columns |
| §6 Market Movers | The price board: coming in and drifting, old prices struck through |
| §7 The Honest Record | The pledge as a large quote, and the three figures as cards with a gold top rule |
| The 10:00 Card | Last, on a midnight band that runs straight into the footer |
| Articles and letters | The story's head across the page; the text in a column of up to 720px with a 320px column of boxes beside it, which drops under the text on narrower screens; then "More from The Fox's Wire" |

Section heads are the site's own (`pp-eyebrow` on the live page): a gold
§ number, a spaced name, a hairline and the live page's note. Headlines
are Playfair Display, everything else DM Sans, as on the rest of the
site. Every word comes from the capture; the redesign invents no copy
beyond the few lines in `content-notes.md`.

## The nav and the footer on these pages

They are the site's own, markup and scripts unchanged: `base.html`'s nav
and footer, as every page here carries them, driven by `site.js`.
`wire.css` restyles them on these pages only (everything hangs off
`body.page-wire`):

- **The bar.** Midnight with the Enclosure's gold line and glow under
  it. The brand moves down into the logo band. The links show at every
  width and scroll sideways when they do not fit, so the menu button,
  the race badge and the date stand down (the masthead has the date).
  On a phone, search and Login stay at the right; Join Free gives way.
- **The menus.** The site's own, opening under their own item; on a
  desktop they also open on hover, and the item runs the bar's full
  height so the pointer stays on it on the way down. Inside the
  scrolling row a menu placed where `chrome.css` puts it would be
  clipped, so `wire.css` fixes it under the bar and `wire_nav.js` sets
  its left edge. `site.js` still opens and closes them.
- **The footer.** Lined up with the Wire's columns. Under the 10:00 Card
  it joins the band, the band's gold line as the seam. Its winning post's
  S stands upright, under the no-italics rule.

`site.js` still measures the bar and adds `site-nav--compact` when the
row does not fit; on these pages nothing reads that class.

## Connecting to the server

Two things on the page talk to the server. `tools/serve.mjs` answers
both in the sandbox, as the Django views should.

**Search** (`wire_search.js`). The search button in the bar opens a
panel; as the reader types, it asks:

```
GET /news/search/?q=ascot
200 {"query": "ascot",
     "results": [{"title": "…", "desk": "LLaMa Letters", "when": "12:50 Ascot",
                  "url": "/letters/ascot-2026-10-31/1250/"}, …]}
```

Up to 12 stories whose title, summary, desk or date contain what was
typed. `desk` and `when` are shown under the title, joined by a dot;
`when` may be empty. The panel's endpoint is its `data-wire-search-url`
(the template's `{% url %}`). In the sandbox the stories are
`fixtures/news-search.json`, answered in the order the front page lists
them; in Django the view searches the published articles and letters,
newest first.

**The 10:00 Card** (`wire_card.js`). The form is a normal POST with
Django's CSRF token, so it works without the script:

```
POST /news/card/subscribe/        email=…&csrfmiddlewaretoken=…
Accept: application/json  →  200 {"ok": true, "message": "…"}
                             400 {"ok": false, "error": "…"}
otherwise                 →  303 to /news/#card
```

With the script, the form goes in the background, the button waits, and
the status line under the form (a polite live region) shows `message` or
`error` as the server words them. The browser checks the address first
(`type="email"`, `required`). The live page's form does nothing today
(`action="#"`, `onsubmit="return false;"`); this needs a view, a model or
a mailing-list call, and a decision on double opt-in.

## The contract: what the scripts need

| Script | Reads | Writes |
| --- | --- | --- |
| `wire_nav.js` | `.page-wire .site-nav__dropdown`, its `.site-nav__dropdown-trigger` and `.site-nav__dropdown-menu`; `.site-nav__links` | `--wire-menu-left` on a menu |
| `wire_search.js` | `[data-wire-search-open]`; `#wire-search` with `data-wire-search-url`, an `input[type="search"]` and `[data-wire-search-results]` (with `data-wire-none` and `data-wire-offline`); `[data-wire-search-close]` | `wire-search-open` on `<html>`; `aria-expanded` on the button; `inert` on the rest of `<body>`; the results list |
| `wire_rail.js` | `[data-wire-rail]` with `.wire-rail__track`, `.wire-rail__arrow--prev` and `--next` | `hidden` on the arrows |
| `wire_time.js` | `time[data-wire-ago][datetime]` | the time's text, for the past week |
| `wire_card.js` | `form[data-wire-card]` (its `action`, an `email` field, a submit button); `[data-wire-card-status]` beside it (with `data-wire-offline`) | the status line's text and `data-state`; the button's `disabled` |

Each script is on its own and does nothing if its hooks are missing.
They load with `defer` after `site.js`. All the wording they show lives
in the markup or comes from the server.

## Branches the capture did not catch

The pages are one morning's capture, so some of what the templates can
render is not shown here. Each needs a decision in the port:

- **No Deep Dive.** The lead is the day's Deep Dive, from the feed (the
  live page had dropped its Fox's Eye block that morning). Without one,
  the next story by time should take the slot.
- **Fewer than six letters,** or none (a day without a LLaMa meeting):
  the columns either side take what there is; with none, the lead can
  run across all three.
- **Nothing has moved yet.** §6 should say so, as the homepage's market
  section does, or be left out with the sections after it renumbered.
- **No race of the week** for §3, and **no long read** for a column of
  §4: leave the section, or the column, out.
- **A signed-in reader:** the bar's Login becomes the site's own account
  items; the Card could say the reader's address is already on the list.

## Budgets and standards

- **Checks.** `npm run check` covers the twelve pages and `static/wire/`
  like every other page: no `!important`, no colour typed out where a
  `base.css` variable holds it, media queries only at 767, 1023 and
  1279px, every font loaded, every reference found.
- **Tests.** `tests/news.spec.js` at 375, 768, 1024 and 1440px: every
  page loads with no script error or failed request, does not scroll
  sideways and asks no other server; the header, the nav's links and
  menus, the section order, the bands and the seam, the rail, the times,
  search and the Card, both against the sandbox server and with it
  failing. `tests/a11y.spec.js` scans the front page, an article and a
  letter with axe: none of them has a known violation.
- **Pictures.** WebP at their painted size, the largest 73 KB
  (`image-provenance.md`).

## Running it

```bash
npm run serve                                  # http://localhost:8080/news/
npx playwright test tests/news.spec.js         # the Wire's tests
npm run check
```

## Trade-offs, made knowingly

- **Breakpoints on the site's scale.** The prototype switched layouts at
  1239, 1007, 759 and 639px; here they are 1279, 1023 and 767, the
  site's own. So between 640 and 767px a phone's single column shows
  where the prototype had two, and from 1240 to 1279px the tablet
  layout. At 320, 375, 768, 1024, 1280, 1440 and 1920px every element
  of the masthead and the content measures the same as on the
  prototype.
- **The sandbox's nav.** The bar is the sandbox's copy of the site's
  nav, older than the live one: it says Login where the live site says
  Sign in, and has no Ask Fox in the Mr Fox menu. Its menus are the
  site's, with their icons and the day's counts, where the prototype's
  were text only. The bar is the site's 60px, 4px taller than the
  prototype's.
- **The tour strip.** The site's "New to Saturday Racing?" strip shows
  here, as on every page, until a reader dismisses it.
- **One colour.** The rail's rank labels use the deeper gold (4.8:1) the
  page uses for small gold text; the prototype's lighter gold was 3.99:1
  at that size.
