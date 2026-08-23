"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
  label: string;
  type?: string;
  autoComplete: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  placeholder?: string;
  /** Fraction of the row on wider screens. */
  span?: "full" | "half";
}

const CONTACT_FIELDS: FieldSpec[] = [
  { name: "name", label: "Full name", autoComplete: "name", span: "full" },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel", inputMode: "tel", span: "half" },
  { name: "email", label: "Email", type: "email", autoComplete: "email", inputMode: "email", span: "half" },
];

const ADDRESS_FIELDS: FieldSpec[] = [
  { name: "street", label: "Street", autoComplete: "address-line1", span: "full" },
  { name: "houseNumber", label: "House / apartment number", autoComplete: "address-line2", span: "half" },
  { name: "postalCode", label: "Postal code", autoComplete: "postal-code", inputMode: "numeric", placeholder: String(DELIVERY_AREA.minPostalCode), span: "half" },
  { name: "city", label: "City", autoComplete: "address-level2", span: "full" },
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
  const draft = useOrderDraftStore((state) => state.draft);
  const setField = useOrderDraftStore((state) => state.setField);
  const setPostalCode = useCartStore((state) => state.setPostalCode);

  /** Fields the customer has typed in, which autofill must never overwrite. */
  const touched = useRef(new Set<AutofillField>());
  /** The last code we asked about, so one lookup per code rather than per keystroke. */
  const lookedUp = useRef("");

  const handleChange = (field: DraftField, value: string) => {
    setField(field, value);
    if (field === "postalCode") setPostalCode(value);
    if (field === "street" || field === "city") touched.current.add(field);
  };

  const postal = checkPostalCode(draft.postalCode);
  const zone = postal.deliverable ? findZone(postal.normalized) : null;

  /*
   * Address autofill.
   *
   * Runs only for a complete, in-area code, and asks the server rather than a
   * lookup service directly so no API key is ever shipped to the browser. With
   * nothing configured the endpoint answers 501 and this quietly fills nothing
   * in — the customer types their address as before. See
   * `lib/fulfillment/address-lookup.ts` for connecting a real service.
   */
  useEffect(() => {
    if (!addressLookupEnabled) return;
    if (fulfillmentType !== "delivery" || !postal.deliverable) return;
    if (lookedUp.current === postal.normalized) return;
    lookedUp.current = postal.normalized;

    let cancelled = false;

    void (async () => {
      let suggestion: AddressSuggestion | null = null;
      try {
        const response = await fetch(
          `/api/address-lookup?postalCode=${encodeURIComponent(postal.normalized)}`,
        );
        if (response.ok) {
          const body = (await response.json()) as {
            ok: boolean;
            suggestion?: AddressSuggestion | null;
          };
          suggestion = body.ok ? (body.suggestion ?? null) : null;
        }
      } catch {
        // A lookup that fails is not an error the customer needs to hear about.
      }

      if (cancelled || !suggestion) return;

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
  }, [addressLookupEnabled, fulfillmentType, postal.deliverable, postal.normalized, setField]);

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
        We deliver here
        {zone ? ` · ${formatMoney(zone.deliveryFee)}, about ${zone.estimatedMinutes} min` : ""}
      </span>
    </p>
  ) : null;

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
          {spec.label}
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
      </div>
    );
  };

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-ink">
        {fulfillmentType === "delivery" ? "Where should we bring it?" : "Who's collecting?"}
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
