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
