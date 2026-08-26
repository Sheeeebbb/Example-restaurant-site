import type { Metadata } from "next";
import { DeliveryBoard } from "@/components/admin/DeliveryBoard";
import { NoAccess } from "@/components/admin/NoAccess";
import { currentActor } from "@/lib/staff/authorize";

export const metadata: Metadata = { title: "Deliveries · Staff" };
export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const actor = await currentActor();
  if (!actor?.can("deliveries.view")) {
    return <NoAccess permission="deliveries.view" what="the delivery board" />;
  }

  return (
    <DeliveryBoard
      actorId={actor.staff.id}
      /* Advisory: it decides which buttons to draw. Every one of them is
         re-checked server-side when pressed. */
      permissions={[...actor.permissions]}
    />
  );
}
