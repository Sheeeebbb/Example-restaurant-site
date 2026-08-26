import { NextResponse } from "next/server";
import { PERMISSION_CATALOGUE } from "@/lib/staff/permissions";
import { requireAnyPermission } from "@/lib/staff/authorize";

/**
 * The catalogue, for the role editor to draw checkboxes from.
 *
 * Served rather than bundled so the editor lists whatever this build knows —
 * add a permission to the catalogue and it appears here, and therefore in the
 * editor, with no other change. That is the extension point working.
 *
 * Readable by anyone who can see or design roles. It is a list of capability
 * names and descriptions, not a statement about who holds them.
 */
export async function GET() {
  const auth = await requireAnyPermission(["roles.view", "roles.assign_permissions"]);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true, groups: PERMISSION_CATALOGUE });
}
