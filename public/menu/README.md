# Menu photography

Dish photographs go in this folder. **Nothing here yet** — every card and
product page is currently rendering the fallback tile.

## How to add them

1. Name each file exactly as listed by `npm run photos:check`, which reports
   coverage and tells you what is still missing.
2. Drop the files into this folder. No code change is needed — `resolvePhoto()`
   finds them on the server and the real photograph replaces the fallback.
3. Record where each one came from in `src/lib/data/photography.ts`: fill in the
   `credit` field with source, licence and photographer. If the licence requires
   attribution, set `attributionRequired: true` and the credit renders under the
   photograph automatically.

Run `npm run photos:check` again to confirm 26/26.

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
- Export as JPEG at quality ~82. Next.js converts to AVIF and WebP on demand;
  supplying an already-compressed WebP just costs quality.
- Keep files under ~400KB. `photos:check` flags anything larger.
- No watermarks, no third-party branding, no visible logos.

## Licensing

Only use photographs you have the right to publish:

- The restaurant's own photography (preferred).
- Stock under a licence permitting commercial web use, with the licence recorded
  in `photography.ts`.

Do **not** take images from competitor sites, delivery platforms, Google Images,
or any source whose licence you have not read.
