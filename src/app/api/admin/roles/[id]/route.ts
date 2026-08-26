import { NextResponse } from "next/server";
import {
  deleteRole,
  getRole,
  recordAudit,
  updateRole,
} from "@/lib/staff/staff-repository";
import { requirePermission } from "@/lib/staff/authorize";
import { permissionLabel } from "@/lib/staff/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("roles.view");
  if (!auth.ok) return auth.response;

  const role = await getRole((await params).id);
  if (!role) return NextResponse.json({ ok: false, error: "No such role." }, { status: 404 });
  return NextResponse.json({ ok: true, role });
}

/**
 * Renames a role, or changes what it allows.
 *
 * Two permissions again, checked against what the request actually asks for:
 * `roles.edit` covers the name and description, `roles.assign_permissions`
 * covers the permission list. So a role can be given the ability to tidy up
 * names without the ability to hand out access — which is the whole reason
 * those are separate permissions.
 *
 * The lock-out safeguard lives in the repository, not here: emptying a role is
 * one of four ways to strand the restaurant outside its own back office, and
 * all four are checked in the one place that writes.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("roles.edit");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: { name?: string; description?: string; permissions?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  if (body.permissions !== undefined && !auth.actor.can("roles.assign_permissions")) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Changing what a role allows needs "roles.assign_permissions". You can rename it and change its description.',
      },
      { status: 403 },
    );
  }

  const before = await getRole(id);
  const result = await updateRole(id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  if (body.permissions !== undefined && before) {
    const added = result.value.permissions.filter((p) => !before.permissions.includes(p));
    const removed = before.permissions.filter((p) => !result.value.permissions.includes(p));
    recordAudit({
      actorId: auth.actor.staff.id,
      actorName: auth.actor.staff.name,
      action: "role.permissions_changed",
      subject: id,
      summary: `Changed "${result.value.name}": ${
        added.length ? `granted ${added.map(permissionLabel).join(", ")}` : "granted nothing"
      }; ${removed.length ? `removed ${removed.map(permissionLabel).join(", ")}` : "removed nothing"}.`,
    });
  } else {
    recordAudit({
      actorId: auth.actor.staff.id,
      actorName: auth.actor.staff.name,
      action: "role.edited",
      subject: id,
      summary: `Edited the role "${result.value.name}".`,
    });
  }

  return NextResponse.json({ ok: true, role: result.value });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("roles.delete");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await deleteRole(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  recordAudit({
    actorId: auth.actor.staff.id,
    actorName: auth.actor.staff.name,
    action: "role.deleted",
    subject: id,
    summary: `Deleted the role "${result.value.name}".`,
  });

  return NextResponse.json({ ok: true, role: result.value });
}
