import type { Metadata } from "next";
import { MenuManager } from "@/components/admin/MenuManager";
import { getCategories, getMenuItems } from "@/lib/data/repository";

export const metadata: Metadata = { title: "Menu · Staff" };

/** Always fresh — staff need to see the menu as it is right now. */
export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const [items, categories] = await Promise.all([getMenuItems(), getCategories()]);
  return <MenuManager initialItems={items} categories={categories} />;
}
