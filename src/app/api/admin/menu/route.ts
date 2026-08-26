import { NextResponse } from "next/server";
import { getMenuItems } from "@/lib/data/repository";
import { createMenuItem, type MenuItemInput } from "@/lib/admin/menu-admin";
import { requirePermission } from "@/lib/staff/authorize";
import { recordAudit } from "@/lib/staff/staff-repository";

/** Reading the menu manager and adding to it are separate permissions. */
export async function GET() {
  const auth = await requirePermission("menu.view");
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true, items: await getMenuItems() });
}

export async function POST(request: Request) {
  const auth = await requirePermission("menu.create");
  if (!auth.ok) return auth.response;

  let input: MenuItemInput;
  try {
    input = (await request.json()) as MenuItemInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const result = await createMenuItem(input);
  if (result.ok) {
    recordAudit({
      actorId: auth.actor.staff.id,
      actorName: auth.actor.staff.name,
      action: "menu.created",
      subject: result.item.id,
      summary: `Added "${result.item.name}" to the menu.`,
    });
  }
  return NextResponse.json(result, { status: result.ok ? 201 : 422 });
}
