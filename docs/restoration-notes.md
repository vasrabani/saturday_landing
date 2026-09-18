# Restoration notes

The redesign dropped a number of things the live page has. This records
what came back, and what still needs a designer rather than a developer.

## Restored

| Feature | Note |
| --- | --- |
| **Syndicates**, **Track record** and the closing **call to action** | Were commented out as `TEMP HIDDEN`. Their styles were still in `landing.css`, so they return working — but see the warning below |
| **The hero duel cards were not clickable** | `landing.js` makes each half a link through `data-picks-half-href`, including Enter and Space; the attribute went missing, so the hero's main panel did nothing at all |
| **"wins this season" had no number** | The design kept the slot and dropped the count, so both battle cards read "— wins this season". Filled, using `data-count-up` so the existing count-up animation picks them up |
| **Drifters showed the steamers again** | The tab only switched a colour, so the same shortening horses were presented as drifting. Drifters now have their own list |
| **Footer links** | Home, Pick, Syndicates, Pinsticker, The Experience and the account links (Sign in, Join free) all vanished in the redesign |

**Warning about the three restored sections:** they come back in the
pre-redesign look, because that is the markup and CSS that was commented
out. They work and they are accessible, but next to the new sections they
look like what they are — older. They want a visual pass in the redesign's
language. That is design work, not integration work.

## Not restored: these need a design decision

Each of these was on the live page and is not in the redesign. In every
case the CSS is still in the repo, so the work is deciding where it goes in
the new layout — which is the contractor's call, not something to guess at.

1. **Hero race strip** (`hf-cover-flag`): runners, declaration phase,
   prize, favourite, each-way terms, and a link to The Pin. The day hub's
   featured card now carries some of this, so the question is whether the
   hero needs it as well or the information moved on purpose.
2. **Pick 6 emblem** (`pick6`): a link into the Pick 6 challenge, gone from
   the hero. This is a navigation loss, not just decoration.
3. **Hero tab toggle** (`hero-tabs`): switched the hero between the big
   race and Bet of the Day (`?hero=big_race`), and carried the Bet of the
   Day pill. The new hero shows one state only.
4. **AI Lab terminal** (`ai-lab__terminal`): the simulation terminal, with
   slots for the big race name, runner count and top signal. The new AI Lab
   section makes its point differently, so this may be a deliberate cut —
   but the data it showed is now shown nowhere.

`landing-anim.js` still contains the typing animation for the terminal, so
if the terminal is not coming back, that code should go with it.
