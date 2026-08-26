/**
 * The permission catalogue.
 *
 * A permission is a single capability, named as a string, and it is the ONLY
 * currency this application's authorisation deals in. Nothing anywhere asks
 * what role someone has — code asks whether they hold a permission, roles are
 * bags of permissions, and staff hold roles. That indirection is the whole
 * design: a restaurant can invent "Senior Kitchen Staff" or "Weekend Manager"
 * by combining permissions differently, and no code changes.
 *
 * ── Adding a permission later ───────────────────────────────────────────────
 * Add an entry to `PERMISSION_CATALOGUE` below and it becomes assignable
 * immediately: the role editor lists it, roles can hold it, and the checks read
 * it. That is the extension point — `reports.view` or `discounts.manage` is one
 * line here plus the check where the feature lives.
 *
 * Existing roles do NOT gain it automatically, deliberately. A new capability
 * appearing in someone's hands because it was invented is how permission
 * systems rot. Grant it explicitly, in the role editor or in a migration (see
 * `staff-repository.ts`).
 *
 * ── Why strings, not an enum ────────────────────────────────────────────────
 * Roles are data: they are stored, edited by managers at runtime, and will one
 * day live in a database. A stored role that names a permission this build has
 * never heard of has to survive being read, listed and saved again — which a
 * string does and a closed union does not. `isKnownPermission` is how code asks
 * whether the catalogue recognises one.
 */

export interface PermissionDefinition {
  /** The stable identifier stored on roles. Never renamed once shipped. */
  id: string;
  /** What the role editor calls it. */
  label: string;
  /** What it actually lets someone do, in a sentence a manager can act on. */
  description: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  description: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_CATALOGUE: PermissionGroup[] = [
  {
    id: "orders",
    label: "Orders",
    description: "Seeing orders and moving them through the kitchen.",
    permissions: [
      {
        id: "orders.view",
        label: "View orders",
        description:
          "See the order queue and every order's details, including the customer's name, phone and address.",
      },
      {
        id: "orders.change_status",
        label: "Change any status",
        description:
          "Move an order to any stage on its normal path. A broader grant than the individual stage permissions below — hold this instead of them, not as well.",
      },
      {
        id: "orders.status.received",
        label: "Mark order received",
        description: "Move an order to the first stage.",
      },
      {
        id: "orders.status.preparing",
        label: "Mark preparing",
        description: "Take an order into the kitchen.",
      },
      {
        id: "orders.status.ready",
        label: "Mark ready",
        description: "Say the food is cooked and ready to leave.",
      },
      {
        id: "orders.status.out_for_delivery",
        label: "Mark out for delivery",
        description:
          "Send any order out, whether or not it is assigned to you. Delivery staff use the delivery permissions instead, which only cover their own runs.",
      },
      {
        id: "orders.status.delivered",
        label: "Mark delivered or collected",
        description:
          "Finish any order. Delivery staff use the delivery permissions instead, which only cover their own runs.",
      },
      {
        id: "orders.status.backward",
        label: "Correct a status backwards",
        description:
          "Move an order back to an earlier stage when it was marked wrongly. Also needs the permission for the stage being moved to.",
      },
      {
        id: "orders.cancel",
        label: "Cancel orders",
        description:
          "End an order with a reason the customer is shown. This also refunds the payment automatically.",
      },
    ],
  },
  {
    id: "deliveries",
    label: "Deliveries",
    description: "The driver's own run: claiming a delivery and completing it.",
    permissions: [
      {
        id: "deliveries.view",
        label: "View deliveries",
        description:
          "See orders waiting for a driver and the ones already assigned, with the address needed to deliver them.",
      },
      {
        id: "deliveries.accept",
        label: "Accept a delivery",
        description:
          "Claim an unassigned order that is ready to go. It is then assigned to you and nobody else can take it.",
      },
      {
        id: "deliveries.out_for_delivery",
        label: "Set own delivery under way",
        description:
          "Mark an order you have been assigned as out for delivery. Only your own.",
      },
      {
        id: "deliveries.confirm_delivery",
        label: "Confirm own delivery",
        description:
          "Mark an order you have been assigned as delivered. Only your own.",
      },
    ],
  },
  {
    id: "menu",
    label: "Menu",
    description: "The dishes, their prices and their photographs.",
    permissions: [
      {
        id: "menu.view",
        label: "View the menu manager",
        description: "See the menu with its prices and availability.",
      },
      {
        id: "menu.create",
        label: "Add dishes",
        description: "Put a new dish on the menu.",
      },
      {
        id: "menu.edit",
        label: "Edit dishes",
        description:
          "Change a dish's name, description, price, options or availability.",
      },
      {
        id: "menu.delete",
        label: "Remove dishes",
        description: "Take a dish off the menu.",
      },
      {
        id: "menu.manage_images",
        label: "Manage dish photographs",
        description: "Upload and replace the photographs shown to customers.",
      },
    ],
  },
  {
    id: "refunds",
    label: "Refunds",
    description: "Money going back to customers.",
    permissions: [
      {
        id: "refunds.view",
        label: "View refund status",
        description:
          "See whether a cancelled order's refund succeeded, and the payment references behind it.",
      },
      {
        id: "refunds.initiate",
        label: "Retry a failed refund",
        description:
          "Ask the payment provider again for a refund that failed. Cancelling already refunds automatically; this is for the ones that did not go through.",
      },
    ],
  },
  {
    id: "staff",
    label: "Staff",
    description: "The people who can sign in.",
    permissions: [
      {
        id: "staff.view",
        label: "View staff",
        description: "See the list of staff accounts and the roles they hold.",
      },
      {
        id: "staff.create",
        label: "Create staff accounts",
        description: "Add a staff member and set their first password.",
      },
      {
        id: "staff.edit",
        label: "Edit staff accounts",
        description:
          "Change a staff member's name, roles, or password. Does not include designing roles.",
      },
      {
        id: "staff.disable",
        label: "Disable and re-enable staff",
        description:
          "Stop an account signing in, and let it back in later. Accounts are disabled rather than deleted so their history stays readable.",
      },
    ],
  },
  {
    id: "roles",
    label: "Roles",
    description:
      "The permission sets staff are given. Separate from managing staff, so someone can hire without redesigning what the roles mean.",
    permissions: [
      {
        id: "roles.view",
        label: "View roles",
        description: "See the roles and what each one allows.",
      },
      {
        id: "roles.create",
        label: "Create roles",
        description:
          "Invent a new role. Filling it with permissions is a separate grant, so this alone creates an empty one.",
      },
      {
        id: "roles.edit",
        label: "Rename and describe roles",
        description: "Change a role's name and description.",
      },
      {
        id: "roles.delete",
        label: "Delete roles",
        description: "Remove a role that is no longer used.",
      },
      {
        id: "roles.assign_permissions",
        label: "Change what a role allows",
        description:
          "Add and remove permissions on a role. The most powerful permission there is — it can grant any other.",
      },
    ],
  },
  {
    id: "audit",
    label: "Audit",
    description: "The record of who did what.",
    permissions: [
      {
        id: "audit.view",
        label: "View the audit log",
        description:
          "Read the record of cancellations, refunds, corrections, and staff and role changes.",
      },
    ],
  },
];

/** Every permission id in the catalogue, in catalogue order. */
export const ALL_PERMISSIONS: string[] = PERMISSION_CATALOGUE.flatMap((group) =>
  group.permissions.map((permission) => permission.id),
);

const CATALOGUE_INDEX = new Map(
  PERMISSION_CATALOGUE.flatMap((group) =>
    group.permissions.map((permission) => [permission.id, permission] as const),
  ),
);

export function isKnownPermission(id: string): boolean {
  return CATALOGUE_INDEX.has(id);
}

export function permissionDefinition(id: string): PermissionDefinition | null {
  return CATALOGUE_INDEX.get(id) ?? null;
}

/** The label for a permission, falling back to its id if the build predates it. */
export function permissionLabel(id: string): string {
  return CATALOGUE_INDEX.get(id)?.label ?? id;
}

/**
 * Permissions that must never end up held by nobody.
 *
 * Between them, these are the keys to the building: the ability to see staff,
 * create and edit them, and change what roles allow. Lose all of them and the
 * restaurant cannot let anyone back in without a developer editing the
 * database — so every mutation is simulated against the state it would produce
 * and refused if it would empty one of these out. See `wouldLockOut`.
 *
 * Written as a list rather than "the Manager role" on purpose. A restaurant
 * that renames Manager, splits it in two, or hands these to a different role
 * entirely is still protected, because the rule is about the capability
 * surviving, not about a particular role existing.
 */
export const LOCKOUT_CRITICAL_PERMISSIONS = [
  "staff.view",
  "staff.create",
  "staff.edit",
  "roles.view",
  "roles.assign_permissions",
] as const;
