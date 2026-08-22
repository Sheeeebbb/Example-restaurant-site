import type { ReactNode } from "react";

/**
 * A dashboard figure.
 *
 * `tone` colours the value only, never the whole card — a wall of coloured
 * blocks reads as decoration and stops meaning anything. Every card also
 * carries a plain-language subtitle, because a number with no unit is a
 * guessing game at a glance.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ember" | "herb" | "warning";
  icon?: ReactNode;
}) {
  const tones = {
    neutral: "text-ink",
    ember: "text-ember",
    herb: "text-herb",
    warning: "text-warning",
  } as const;

  return (
    <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {icon && <span aria-hidden="true" className="text-ink-subtle">{icon}</span>}
      </div>
      <p className={`mt-2 font-display text-2xl font-semibold tabular-nums sm:mt-3 sm:text-3xl ${tones[tone]}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-subtle sm:text-sm">{hint}</p>}
    </div>
  );
}
