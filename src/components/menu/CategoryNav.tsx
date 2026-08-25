"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";

export interface NavSection {
  /** The id of the section element on the page. */
  id: string;
  name: string;
}

/**
 * The menu's category bar.
 *
 * It navigates rather than filters. Every category is on the page at once, so
 * a chip scrolls to its section instead of reloading the menu with everything
 * else removed — the customer keeps their sense of how much menu there is, and
 * can wander into the next section without going back for it.
 *
 * The chips are real `<a href="#cat-…">` anchors. With JavaScript still loading
 * they jump to the right heading on their own; the handler below only upgrades
 * that jump to a smooth one and keeps the URL tidy.
 *
 * Which chip is lit is decided by an IntersectionObserver watching the section
 * elements, not by measuring scroll offsets on every frame. The observer's
 * `rootMargin` narrows the viewport to a band just under the sticky bars, so
 * "current" means "the section whose content is directly below the nav" rather
 * than "whatever is technically on screen", which at any moment is usually two
 * or three sections.
 */
export function CategoryNav({ sections }: { sections: NavSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [offset, setOffset] = useState(0);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const listRef = useRef<HTMLUListElement>(null);
  const chipRefs = useRef(new Map<string, HTMLAnchorElement>());
  /*
   * A click scrolls past every section between here and there. Without this the
   * observer would light each one in turn and the bar would flicker through the
   * whole menu on the way down, which reads as a bug.
   */
  const lockUntil = useRef(0);

  const reducedMotion = useCallback(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  /* ── How far the sticky header + this bar cover the top of the page ────── */
  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement);
      const header =
        parseFloat(styles.getPropertyValue("--header-height")) || 0;
      const nav = parseFloat(styles.getPropertyValue("--menu-nav-height")) || 0;
      setOffset(header + nav);
    };

    read();
    // The header wraps to two rows below `lg`, so the offset changes with width.
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  /* ── Which section is being read ───────────────────────────────────────── */
  useEffect(() => {
    if (offset === 0) return;

    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }

        if (Date.now() < lockUntil.current) return;

        // Sections are observed in page order, so the first one still in the
        // band is the one the customer is looking at. When the band is empty —
        // mid-scroll between two tall sections — the previous answer is still
        // the best one, so it is left alone.
        const current = sections.find((section) => visible.has(section.id));
        if (current) setActive(current.id);
      },
      { rootMargin: `-${offset + 8}px 0px -62% 0px`, threshold: 0 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections, offset]);

  /* ── The last section, which is too short to reach the band ────────────── */
  useEffect(() => {
    const sentinel = document.getElementById("menu-end");
    const last = sections.at(-1);
    if (!sentinel || !last) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && Date.now() >= lockUntil.current) {
          setActive(last.id);
        }
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sections]);

  /* ── Keep the lit chip on screen in the horizontal strip ───────────────── */
  useEffect(() => {
    const list = listRef.current;
    const chip = chipRefs.current.get(active);
    if (!list || !chip) return;

    const max = list.scrollWidth - list.clientWidth;
    if (max <= 0) return; // Not scrollable: every chip is already visible.

    const centred = chip.offsetLeft - (list.clientWidth - chip.clientWidth) / 2;
    const left = Math.max(0, Math.min(centred, max));
    if (Math.abs(left - list.scrollLeft) < 4) return;

    list.scrollTo({ left, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active, reducedMotion]);

  /* ── Fade hints, so it is obvious the strip carries on ─────────────────── */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const max = list.scrollWidth - list.clientWidth;
      setOverflow({
        start: list.scrollLeft > 4,
        end: max > 4 && list.scrollLeft < max - 4,
      });
    };

    measure();
    list.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      list.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [sections]);

  const handleClick = (id: string) => (event: React.MouseEvent) => {
    const target = document.getElementById(id);
    if (!target || event.metaKey || event.ctrlKey || event.shiftKey) return;

    event.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });

    // replaceState, not a hash jump: the URL stays shareable without filling
    // the back button with every category the customer glanced at.
    window.history.replaceState(null, "", `#${id}`);
    lockUntil.current = Date.now() + 700;
    setActive(id);
  };

  return (
    <div className="sticky top-[var(--header-height)] z-30 border-y border-line bg-paper/95 backdrop-blur-md">
      <Container className="relative">
        <nav aria-label="Menu categories">
          {/*
            Scrolls sideways on small screens rather than wrapping to three
            rows under an already two-row sticky header. `-mx-4 px-4` lets the
            row bleed to the screen edges so the last chip doesn't look clipped.
          */}
          {/*
              `overscroll-x-contain` keeps a swipe on this strip inside it. On
              Android — and on One UI in particular, where back is a horizontal
              edge swipe — a horizontal scroll that reaches its end otherwise
              chains to the browser, and flicking the categories navigates the
              customer off the menu instead of moving the chips.
            */}
          <ul
            ref={listRef}
            className="-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sections.map((section) => {
              const isActive = section.id === active;
              return (
                <li key={section.id}>
                  <a
                    ref={(node) => {
                      if (node) chipRefs.current.set(section.id, node);
                      else chipRefs.current.delete(section.id);
                    }}
                    href={`#${section.id}`}
                    onClick={handleClick(section.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-ember text-on-ember"
                        : "border border-line-strong bg-surface text-ink-muted hover:border-ink-subtle hover:text-ink"
                    }`}
                  >
                    {section.name}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/*
          Purely a hint that the strip continues, and only while it does.
          `pointer-events-none` keeps them from stealing a tap meant for a chip.
        */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-paper to-transparent transition-opacity duration-200 ${
            overflow.start ? "opacity-100" : "opacity-0"
          }`}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper to-transparent transition-opacity duration-200 ${
            overflow.end ? "opacity-100" : "opacity-0"
          }`}
        />
      </Container>
    </div>
  );
}
