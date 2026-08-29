/**
 * NOT TRANSLATED, deliberately.
 *
 * This is a legal instrument, not interface copy. A privacy notice and a set of
 * terms say what the restaurant is bound to and what a customer has agreed to,
 * and a translation of them is a second binding document — one whose wording
 * should come from whoever is accountable for the first, not from the person
 * who wired up the i18n system.
 *
 * So it falls back to English, which is exactly what the fallback is for: a
 * real sentence in the wrong language beats a confident wrong sentence in the
 * right one. When counsel supplies Dutch copy, it becomes a `legal` namespace
 * in the message catalogue like anything else — no code here has to change
 * shape for that to happen.
 */
import type { Metadata } from "next";
import { Prose } from "@/components/layout/Prose";
import { RESTAURANT } from "@/lib/config/restaurant";
import { formatMoney } from "@/lib/money";
import { FIRST_ORDER_PROMO } from "@/lib/data/promotions";

export const metadata: Metadata = { title: "Terms" };

/**
 * The rules the application genuinely enforces, rather than invented legalese.
 *
 * Every figure here is read from configuration, so this page cannot drift away
 * from what the ordering logic actually does.
 */
export default function TermsPage() {
  return (
    <Prose
      title="Terms"
      intro={`${RESTAURANT.name} is a fictional restaurant built as a demonstration project. No real orders are fulfilled and no payments are taken. These are the rules the application itself enforces.`}
    >
      <section>
        <h2>Orders</h2>
        <ul>
          <li>
            Orders are simulated. Nothing is cooked, delivered, or charged.
          </li>
          <li>
            Menu prices are shown in euros and include VAT at{" "}
            {RESTAURANT.fees.taxRatePercent}%. The tax line on your receipt shows
            how much of the total is VAT; it is not added on top.
          </li>
          <li>
            Items can be marked unavailable by staff at any time and cannot be
            ordered while they are.
          </li>
        </ul>
      </section>

      <section>
        <h2>Delivery and pickup</h2>
        <ul>
          <li>
            Delivery fees and minimum order values vary by neighbourhood. Both
            are shown before you pay.
          </li>
          <li>
            Delivery is free on orders of{" "}
            {formatMoney(RESTAURANT.fees.freeDeliveryThreshold)} or more, before
            discounts.
          </li>
          <li>
            Pickup is free and can be scheduled up to{" "}
            {RESTAURANT.ordering.maxDaysAhead} days ahead.
          </li>
          <li>
            Orders close {RESTAURANT.ordering.lastOrderBufferMinutes} minutes
            before the kitchen does.
          </li>
        </ul>
      </section>

      <section>
        <h2>Promotional codes</h2>
        <ul>
          <li>
            <strong>{FIRST_ORDER_PROMO.code}</strong> takes{" "}
            {FIRST_ORDER_PROMO.value}% off orders over{" "}
            {formatMoney(FIRST_ORDER_PROMO.minimumSubtotal)}.
          </li>
          <li>
            Discounts apply to food only — never to the delivery fee, and never
            below zero.
          </li>
          <li>One code per order. Codes are validated when you check out.</li>
        </ul>
      </section>

      <section>
        <h2>Payment</h2>
        <p>
          Checkout uses a mock payment provider. No card details are collected
          and no money moves. See the{" "}
          <a href="/privacy" className="text-ember underline underline-offset-4">
            privacy policy
          </a>{" "}
          for what is stored.
        </p>
      </section>
    </Prose>
  );
}
