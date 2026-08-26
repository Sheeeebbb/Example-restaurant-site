import { NextResponse } from "next/server";
import { listAudit } from "@/lib/staff/staff-repository";
import { requirePermission } from "@/lib/staff/authorize";

/**
 * The record of who did what.
 *
 * Its own permission, because reading it is a different kind of access from
 * doing the things in it: a role can be allowed to cancel orders without being
 * allowed to review everyone else's cancellations.
 */
export async function GET() {
  const auth = await requirePermission("audit.view");
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true, entries: await listAudit(200) });
}
