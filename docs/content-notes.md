# Content notes

What the sample content on the page means, and the decisions it still needs
from you. The page is a snapshot, so every number and horse name here is
sample data — but it now at least agrees with itself.

## Made consistent

| Was | Now |
| --- | --- |
| The Fox picked Dark Cloud Rising in the hero and day hub, but Illinois on the battle card | Dark Cloud Rising at 7/2 everywhere. Illinois stays in the AI Chamber, where it belongs: it is Gemini's pick, and the section is about the models disagreeing |
| "34 races" in the strip, 26 in the day hub | 26, which is what the day hub actually lists across four meetings |
| Market intelligence listed Goodwood and Ffos Las runners | The same horses at this page's own meetings: Musselburgh, Lingfield (AW), Bellewstown, Stratford |
| "Pick as many or as few races as you like" | "Pick up to six races a day", which is the real limit (`daily_pick_limit` in `public/views/landing.py`) |
| The Saturday Featured callout repeated "Every race you pick" | "Saturday's featured race", so the three callouts name three different scopes |
| A shelf card read "Dummy · preview copy" | Ordinary sample meta, like the cards beside it |
| "MR FOX • AI TIPSTER" on the hero portrait | "MR FOX • TIPSTER". House rule: Mr Fox's own surfaces do not carry AI model badges |

## Links

Fixed: the Join button pointed at `/accounts/signup/`, which does not exist
(it is `/members/register/`); Bet of the Day pointed at Mr Fox's profile
rather than its own page; the AI Chamber, AI Lab and Market movers links
were page-relative anchors, which break everywhere except this page, since
the footer is site-wide.

Restored: **Responsible Gambling**, which the redesign dropped, and
**BeGambleAware.org** in the legal text, which became plain words. Both are
compliance links.

Removed, because the live site has no such page and its own footer has
never linked to one: **Terms**, **Cookies**, **Racecourses**.

## Sample data added in the production sync

These are the sample values behind sections that came back from
production, where the snapshot had nothing to show them with. None has
a real source.

- **Market intelligence:** "Updated 12 minutes ago · 18 steamers · 14
  drifters". The narrative and underdog watch are what production's view
  writes for this page's own steamers.
- **Day hub:** the Portobello Cup's class ("3").
- **Syndicates:** The Friday Night Pack (5), Musselburgh Regulars (4), The
  Early Doors Club (3).
- **Build-up News:** Chapman's Peak's withdrawal (the non-runner the ticker
  already reports), the Musselburgh going and a jockey booking.
- **Track record:** three past results.
- **Signed in (`states.html`):** Rosie M, 2 of 6 picks used, Vegasmile as
  her last winner.

## Decided in the production port

- **Shelf cards:** the shelf shows the four cards the service builds; the
  two sample-only cards are gone.
- **AI Chamber confidence scores:** dropped, since there is no field behind
  them.
- **GB / IRE labels on meetings:** dropped. Course buttons show race counts.
- **The hero's "Latest News" card:** shows the featured race's first
  build-up headline, or the Fox's Wire line when there is none.
- **Market intelligence with no moves:** the section is hidden.

## Decisions for you

1. **Terms and Cookies.** Most sites this size have both, and the site has
   only a Privacy page. Either they get written and the footer links come
   back, or the site stands on Privacy alone. Tell me which and I will
   wire it up.
2. **Racecourses.** The redesign invented this link. If you want the page,
   it needs a source; if not, nothing more to do.
