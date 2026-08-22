import Link from "next/link";
import { Container } from "@/components/ui/Container";
import type { Category } from "@/lib/types";

/**
 * Category filter.
 *
 * Plain links to `/menu?category=…`, not client-side state. That makes each
 * filtered view a real URL — shareable, bookmarkable, correct in the back
 * button, and rendered on the server — and it means the filter works with
 * JavaScript still loading. No `useState` could offer any of that.
 *
 * `aria-current="page"` marks the active chip, so it is announced as selected
 * rather than merely being a different colour.
 */
export function CategoryFilter({
  categories,
  active,
}: {
  categories: Category[];
  active: string | null;
}) {
  const chips = [
    { slug: null, name: "All", href: "/menu" },
    ...categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      href: `/menu?category=${category.slug}`,
    })),
  ];

  return (
    <div className="sticky top-[var(--header-height)] z-30 border-y border-line bg-paper/95 backdrop-blur-md">
      <Container>
        <nav aria-label="Menu categories">
          {/*
            Scrolls sideways on small screens rather than wrapping to three
            rows under an already two-row sticky header. `-mx-4 px-4` lets the
            row bleed to the screen edges so the last chip doesn't look clipped.
          */}
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((chip) => {
              const isActive = chip.slug === active;
              return (
                <li key={chip.href}>
                  <Link
                    href={chip.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-ember text-on-ember"
                        : "border border-line-strong bg-surface text-ink-muted hover:border-ink-subtle hover:text-ink"
                    }`}
                  >
                    {chip.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Container>
    </div>
  );
}
