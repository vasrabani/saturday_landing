# Image provenance

Recorded before the WebP conversion, which strips embedded metadata.

Nine images carry a C2PA manifest naming OpenAI as the generator, with the
assertion `trainedAlgorithmicMedia`: they were produced by an image model, not
photographed. The contractor supplied them. Two things follow: if the site ever
needs to disclose AI-generated imagery, this is the list, and their licensing
rests on the generator terms rather than a stock licence.

| Image | Original | Size | AI-generated |
| --- | --- | --- | --- |
| `day-hub-bg.png` | 3324x1618 | 4000 KB | No tag |
| `mi-steam-bg.png` | 1404x1120 | 2313 KB | Yes (OpenAI C2PA) |
| `hero-fold-bg.png` | 1254x1254 | 1906 KB | Yes (OpenAI C2PA) |
| `rivalry-pack-card-bg.png` | 1189x1323 | 1850 KB | Yes (OpenAI C2PA) |
| `ai-chamber/chamber-bg.png` | 1536x1024 | 1829 KB | Yes (OpenAI C2PA) |
| `den/fox-avatar.png` | 1225x1284 | 1720 KB | Yes (OpenAI C2PA) |
| `rivalry-fox-card-bg.png` | 1402x1122 | 1662 KB | Yes (OpenAI C2PA) |
| `den/shield-fox.png` | 1333x1180 | 1633 KB | Yes (OpenAI C2PA) |
| `next-off-bg.png` | 1535x1025 | 1581 KB | Yes (OpenAI C2PA) |
| `fox-card-bg.png` | 1377x1142 | 1510 KB | Yes (OpenAI C2PA) |
| `picks-fox-card-bg-bleed.png` | 1490x791 | 1461 KB | No tag |
| `race-of-the-day-bg-bleed.png` | 1378x971 | 1392 KB | No tag |
| `mr_fox_host.png` | 720x1080 | 1178 KB | No tag |
| `the_pack.png` | 720x859 | 1148 KB | No tag |
| `footer/footer-bg.png` | 1652x871 | 931 KB | No tag |
| `picks-cubs-card-bg-bleed.png` | 1490x791 | 874 KB | No tag |
| `the_pack-sm.png` | 340x406 | 267 KB | No tag |
| `mr_fox_host-sm.png` | 340x510 | 258 KB | No tag |
| `saturday-draw/draw-bg.jpg` | 1920x1080 | 102 KB | No tag |
| `challenges/challenges-bg.jpg` | 1920x1080 | 42 KB | No tag |
| `fox-title-underline.png` | 560x49 | 18 KB | No tag |
| `nav-active-underline.png` | 560x70 | 14 KB | No tag |
| `course-horse.png` | 160x106 | 10 KB | No tag |
| `how-it-works/icon-trophy-card.png` | 21x21 | 1 KB | No tag |

## The Fox Trail (`static/grid/img/`)

Nothing here is a photograph or the output of an image model.

| Image | Size | Where it came from |
| --- | --- | --- |
| `turf.webp`, `lawn.webp` | 192x192, 29 KB each | Grass tiles drawn by a script (noise and mowing bands, made to repeat without a seam). They paint at 96px, so this is the 2× size |
| `silk-*.svg` (8), `horseshoe.svg` | under 1 KB each | Drawn by hand as paths, for use as CSS masks |
| `fox.svg` | under 1 KB | The fox mark from the footer (`static/public/img/footer/icon-fox.svg`), redrawn as a mask so the trail's stylesheet needs no file outside its own folder |

## The meeting page

- `static/meeting/img/masthead.webp` is a copy of `hero-fold-bg.webp`
  above (AI-generated, OpenAI C2PA), so the page's stylesheet points
  inside its own folder; nothing new was generated.
- `static/meeting/img/icons/*.svg` are 22 line icons drawn for the
  prototype (most after the Feather set; the winning post, the horseshoe
  and the jockey's cap are the page's own), under 1 KB each.
- `static/meeting/img/silks/*.svg` are the 152 jockeys' silks the two
  captured pages show, exactly as `silks.theracingapi.com` served them on
  9 and 10 October 2026 (the largest is 132 KB; the service does not
  optimise them). They are the live page's images, copied so the sandbox
  works offline; the template keeps loading them from the service.

## The day's races (`static/browse/img/`)

- `masthead.webp` is the homepage's Steam of the Day picture,
  `mi-steam-bg` above (AI-generated, OpenAI C2PA), enlarged to twice its
  size (2688 x 2144, 293 KB) with Real-ESRGAN (`x4plus`) so it stays
  sharp across a wide screen. That is a machine upscale of the same
  picture: nothing was added to it.
- `horse.svg` is the course horse (`course-horse.webp` above) traced as
  one path, in the brand gold: the reveal track's horse and the footer's.
- `icons/*.svg` are 11 line icons, under 1 KB each: the eye, arrow,
  check and stars the meeting page has, the paw from the footer
  (`static/public/img/footer/icon-paw.svg`) redrawn as a mask, and the
  rest from the Feather set.
