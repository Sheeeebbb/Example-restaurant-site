import type { DeliveryZone } from "../types";
import { DELIVERY_ZONES } from "../config/restaurant";

/** Uppercased, stripped of spaces and hyphens, and limited to the 5-digit ZIP. */
export function normalizePostalCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "").slice(0, 5);
}

/** The zone covering a postal code, or null when we do not deliver there. */
export function findZone(postalCode: string): DeliveryZone | null {
  const normalized = normalizePostalCode(postalCode);
  if (!normalized) return null;
  return (
    DELIVERY_ZONES.find((zone) => zone.postalCodes.includes(normalized)) ?? null
  );
}
