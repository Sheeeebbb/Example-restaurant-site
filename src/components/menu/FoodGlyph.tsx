/**
 * Line-art glyphs used by the image placeholder, one per menu category.
 *
 * These stand in for photography. They are deliberately quiet — thin strokes at
 * low contrast — so a card without a photo still reads as a considered piece of
 * design rather than a failed image load.
 */
export type GlyphName =
  | "burger"
  | "sandwich"
  | "salad"
  | "fries"
  | "dessert"
  | "drink";

/** Maps a category id to its glyph, falling back to something sensible. */
export function glyphForCategory(categoryId: string): GlyphName {
  switch (categoryId) {
    case "cat-burgers":
      return "burger";
    case "cat-sandwiches":
      return "sandwich";
    case "cat-salads":
      return "salad";
    case "cat-sides":
      return "fries";
    case "cat-desserts":
      return "dessert";
    case "cat-drinks":
      return "drink";
    default:
      return "burger";
  }
}

const PATHS: Record<GlyphName, React.ReactNode> = {
  burger: (
    <>
      <path d="M6 13h20a0 0 0 0 1 0 0c0 1.7-1.3 3-3 3H9c-1.7 0-3-1.3-3-3Z" />
      <path d="M8 19h16" />
      <path d="M6 24h20c0 1.7-1.3 3-3 3H9c-1.7 0-3-1.3-3-3Z" />
      <path d="M6 13c0-3.9 4.5-7 10-7s10 3.1 10 7" />
    </>
  ),
  sandwich: (
    <>
      <path d="M4 21 16 8l12 13" />
      <path d="M4 21h24" />
      <path d="M10 15h12" />
    </>
  ),
  salad: (
    <>
      <path d="M4 15h24c0 6.6-5.4 12-12 12S4 21.6 4 15Z" />
      <path d="M11 15c0-3.3 2.2-6 5-6s5 2.7 5 6" />
      <path d="M16 9V5" />
    </>
  ),
  fries: (
    <>
      <path d="M9 15h14l-1.5 12h-11L9 15Z" />
      <path d="M12 15V6" />
      <path d="M16 15V4" />
      <path d="M20 15V7" />
    </>
  ),
  dessert: (
    <>
      <path d="M8 16h16l-2 11H10L8 16Z" />
      <path d="M8 16c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      <path d="M16 8V4" />
    </>
  ),
  drink: (
    <>
      <path d="M9 8h14l-2 19H11L9 8Z" />
      <path d="M10 15h12" />
      <path d="M16 8V3" />
    </>
  ),
};

export function FoodGlyph({
  name,
  className = "",
}: {
  name: GlyphName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
