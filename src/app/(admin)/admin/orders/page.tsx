import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersBoard } from "@/components/admin/OrdersBoard";

export const metadata: Metadata = { title: "Orders · Staff" };

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersBoard />
    </Suspense>
  );
}
