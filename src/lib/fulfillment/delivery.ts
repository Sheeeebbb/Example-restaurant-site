import type { DeliveryZone } from "../types";
import { DELIVERY_ZONES } from "../config/restaurant";
import { checkPostalCode } from "./postal-code";

/**
 * Which delivery zone a postal code falls in — the zone carries the fee, the
 * minimum order and the travel time.
 *
 * Whether we deliver at all is decided in `./postal-code`; this only asks which
 * ring of the map the address sits in. A malformed or out-of-area code has no
 * zone, and every caller treats that as "not deliverable".
 */
export { normalizePostalCode } from "./postal-code";

export function findZone(postalCode: string): DeliveryZone | null {
  const { value } = checkPostalCode(postalCode);
  if (value === null) return null;
  return (
    DELIVERY_ZONES.find((zone) => value >= zone.from && value <= zone.to) ?? null
  );
}
