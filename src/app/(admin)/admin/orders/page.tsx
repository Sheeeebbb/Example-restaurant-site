import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersBoard } from "@/components/admin/OrdersBoard";
import { NoAccess } from "@/components/admin/NoAccess";
import { currentActor } from "@/lib/staff/authorize";

export const metadata: Metadata = { title: "Orders · Staff" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const actor = await currentActor();
  if (!actor?.can("orders.view")) {
    return <NoAccess permission="orders.view" what="the order queue" />;
  }

  return (
    <Suspense fallback={null}>
      {/* Advisory, for drawing controls. The endpoints behind every one of
          them check the same permissions again. */}
      <OrdersBoard permissions={[...actor.permissions]} actorId={actor.staff.id} />
    </Suspense>
  );
}
