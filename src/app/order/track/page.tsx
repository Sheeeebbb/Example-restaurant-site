import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Track your order" };

/** Placeholder. Order tracking is built in a later stage. */
export default function TrackOrderPage() {
  return (
    <Container className="py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Track your order
      </h1>
      <p className="mt-3 max-w-prose text-ink-muted">
        This page is scaffolded but not yet built. The order model and status
        lifecycle it depends on are already defined in{" "}
        <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-sm">
          lib/types.ts
        </code>
        .
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-6">
        Back home
      </ButtonLink>
    </Container>
  );
}
