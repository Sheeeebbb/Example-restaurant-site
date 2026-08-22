import { Container } from "@/components/ui/Container";
import { FoodImage } from "@/components/menu/FoodImage";
import { OrderModeButtons } from "./OrderModeButtons";
import { ServiceStatus } from "@/components/layout/ServiceStatus";
import { formatMoney } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import type { MenuItem } from "@/lib/types";

/**
 * Split hero: copy on the left, a composed image stack on the right.
 *
 * The composition is built to hold up whether or not real photography exists —
 * the large panel plus the offset detail card reads as an intentional layout,
 * not as a gap where a picture should be. When photos land they simply fill the
 * two frames.
 */
export function Hero({
  showcase,
  showcasePhoto,
  heroPhoto,
}: {
  showcase: MenuItem | null;
  showcasePhoto: string | null;
  heroPhoto: string | null;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-surface">
      <Container className="py-14 sm:py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="motion-safe:animate-[fade-up_0.6s_ease-out_both]">
            <div className="flex flex-wrap items-center gap-2">
              <ServiceStatus />
              <p className="inline-flex items-center gap-2 rounded-full bg-ember-soft px-3 py-1.5 text-sm font-medium text-ember">
                Free delivery over {formatMoney(RESTAURANT.fees.freeDeliveryThreshold)}
              </p>
            </div>

            <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-[4.25rem]">
              Good Food.
              <br />
              <span className="text-ember">Delivered</span> to Your Door.
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
              Freshly prepared food made with quality ingredients. Order for
              delivery or pickup whenever you&rsquo;re hungry.
            </p>

            <OrderModeButtons className="mt-8" />

            {/* A 3-up grid rather than flex-wrap: at 390px wrapping left the
                third stat orphaned on its own row. */}
            <dl className="mt-10 grid grid-cols-3 gap-x-4 border-t border-line pt-6 sm:gap-x-10">
              {[
                { value: "25 min", label: "Average delivery" },
                { value: "4.8/5", label: "From 1,200+ reviews" },
                { value: "100%", label: "Fresh, never frozen" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block font-display text-2xl font-semibold text-ink">
                      {stat.value}
                    </span>
                    <span className="text-xs text-ink-muted sm:text-sm">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* The dish it shows is also linked from the featured strip below,
              so nothing here is the only route to it. */}
          <div className="relative motion-safe:animate-[fade-up_0.6s_0.1s_ease-out_both]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-line bg-surface-sunken shadow-overlay lg:aspect-[4/5]">
              <FoodImage
                src={heroPhoto}
                alt="Urban Table cheeseburger and skin-on fries served on a board"
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
            </div>

            {showcase && (
              <div className="absolute -bottom-5 -left-2 flex w-[15rem] items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-overlay sm:left-6 sm:w-[17rem]">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
                  <FoodImage
                    src={showcasePhoto}
                    alt=""
                    sizes="56px"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink-subtle">
                    Most ordered
                  </p>
                  <p className="truncate font-display font-semibold text-ink">
                    {showcase.name}
                  </p>
                  <p className="text-sm font-medium text-ember">
                    {formatMoney(showcase.basePrice)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
