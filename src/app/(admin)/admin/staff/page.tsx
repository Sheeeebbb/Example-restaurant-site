import type { Metadata } from "next";
import { StaffManager } from "@/components/admin/StaffManager";
import { NoAccess } from "@/components/admin/NoAccess";
import { currentActor } from "@/lib/staff/authorize";
import { listRoles, listStaff } from "@/lib/staff/staff-repository";

export const metadata: Metadata = { title: "Staff · Staff" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const actor = await currentActor();
  if (!actor?.can("staff.view")) {
    return <NoAccess permission="staff.view" what="the staff page" />;
  }

  /*
   * The roles list is needed to name and assign them, and someone who can
   * manage staff may not be allowed to design roles — so it is fetched here
   * regardless of `roles.view`. Names and ids only reach the client; what each
   * role ALLOWS is on the roles page, behind its own permission.
   */
  const [staff, roles] = await Promise.all([listStaff(), listRoles()]);

  return (
    <StaffManager
      initialStaff={staff}
      roles={roles.map((role) => ({ ...role, permissions: [] }))}
      canCreate={actor.can("staff.create")}
      canEdit={actor.can("staff.edit")}
      canDisable={actor.can("staff.disable")}
      selfId={actor.staff.id}
    />
  );
}
