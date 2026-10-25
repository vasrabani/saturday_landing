# The Enclosure: start here

You are revamping **the Enclosure**, the phone app a company's guests use
on their day at the races with Saturday Racing. This page gets you from
nothing to the app running on your machine in about five minutes, then
tells you where to work and how to hand it back.

The full design brief is **[`docs/enclosure-brief.md`](docs/enclosure-brief.md)**.
Read it once the app is running.

A live example of the app (a public showcase day, best viewed on a phone):
<https://www.saturday-racing.com/enclosure/jdl-consultants-bath-day/>

---

## 1. What you need

- **Git**
- **Node.js 20** (18 or later works; `.nvmrc` says 20). Check with `node -v`.
- **Google Chrome** (for viewing at phone size, and the tests use it)

There is no Python, database or Django setup. The app's pages are already
built and are in this repo.

## 2. Get the code

```bash
git clone https://github.com/vasrabani/saturday_landing.git
cd saturday_landing
npm ci
```

## 3. Run it

```bash
npm run serve
```

It prints `Serving on http://localhost:8080/`. Open:

**<http://localhost:8080/enclosure/>**

That page lists everything. Leave the terminal running while you work;
stop it with Ctrl+C.

If port 8080 is busy, pick another:

```bash
# macOS / Linux / Git Bash
PORT=8090 npm run serve
```

```powershell
# Windows PowerShell
$env:PORT=8090; npm run serve
```

Always use `npm run serve`. Opening the HTML files directly (`file://`)
does not work: the pages post picks and notes to the server and read
their live updates from it.

## 4. See it as a phone

It is a phone app. In Chrome, open DevTools (**F12**), switch on the
device toolbar (**Ctrl+Shift+M**, or **Cmd+Shift+M** on a Mac) and pick a
phone around 375px wide. Do your design work there first, then check
tablet and desktop widths.

## 5. What you are looking at

One real race day (Bath, 29 September 2026, nine races), with a made-up
client, Hartwell & Penn, and eleven made-up guests. The day is frozen at
five moments, one folder each:

| Open | Clock | You are | What it shows |
| --- | --- | --- | --- |
| [`enclosure/race-day/`](http://localhost:8080/enclosure/race-day/index.html) | 16:20 | Priya, a guest | mid-afternoon: five races done, four to go. **Start here** |
| [`enclosure/morning/`](http://localhost:8080/enclosure/morning/index.html) | 12:40 | Priya | before the first race |
| [`enclosure/day-done/`](http://localhost:8080/enclosure/day-done/index.html) | 19:05 | Priya | after the last race, prizes given |
| [`enclosure/steward/steward.html`](http://localhost:8080/enclosure/steward/steward.html) | 16:20 | Ruth, the host | the host's control room |
| [`enclosure/visitor/`](http://localhost:8080/enclosure/visitor/index.html) | 19:05 | not signed in | what a member of the public sees |

(The links work once `npm run serve` is running.)

Try these in **race-day**, at phone size:

1. **The bottom bar:** Home, Card, Feed, Cup.
2. **Card → race 8:** tap a horse, then **Confirm pick**. The pick and
   balance update. (The sandbox always answers with the same pick, the
   favourite for 50 credits, whichever horse you tap. That is expected.)
3. **The camera button** in the middle of the bar: write a note and post
   it. It appears at the top of the Feed.
4. **Feed:** the All / Racing / Comments / Photos filters; tap a photo.
5. **Cup:** your place, your picks, the Standings; tap a name.
6. **The circle at top right** (your silks), and the "Saturday Racing
   production" strip at the very top.

Nothing here talks to a real server, and nothing you do is saved. Reload
a page and it is back as it was.

## 6. Where to make your changes

| You are changing | Edit |
| --- | --- |
| The look of any screen | `static/enclosure/css/*.css` (`tokens.css` holds the colours, type and spacing) |
| Behaviour | `static/enclosure/js/*.js` |
| Home-screen icons | `static/enclosure/icons/` (keep the sizes) |
| Page structure (HTML) | the pages in `enclosure/race-day/` only. See below |

- **Structure changes:** make them in the `enclosure/race-day/` pages so
  they can be seen and tested, and list every one in your PR under a
  heading **STRUCTURAL** (which page, what moved, what is new). Vas
  rebuilds them into the real app. You do not need to copy them into the
  other four folders.
- **Do not run** `tools/build-enclosure.py` or
  `tools/harvest-enclosure.py`. They need the private Django site, and
  they would overwrite your HTML changes.
- **Do not edit** `static/css/`, `static/js/` or other pages of the
  sandbox for this work.
- The scripts find things on the page through `data-role` and other
  `data-*` attributes. Restyle freely, but keep those attributes.
  `docs/enclosure-brief.md` lists every one.

## 7. Check your work before a PR

The first time only:

```bash
npx playwright install chromium
```

Then, before every PR:

```bash
npm run check
npx playwright test tests/enclosure.spec.js
```

- `npm run check` takes seconds. It catches missing files, debug code,
  new `!important`s, new screen breakpoints and similar.
- The Enclosure tests take about 5 minutes. They check that every page
  loads without errors and does not scroll sideways at 375, 768, 1024 and
  1440px, and that picks, notes, the tabs, the filters and the Cup still
  work.

Both must pass. GitHub's automatic checks are not running on this repo
at the moment, so **paste the result of both commands into your PR**.

(`npm test` runs the whole sandbox, about 50 minutes. You do not need it
for Enclosure work.)

## 8. Hand it back

1. Make a branch: `git checkout -b enclosure/<what-it-is>`, for example
   `enclosure/cup-redesign`.
2. Keep each PR to one piece of work.
3. Push it and open a pull request against `main`. In the description:
   - what you changed and why;
   - screenshots at **375px** (before and after), and at one wide size;
   - the **STRUCTURAL** list, if you changed any HTML;
   - the output of `npm run check` and the Enclosure tests.

## 9. Things that look wrong but are not your bugs

The live app already has a few problems. They are listed at the end of
`docs/enclosure-brief.md` ("Where it stands") so you do not lose time on
them. The CSS ones (the "Paused" chip that always shows, the stake label
running together) are yours to fix as part of the revamp if you like.

## Questions

**Vas Rabani** · vasrabani@hotmail.co.uk, or on Upwork.
