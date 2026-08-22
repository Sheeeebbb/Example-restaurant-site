import { isAcceptingOrdersAt, openingHoursSummary } from "@/lib/fulfillment/scheduling";
import { WEEKDAY_NAMES } from "@/lib/config/restaurant";

/**
 * Whether the kitchen is taking orders right now.
 *
 * Previously nothing on the site said this. A customer could browse, fill a
 * cart and reach checkout at 4am before anything told them the restaurant was
 * shut — and until the fix in `validateTiming`, the order was simply accepted.
 * Saying it up front is the honest half of that fix.
 *
 * Rendered on the server, so it reflects the restaurant's clock rather than the
 * customer's device — someone ordering from another timezone sees Berlin's
 * hours, which are the ones that matter.
 */
export function ServiceStatus({ className = "" }: { className?: string }) {
  const now = new Date();
  const open = isAcceptingOrdersAt(now);
  const hours = openingHoursSummary();
  const today = hours[now.getDay()];

  // The next day the kitchen actually opens, for the closed message.
  const nextOpen = (() => {
    for (let offset = 1; offset <= 7; offset += 1) {
      const day = (now.getDay() + offset) % 7;
      if (hours[day].hours !== "Closed") {
        return { name: offset === 1 ? "tomorrow" : WEEKDAY_NAMES[day], hours: hours[day].hours };
      }
    }
    return null;
  })();

  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
        open ? "bg-herb-soft text-herb" : "bg-surface-sunken text-ink-muted"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${open ? "bg-herb" : "bg-ink-subtle"}`}
      />
      {open ? (
        <>Open now · until {today.hours.split(" – ")[1]}</>
      ) : nextOpen ? (
        <>Closed · opens {nextOpen.name} {nextOpen.hours.split(" – ")[0]}</>
      ) : (
        <>Closed</>
      )}
    </p>
  );
}
