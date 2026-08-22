import { statusLabel } from "@/lib/order/status";
import type { FulfillmentType, OrderStatus } from "@/lib/types";

/**
 * Colour carries a hint, never the meaning — the label always spells the status
 * out, so it survives a monochrome screen or a colour-blind reader.
 */
const TONES: Record<OrderStatus, string> = {
  pending: "bg-surface-sunken text-ink-muted",
  confirmed: "bg-surface-sunken text-ink",
  preparing: "bg-ember-soft text-ember",
  ready: "bg-warning-soft text-warning",
  outForDelivery: "bg-ember-soft text-ember",
  completed: "bg-herb-soft text-herb",
  cancelled: "bg-danger-soft text-danger",
};

export function StatusBadge({
  status,
  fulfillmentType,
}: {
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[status]}`}
    >
      {statusLabel(status, fulfillmentType)}
    </span>
  );
}
