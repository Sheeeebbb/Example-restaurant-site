# Urban Table

A restaurant ordering site for a fictional neighbourhood kitchen — browse a
menu, customise dishes, and order for pickup or delivery.

**Status: Stage 1 of 8 — foundation.** The architecture, design system, domain
model, pricing engine, and app shell are in place. The ordering flow itself is
built in later stages; see [Roadmap](#roadmap).

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 55 unit tests over the pricing and scheduling logic
npm run build
```

---

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16, App Router** | See below |
| Language | **TypeScript** (strict) | The domain is full of money and state machines |
| Styling | **Tailwind CSS v4** | CSS-first `@theme` makes design tokens the source of truth |
| Cart state | **Zustand** + `persist` | ~1 kB, no provider tree, selector-level subscriptions |
| Tests | **Vitest** | Covers pricing and scheduling — the logic that decides what people are charged |

### Why Next.js rather than Vite + React

The deciding constraint is real payments. A Stripe secret key can never reach
the browser, so taking real card payments requires a server no matter what.
Next.js Route Handlers put that server in the same project, which turns stage 8
from "stand up and deploy a second service" into "add a file". It also gives the
menu real SEO, and the admin area somewhere to put authentication.

Vite + React would be slightly simpler today and materially harder later. That
trade only pays off if payments never arrive — and they are requirement #7.

---

## The decisions that matter

### 1. Money is integer cents, everywhere

`Cents` is a number of cents, never a float, never a formatted string.
Floating-point dollars reintroduce the `0.1 + 0.2` problem into people's bills.
All arithmetic lives in `lib/money.ts` and only becomes a string at render time.

### 2. Options and extras are one concept

A required single-select `OptionGroup` is "choose a size". An optional
multi-select one is "add extras". Same type, different `selection` mode — so the
customiser UI, its validation, and its pricing are each written once.

### 3. The data layer is `async` from day one

Every function in `lib/data/repository.ts` returns a `Promise`, even though all
of it currently resolves from local TypeScript modules. When the menu moves to a
database, only those function *bodies* change: call sites already `await` and
already handle "not found". Nothing outside `lib/data/` imports the seed modules
directly, so there is exactly one place to swap.

### 4. The client never decides what to charge

Cart totals in the browser are a **preview**. At checkout the server recomputes
them from live menu data using the same `calculateTotals` function and charges
its own figure. Likewise, promo codes are validated client-side for fast
feedback and re-validated server-side for authority — both through the one
`validatePromotion` function, so the two can't drift.

Only the promo **code** is persisted, never the resolved discount. A stored
discount is a number a customer could edit in localStorage and carry to
checkout.

### 5. Payments sit behind an adapter

Checkout depends on the `PaymentProvider` interface, never on a processor.
`MockPaymentProvider` is the only implementation today; Stripe becomes a second
one and a one-line change in `getPaymentProvider()`.

There is deliberately **no field for a card number, CVC, or expiry** anywhere in
these types. Real card entry belongs in a Stripe Elements iframe or hosted
checkout, which keeps card data out of our DOM and our servers — and keeps this
project out of PCI scope entirely.

### 6. Cart lines are content-addressed

A line's id is a hash of the item plus its sorted selections and notes. Adding
"large, extra cheese" twice increments one line; "large, no cheese" gets its own
row. Sorting first makes the id independent of the order the boxes were ticked.

### 7. Personal data stays out of localStorage

The cart, fulfilment choice, and promo code persist across refreshes. Customer
name, phone, email, and address do not — they live in component state during
checkout and go straight onto the order.

---

## Project structure

```
src/
├── app/
│   ├── layout.tsx              Root shell: fonts, header/footer, skip link
│   ├── globals.css             ← the entire design system lives here
│   ├── page.tsx                Landing page
│   ├── menu/                   Menu browsing + filtering        (stage 2)
│   ├── cart/                   Cart review                      (stage 3)
│   ├── checkout/               Fulfilment → details → payment   (stage 4)
│   ├── order/track/            Order status                     (stage 5)
│   ├── admin/                  Staff area                       (stage 6)
│   └── api/                    Route handlers                   (stage 4+)
│
├── components/
│   ├── layout/                 SiteHeader, SiteFooter
│   ├── ui/                     Button, Badge, Container
│   └── cart/                   CartButton, CartHydration
│
└── lib/
    ├── types.ts                The domain model. Start here.
    ├── money.ts                Cents arithmetic and formatting
    ├── config/restaurant.ts    Hours, fees, delivery zones — all configuration
    ├── data/
    │   ├── menu.ts             Seed menu (stands in for the DB)
    │   ├── promotions.ts       Seed promo codes + validation
    │   └── repository.ts       ← the swap point for a real backend
    ├── cart/
    │   ├── store.ts            Zustand store, persisted
    │   ├── lines.ts            Line identity + option validation
    │   ├── totals.ts           ← the pricing engine (pure, shared client/server)
    │   └── selectors.ts        Derived cart values
    ├── fulfillment/
    │   ├── delivery.ts         Postal code → zone, fee, minimum
    │   └── scheduling.ts       Opening hours, lead times, ASAP vs scheduled slots
    └── payments/
        ├── types.ts            PaymentProvider interface
        └── mock.ts             Simulated processor
```

`lib/cart/totals.ts` imports nothing from React or the browser, specifically so
the same function can run in a Route Handler later. Two implementations of
pricing is how a checkout ends up charging a different number from the one on
screen.

---

## Frontend-only now → backend later

| Concern | Today | Later |
| --- | --- | --- |
| Menu & categories | Typed modules behind the repository | Postgres, admin CRUD |
| Cart | Zustand + localStorage | Unchanged — carts belong on the client |
| Pricing | Pure functions, client-side | Same functions, re-run server-side at checkout |
| Promo codes | Client validation | Server-authoritative, usage limits per customer |
| Orders | localStorage | Persisted, queryable by staff |
| Payments | `MockPaymentProvider` | Stripe PaymentIntents + webhooks |
| Order status | Local, polled | DB-backed, pushed over SSE |
| Admin auth | **Not built** | Real auth in Next.js Proxy (*Middleware, renamed in v16*) |

Admin auth is deliberately absent rather than faked. A pretend login invites
someone to treat the admin area as protected when it isn't.

---

## Design system

All tokens live in `src/app/globals.css`. Tailwind's `@theme inline` maps them
onto utility classes, so re-declaring a variable under a media query re-skins
every component that uses it. **A rebrand is that one file.**

- **Paper / surface / ink** — warm off-white ground rather than clinical white.
  Food photography needs a warm, neutral surround; the food supplies the colour.
- **Ember** (`#c2410c`) — the single accent, used for actions and nothing else.
- **Herb** — secondary, reserved for open/available states.
- **Fraunces** for display, **Inter** for UI. Both self-hosted via `next/font`,
  so there is no render-blocking request and no layout shift.

Dark mode is supported through `prefers-color-scheme`.

### `--on-ember` and `--on-danger`

Ember is darkened for light mode and lightened for dark mode, so it can't carry
white text in both. These paired tokens hold the correct *foreground* for each
accent fill and flip with the scheme. Without them, the primary button fails
contrast in dark mode at about 2.1:1.

### Accessibility

Targeting WCAG 2.2 AA:

- Body text meets 4.5:1 in both schemes; accent fills use their paired `--on-*` token.
- A single visible `:focus-visible` ring, defined once and never removed.
- Skip link as the first tab stop (2.4.1).
- `min-h-11` (44 px) on interactive controls (2.5.8).
- Semantic landmarks; one `<nav>` reflowed with flex-wrap rather than a
  duplicated mobile copy, so nothing is announced twice or hidden from
  whichever breakpoint you're on.
- `prefers-reduced-motion` honoured globally (2.3.3).
- Colour is never the only carrier of meaning — dietary badges are labelled in words.

---

## Roadmap

| Stage | Scope | Status |
| --- | --- | --- |
| **1. Foundation** | Stack, design system, domain model, data layer, cart engine, fulfilment rules, payment adapter, app shell | ✅ **Done** |
| **2. Menu** | Menu page, category filtering, dietary filters, product detail, option customiser, add to cart | Next |
| **3. Cart** | Cart page, quantity stepper, remove, promo codes, delivery/pickup toggle, mobile sticky bar | |
| **4. Checkout** | Fulfilment step, address + zone validation, ASAP vs scheduled slots, customer details, mock payment, `/api/checkout` recomputing totals server-side | |
| **5. Confirmation & tracking** | Order confirmation, reference lookup, status timeline | |
| **6. Admin** | Order queue, status transitions, menu management, availability toggle, sales summary | |
| **7. Polish** | Loading/empty/error states, real photography, metadata, keyboard + screen-reader audit | |
| **8. Integration** | Stripe behind the existing adapter, database behind the existing repository, admin auth in Proxy | |

Each stage is shippable: nothing depends on a stage after it.

---

## Notes

Urban Table is fictional. **No real payments are processed and no card details
are collected or stored** — `MockPaymentProvider` simulates the gateway,
including its latency and failure paths, so the UI handles those states long
before a real processor arrives.

Menu photography goes in `public/menu/` under the filenames already referenced
in `lib/data/menu.ts`; a warm gradient stands in until then.
