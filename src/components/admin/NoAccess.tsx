import Link from "next/link";
import { permissionLabel } from "@/lib/staff/permissions";

/**
 * What a staff member sees where a page they cannot open would have been.
 *
 * Not a redirect and not a blank screen: someone who followed a link, or whose
 * role was narrowed while they had the tab open, needs to know that the page
 * exists, that the answer is about their role rather than a bug, and who can
 * change it. A silent bounce to the dashboard teaches people that the software
 * is unreliable.
 *
 * It is also, emphatically, not the control. The page's data is never fetched
 * and the endpoints behind it refuse the same person independently. This is the
 * explanation, not the lock.
 */
export function NoAccess({
  permission,
  what,
}: {
  permission: string;
  /** What the page is, in the staff member's words: "the menu manager". */
  what: string;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <div className="rounded-card border border-line bg-surface p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Not part of your role
        </h1>
        <p className="mt-3 leading-relaxed text-ink-muted">
          Opening {what} needs the{" "}
          <span className="font-medium text-ink">
            &ldquo;{permissionLabel(permission)}&rdquo;
          </span>{" "}
          permission, and none of the roles on your account include it. Ask a
          manager if you need it — they can add it to your role without anyone
          touching the code.
        </p>
        <Link
          href="/admin"
          className="mt-8 inline-flex min-h-11 items-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover"
        >
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}
