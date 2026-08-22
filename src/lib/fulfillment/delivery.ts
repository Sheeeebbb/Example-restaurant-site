import type { Cents, DeliveryZone } from "../types";
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

export function isDeliverable(postalCode: string): boolean {
  return findZone(postalCode) !== null;
}

/** Every postal code we serve — powers the "where we deliver" list in the footer. */
export function servedPostalCodes(): string[] {
  return DELIVERY_ZONES.flatMap((zone) => zone.postalCodes).sort();
}

export interface ZoneCheck {
  zone: DeliveryZone | null;
  deliverable: boolean;
  fee: Cents;
  minimumOrder: Cents;
  estimatedMinutes: number;
}

export function checkPostalCode(postalCode: string): ZoneCheck {
  const zone = findZone(postalCode);
  return {
    zone,
    deliverable: zone !== null,
    fee: zone?.deliveryFee ?? 0,
    minimumOrder: zone?.minimumOrder ?? 0,
    estimatedMinutes: zone?.estimatedMinutes ?? 0,
  };
}
