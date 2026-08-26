import type { Actor } from "./authorize";

/**
 * Which staff pages this person actually has.
 *
 * The navigation is built from permissions rather than filtered after the fact,
 * so a kitchen tablet shows Orders and nothing else — not Orders plus four
 * greyed-out links to places the person will never go. A menu of things you
 * cannot do is not information, it is noise on a screen someone is using with
 * one hand while carrying a tray.
 *
 * Every destination re-checks on the server. This decides what to draw; it
 * decides nothing about what is allowed.
 */
export interface StaffLink {
  href: string;
  label: string;
  /** The permission that opens it. */
  permission: string;
}

export const STAFF_LINKS: StaffLink[] = [
  { href: "/admin/orders", label: "Orders", permission: "orders.view" },
  { href: "/admin/deliveries", label: "Deliveries", permission: "deliveries.view" },
  { href: "/admin/menu", label: "Menu", permission: "menu.view" },
  { href: "/admin/staff", label: "Staff", permission: "staff.view" },
  { href: "/admin/roles", label: "Roles", permission: "roles.view" },
  { href: "/admin/audit", label: "Activity", permission: "audit.view" },
];

export function linksFor(permissions: Set<string> | string[]): StaffLink[] {
  const held = permissions instanceof Set ? permissions : new Set(permissions);
  return STAFF_LINKS.filter((link) => held.has(link.permission));
}

export function navigationFor(actor: Actor): StaffLink[] {
  return linksFor(actor.permissions);
}
