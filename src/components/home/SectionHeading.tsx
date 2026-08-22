import type { ReactNode } from "react";

/** Shared section header so rhythm and hierarchy stay identical down the page. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  action,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  action?: ReactNode;
}) {
  const centered = align === "center";

  return (
    <div
      className={
        centered
          ? "mx-auto max-w-2xl text-center"
          : "flex flex-wrap items-end justify-between gap-4"
      }
    >
      <div className={centered ? "" : "max-w-xl"}>
        {eyebrow && (
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ember">
            {eyebrow}
          </p>
        )}
        <h2
          id={id}
          className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-lg leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
