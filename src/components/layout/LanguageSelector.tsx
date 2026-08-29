"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { LOCALES, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

/**
 * Two words, one of them highlighted.
 *
 * ── Why not flags ───────────────────────────────────────────────────────────
 * A flag is a country, not a language. 🇬🇧 excludes the Dutch speakers in
 * Belgium as surely as 🇳🇱 excludes them from the Netherlands, and there is no
 * flag for English that is not somebody's nationality. The name of the language
 * in that language is what a person actually scans for, so that is what this
 * shows: "English" and "Nederlands", never "Dutch".
 *
 * ── Why a radiogroup and not a <select> ─────────────────────────────────────
 * Two options. A dropdown would be two taps and a system sheet on Android to
 * choose between two words that fit side by side. Native radios give arrow-key
 * navigation, a real focus ring and "2 of 2, selected" to a screen reader
 * without a line of ARIA to keep in sync.
 */
export function LanguageSelector({ className = "" }: { className?: string }) {
  const active = useLocale() as Locale;
  const t = useTranslations("language");
  const [pending, startTransition] = useTransition();

  const choose = (code: Locale) => {
    if (code === active) return;

    /*
     * The action writes the cookie and revalidates the layout, so the same
     * round trip that stores the choice also returns the page in the new
     * language. The transition keeps the current page, its scroll position and
     * the cart exactly where they are — the words change and nothing else does,
     * which is the whole point.
     */
    startTransition(() => {
      void setLocale(code);
    });
  };

  return (
    <fieldset
      className={`border-0 p-0 ${className}`}
      aria-busy={pending || undefined}
    >
      <legend className="sr-only">{t("label")}</legend>
      <div className="inline-flex rounded-control border border-line bg-surface p-0.5">
        {LOCALES.map((locale) => {
          const isActive = locale.code === active;
          return (
            <label
              key={locale.code}
              className={`relative flex min-h-9 cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-2px)] px-3 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember ${
                isActive
                  ? "bg-ember font-semibold text-on-ember"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name="site-language"
                value={locale.code}
                checked={isActive}
                onChange={() => choose(locale.code)}
                className="sr-only"
              />
              {/*
                `lang` on the label so a screen reader pronounces "Nederlands"
                in Dutch even while the rest of the page is English — otherwise
                it reads as an English word and is not recognisable.
              */}
              <span lang={locale.code}>{locale.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
