# Menu photography

One photograph per dish, plus the homepage hero. All twenty-seven are in this
folder — `npm run photos:check` reports coverage.

The files currently here are **licensed stock photography, retouched to the
house style**. They are stand-ins for a real shoot: every one is CC0 or a
comparable licence permitting commercial use and modification, and every one is
recorded in `src/lib/data/photography.ts` with its source, photographer and
licence.

## Replacing one with the restaurant's own photograph

1. Shoot or retouch to the spec below, and name the file exactly as the current
   one (`npm run photos:check` lists the names).
2. Drop it in this folder, replacing the stock file. **No code change is
   needed** — `resolvePhoto()` finds it on the server.
3. Update that dish's entry in `SOURCED` in `src/lib/data/photography.ts`:
   source `"Urban Table"`, the licence you hold it under, and
   `attributionRequired: false`. A credit only renders where the licence
   demands one, so removing a stock credit removes the line under the photo.

Run `npm run photos:check` again to confirm 27/27 and that nothing is oversized.

## What was done to the files here

Each source photograph was retouched to `HOUSE_STYLE`, and only corrected — no
dish was altered in what it shows, and nothing was added to or removed from a
plate:

- cropped to 4:3 around the dish, tightening the frame where the subject sat off
  centre or a distraction sat at the edge;
- white balance pulled toward the house neutral, damped so a genuinely warm dish
  stays warm;
- exposure normalised on percentile black and white points, then brought to a
  common brightness;
- contrast and saturation normalised to the same targets across the set — this
  is most of what makes twenty-seven photographs read as one shoot;
- colour noise smoothed, luminance detail left alone;
- a soft elliptical focus falloff toward the corners for the shallow depth of
  field the house style asks for;
- restrained unsharp mask, thresholded so flat areas are not sharpened into
  texture;
- exported at 1200x900, JPEG q82, metadata stripped.

## What each photograph must show

`src/lib/data/photography.ts` holds a brief per dish: the subject, the camera
angle, the ingredients that must be visible, and the ones that must **not** be.
That last list matters — paid extras like bacon or an extra patty must not
appear in a photograph of the standard dish, or the picture advertises something
the customer is not buying.

`HOUSE_STYLE` in the same file is the shoot specification: lighting, colour
temperature, background, depth of field, framing and finishing. Quote it to a
photographer or use it as a retouching brief. It is what makes twenty-seven
separate photographs look like one session.

## Technical requirements

- **4:3**, at least 1200px wide. Cards and the product page both use a 4:3 frame
  with `object-cover`, so a different ratio will be cropped rather than
  distorted — but shooting to 4:3 keeps the composition you intended. The files
  here are 1600×1200.
- Export as JPEG at quality ~82. Next.js converts to AVIF and WebP on demand;
  supplying an already-compressed WebP just costs quality.
- Keep files under ~400KB. `photos:check` flags anything larger.
- No watermarks, no third-party branding, no visible logos.

## Licensing

Only use photographs you have the right to publish:

- The restaurant's own photography (preferred).
- Stock under a licence permitting commercial web use **and modification** —
  these are retouched, so a no-derivatives licence is not usable. Record the
  licence in `photography.ts`.

Do **not** take images from competitor sites, delivery platforms, Google Images,
or any source whose licence you have not read.
