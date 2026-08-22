import Image from "next/image";
import { FoodGlyph, glyphForCategory } from "./FoodGlyph";

/**
 * A menu photograph, or a designed stand-in when that photograph doesn't exist.
 *
 * `src` is expected to be the output of `resolvePhoto()` — a real path, or null.
 * Resolving on the server means we never request a missing file, so there is no
 * broken-image flash and no 404 per card.
 *
 * The placeholder is marked `aria-hidden` and carries no alt text: it depicts
 * nothing, and announcing "Classic cheeseburger" for a generic icon would
 * describe a photo that isn't there. The dish name sits next to it in the card
 * regardless.
 *
 * IT IS A FALLBACK, NOT THE DESIGN. Every dish has a photograph brief in
 * `lib/data/photography.ts`; the moment the matching file appears in
 * `public/menu/`, `resolvePhoto()` finds it and the real photograph renders
 * here instead, with no code change. Run `npm run photos:check` for coverage.
 */
export function FoodImage({
  src,
  alt,
  categoryId,
  sizes,
  priority = false,
  className = "",
  glyphClassName = "h-20 w-20",
}: {
  src: string | null;
  alt: string;
  categoryId: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  glyphClassName?: string;
}) {
  if (src) {
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

  return (
    <div
      aria-hidden="true"
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-sunken ${className}`}
    >
      {/* A single soft warm wash. Enough to make the frame feel composed rather
          than empty, without becoming a gradient in its own right. */}
      <span className="absolute inset-0 bg-[radial-gradient(115%_85%_at_50%_0%,var(--ember-soft),transparent_72%)]" />

      {/*
        The glyph sits on a ringed disc rather than floating loose in the frame.
        At the old size it read as a large empty box with a small mark in it —
        twenty-six of those in a grid look unfinished. Given a shape to occupy,
        the same tile reads as a deliberate category illustration until real
        photography replaces it.
      */}
      <span className="relative flex aspect-square w-[38%] max-w-32 items-center justify-center rounded-full border border-ember-border/60 bg-surface/45">
        <FoodGlyph
          name={glyphForCategory(categoryId)}
          className={`${glyphClassName} max-h-[58%] max-w-[58%] text-ember/45`}
        />
      </span>
    </div>
  );
}
