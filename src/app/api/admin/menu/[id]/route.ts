import { NextResponse } from "next/server";
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
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await deleteMenuItem(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
