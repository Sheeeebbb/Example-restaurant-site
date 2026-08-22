import { NextResponse } from "next/server";
import { getMenuItems } from "@/lib/data/repository";
import { createMenuItem, type MenuItemInput } from "@/lib/admin/menu-admin";

export async function GET() {
  return NextResponse.json({ ok: true, items: await getMenuItems() });
}

export async function POST(request: Request) {
  let input: MenuItemInput;
  try {
    input = (await request.json()) as MenuItemInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const result = await createMenuItem(input);
  return NextResponse.json(result, { status: result.ok ? 201 : 422 });
}
