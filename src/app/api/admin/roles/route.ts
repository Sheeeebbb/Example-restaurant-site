import { NextResponse } from "next/server";
import { createRole, listRoles, recordAudit } from "@/lib/staff/staff-repository";
import { requirePermission } from "@/lib/staff/authorize";
import { permissionLabel } from "@/lib/staff/permissions";

export async function GET() {
  const auth = await requirePermission("roles.view");
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true, roles: await listRoles() });
}

/**
 * Creates a role.
 *
 * Creating and choosing what it allows are two permissions, and they are
 * checked separately: `roles.create` makes an empty role, `roles.assign_permissions`
 * puts anything in it. Someone allowed only to create gets a role with no
 * permissions and has to ask — which is the safe direction for that mistake to
 * fall in.
 */
export async function POST(request: Request) {
  const auth = await requirePermission("roles.create");
  if (!auth.ok) return auth.response;

  let body: { name?: string; description?: string; permissions?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const wantsPermissions = (body.permissions ?? []).length > 0;
  if (wantsPermissions && !auth.actor.can("roles.assign_permissions")) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'You can create a role but not choose what it allows — that needs "roles.assign_permissions". Create it empty and ask a manager to fill it in.',
      },
      { status: 403 },
    );
  }

  const result = await createRole({
    name: body.name ?? "",
    description: body.description,
    permissions: body.permissions,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  recordAudit({
    actorId: auth.actor.staff.id,
    actorName: auth.actor.staff.name,
    action: "role.created",
    subject: result.value.id,
    summary: `Created the role "${result.value.name}" with ${result.value.permissions.length} permission(s): ${
      result.value.permissions.map(permissionLabel).join(", ") || "none"
    }.`,
  });

  return NextResponse.json({ ok: true, role: result.value }, { status: 201 });
}
