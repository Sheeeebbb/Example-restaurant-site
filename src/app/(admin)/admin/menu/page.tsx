import type { Metadata } from "next";
import { MenuManager } from "@/components/admin/MenuManager";
import { NoAccess } from "@/components/admin/NoAccess";
import { currentActor } from "@/lib/staff/authorize";
import { getCategories, getMenuItems } from "@/lib/data/repository";
import { resolveMenuPhotos } from "@/lib/data/photos";

export const metadata: Metadata = { title: "Menu · Staff" };

/** Always fresh — staff need to see the menu as it is right now. */
export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const actor = await currentActor();
  if (!actor?.can("menu.view")) {
    return <NoAccess permission="menu.view" what="the menu manager" />;
  }

  const [items, categories] = await Promise.all([getMenuItems(), getCategories()]);
  return (
    <MenuManager
      initialItems={items}
      categories={categories}
      /* Resolved here so the list never requests a photograph that isn't
         there — a dish still waiting for one shows a labelled gap instead of
         a broken image and a 404. */
      photoMap={resolveMenuPhotos(items)}
      /* A role can be allowed to read the menu without changing it. Advisory
         only — every menu endpoint checks the same permissions itself. */
      canCreate={actor.can("menu.create")}
      canEdit={actor.can("menu.edit")}
      canDelete={actor.can("menu.delete")}
      canManageImages={actor.can("menu.manage_images")}
    />
  );
}
