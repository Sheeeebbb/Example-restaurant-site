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

export const metadata: Metadata = { title: "Privacy policy" };

/**
 * Describes what this application actually does with data today.
 *
 * Deliberately NOT boilerplate copied from a real policy. Urban Table is a
 * fictional restaurant, and a convincing-looking legal document for an entity
 * that does not exist would be worse than useless — someone might rely on it.
 * What follows is an accurate description of the current implementation, which
 * is genuinely the most useful thing this page can contain.
 */
export default function PrivacyPage() {
  return (
    <Prose
      title="Privacy policy"
      intro={`${RESTAURANT.name} is a fictional restaurant built as a demonstration project. This page describes what the application actually does with data — it is not a legal document.`}
    >
      <section>
        <h2>What is stored, and where</h2>
        <p>
          Your basket, your delivery-or-pickup choice, and any promotional code
          you apply are saved in your own browser&rsquo;s local storage. That
          data never leaves your device and is not transmitted anywhere.
        </p>
        <p>
          Your name, phone number, email address, and delivery address are
          deliberately <strong>not</strong> written to local storage. During
          checkout they exist only in the page&rsquo;s memory, and they are gone
          when you close the tab.
        </p>
      </section>

      <section>
        <h2>Payments</h2>
        <p>
          No payments are processed. Checkout is simulated by a mock payment
          provider, and the application contains no field capable of accepting a
          card number, expiry date, or security code. Nothing is charged and no
          card details are collected or stored.
        </p>
      </section>

      <section>
        <h2>Tracking</h2>
        <p>
          There are no analytics, no advertising pixels, and no third-party
          tracking cookies. Fonts are self-hosted, so loading a page does not
          make a request to any external service.
        </p>
      </section>

      <section>
        <h2>Clearing your data</h2>
        <p>
          Emptying your cart removes the stored basket. Clearing site data for
          this domain in your browser settings removes everything else.
        </p>
      </section>

      <section>
        <h2>If this became a real restaurant</h2>
        <p>
          A production deployment would need a genuine privacy policy covering
          order records, payment processing through a provider such as Stripe,
          and any delivery partner handling your address. That policy would be
          written for the real operating entity — not adapted from this page.
        </p>
      </section>
    </Prose>
  );
}
