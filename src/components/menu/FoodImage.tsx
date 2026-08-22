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
 */
export function FoodImage({
  src,
  alt,
  categoryId,
  sizes,
  priority = false,
  className = "",
  glyphClassName = "h-14 w-14",
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
        className={`object-cover ${className}`}
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
      <FoodGlyph
        name={glyphForCategory(categoryId)}
        className={`relative ${glyphClassName} text-ink-subtle/40`}
      />
    </div>
  );
}
