import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Cart" };

/** Placeholder. The real cart experience is built in a later stage. */
export default function CartPage() {
  return (
    <Container className="py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Cart
      </h1>
      <p className="mt-3 max-w-prose text-ink-muted">
        This page is scaffolded but not yet built. The foundation it depends on —
        menu data, pricing, and cart state — is already in place.
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-6">
        Back home
      </ButtonLink>
    </Container>
  );
}
