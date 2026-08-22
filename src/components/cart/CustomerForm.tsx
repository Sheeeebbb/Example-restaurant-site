"use client";

import { useOrderDraftStore } from "@/lib/order/draft-store";
import { useCartStore } from "@/lib/cart/store";
import { FIELD_LIMITS, type DraftField, type FieldErrors } from "@/lib/order/validation";
import { RESTAURANT } from "@/lib/config/restaurant";
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
 * everything identifying stays in the sessionStorage draft.
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
  { name: "postalCode", label: "Postal code", autoComplete: "postal-code", inputMode: "numeric", placeholder: "10969", span: "half" },
  { name: "city", label: "City", autoComplete: "address-level2", span: "full" },
];

export function CustomerForm({
  fulfillmentType,
  errors,
  showErrors,
}: {
  fulfillmentType: FulfillmentType;
  errors: FieldErrors;
  showErrors: boolean;
}) {
  const draft = useOrderDraftStore((state) => state.draft);
  const setField = useOrderDraftStore((state) => state.setField);
  const setPostalCode = useCartStore((state) => state.setPostalCode);

  const handleChange = (field: DraftField, value: string) => {
    setField(field, value);
    if (field === "postalCode") setPostalCode(value);
  };

  const renderField = (spec: FieldSpec) => {
    const error = showErrors ? errors[spec.name] : undefined;
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
          <p id={errorId} className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
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
