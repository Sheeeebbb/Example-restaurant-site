import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { currentActor } from "@/lib/staff/authorize";
import { listAudit } from "@/lib/staff/staff-repository";
import { RESTAURANT } from "@/lib/config/restaurant";

export const metadata: Metadata = { title: "Activity · Staff" };
export const dynamic = "force-dynamic";

/**
 * Who did what.
 *
 * Server-rendered, read-only, and deliberately plain: an audit log is read when
 * something has gone wrong, and the useful thing then is a list in time order
 * that nobody can edit from this screen.
 */
export default async function AuditPage() {
  const actor = await currentActor();
  if (!actor?.can("audit.view")) {
    return <NoAccess permission="audit.view" what="the activity log" />;
  }

  const entries = await listAudit(200);
  const format = new Intl.DateTimeFormat(RESTAURANT.dateLocale, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Activity
      </h1>
      <p className="mt-1 max-w-2xl text-ink-muted">
        Cancellations, refunds, backwards corrections, delivery claims, and every
        change to staff accounts, roles and the menu.
      </p>

      {entries.length === 0 ? (
        <p className="mt-8 text-ink-muted">Nothing recorded yet.</p>
      ) : (
        <ol className="mt-6 space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-card border border-line bg-surface p-4 text-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <time
                  dateTime={entry.at}
                  className="shrink-0 tabular-nums text-ink-subtle"
                >
                  {format.format(new Date(entry.at))}
                </time>
                <span className="font-medium text-ink">{entry.actorName}</span>
                <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs text-ink-muted">
                  {entry.action}
                </code>
                <span className="text-xs text-ink-subtle">{entry.subject}</span>
              </div>
              <p className="mt-1 leading-relaxed text-ink-muted">{entry.summary}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
