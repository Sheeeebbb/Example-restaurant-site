"use client";

import { useTranslations } from "next-intl";

import {
  TEST_CARD_NUMBER,
  formatCardNumber,
  formatExpiry,
  digitsOnly,
  type CardDraft,
  type CardErrors,
} from "@/lib/payments/card-mock";

/**
 * DEMONSTRATION card form.
 *
 * ── What happens to what you type here ──────────────────────────────────────
 * Nothing leaves this component. The values live in the parent's React state,
 * are used only to render this form and to gate the submit button, and are
 * wiped the moment an order is placed. They are NOT written to localStorage or
 * sessionStorage, NOT included in the request to `/api/checkout` — which has no
 * card fields in its type — and NOT stored on the resulting order. The receipt
 * shows a provider reference, never a card number.
 *
 * ── Why it looks like this ──────────────────────────────────────────────────
 * The point of building it is that the checkout has to handle a real payment
 * step's shape: validation, a pending state, and a failure path. Those are the
 * parts that are painful to retrofit.
 *
 * ── How this is replaced ────────────────────────────────────────────────────
 * With Stripe, this component is DELETED rather than adapted. Stripe Elements
 * renders the card inputs inside an iframe on Stripe's own origin, so the
 * number never enters our DOM or our server, and the project stays out of PCI
 * scope. The rest of checkout does not change, because nothing downstream of
 * here ever knew about a card in the first place.
 */
export function MockPaymentForm({
  card,
  errors,
  showErrors,
  disabled,
  onChange,
}: {
  card: CardDraft;
  errors: CardErrors;
  showErrors: boolean;
  disabled: boolean;
  onChange: (field: keyof CardDraft, value: string) => void;
}) {
  const t = useTranslations("checkout");
  const field = (
    name: keyof CardDraft,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
    className = "",
  ) => {
    const error = showErrors ? errors[name] : undefined;
    return (
      <div className={className}>
        <label htmlFor={`card-${name}`} className="text-sm font-medium text-ink">
          {label}
        </label>
        <input
          id={`card-${name}`}
          value={card[name]}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `card-${name}-error` : undefined}
          // Autofill is switched off deliberately: this is a demonstration form
          // and a saved real card has no business being offered to it.
          autoComplete="off"
          {...props}
          className={`mt-2 min-h-11 w-full rounded-control border bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle disabled:opacity-60 ${
            error ? "border-danger" : "border-line"
          }`}
        />
        {error && (
          <p id={`card-${name}-error`} className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-ink">{t("payment")}</h2>
        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
          Test mode
        </span>
      </div>

      <div className="mt-3 rounded-control border border-warning bg-warning-soft p-3">
        <p className="text-sm font-medium text-warning">
          {t("noRealCard")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {t("testCardBody")}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange("cardholder", "Test Customer");
            onChange("number", formatCardNumber(TEST_CARD_NUMBER));
            onChange("expiry", "12/30");
            onChange("cvc", "123");
          }}
          className="mt-3 min-h-9 rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken disabled:opacity-50"
        >
          {t("fillTestCard")}
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {field(
          "cardholder",
          t("cardholder"),
          {
            type: "text",
            placeholder: t("cardPlaceholderName"),
            onChange: (event) => onChange("cardholder", event.target.value),
          },
          "sm:col-span-2",
        )}

        {field(
          "number",
          t("cardNumber"),
          {
            type: "text",
            inputMode: "numeric",
            placeholder: "4242 4242 4242 4242",
            maxLength: 19,
            onChange: (event) =>
              onChange("number", formatCardNumber(event.target.value)),
          },
          "sm:col-span-2",
        )}

        {field("expiry", t("expiry"), {
          type: "text",
          inputMode: "numeric",
          placeholder: "MM/YY",
          maxLength: 5,
          onChange: (event) => onChange("expiry", formatExpiry(event.target.value)),
        })}

        {field("cvc", t("cvc"), {
          type: "text",
          inputMode: "numeric",
          placeholder: "123",
          maxLength: 4,
          onChange: (event) => onChange("cvc", digitsOnly(event.target.value).slice(0, 4)),
        })}
      </div>
    </div>
  );
}
