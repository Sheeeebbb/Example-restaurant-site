import { beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { resetStore } from "../server/store";
import {
  ALL_PERMISSIONS,
  LOCKOUT_CRITICAL_PERMISSIONS,
  PERMISSION_CATALOGUE,
  isKnownPermission,
} from "./permissions";
import {
  createRole,
  createStaff,
  deleteRole,
  ensureStaffData,
  listRoles,
  listStaff,
  permissionsFor,
  publicStaff,
  resolvePermissions,
  signIn,
  signOut,
  staffForToken,
  updateRole,
  updateStaff,
  wouldLockOut,
} from "./staff-repository";
import { hashPassword, needsRehash, validatePassword, verifyPassword } from "./password";
import type { Role, StaffAccount } from "./types";

const PASSWORD = "correct-horse-battery-staple";

beforeEach(() => resetStore());

async function seeded() {
  await ensureStaffData();
  const roles = await listRoles();
  return {
    manager: roles.find((role) => role.name === "Manager")!,
    kitchen: roles.find((role) => role.name === "Kitchen Staff")!,
    delivery: roles.find((role) => role.name === "Delivery Staff")!,
    roles,
  };
}

describe("the permission catalogue", () => {
  it("has no duplicate ids", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it("names every permission in the dotted form the checks use", () => {
    for (const id of ALL_PERMISSIONS) {
      expect(id, id).toMatch(/^[a-z]+(\.[a-z_]+)+$/);
    }
  });

  it("explains every permission to whoever is assigning it", () => {
    for (const group of PERMISSION_CATALOGUE) {
      for (const permission of group.permissions) {
        expect(permission.label.length, permission.id).toBeGreaterThan(3);
        expect(permission.description.length, permission.id).toBeGreaterThan(20);
      }
    }
  });

  it("recognises its own and nothing else", () => {
    expect(isKnownPermission("orders.view")).toBe(true);
    expect(isKnownPermission("orders.*")).toBe(false);
    expect(isKnownPermission("*")).toBe(false);
    expect(isKnownPermission("reports.view")).toBe(false);
  });
});

describe("seeding and migration", () => {
  it("creates the three initial roles", async () => {
    const { manager, kitchen, delivery } = await seeded();
    expect(manager.permissions).toEqual([...ALL_PERMISSIONS].sort());
    expect(kitchen.permissions.sort()).toEqual([
      "orders.status.preparing",
      "orders.status.ready",
      "orders.view",
    ]);
    expect(delivery.permissions.sort()).toEqual([
      "deliveries.accept",
      "deliveries.confirm_delivery",
      "deliveries.out_for_delivery",
      "deliveries.view",
    ]);
  });

  it("gives the kitchen and delivery roles nothing they were not granted", async () => {
    const { kitchen, delivery } = await seeded();
    for (const role of [kitchen, delivery]) {
      for (const forbidden of [
        "staff.create",
        "roles.assign_permissions",
        "menu.edit",
        "refunds.initiate",
        "orders.cancel",
        "orders.status.backward",
      ]) {
        expect(role.permissions, `${role.name} / ${forbidden}`).not.toContain(forbidden);
      }
    }
    expect(kitchen.permissions).not.toContain("deliveries.accept");
    expect(delivery.permissions).not.toContain("orders.view");
  });

  it("migrates the old shared passcode into a real account", async () => {
    await ensureStaffData();
    const session = await signIn("manager", "urbantable");
    expect(session).not.toBeNull();
    // ...as a hashed password, not the environment variable it came from.
    const staff = await staffForToken(session!.token);
    expect(staff?.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(staff?.passwordHash).not.toContain("urbantable");
  });

  it("is idempotent — running again changes nothing", async () => {
    await ensureStaffData();
    const before = await listRoles();
    await updateRole(before[0].id, { description: "Edited by the restaurant." });
    await ensureStaffData();
    await ensureStaffData();

    const after = await listRoles();
    expect(after).toHaveLength(before.length);
    expect(after.find((role) => role.id === before[0].id)?.description).toBe(
      "Edited by the restaurant.",
    );
  });
});

describe("passwords", () => {
  it("never stores the password", async () => {
    const digest = await hashPassword(PASSWORD);
    expect(digest).not.toContain(PASSWORD);
    expect(digest.startsWith("scrypt$")).toBe(true);
  });

  it("verifies the right one and rejects the rest", async () => {
    const digest = await hashPassword(PASSWORD);
    expect(await verifyPassword(PASSWORD, digest)).toBe(true);
    expect(await verifyPassword(`${PASSWORD} `, digest)).toBe(false);
    expect(await verifyPassword("", digest)).toBe(false);
  });

  it("salts, so two identical passwords do not share a digest", async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it("fails closed on a corrupt digest rather than throwing", async () => {
    for (const bad of ["", "nonsense", "scrypt$x$y$z$a$b", "bcrypt$1$2$3$4$5"]) {
      expect(await verifyPassword(PASSWORD, bad), bad).toBe(false);
    }
  });

  it("knows when a digest was written with weaker parameters", async () => {
    expect(needsRehash(await hashPassword(PASSWORD))).toBe(false);
    expect(needsRehash("scrypt$2$8$1$AAAA$BBBB")).toBe(true);
    expect(needsRehash("not-a-digest")).toBe(true);
  });

  it("asks for length rather than punctuation", () => {
    expect(validatePassword("short")).toMatch(/at least 12/i);
    expect(validatePassword("a-long-enough-passphrase")).toBeNull();
  });
});

describe("resolving permissions", () => {
  const role = (id: string, permissions: string[]): Role => ({
    id,
    name: id,
    description: "",
    permissions,
    builtIn: false,
    createdAt: "",
    updatedAt: "",
  });

  it("is the union of the account's roles", () => {
    const permissions = resolvePermissions({ roleIds: ["a", "b"] }, [
      role("a", ["orders.view"]),
      role("b", ["menu.view", "orders.view"]),
    ]);
    expect([...permissions].sort()).toEqual(["menu.view", "orders.view"]);
  });

  it("can only ever add — a second role never removes access", () => {
    const first = resolvePermissions({ roleIds: ["a"] }, [
      role("a", ["orders.view", "orders.cancel"]),
      role("b", []),
    ]);
    const both = resolvePermissions({ roleIds: ["a", "b"] }, [
      role("a", ["orders.view", "orders.cancel"]),
      role("b", []),
    ]);
    for (const permission of first) expect(both.has(permission), permission).toBe(true);
  });

  it("ignores a role that no longer exists rather than throwing", () => {
    expect([...resolvePermissions({ roleIds: ["gone"] }, [])]).toEqual([]);
  });

  it("gives a disabled account nothing at all", async () => {
    const { kitchen } = await seeded();
    const created = await createStaff({
      username: "cook",
      name: "Sam",
      password: PASSWORD,
      roleIds: [kitchen.id],
    });
    const id = created.ok ? created.value.id : "";
    expect([...(await permissionsFor(id))].length).toBeGreaterThan(0);

    await updateStaff(id, { disabled: true });
    expect([...(await permissionsFor(id))]).toEqual([]);
  });
});

describe("roles are data", () => {
  it("lets a restaurant invent one at runtime", async () => {
    const result = await createRole({
      name: "Assistant Manager",
      description: "Runs the floor.",
      permissions: ["orders.view", "orders.change_status", "orders.cancel", "menu.edit"],
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.builtIn).toBe(false);
    expect(result.ok && result.value.permissions).toContain("orders.cancel");
  });

  it("refuses a permission this build has never heard of", async () => {
    const result = await createRole({
      name: "Wildcard",
      permissions: ["orders.view", "*", "orders.*", "reports.view"],
    });
    // Only the real one survives: a role may not promise access nothing checks.
    expect(result.ok && result.value.permissions).toEqual(["orders.view"]);
  });

  it("refuses two roles with the same name", async () => {
    await createRole({ name: "Floor" });
    const second = await createRole({ name: "  floor  " });
    expect(second.ok).toBe(false);
  });

  it("will not delete a role somebody holds", async () => {
    const { kitchen } = await seeded();
    const custom = await createRole({ name: "Weekend Cook", permissions: ["orders.view"] });
    const roleId = custom.ok ? custom.value.id : "";
    await createStaff({ username: "weekend", name: "Sam", password: PASSWORD, roleIds: [roleId] });

    const blocked = await deleteRole(roleId);
    expect(blocked.ok).toBe(false);
    expect(blocked.ok ? "" : blocked.error).toMatch(/staff member holds/i);
    void kitchen;
  });

  it("will not delete a built-in role", async () => {
    const { kitchen } = await seeded();
    const result = await deleteRole(kitchen.id);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/ships with/i);
  });
});

describe("the restaurant cannot lock itself out", () => {
  const accountsAnd = (roles: Role[], staff: Partial<StaffAccount>[]): StaffAccount[] =>
    staff.map((account, index) => ({
      id: `s${index}`,
      username: `u${index}`,
      name: `N${index}`,
      passwordHash: "",
      roleIds: [],
      disabled: false,
      createdAt: "",
      updatedAt: "",
      ...account,
    })) as StaffAccount[];

  it("names the capability that would be lost", async () => {
    const { manager, kitchen } = await seeded();
    const roles = [manager, kitchen];
    const fine = accountsAnd(roles, [{ roleIds: [manager.id] }]);
    expect(wouldLockOut(fine, roles)).toBeNull();

    const stranded = accountsAnd(roles, [{ roleIds: [kitchen.id] }]);
    expect(LOCKOUT_CRITICAL_PERMISSIONS).toContain(wouldLockOut(stranded, roles) as never);
  });

  it("counts only enabled accounts", async () => {
    const { manager } = await seeded();
    const disabled = accountsAnd([manager], [{ roleIds: [manager.id], disabled: true }]);
    expect(wouldLockOut(disabled, [manager])).not.toBeNull();
  });

  it("blocks disabling the last account that holds the keys", async () => {
    await ensureStaffData();
    const [seededManager] = await listStaff();
    const result = await updateStaff(seededManager.id, { disabled: true });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/would leave nobody able to/i);
  });

  it("blocks emptying the last role that holds them", async () => {
    const { manager } = await seeded();
    const result = await updateRole(manager.id, { permissions: ["orders.view"] });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/would leave nobody able to/i);
  });

  it("blocks moving the last holder onto a role without them", async () => {
    const { kitchen } = await seeded();
    const [seededManager] = await listStaff();
    const result = await updateStaff(seededManager.id, { roleIds: [kitchen.id] });
    expect(result.ok).toBe(false);
  });

  it("allows all of it once a second account holds them", async () => {
    const { manager } = await seeded();
    const [first] = await listStaff();
    await createStaff({
      username: "second",
      name: "Second Manager",
      password: PASSWORD,
      roleIds: [manager.id],
    });

    const result = await updateStaff(first.id, { disabled: true });
    expect(result.ok).toBe(true);
  });

  it("is about capabilities, not about a role called Manager", async () => {
    const { manager } = await seeded();
    const [first] = await listStaff();

    // A restaurant that invents its own top role is protected by the same rule.
    const invented = await createRole({
      name: "Owner",
      permissions: [...LOCKOUT_CRITICAL_PERMISSIONS],
    });
    await createStaff({
      username: "owner",
      name: "The Owner",
      password: PASSWORD,
      roleIds: [invented.ok ? invented.value.id : ""],
    });

    // Now the seeded manager is expendable...
    expect((await updateStaff(first.id, { disabled: true })).ok).toBe(true);
    // ...and the Manager role can be emptied, because Owner still has the keys.
    expect((await updateRole(manager.id, { permissions: ["orders.view"] })).ok).toBe(true);
  });
});

describe("sessions", () => {
  it("issues an opaque token that carries nothing", async () => {
    await ensureStaffData();
    const session = await signIn("manager", "urbantable");
    expect(session?.token).toMatch(/^[0-9a-f]{64}$/);
    // Nothing decodable: no staff id, no role, no permission, no expiry.
    expect(session?.token).not.toContain("manager");
  });

  it("refuses a wrong password and an unknown user alike", async () => {
    await ensureStaffData();
    expect(await signIn("manager", "wrong")).toBeNull();
    expect(await signIn("nobody", "urbantable")).toBeNull();
  });

  it("refuses a disabled account even with the right password", async () => {
    const { manager } = await seeded();
    await createStaff({ username: "spare", name: "Spare", password: PASSWORD, roleIds: [manager.id] });
    const [first] = (await listStaff()).filter((s) => s.username === "manager");
    await updateStaff(first.id, { disabled: true });
    expect(await signIn("manager", "urbantable")).toBeNull();
  });

  it("ends a session on sign-out, server-side", async () => {
    await ensureStaffData();
    const session = await signIn("manager", "urbantable");
    expect(await staffForToken(session!.token)).not.toBeNull();
    await signOut(session!.token);
    expect(await staffForToken(session!.token)).toBeNull();
  });

  it("ends every session when the account is disabled or its password changes", async () => {
    const { manager } = await seeded();
    const created = await createStaff({
      username: "second",
      name: "Second",
      password: PASSWORD,
      roleIds: [manager.id],
    });
    const id = created.ok ? created.value.id : "";

    const a = await signIn("second", PASSWORD);
    await updateStaff(id, { password: "a-brand-new-passphrase" });
    expect(await staffForToken(a!.token)).toBeNull();

    const b = await signIn("second", "a-brand-new-passphrase");
    await updateStaff(id, { disabled: true });
    expect(await staffForToken(b!.token)).toBeNull();
  });

  it("refuses a token nobody issued", async () => {
    await ensureStaffData();
    expect(await staffForToken("f".repeat(64))).toBeNull();
    expect(await staffForToken("staff-demo-session")).toBeNull();
  });
});

describe("what leaves the server", () => {
  it("never includes the password digest", async () => {
    await ensureStaffData();
    for (const member of await listStaff()) {
      expect(Object.keys(member)).not.toContain("passwordHash");
      expect(JSON.stringify(member)).not.toMatch(/scrypt/);
    }
  });

  it("strips it from a raw account too", () => {
    const stripped = publicStaff({
      id: "s1",
      username: "u",
      name: "N",
      passwordHash: "scrypt$1$2$3$4$5",
      roleIds: [],
      disabled: false,
      createdAt: "",
      updatedAt: "",
    });
    expect(JSON.stringify(stripped)).not.toContain("scrypt");
  });
});

/**
 * The guard that makes "no handler can forget" true rather than aspirational.
 *
 * Reads every route file under `app/api/admin` and insists it consults the
 * authorisation module. A new endpoint added without a check fails this test
 * before it can reach a deployment — which is the only way a rule like "every
 * protected route checks" survives contact with a growing application.
 */
describe("every admin endpoint is guarded", () => {
  const ADMIN_API = join(process.cwd(), "src/app/api/admin");

  const routeFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return routeFiles(path);
      return entry === "route.ts" ? [path] : [];
    });

  const files = routeFiles(ADMIN_API);

  it("finds the routes at all, so this test cannot pass vacuously", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files.map((file) => [file.replace(process.cwd(), ""), file]))(
    "%s checks a permission",
    (_label, file) => {
      const source = readFileSync(file, "utf8");

      /*
       * The sign-in endpoint is the one exception, and it is exempt by name
       * rather than by pattern: it is how a session is obtained, so requiring
       * one would make it impossible to sign in. It is also the only file in
       * here that may be reachable unauthenticated.
       */
      if (file.endsWith(join("session", "route.ts"))) {
        expect(source).toMatch(/signIn|currentActor/);
        return;
      }

      expect(source).toMatch(
        /requirePermission\(|requireAnyPermission\(|currentActor\(/,
      );
    },
  );

  it.each(files.map((file) => [file.replace(process.cwd(), ""), file]))(
    "%s never derives the CALLER's permissions from the request",
    (_label, file) => {
      const source = readFileSync(file, "utf8");

      /*
       * The distinction this test draws, because it is the one that matters:
       * `/api/admin/roles` legitimately reads `body.permissions` — that is the
       * role being edited, the data. What no handler may do is work out what
       * the CALLER is allowed to do from anything the caller sent.
       *
       * There is exactly one sanctioned source, `lib/staff/authorize.ts`, and
       * it reads the session cookie. So: no route may resolve permissions for
       * itself, and none may take them from a header.
       */
      expect(source, "resolves permissions itself").not.toMatch(
        /resolvePermissions\(|permissionsFor\(|staffForToken\(/,
      );
      expect(source, "reads a role or permission header").not.toMatch(
        /headers\.get\(\s*["'`]x-(role|permission)/i,
      );
      // And the actor always comes from the module that reads the cookie.
      if (!file.endsWith(join("session", "route.ts"))) {
        expect(source, "imports the authorisation gate").toMatch(
          /from "@\/lib\/staff\/authorize"/,
        );
      }
    },
  );
});
