import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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

/**
 * Dietary tags carry a colour, but the label always states the meaning in words
 * too. Only the colour is decided here: the tag itself (`gluten-free`) is the
 * stored, language-neutral value and doubles as its translation key, so the
 * word on screen changes with the language while the data never does.
 */
const TAG_TONES: Record<DietaryTag, Tone> = {
  vegetarian: "herb",
  vegan: "herb",
  "gluten-free": "neutral",
  spicy: "ember",
  "contains-nuts": "warning",
};

export function DietaryBadge({ tag }: { tag: DietaryTag }) {
  const t = useTranslations("dietary");
  return <Badge tone={TAG_TONES[tag]}>{t(tag)}</Badge>;
}
