# Menu photography

Dish photographs live in this folder. **These are temporary stock photographs,
not Urban Table's own.** They are here so the site can be judged with real food
in it; every one of them is meant to be replaced by a proper shoot.

Current state: **26 of 26 images present** (`npm run photos:check`).

## Where they came from

Every file was sourced through [Openverse](https://openverse.org), which
aggregates openly-licensed images and carries the licence, author and origin for
each one. Only results filtered to *commercial use + modification permitted*
were considered. Twenty-three are CC0 (Rawpixel, StockSnap.io, the WordPress
Photo Directory), three are CC BY-SA from Wikimedia Commons.

The record of what each file is lives in `src/lib/data/photography.ts`, in the
`CREDITS` block: source, page URL, photographer, licence, and whether attribution
is required. That block is the only bookkeeping a swap needs.

Nothing was taken from a competitor's website, a delivery platform, Google
Images, or any watermarked source.

## What was done to them

Enhancement only, applied identically to all of them: exposure normalised toward
a common mean, gray-world white balance with a slight warm bias (~5200K), a
gentle saturation lift, restrained sharpening, a 4:3 crop at 1600×1200, JPEG
quality 78 (mozjpeg). No food was invented, added or removed, and nothing was
generated.

They still do not look like one session — they were shot by twenty-six different
people in twenty-six different rooms — which is exactly what the real shoot
fixes.

## Flagged for review

These are usable but imperfect. Replace them first.

| File | Why it is flagged |
| --- | --- |
| `halloumi-roasted-pepper.jpg` | Roasted peppers and rocket are clearly right; the cheese is not clearly identifiable as grilled halloumi. |
| `superfood-quinoa-bowl.jpg` | Quinoa and vegetables, but no roast sweet potato, kale or pomegranate. |
| `new-york-cheesecake.jpg` | Reads as cheesecake with berry compote, but set rather than dense-baked. |
| `slow-braised-beef-dip.jpg` | Braised beef sandwich, but no pot of dipping jus in frame. |
| `salted-caramel-brownie.jpg` | Fudgy brownies, no salted caramel visible. |
| `sweet-potato-fries.jpg` | Sweet potato fries, but no ramekin of chipotle mayo. |
| `buttermilk-slaw.jpg` | Creamy cabbage-and-carrot slaw, correct in substance; the source file is titled as a chain restaurant's slaw, though no branding is visible. |
| `double-smash-deluxe.jpg` | Two patties and cheese, but the grilled onion and pickles are not legible. |
| `urban-classic.jpg` | Beef patty and cheddar are right; the house pickles are not visible. |

## How to replace them

1. Name each file exactly as listed by `npm run photos:check`.
2. Drop the file into this folder. No code change is needed — `resolvePhoto()`
   finds it on the server and it replaces whatever was there.
3. Update its entry in the `CREDITS` block of `src/lib/data/photography.ts`.
   For Urban Table's own photography that is
   `source: "Urban Table"`, `licence: "© Urban Table — all rights reserved"`,
   `attributionRequired: false`.

Run `npm run photos:check` again to confirm 27/27.

## What each photograph must show

`src/lib/data/photography.ts` holds a brief per dish: the subject, the camera
angle, the ingredients that must be visible, and the ones that must **not** be.
That last list matters — paid extras like bacon or an extra patty must not
appear in a photograph of the standard dish, or the picture advertises something
the customer is not buying.

`HOUSE_STYLE` in the same file is the shoot specification: lighting, colour
temperature, background, depth of field, framing and finishing. Quote it to a
photographer or use it as a retouching brief. It is what makes twenty-six
separate photographs look like one session.

## Technical requirements

- **4:3**, at least 1200px wide. Cards and the product page both use a 4:3 frame
  with `object-cover`, so a different ratio will be cropped rather than
  distorted — but shooting to 4:3 keeps the composition you intended.
- Export as JPEG at quality ~80. Next.js converts to AVIF and WebP on demand;
  supplying an already-compressed WebP just costs quality.
- Keep files under ~400KB. `photos:check` flags anything larger.
- No watermarks, no third-party branding, no visible logos.

## Licensing

Only use photographs you have the right to publish:

- The restaurant's own photography (preferred).
- Stock under a licence permitting commercial web use, with the licence recorded
  in `photography.ts`. Where the licence requires attribution, set
  `attributionRequired: true` — the credit then renders under the photograph on
  the dish page and the image is listed under **Photography** on the About page.

Do **not** take images from competitor sites, delivery platforms, Google Images,
or any source whose licence you have not read.
