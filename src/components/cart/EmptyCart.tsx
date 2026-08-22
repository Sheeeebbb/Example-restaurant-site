import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { FoodGlyph } from "@/components/menu/FoodGlyph";

export function EmptyCart() {
  return (
    <Container className="py-20 sm:py-28">
      <div className="mx-auto max-w-md text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ember-soft text-ember"
        >
          <FoodGlyph name="burger" className="h-10 w-10" />
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
