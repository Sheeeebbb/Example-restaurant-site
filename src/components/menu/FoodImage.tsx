import Image from "next/image";

/**
 * A menu photograph.
 *
 * `src` is expected to be the output of `resolvePhoto()` — a real path, or null.
 * Resolving on the server means we never request a missing file, so there is no
 * broken-image flash and no 404 per card.
 *
 * Every dish on the menu has a photograph in `public/menu/`, and a test asserts
 * it (`photos.test.ts`), so the null branch is a safety net rather than a
 * design: it renders nothing and leaves the frame its own background, because
 * an icon standing in for a dish is worse than an empty frame — it tells the
 * customer the kitchen serves a drawing. Run `npm run photos:check` for
 * coverage; the brief for each frame lives in `lib/data/photography.ts`.
 */
export function FoodImage({
  src,
  alt,
  sizes,
  priority = false,
  className = "",
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      /*
       * Above-the-fold photographs are fetched eagerly; everything below is
       * lazy, so a twenty-six card menu does not pull twenty-six photographs
       * before the customer has scrolled.
       */
      loading={priority ? undefined : "lazy"}
      /*
       * `object-cover` with a fixed aspect-ratio frame is what stops a
       * portrait shot from being squashed into a landscape card — it crops
       * instead of distorting. `object-center` keeps the crop on the dish,
       * which the house style centres in frame.
       */
      className={`object-cover object-center ${className}`}
    />
  );
}
