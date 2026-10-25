# The Enclosure: the pages, what you may change, and how it goes back

The Enclosure is the phone app a corporate client's guests use on their
race day at Saturday Racing. A company books a day at the races; each
guest gets an invitation, signs in, and adds the Enclosure to their home
screen. On the day it gives them the card, a Corporate Cup to play
(1,000 pretend credits each, a pick per race, a leaderboard and awards),
a feed of results, notes and photos from the room, and, for the host,
the Steward's Room. One live example, a public showcase day:
<https://www.saturday-racing.com/enclosure/jdl-consultants-bath-day/>.

Like Fox Signals, the Enclosure was built in the Django site and copied
here, not the other way round. The pages under `enclosure/` are the
markup the Django templates produce, under the same stylesheets and
scripts, byte for byte. Your work here is copied back into the Django
site when it is done.

Run the sandbox (`npm install`, `npm run serve`) and open
<http://localhost:8080/enclosure/>. It is a phone app: work at 375px
first (Chrome DevTools' device toolbar, Ctrl+Shift+M).

## The scenarios

Every page is one race day: Bath, Tuesday 29 September 2026, nine races
from 14:02 to 18:07. The client is Hartwell & Penn, the host is Ruth
Calder, and there are eleven guests. Each scenario is a folder, with the
clock stopped at one moment of the day:

| Folder | Clock | Seen as | What it shows |
| --- | --- | --- | --- |
| `enclosure/morning/` | 12:40 | Priya Shah, a guest | before the first race: picks made, every race open |
| `enclosure/race-day/` | 16:20 | Priya | mid-card: five races settled, the 16:35 next off, the last three open. **Start here** |
| `enclosure/day-done/` | 19:05 | Priya | after the last race: all settled, awards given, the day closed |
| `enclosure/steward/` | 16:20 | Ruth, the host | the Steward's Room in place of Home, the host's view of every tab |
| `enclosure/visitor/` | 19:05 | nobody signed in | a public showcase day, as the JDL page above is seen; and the sign-in page |

Every folder has the same pages:

| Page | What it is | Django template (`enclosure/templates/enclosure/`) |
| --- | --- | --- |
| every page | top bar, bottom nav, camera button and its sheet, the sheets behind the avatar and the "Saturday Racing production" strip, the install prompt, the photo viewer | `base.html`, `_topbar.html`, `_bottomnav.html`, `_note_sheet.html`, `_avatar_sheet.html`, `_maker_mark.html`, `_about_sheet.html`, `_install_nudge.html`, `_lightbox.html` |
| `index.html` | Home: the next race, the three tiles (Next, Cup, Recap), the latest of the feed | `home.html`, `_home_content.html` |
| `card.html` | the Card: the day's nine races | `card.html` |
| `race-1.html` … `race-9.html` | one race: header, your pick and stake, LLaMa's predicted 1-2-3-4, the field | `card_detail.html`, `_card_race_head.html`, `_card_pick_bar.html`, `_card_letter_panel.html`, `_card_field.html`, `_card_runner_tile.html` |
| `feed.html`, `feed-racing.html`, `feed-comments.html`, `feed-photos.html` | the Feed and its three filters | `feed.html`, `_feed_stream.html`, `_feed_item.html` |
| `cup.html` | the Corporate Cup: your balance and place, your picks, the Standings | `cup.html`, `_cup_hero.html`, `_cup_progress.html`, `_cup_picks.html`, `_cup_board.html` |
| `me.html` | your own page: picks, posts, awards | `me.html`, `_me_pick_row.html` |
| `guest-N.html` | another guest's picks, from a name on the Standings | `guest_profile.html` |
| `steward.html` | the Steward's Room (steward folder only) | `steward.html` |
| `signin.html` | sign in without leaving the app (visitor folder only) | `signin.html` |

The templates are copied to `docs/enclosure-templates/` so you can read
them: they show the states no scenario reaches (an abandoned race, a
non-runner, a guest who has made no picks at all). Nothing uses them, and
they are not copied back.

## What is real and what is a stand-in

- **Real:** the card. Nine races at Bath on 29 September 2026, recorded
  from the live site (`fixtures/enclosure-day.json`): names, distances,
  going, prize money, every runner with jockey, trainer, form, ratings,
  silks and price, the finishing order, and LLaMa's read on eight races.
- **Made up, the same on every build:** Hartwell & Penn and everyone in
  the room, their picks and stakes, their notes, and the host's
  briefings. Horses' ages and weights (not shown on any page).
- **Drawn stand-ins:** the photos in the Feed (`enclosure/media/`). They
  say "Stand-in photo" on them. Real guests' photos are phone pictures,
  usually 4:3 landscape or 3:4 portrait: design for both.
- **Silks** load from the silks service on the internet
  (`silks.theracingapi.com`), as on the site. Offline, the tiles show an
  empty circle.

## What works here, and how

The app is live on the day: Home, the Feed, the Cup and each open race
ask the server for news every 30 seconds, and a guest sends picks, notes
and photos. Here, each of those has a recorded answer saved beside the
page, so the scripts run exactly as they do on the site:

- **Polls** (`data-live-endpoint`) answer from `<page>.live.json`. The
  clock is stopped, so the answer is the page as it is: nothing moves.
- **A pick** (`race-N.pick.json`): tap a horse, choose a stake, confirm.
  The answer is always the same pick, **the favourite for 50 credits**,
  whichever horse you tapped. On a race that is off, or as the host or a
  visitor, the answer is the refusal the site gives ("picks are locked",
  "Only invited guests can place picks").
- **A note or a photo** (the camera button; `note.json`, `photo.json`):
  the answer is the Feed with one new note ("Who else is on the favourite
  in the next?") or photo ("Your photo here"), whatever you wrote.
- **A host's briefing** (`steward/briefing.json`) answers as the site
  does.
- **Signing in or out** goes to the visitor's pages; nothing is checked.

`npm run serve` is enough for all of it. Any static server works for
these pages, but use `npm run serve` for the rest of the sandbox.

## What you may change

| What | Where |
| --- | --- |
| The look of every tab | `static/enclosure/css/*.css` (one per tab, plus `shell.css` for the frame and `tokens.css`) |
| Behaviour | `static/enclosure/js/*.js` |
| Icons | `static/enclosure/icons/` (the home-screen icons: keep the sizes) |
| Markup | the pages, **with a note in the PR** (see "How it goes back") |

Things to know before you start:

- **`tokens.css` is the system.** Sage is the main accent, cream the
  ground, claret for a lost pick, and **gold is for the host only**,
  never on a guest's screen. It is one light, daytime look on purpose:
  there is no dark mode. If the revamp changes any of that, say so in
  the PR, it is a decision for Vas.
- **It is a phone app first.** The frame stops growing at 640px
  (`--enc-max-w`) and sits in the middle of a wider screen. The tests
  run at 375, 768, 1024 and 1440: nothing may run off the side at any
  of them.
- **The breakpoints are the Enclosure's own.** The rest of the sandbox
  uses 768/1024/1280; the Enclosure's CSS has 359px and 480px.
  `npm run check` lists these as known. A new breakpoint fails the
  check: if it is right, add it with `npm run check -- --update` and say
  why in the PR.
- The pages are built, not written: `tools/build-enclosure.py` writes
  every one of them from the Django site and would overwrite your edits
  if it ran. It is Vas's to run, after your work has gone back.

## The hooks the scripts need

Restyle anything; keep these. The tests (`tests/enclosure.spec.js`) hold
on to them.

**Every page**

- `.enc-shell` wraps the page; `main#enc-main` holds the tab, with
  `data-active-tab`.
- The bottom nav is `nav[aria-label="Primary"]`; each tab link carries
  `data-tab` (`home`, `card`, `feed`, `cup`, or `steward` for the host)
  and the current one has the class `is-active`.
- The camera button is `[data-role="note-open"]` with
  `aria-controls="enc-note-sheet"`. The sheet `#enc-note-sheet` carries
  `data-note-endpoint`, `data-photo-endpoint`, `data-race-id` and
  `data-filter`; inside it `[data-role="mode"][data-mode="note|photo"]`
  switch between the two forms (`[data-mode-form]`), and
  `[data-role="text"]`, `[data-role="count"]`, `[data-role="error"]`,
  `[data-role="close"]` do what they say (`note_sheet.js`).
- The avatar is `[data-role="avatar-open"]` (`avatar_sheet.js`), the
  "Saturday Racing production" strip `[data-role="mark-open"]`
  (`maker_mark.js`). Each sheet closes on its `[data-role="close"]`.
- The install prompt (`install_nudge.js`): `[data-role="install"]`,
  `[data-role="dismiss"]`, `[data-role="ios"]`; it remembers a dismissal
  in the browser for 14 days (`data-storage-key`, `data-cooldown-days`).
- A photo in the Feed opens with `[data-role="photo-lightbox"]`
  (`data-photo-src`, `data-photo-caption`) into
  `[data-role="lightbox-img"]` and `[data-role="lightbox-caption"]`.

**Home** (`home_live.js`): `.enc-home` with `data-live-endpoint` and
`data-post-meeting`; `[data-role="home-content"]` is what the poll
replaces; `[data-role="poll-meta"]` is the paused chip.

**A race** (`card_detail.js`): `.enc-card-detail` with
`data-live-endpoint`, `data-pick-endpoint`, `data-can-post`,
`data-stop-flag`; the poll replaces `[data-role="head"]`,
`[data-role="pick"]`, `[data-role="letter"]` and `[data-role="field"]`.
Each horse is a `[data-role="runner"]` button with `data-horse-name`,
`data-runner-number` and `aria-pressed`; the pick form is
`[data-role="pick-form"]` with `[data-role="horse-input"]`,
`[data-role="stake"]`, `[data-role="submit"]`, `[data-role="status"]`,
`[data-role="empty-title"]`. The chevrons are `[data-role="race-prev"]`
and `[data-role="race-next"]`.

**The Feed** (`feed_live.js`): `data-live-endpoint` and `data-filter` on
the feed; `[data-role="stream"]` is what the poll and a new post
replace; `[data-role="poll-meta"]` the paused chip. The filters are
links in `nav[aria-label="Filter feed"]`, the current one with
`aria-current="true"`.

**The Cup** (`cup_live.js`): `data-live-endpoint` and `data-all-settled`;
the poll replaces `[data-role="cup-hero"]`, `[data-role="cup-progress"]`,
`[data-role="cup-picks"]` and `[data-role="cup-board"]`.

**The Steward's Room** (`steward_briefing.js`): the briefing form
carries `data-endpoint`.

## How it goes back

The stylesheets, scripts and icons are kept **byte for byte** the same
as the Django site's (`enclosure/static/enclosure/…` there,
`static/enclosure/…` here, same file names). A change to them goes back
by copying the file.

The pages do not go back: they are output, written by the templates in
the table above, and there are 137 of them. So:

- Make a change to **structure** on the `race-day` pages (all of them,
  if the change is on every page, such as the nav), so it can be seen
  and tested here. You do not need to repeat it in the other folders.
- List each structural change in the PR under **"STRUCTURAL"**: which
  page, which part, what moved or what is new. It is made again in the
  template, then the pages are rebuilt.
- New text the app shows (a label, an empty state) is structure too.
- If a change needs something the server does not send today (a new
  number, a new state), say so under STRUCTURAL: it is new Django work,
  and Vas decides on it.

## Where it stands: what is already known to be wrong

Found while building this sandbox. All of them are on the live site
today, and all are here, because these pages are the site's.

- **"Paused · tap to resume" always shows** on the Feed, even while it is
  polling and after the day is done. `.enc-feed__meta { display: flex }`
  in `feed.css` beats the `hidden` attribute the script sets.
- **The stake label runs together**: "STAKEBALANCE 780" on an open race.
  The label is a `<legend>` laid out with `display: flex`, which a legend
  does not honour.
- **A visitor is told they are the host.** The Cup's preview panel says
  "You're viewing this event as a Steward" to anyone without a seat,
  including a visitor who is not signed in (`visitor/cup.html`). The
  template has one panel for both (`_cup_hero.html`); a visitor needs
  its own words.
- **The bell in the top bar goes nowhere** (`href="#notifications"`).
  There are no notifications yet; the revamp can drop it or make it a
  placeholder that says so.
- **A winning pick at short odds shows as lost** in "Your picks" on the
  Cup, on Me and on a guest's page: Divide And Conquer at 2/7 is "LOST
  −100" though it won, and every winner's profit is shown short by the
  stake (Oman, 50 at 13/2, shows +275, not +325). This is a server bug,
  not a design one, and not yours to fix; when it is fixed in the Django
  site these pages are rebuilt. Design for a win being a win.
- **"Wooden Spoon awarded" lands in the Feed in the middle of the day**,
  after any race, not once at the end. Also server-side.
- **The last race's winner reads "Jeewan (A) (A)"** in the Feed: the
  Arabian-bred "(A)" is doubled in the results data. Server-side too.
- **Race names come in the racing data's capitals**: "Jdl Consultants Ltd
  Apprentice Handicap Stakes", "Sw Hire", "Carbonnetzero". They are long
  (up to 106 characters), and the Card and race header must take them.

Questions about the product rather than the design go to Vas.
