import { NextResponse } from "next/server";
import { createStaff, listStaff, recordAudit } from "@/lib/staff/staff-repository";
import { requirePermission } from "@/lib/staff/authorize";
import { validatePassword } from "@/lib/staff/password";

export async function GET() {
  const auth = await requirePermission("staff.view");
  if (!auth.ok) return auth.response;

  // `listStaff` returns `PublicStaff`, which has no `passwordHash` field to
  // forget to strip. The digest cannot leave this server by this route because
  // the shape that leaves does not contain it.
  return NextResponse.json({ ok: true, staff: await listStaff() });
}

/**
 * Creates a staff account.
 *
 * The password is set here and never seen again: it is hashed on the way in,
 * and no endpoint anywhere returns it or a hint of it. Setting someone's first
 * password is the one moment it exists in the clear, and it exists in this
 * request and nowhere else — not in a log line, not in an audit entry.
 */
export async function POST(request: Request) {
  const auth = await requirePermission("staff.create");
  if (!auth.ok) return auth.response;

  let body: { username?: string; name?: string; password?: string; roleIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const passwordProblem = validatePassword(body.password ?? "");
  if (passwordProblem) {
    return NextResponse.json({ ok: false, error: passwordProblem }, { status: 422 });
  }

  const result = await createStaff({
    username: body.username ?? "",
    name: body.name ?? "",
    password: body.password as string,
    roleIds: body.roleIds,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  recordAudit({
    actorId: auth.actor.staff.id,
    actorName: auth.actor.staff.name,
    action: "staff.created",
    subject: result.value.id,
    summary: `Created the account "${result.value.username}" for ${result.value.name} with ${result.value.roleIds.length} role(s).`,
  });

  return NextResponse.json({ ok: true, staff: result.value }, { status: 201 });
}
