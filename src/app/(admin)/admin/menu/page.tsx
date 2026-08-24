import type { Metadata } from "next";
import { MenuManager } from "@/components/admin/MenuManager";
import { getCategories, getMenuItems } from "@/lib/data/repository";
import { resolveMenuPhotos } from "@/lib/data/photos";

export const metadata: Metadata = { title: "Menu · Staff" };

/** Always fresh — staff need to see the menu as it is right now. */
export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const [items, categories] = await Promise.all([getMenuItems(), getCategories()]);
  return (
    <MenuManager
      initialItems={items}
      categories={categories}
      /* Resolved here so the list never requests a photograph that isn't
         there — a dish still waiting for one shows a labelled gap instead of
         a broken image and a 404. */
      photoMap={resolveMenuPhotos(items)}
    />
  );
}
