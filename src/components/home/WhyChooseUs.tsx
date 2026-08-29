import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "./SectionHeading";

const REASONS = [
  {
    key: "Fresh",
    icon: (
      <>
        <path d="M12 21c0-5 4-9 9-9-.4 5-4 9-9 9Z" />
        <path d="M12 21c-5 0-9-4-9-9 5 0 9 4 9 9Z" />
        <path d="M12 21v-6" />
      </>
    ),
  },
  {
    key: "Fast",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
  },
  {
    key: "Pickup",
    icon: (
      <>
        <path d="M5 8h14l-1.2 12H6.2L5 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </>
    ),
  },
  {
    key: "Care",
    icon: (
      <>
        <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9Z" />
      </>
    ),
  },
];

export async function WhyChooseUs() {
  const t = await getTranslations("home");
  return (
    <section aria-labelledby="why-heading" className="border-y border-line bg-surface">
      <Container className="py-16 sm:py-24">
        <SectionHeading
          id="why-heading"
          eyebrow={t("whyTitle")}
          title={t("whyLead")}
          align="center"
        />

        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map((reason) => (
            <li key={reason.key} className="text-center sm:text-left">
              <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ember-soft text-ember sm:mx-0">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-6 w-6"
                >
                  {reason.icon}
                </svg>
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">
                {t(`why${reason.key}Title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {t(`why${reason.key}Body`)}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
