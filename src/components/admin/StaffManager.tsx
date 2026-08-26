"use client";

import { useState } from "react";
import type { PublicStaff, Role } from "@/lib/staff/types";

/**
 * Staff accounts.
 *
 * Passwords are set here and never read back: there is no field on this screen
 * that shows one, no endpoint that returns one, and nothing in the record the
 * server sends that could be turned into one. Setting a password writes a new
 * scrypt digest and ends that account's sessions.
 *
 * Accounts are disabled rather than deleted, so the order history that names
 * them stays readable. A disabled account cannot sign in and its live sessions
 * end the moment it is disabled.
 */
export function StaffManager({
  initialStaff,
  roles,
  canCreate,
  canEdit,
  canDisable,
  selfId,
}: {
  initialStaff: PublicStaff[];
  roles: Role[];
  canCreate: boolean;
  canEdit: boolean;
  canDisable: boolean;
  /** So the screen can say "this is you" rather than making someone work it out. */
  selfId: string;
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PublicStaff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);

  const roleName = (id: string) => roles.find((role) => role.id === id)?.name ?? id;

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setError(null);
    setUsername("");
    setName("");
    setPassword("");
    setRoleIds([]);
  };

  const openEdit = (member: PublicStaff) => {
    setCreating(false);
    setEditing(member);
    setError(null);
    setUsername(member.username);
    setName(member.name);
    setPassword("");
    setRoleIds([...member.roleIds]);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
    setError(null);
    setPassword("");
  };

  const toggleRole = (id: string) =>
    setRoleIds((current) =>
      current.includes(id) ? current.filter((r) => r !== id) : [...current, id],
    );

  const apply = (saved: PublicStaff) =>
    setStaff((current) =>
      current.some((member) => member.id === saved.id)
        ? current.map((member) => (member.id === saved.id ? saved : member))
        : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
    );

  const save = async () => {
    setBusy(true);
    setError(null);

    const body: Record<string, unknown> = editing
      ? { name, roleIds, ...(password ? { password } : {}) }
      : { username, name, password, roleIds };

    const response = await fetch(
      editing ? `/api/admin/staff/${editing.id}` : "/api/admin/staff",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const result = (await response.json()) as {
      ok: boolean;
      staff?: PublicStaff;
      error?: string;
    };
    setBusy(false);

    if (!result.ok || !result.staff) {
      setError(result.error ?? "That didn't save.");
      return;
    }
    apply(result.staff);
    close();
  };

  const setDisabled = async (member: PublicStaff, disabled: boolean) => {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/staff/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      staff?: PublicStaff;
      error?: string;
    };
    setBusy(false);
    if (!result.ok || !result.staff) {
      // The lock-out safeguard speaks through here: "this would leave nobody
      // able to…". Shown as written, because it explains itself.
      setError(result.error ?? "That didn't save.");
      return;
    }
    apply(result.staff);
  };

  const open = creating || editing !== null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Staff
          </h1>
          <p className="mt-1 max-w-2xl text-ink-muted">
            Who can sign in, and which roles they hold. Someone&rsquo;s access is
            everything their roles allow, combined.
          </p>
        </div>
        {canCreate && !open && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-11 items-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover"
          >
            Add staff member
          </button>
        )}
      </div>

      {error && !open && (
        <p role="alert" className="mt-4 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {open && (
        <div className="mt-6 rounded-card border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-ink">
            {editing ? `Edit ${editing.name}` : "New staff member"}
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="staff-username" className="block text-sm font-medium text-ink">
                Username
              </label>
              <input
                id="staff-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={Boolean(editing)}
                autoCapitalize="none"
                spellCheck={false}
                className="mt-2 min-h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink disabled:opacity-60"
              />
              {editing && (
                <p className="mt-1 text-xs text-ink-subtle">
                  Usernames don&rsquo;t change — the audit trail refers to them.
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label htmlFor="staff-name" className="block text-sm font-medium text-ink">
                Name
              </label>
              <input
                id="staff-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink"
              />
            </div>
          </div>

          <label htmlFor="staff-password" className="mt-4 block text-sm font-medium text-ink">
            {editing ? "New password" : "Password"}
          </label>
          <input
            id="staff-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={editing ? "Leave blank to keep the current one" : ""}
            className="mt-2 min-h-11 w-full max-w-sm rounded-control border border-line bg-surface px-3 text-sm text-ink"
          />
          <p className="mt-1 text-xs text-ink-subtle">
            At least 12 characters. Stored as a scrypt digest and never shown
            again — if it is forgotten, set a new one.
            {editing && " Changing it signs them out everywhere."}
          </p>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-ink">Roles</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3 text-sm text-ink hover:bg-surface-sunken"
                >
                  <input
                    type="checkbox"
                    checked={roleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                    className="h-4 w-4 accent-[var(--color-ember)]"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="mt-4 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex min-h-11 items-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember disabled:opacity-50"
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Create account"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-4 text-sm font-semibold text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {staff.map((member) => (
          <li
            key={member.id}
            className={`rounded-card border bg-surface p-5 ${
              member.disabled ? "border-line opacity-70" : "border-line"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {member.name}
                  </h2>
                  <code className="text-sm text-ink-subtle">{member.username}</code>
                  {member.id === selfId && (
                    <span className="rounded-full bg-ember-soft px-2 py-0.5 text-xs font-semibold text-ember">
                      You
                    </span>
                  )}
                  {member.disabled && (
                    <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {member.roleIds.length > 0
                    ? member.roleIds.map(roleName).join(" · ")
                    : "No roles — this account can sign in and do nothing."}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEdit(member)}
                    className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-3 text-sm font-medium text-ink hover:bg-surface-sunken"
                  >
                    Edit
                  </button>
                )}
                {canDisable && (
                  <button
                    type="button"
                    onClick={() => setDisabled(member, !member.disabled)}
                    disabled={busy}
                    className={`inline-flex min-h-11 items-center rounded-control border px-3 text-sm font-medium disabled:opacity-50 ${
                      member.disabled
                        ? "border-herb text-herb hover:bg-herb-soft"
                        : "border-danger text-danger hover:bg-danger-soft"
                    }`}
                  >
                    {member.disabled ? "Re-enable" : "Disable"}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
