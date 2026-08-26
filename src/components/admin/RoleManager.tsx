"use client";

import { useState } from "react";
import type { PermissionGroup } from "@/lib/staff/permissions";
import type { Role } from "@/lib/staff/types";

/**
 * Designing roles.
 *
 * The editor is a list of checkboxes grouped the way the catalogue groups them,
 * and the catalogue is fetched rather than hard-coded — so a permission added
 * to the system later appears here with no change to this file. That is the
 * requirement "new permissions can be introduced later" made concrete: this
 * screen has no list of permissions in it.
 *
 * `canAssign` is the one thing it branches on, and it only decides whether the
 * checkboxes are editable. The server refuses a permission change from someone
 * without `roles.assign_permissions` whatever this component does.
 */
export function RoleManager({
  initialRoles,
  groups,
  canCreate,
  canEdit,
  canAssign,
  canDelete,
}: {
  initialRoles: Role[];
  groups: PermissionGroup[];
  canCreate: boolean;
  canEdit: boolean;
  canAssign: boolean;
  canDelete: boolean;
}) {
  const [roles, setRoles] = useState(initialRoles);
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setError(null);
    setDraftName("");
    setDraftDescription("");
    setDraftPermissions([]);
  };

  const openEdit = (role: Role) => {
    setCreating(false);
    setEditing(role);
    setError(null);
    setDraftName(role.name);
    setDraftDescription(role.description);
    setDraftPermissions([...role.permissions]);
  };

  const close = () => {
    setEditing(null);
    setCreating(false);
    setError(null);
  };

  const toggle = (id: string) =>
    setDraftPermissions((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );

  const save = async () => {
    setBusy(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: draftName,
      description: draftDescription,
    };
    // Only sent when this person may change it — and the server checks again.
    if (canAssign) payload.permissions = draftPermissions;

    const response = await fetch(
      editing ? `/api/admin/roles/${editing.id}` : "/api/admin/roles",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const body = (await response.json()) as { ok: boolean; role?: Role; error?: string };
    setBusy(false);

    if (!body.ok || !body.role) {
      setError(body.error ?? "That didn't save.");
      return;
    }

    const saved = body.role;
    setRoles((current) =>
      editing
        ? current.map((role) => (role.id === saved.id ? saved : role))
        : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
    );
    close();
  };

  const remove = async (role: Role) => {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
    const body = (await response.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!body.ok) {
      setError(body.error ?? "That didn't delete.");
      return;
    }
    setRoles((current) => current.filter((candidate) => candidate.id !== role.id));
  };

  const open = creating || editing !== null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Roles
          </h1>
          <p className="mt-1 max-w-2xl text-ink-muted">
            A role is a set of permissions. Staff hold roles, and what someone
            can do is everything their roles allow, added together.
          </p>
        </div>
        {canCreate && !open && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-11 items-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover"
          >
            New role
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
            {editing ? `Edit ${editing.name}` : "New role"}
          </h2>

          <label htmlFor="role-name" className="mt-4 block text-sm font-medium text-ink">
            Name
          </label>
          <input
            id="role-name"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            disabled={!canEdit && Boolean(editing)}
            className="mt-2 min-h-11 w-full max-w-sm rounded-control border border-line bg-surface px-3 text-sm text-ink"
          />

          <label htmlFor="role-description" className="mt-4 block text-sm font-medium text-ink">
            What it is for
          </label>
          <input
            id="role-description"
            value={draftDescription}
            onChange={(event) => setDraftDescription(event.target.value)}
            disabled={!canEdit && Boolean(editing)}
            className="mt-2 min-h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink"
          />

          <fieldset className="mt-6" disabled={!canAssign}>
            <legend className="text-sm font-semibold text-ink">
              What it allows
              {!canAssign && (
                <span className="ml-2 font-normal text-ink-subtle">
                  — you can rename this role, but changing what it allows needs
                  &ldquo;Change what a role allows&rdquo;.
                </span>
              )}
            </legend>

            <div className="mt-3 space-y-5">
              {groups.map((group) => (
                <div key={group.id}>
                  <p className="text-sm font-semibold text-ink">{group.label}</p>
                  <p className="text-xs text-ink-subtle">{group.description}</p>
                  <ul className="mt-2 space-y-1.5">
                    {group.permissions.map((permission) => (
                      <li key={permission.id}>
                        <label className="flex cursor-pointer gap-3 rounded-control p-2 hover:bg-surface-sunken">
                          <input
                            type="checkbox"
                            checked={draftPermissions.includes(permission.id)}
                            onChange={() => toggle(permission.id)}
                            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-ember)]"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-ink">
                              {permission.label}
                            </span>
                            <span className="block text-xs leading-relaxed text-ink-muted">
                              {permission.description}
                            </span>
                            <code className="block text-[11px] text-ink-subtle">
                              {permission.id}
                            </code>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
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
              {busy ? "Saving…" : editing ? "Save role" : "Create role"}
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
        {roles.map((role) => (
          <li key={role.id} className="rounded-card border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {role.name}
                  </h2>
                  {role.builtIn && (
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-subtle">
                      Built in
                    </span>
                  )}
                  <span className="text-xs text-ink-subtle">
                    {role.permissions.length} permission
                    {role.permissions.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
                  {role.description}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {(canEdit || canAssign) && (
                  <button
                    type="button"
                    onClick={() => openEdit(role)}
                    className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-3 text-sm font-medium text-ink hover:bg-surface-sunken"
                  >
                    Edit
                  </button>
                )}
                {canDelete && !role.builtIn && (
                  <button
                    type="button"
                    onClick={() => remove(role)}
                    className="inline-flex min-h-11 items-center rounded-control border border-danger px-3 text-sm font-medium text-danger hover:bg-danger-soft"
                  >
                    Delete
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
