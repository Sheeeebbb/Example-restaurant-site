import { NextResponse } from "next/server";
import { getStaff, recordAudit, updateStaff } from "@/lib/staff/staff-repository";
import { requirePermission } from "@/lib/staff/authorize";
import { validatePassword } from "@/lib/staff/password";

/**
 * Edits a staff account.
 *
 * Three different things live behind one PATCH, and they need different
 * permissions, so each is checked against what the request actually contains:
 *
 *   name, roles, password  →  staff.edit
 *   disabled               →  staff.disable
 *
 * Separated because "let someone hire and assign roles" and "let someone lock
 * a colleague out mid-shift" are different amounts of trust.
 *
 * The safeguard against stranding the restaurant — removing the last account
 * that can manage staff and roles, or disabling it — is applied in the
 * repository, so it holds whichever field the request used to get there.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: {
    name?: string;
    roleIds?: string[];
    password?: string;
    disabled?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const changesAccount =
    body.name !== undefined || body.roleIds !== undefined || body.password !== undefined;
  const changesEnabled = body.disabled !== undefined;

  if (changesAccount) {
    const auth = await requirePermission("staff.edit");
    if (!auth.ok) return auth.response;
  }
  if (changesEnabled) {
    const auth = await requirePermission("staff.disable");
    if (!auth.ok) return auth.response;
  }

  // Re-read the actor once, after the checks above have both passed.
  const auth = await requirePermission(changesEnabled ? "staff.disable" : "staff.edit");
  if (!auth.ok) return auth.response;

  if (body.password !== undefined) {
    const problem = validatePassword(body.password);
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 422 });
  }

  const before = await getStaff(id);
  const result = await updateStaff(id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  /*
   * What changed, in words, and never the password itself — not its length,
   * not a masked version. "Set a new password" is the whole fact worth keeping.
   */
  const changes: string[] = [];
  if (body.name !== undefined && before?.name !== result.value.name) {
    changes.push(`renamed to ${result.value.name}`);
  }
  if (body.roleIds !== undefined) {
    changes.push(`roles set to ${result.value.roleIds.length} role(s)`);
  }
  if (body.password !== undefined) changes.push("set a new password");
  if (body.disabled !== undefined) {
    changes.push(result.value.disabled ? "disabled the account" : "re-enabled the account");
  }

  recordAudit({
    actorId: auth.actor.staff.id,
    actorName: auth.actor.staff.name,
    action: body.disabled !== undefined ? "staff.availability_changed" : "staff.edited",
    subject: id,
    summary: `${result.value.username}: ${changes.join(", ") || "no change"}.`,
  });

  return NextResponse.json({ ok: true, staff: result.value });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("staff.view");
  if (!auth.ok) return auth.response;

  const staff = await getStaff((await params).id);
  if (!staff) {
    return NextResponse.json({ ok: false, error: "No such staff account." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, staff });
}
