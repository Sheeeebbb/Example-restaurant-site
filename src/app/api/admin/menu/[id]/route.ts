import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/staff/authorize";
import { recordAudit } from "@/lib/staff/staff-repository";
import {
  deleteMenuItem,
  setMenuItemAvailability,
  updateMenuItem,
  type MenuItemInput,
} from "@/lib/admin/menu-admin";

/**
 * PATCH takes either a full item (an edit) or `{ available }` alone — the
 * availability toggle is the action staff use most, and making them round-trip
 * a whole item to flip one flag would be a poor use of a busy service.
 *
 * Both are `menu.edit`: taking a dish off the menu for the night changes what
 * customers can buy just as much as changing its price does.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("menu.edit");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: Partial<MenuItemInput> & { available?: boolean };
  try {
    body = (await request.json()) as Partial<MenuItemInput> & { available?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const isAvailabilityOnly =
    typeof body.available === "boolean" && body.name === undefined;

  const result = isAvailabilityOnly
    ? await setMenuItemAvailability(id, body.available as boolean)
    : await updateMenuItem(id, body as MenuItemInput);

  if (result.ok) {
    recordAudit({
      actorId: auth.actor.staff.id,
      actorName: auth.actor.staff.name,
      action: isAvailabilityOnly ? "menu.availability_changed" : "menu.edited",
      subject: id,
      summary: isAvailabilityOnly
        ? `Marked "${result.item.name}" ${body.available ? "available" : "unavailable"}.`
        : `Edited "${result.item.name}".`,
    });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("menu.delete");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await deleteMenuItem(id);
  if (result.ok) {
    recordAudit({
      actorId: auth.actor.staff.id,
      actorName: auth.actor.staff.name,
      action: "menu.deleted",
      subject: id,
      summary: `Removed dish ${id} from the menu.`,
    });
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
