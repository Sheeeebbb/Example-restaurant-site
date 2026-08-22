import type { ReactNode } from "react";
import type { DietaryTag } from "@/lib/types";

type Tone = "neutral" | "ember" | "herb" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-muted",
  ember: "bg-ember-soft text-ember",
  herb: "bg-herb-soft text-herb",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Dietary tags carry a colour, but the label always states the meaning in words too. */
const TAG_LABELS: Record<DietaryTag, { label: string; tone: Tone }> = {
  vegetarian: { label: "Vegetarian", tone: "herb" },
  vegan: { label: "Vegan", tone: "herb" },
  "gluten-free": { label: "Gluten free", tone: "neutral" },
  spicy: { label: "Spicy", tone: "ember" },
  "contains-nuts": { label: "Contains nuts", tone: "warning" },
};

export function DietaryBadge({ tag }: { tag: DietaryTag }) {
  const { label, tone } = TAG_LABELS[tag];
  return <Badge tone={tone}>{label}</Badge>;
}
