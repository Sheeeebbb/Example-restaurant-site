import type { RefundResult, RefundStatus } from "../types";

/**
 * What a refund is called, for each of the two audiences.
 *
 * Both live here, side by side, for one reason: the rule that the customer is
 * never told their money is on its way unless the payment provider said so is
 * easier to keep when the sentence that would break it is written next to the
 * sentence that must not. Neither function can invent a state — they only
 * describe the `RefundResult` the provider produced.
 *
 * No server imports, deliberately: both sides of the application render these,
 * and the staff screen is a client component.
 */

export type RefundTone = "good" | "info" | "warn" | "neutral";

export interface RefundNotice {
  headline: string;
  detail: string;
  tone: RefundTone;
}

/**
 * The customer's version.
 *
 * "Initiated" and "completed" are different sentences, and a failure is neither
 * — it is an apology and a phone call, because the one thing worse than a late
 * refund is being told you already have it.
 *
 * A missing record means an order cancelled before refunds existed here. That
 * is unknown, not "nothing owed", and it says so.
 */
export function customerRefundNotice(
  /*
   * The status alone, and that is the whole type on purpose.
   *
   * A customer is never shown a provider refund id or a failure message written
   * for staff, so the public endpoint does not send them — and this signature
   * is what keeps it that way. Widening it to `RefundResult` would make leaking
   * one of those fields into the copy a typo away rather than impossible.
   */
  refund: { status: RefundStatus } | undefined,
): RefundNotice {
  if (!refund) {
    return {
      headline: "Please contact us about your refund.",
      detail:
        "This order was cancelled before refunds were recorded here. Call us with your order number and we'll confirm what was charged and put it right.",
      tone: "neutral",
    };
  }

  switch (refund.status) {
    case "pending":
      return {
        headline: "Your refund has been initiated.",
        detail:
          "It's with your bank now, and usually takes a few working days to appear on your statement.",
        tone: "info",
      };
    case "succeeded":
      return {
        headline: "Your refund has been completed.",
        detail:
          "It may still take a few working days to appear on your statement, depending on your bank.",
        tone: "good",
      };
    case "failed":
      return {
        headline: "We couldn't process your refund automatically.",
        detail:
          "Nothing is lost — we've been alerted and will sort it out. Call us and quote your order number if you'd rather not wait.",
        tone: "warn",
      };
    case "notRequired":
      return {
        headline: "Nothing was charged for this order.",
        detail: "There's no payment to refund.",
        tone: "neutral",
      };
  }
}

/**
 * The staff version, plus the flag that decides whether it shouts.
 *
 * `needsAttention` is what makes a failed refund findable rather than merely
 * recorded: it is the difference between a line of text on a page nobody
 * scrolled to and a warning that says a person has to do something.
 */
export function staffRefundNotice(
  refund: RefundResult | undefined,
): RefundNotice & { needsAttention: boolean } {
  if (!refund) {
    return {
      headline: "No refund record",
      detail:
        "This order was cancelled before refunds were raised automatically. Check the payment provider before assuming the customer has their money.",
      tone: "warn",
      needsAttention: true,
    };
  }

  switch (refund.status) {
    case "pending":
      return {
        headline: "Refund initiated",
        detail: `Sent to ${refund.provider} and not confirmed yet. The customer has been told it is on its way.`,
        tone: "info",
        needsAttention: false,
      };
    case "succeeded":
      return {
        headline: "Refund confirmed",
        detail: `Confirmed by ${refund.provider}.`,
        tone: "good",
        needsAttention: false,
      };
    case "failed":
      return {
        headline: "Refund failed — needs manual action",
        detail:
          refund.failureMessage ??
          "The payment provider did not confirm the refund.",
        tone: "warn",
        needsAttention: true,
      };
    case "notRequired":
      return {
        headline: "No refund due",
        detail: "No payment was captured for this order, so nothing was sent back.",
        tone: "neutral",
        needsAttention: false,
      };
  }
}
