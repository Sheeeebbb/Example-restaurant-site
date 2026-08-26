import type { Metadata } from "next";
import { RoleManager } from "@/components/admin/RoleManager";
import { NoAccess } from "@/components/admin/NoAccess";
import { currentActor } from "@/lib/staff/authorize";
import { listRoles } from "@/lib/staff/staff-repository";
import { PERMISSION_CATALOGUE } from "@/lib/staff/permissions";

export const metadata: Metadata = { title: "Roles · Staff" };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const actor = await currentActor();
  if (!actor?.can("roles.view")) {
    return <NoAccess permission="roles.view" what="the roles page" />;
  }

  return (
    <RoleManager
      initialRoles={await listRoles()}
      groups={PERMISSION_CATALOGUE}
      canCreate={actor.can("roles.create")}
      canEdit={actor.can("roles.edit")}
      canAssign={actor.can("roles.assign_permissions")}
      canDelete={actor.can("roles.delete")}
    />
  );
}
