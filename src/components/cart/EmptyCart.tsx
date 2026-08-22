import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function EmptyCart() {
  return (
    <Container className="py-20 sm:py-28">
      <div className="mx-auto max-w-md text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ember-soft text-ember"
        >
          {/* An empty shopping bag — the state being described, rather than a
              drawing of food the kitchen would have to serve. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-10 w-10"
          >
            <path d="M5 8h14l-1.2 12H6.2L5 8Z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </svg>
        </span>

        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your cart is waiting.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          Nothing in it yet. Have a look at what&rsquo;s coming out of the
          kitchen tonight.
        </p>

        <ButtonLink href="/menu" size="lg" className="mt-8">
          Browse Menu
        </ButtonLink>
      </div>
    </Container>
  );
}
