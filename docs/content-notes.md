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

## Decisions for you

1. **Terms and Cookies.** Most sites this size have both, and the site has
   only a Privacy page. Either they get written and the footer links come
   back, or the site stands on Privacy alone. Tell me which and I will
   wire it up.
2. **Racecourses.** The redesign invented this link. If you want the page,
   it needs a source; if not, nothing more to do.
3. **Two shelf cards have no data behind them.** The editorial shelf
   service (`news/services/editorial_shelf.py`) builds four cards; the
   design shows six. The two extra ones — course notes and a market report
   — are sample content only. Either the service learns to build them, or
   the shelf shows four and the design flexes to fit.
4. **Per-model confidence scores in the AI Chamber** (Claude 91, ChatGPT
   54, Gemini 52) have no field in the app. They look good and they are a
   real feature to build, but until then they cannot be rendered.
5. **GB / IRE labels on meetings** in the day hub: meetings carry no
   country field today.
6. **A news headline in the hero** ("Latest News" card): there is no
   headline slot in the hero's data.
