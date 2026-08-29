"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useOrderDraftStore } from "@/lib/order/draft-store";
import { useCartStore } from "@/lib/cart/store";
import { FIELD_LIMITS, type DraftField, type FieldErrors } from "@/lib/order/validation";
import { checkPostalCode } from "@/lib/fulfillment/postal-code";
import { findZone } from "@/lib/fulfillment/delivery";
import {
  applyAutofill,
  type AddressSuggestion,
  type AutofillField,
} from "@/lib/fulfillment/address-autofill";
import { formatMoney } from "@/lib/money";
import { useTranslations, useLocale } from "next-intl";
import { fromNextIntl } from "@/i18n/messages";
import type { Locale } from "@/i18n/config";
import { DELIVERY_AREA, RESTAURANT } from "@/lib/config/restaurant";
import type { FulfillmentType } from "@/lib/types";

/**
 * Contact and delivery details.
 *
 * Which fields appear follows the fulfilment mode — pickup customers are never
 * asked for an address they don't need. Errors are shown per field and only
 * after a failed attempt to continue; flagging empty inputs before anyone has
 * typed is just scolding them for not having finished.
 *
 * The postal code is mirrored into the cart store because it prices delivery;
 * everything identifying stays in the sessionStorage draft. It is asked for
 * once, here, and every later step reads it back — the checkout summary, the
 * fee, the order itself.
 *
 * Its verdict comes from `lib/fulfillment/postal-code.ts`, the same module the
 * continue button and the server use, so the green line under the field and the
 * rule that actually blocks the order can never disagree.
 */

interface FieldSpec {
  name: DraftField;
  /** Key in the `checkout` namespace. */
  labelKey: string;
  type?: string;
  autoComplete: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  placeholder?: string;
  /** Fraction of the row on wider screens. */
  span?: "full" | "half";
}

const CONTACT_FIELDS: FieldSpec[] = [
  { name: "name", labelKey: "name", autoComplete: "name", span: "full" },
  { name: "phone", labelKey: "phone", type: "tel", autoComplete: "tel", inputMode: "tel", span: "half" },
  { name: "email", labelKey: "email", type: "email", autoComplete: "email", inputMode: "email", span: "half" },
];

/** "8930 AB" where the area allows letters, "8930" where it does not. */
const POSTAL_CODE_PLACEHOLDER =
  DELIVERY_AREA.letters > 0
    ? `${DELIVERY_AREA.minPostalCode} AB`
    : String(DELIVERY_AREA.minPostalCode);

const ADDRESS_FIELDS: FieldSpec[] = [
  { name: "street", labelKey: "street", autoComplete: "address-line1", span: "full" },
  { name: "houseNumber", labelKey: "houseNumber", autoComplete: "address-line2", span: "half" },
  /*
   * Text, not numeric: a Dutch postal code ends in two letters, and a numeric
   * keypad cannot type them. The digits alone still work — the letters are what
   * turn "somewhere in Leeuwarden" into a street.
   */
  { name: "postalCode", labelKey: "postalCode", autoComplete: "postal-code", inputMode: "text", placeholder: POSTAL_CODE_PLACEHOLDER, span: "half" },
  { name: "city", labelKey: "city", autoComplete: "address-level2", span: "full" },
];

export function CustomerForm({
  fulfillmentType,
  errors,
  showErrors,
  addressLookupEnabled = false,
}: {
  fulfillmentType: FulfillmentType;
  errors: FieldErrors;
  showErrors: boolean;
  /**
   * Whether a lookup service is connected, decided on the server. False today,
   * and while it is false the browser never calls the endpoint — a request that
   * can only 501 is not worth making.
   */
  addressLookupEnabled?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const messages = fromNextIntl(t as (k: string, v?: Record<string, string | number>) => string);
  const money = (cents: number) => formatMoney(cents, locale);

  const draft = useOrderDraftStore((state) => state.draft);
  const setField = useOrderDraftStore((state) => state.setField);
  const setPostalCode = useCartStore((state) => state.setPostalCode);

  /** Fields the customer has typed in, which autofill must never overwrite. */
  const touched = useRef(new Set<AutofillField>());
  /** The last code we asked about, so one lookup per code rather than per keystroke. */
  const lookedUp = useRef("");

  /**
   * What the lookup is doing, purely so the customer can see it.
   *
   * "missing" is not an error: the register does not know that code, which for
   * a new-build street is simply true. Nothing here can block continuing.
   */
  const [lookup, setLookup] = useState<{
    state: "idle" | "loading" | "found" | "missing" | "failed";
    suggestion: AddressSuggestion | null;
  }>({ state: "idle", suggestion: null });

  const handleChange = (field: DraftField, value: string) => {
    setField(field, value);
    if (field === "postalCode") setPostalCode(value);
    if (field === "street" || field === "city") touched.current.add(field);
  };

  const postal = checkPostalCode(draft.postalCode, messages);
  const zone = postal.deliverable ? findZone(postal.normalized) : null;

  /*
   * Address autofill.
   *
   * Runs for any complete postal code, whether or not we deliver to it. Those
   * are separate questions: the green line under the field answers one, this
   * answers the other, and a customer outside the area still deserves to be
   * told what their own address is before being told we cannot reach it.
   *
   * Keyed on the full normalised code, so typing the two letters after the
   * digits asks again — and gets a street where the digits alone got a town.
   *
   * The browser asks the server, never the lookup service, so no credential is
   * ever shipped to it. With lookup switched off the endpoint is not called at
   * all and the customer types their address exactly as before.
   */
  useEffect(() => {
    if (!addressLookupEnabled) return;
    if (fulfillmentType !== "delivery" || postal.area === null) return;
    /*
     * Keyed on what would actually be sent, not on what is in the box.
     *
     * Half a letter suffix narrows nothing, so "8934" and "8934A" both ask
     * about 8934 — and asking twice for the same answer is a request spent on
     * a free public service for nothing. Typing a full code out therefore
     * makes two lookups (one at the digits, one at the letters), not three.
     */
    const query = `${postal.area}${postal.letters ?? ""}`;
    if (lookedUp.current === query) return;
    lookedUp.current = query;

    let cancelled = false;
    setLookup({ state: "loading", suggestion: null });

    void (async () => {
      let suggestion: AddressSuggestion | null = null;
      let failed = false;

      try {
        const response = await fetch(
          `/api/address-lookup?postalCode=${encodeURIComponent(query)}`,
        );
        if (response.ok) {
          const body = (await response.json()) as {
            ok: boolean;
            suggestion?: AddressSuggestion | null;
          };
          suggestion = body.ok ? (body.suggestion ?? null) : null;
        } else {
          // 501 means lookup is switched off, which is not a failure worth
          // reporting; anything else is the service being unwell.
          failed = response.status !== 501;
        }
      } catch {
        failed = true;
      }

      if (cancelled) return;

      setLookup({
        state: failed ? "failed" : suggestion ? "found" : "missing",
        suggestion,
      });

      if (!suggestion) return;

      // Read the draft at apply time, not from the closure: the customer has
      // very likely typed something while the request was in flight.
      const current = useOrderDraftStore.getState().draft;
      for (const [field, value] of Object.entries(
        applyAutofill(current, suggestion, touched.current),
      )) {
        setField(field as DraftField, value);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addressLookupEnabled, fulfillmentType, postal.area, postal.letters, setField]);

  /*
   * What sits under the postal-code field.
   *
   * Before the customer tries to continue, only a settled verdict is worth
   * showing: "8" is not a wrong postal code, it is an unfinished one. After a
   * failed attempt the submitted error wins, because it also covers the empty
   * field, which live feedback stays quiet about.
   */
  const postalMessage = (showErrors ? errors.postalCode : null) ?? postal.message;
  const postalConfirmed = !postalMessage && postal.deliverable;

  /*
   * The place the code resolved to, as confirmation rather than as a field.
   *
   * Municipality and province are shown here and written nowhere: the order
   * form has a city and no municipality, and adding one would change what an
   * address means in the kitchen, on the driver's board and in every order
   * already placed. Seeing "Leeuwarden · gemeente Leeuwarden" is enough to know
   * the lookup found the right place.
   */
  const lookupPlace = (() => {
    const found = lookup.suggestion;
    if (!found) return null;
    const parts = [found.street, found.city].filter(Boolean);
    const extra = [
      found.municipality ? `gemeente ${found.municipality}` : null,
      found.region,
    ].filter(Boolean);
    if (parts.length === 0 && extra.length === 0) return null;
    return [parts.join(", "), extra.join(" · ")].filter(Boolean).join(" · ");
  })();

  const postalFeedback: ReactNode = postalConfirmed ? (
    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-herb">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
      >
        <path d="m4 10.5 4 4 8-9" />
      </svg>
      <span>
        {zone
          ? t("delivery.weDeliverHereDetail", {
              fee: money(zone.deliveryFee),
              minutes: zone.estimatedMinutes,
            })
          : t("delivery.weDeliverHere")}
      </span>
    </p>
  ) : null;

  /**
   * What the lookup has to say, under the postal-code field.
   *
   * Every one of these is advisory. None of them sets an error, none blocks
   * continuing, and the customer can ignore all of them and type the address
   * themselves — which is the whole contract: autofill is an accelerator, and
   * a broken accelerator must still leave a working form.
   */
  const lookupNote: ReactNode =
    !addressLookupEnabled || fulfillmentType !== "delivery" ? null : lookup.state ===
      "loading" ? (
      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted" role="status">
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-transparent"
        />
        <span>{t("delivery.lookupSearching")}</span>
      </p>
    ) : lookup.state === "found" && lookupPlace ? (
      <p className="mt-1.5 text-sm text-ink-muted" role="status">
        {lookupPlace}
      </p>
    ) : lookup.state === "missing" ? (
      <p className="mt-1.5 text-sm text-ink-muted" role="status">
        {t("delivery.lookupNotFound")}
      </p>
    ) : lookup.state === "failed" ? (
      <p className="mt-1.5 text-sm text-ink-muted" role="status">
        {t("delivery.lookupUnavailable")}
      </p>
    ) : null;

  /**
   * The street menu, for a code that covers a handful of streets rather than
   * one. Picking counts as typing it: the field becomes the customer's, and
   * nothing later overwrites it.
   */
  const streetChoices =
    lookup.state === "found" && !draft.street.trim()
      ? (lookup.suggestion?.streetOptions ?? [])
      : [];

  const streetPicker: ReactNode = streetChoices.length > 0 && (
    <div className="mt-2">
      <p className="text-sm text-ink-muted">{t("delivery.whichStreet")}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {streetChoices.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleChange("street", option)}
            className="inline-flex min-h-9 items-center rounded-control border border-line-strong bg-surface px-3 text-sm text-ink transition-colors hover:border-ember hover:text-ember"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );

  const renderField = (spec: FieldSpec) => {
    /*
     * The postal code answers live, because a customer we do not deliver to
     * should find out while their cursor is still in the field — not after
     * filling in the rest of the form and pressing continue.
     */
    const error =
      spec.name === "postalCode"
        ? (postalMessage ?? undefined)
        : showErrors
          ? errors[spec.name]
          : undefined;
    const errorId = `${spec.name}-error`;

    return (
      <div
        key={spec.name}
        className={spec.span === "half" ? "sm:col-span-1" : "sm:col-span-2"}
      >
        <label htmlFor={spec.name} className="text-sm font-medium text-ink">
          {t(`checkout.${spec.labelKey}`)}
        </label>
        <input
          id={spec.name}
          name={spec.name}
          type={spec.type ?? "text"}
          inputMode={spec.inputMode}
          autoComplete={spec.autoComplete}
          placeholder={spec.placeholder}
          maxLength={FIELD_LIMITS[spec.name]}
          value={draft[spec.name]}
          onChange={(event) => handleChange(spec.name, event.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className={`mt-2 min-h-11 w-full rounded-control border bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle ${
            error ? "border-danger" : "border-line"
          }`}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
        {spec.name === "postalCode" && postalFeedback}
        {spec.name === "postalCode" && lookupNote}
        {spec.name === "street" && streetPicker}
      </div>
    );
  };

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-ink">
        {fulfillmentType === "delivery" ? t("checkout.whereToBring") : t("checkout.whoIsCollecting")}
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {CONTACT_FIELDS.map(renderField)}

        {fulfillmentType === "delivery" && (
          <>
            {ADDRESS_FIELDS.map(renderField)}

            <div className="sm:col-span-2">
              <label
                htmlFor="deliveryInstructions"
                className="text-sm font-medium text-ink"
              >
                Delivery instructions{" "}
                <span className="font-normal text-ink-subtle">(optional)</span>
              </label>
              <textarea
                id="deliveryInstructions"
                name="deliveryInstructions"
                rows={2}
                maxLength={FIELD_LIMITS.deliveryInstructions}
                value={draft.deliveryInstructions}
                onChange={(event) =>
                  handleChange("deliveryInstructions", event.target.value)
                }
                placeholder="Buzzer 3B, second courtyard, leave with the neighbour…"
                className="mt-2 w-full rounded-control border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-subtle"
              />
            </div>
          </>
        )}
      </div>

      {fulfillmentType === "pickup" && (
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          Collect from {RESTAURANT.address.line1}, {RESTAURANT.address.postalCode}{" "}
          {RESTAURANT.address.city}. We&rsquo;ll text you when it&rsquo;s ready.
        </p>
      )}
    </div>
  );
}
