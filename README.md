# Urban Table

A modern neighbourhood restaurant in Berlin serving burgers, sandwiches and
salads — browse the menu, customise dishes, and order for delivery or pickup.

**Status: Stage 7 of 8 — QA, accessibility and polish.** Both journeys have been
audited end to end and the defects found are fixed and covered by regression
tests. Real backend integration remains; see [Roadmap](#roadmap).

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 217 unit tests, including regressions for every defect found in QA
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
Floating-point euros reintroduce the `0.1 + 0.2` problem into people's bills.
All arithmetic lives in `lib/money.ts` and only becomes a string at render time.

**VAT is inside the price, not added to it.** Menu prices in this market are
quoted inclusive of VAT, so `calculateTotals` *extracts* the tax for the receipt
line rather than adding it on top. Getting this backwards would overcharge every
order by 19%.

### 2. Options and extras are one concept

A required single-select `OptionGroup` is "choose a size". An optional
multi-select one is "add extras". Same type, different `selection` mode — so the
customiser UI, its validation, and its pricing are each written once.

**Customisation is data, not per-product code.** Nothing in the app branches on
"is this a burger?". `lib/data/option-groups.ts` holds composable factories —
`extras()`, `sauces()`, `portionSize()`, `removals()` — and a product declares
which it offers. `OptionGroupField` branches only on `group.selection`, so
sizes, extras, sauces, ingredient removals and upsells all render, validate and
price through one code path. A new dish is a new entry in `menu.ts`; a new
*kind* of choice is one factory. Neither touches a component.

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

### 4a. The delivery fee is one number

`RESTAURANT.fees.deliveryFee` is the standard fee and the single thing to change
when delivery pricing changes. A postal code that matches a `DELIVERY_ZONES`
entry may override it with a zone-specific fee and minimum order.

Where the vans go is `DELIVERY_AREA` in the same file — `minPostalCode`,
`maxPostalCode` and the number of digits a code has here. Those three numbers
are the delivery boundary for the whole application; the cart, the address form
and the server all reach them through `lib/fulfillment/postal-code.ts` rather
than repeating a range of their own.

The flat default matters: without one, the cart would read "free delivery"
until an address was entered, and then take it back at checkout.

### 5. Payments sit behind an adapter

Checkout depends on the `PaymentProvider` interface, never on a processor.
`MockPaymentProvider` is the only implementation today; Stripe becomes a second
one and a one-line change in `getPaymentProvider()`.

There is deliberately **no field for a card number, CVC, or expiry** in
`PaymentRequest`, in `Order`, or in any persisted store. The demonstration card
form (`MockPaymentForm`) is the one place card values exist at all: they live in
that component's React state, gate the submit button, and are wiped when the
order is placed. They are never persisted and never included in the request to
`/api/checkout`.

With Stripe, that component is **deleted rather than adapted** — Elements
renders the inputs inside an iframe on Stripe's origin, so the number never
enters our DOM or our server, and the project stays out of PCI scope. Nothing
downstream changes, because nothing downstream ever knew about a card.

### 5a. The server decides what to charge

`/api/checkout` treats its request as hostile. The client sends item ids, option
ids, quantities and notes — **no prices**. The server looks each item up in the
menu, rebuilds the selections from live option data, recomputes every unit
price, revalidates the promo code, and charges the figure *it* calculated.

A client that posts `total: 1` is charged the real amount, because the number it
sent is never read. There is a test for exactly that.

### 5b. Order status is derived, not stored

The tracking timeline computes its stage from `createdAt` and
`estimatedReadyAt` rather than counting up from page load. A timer would reset
on every refresh — customers would watch their order slide back to "received"
each time they reloaded. Deriving it means the same moment always yields the
same stage.

### 5c. The staff gate is mocked, in one place

`/admin/*` and `/api/admin/*` are guarded by `src/proxy.ts` (Next 16 renamed
Middleware to Proxy). Every check funnels through `hasStaffSession`, so no route
handler does its own — a handler that forgets is how admin areas leak.

**The check itself is not secure and does not pretend to be.** It compares a
shared passcode and sets a cookie whose value is a constant, forgeable by anyone
who reads the source. There is no user identity, no roles, no revocation, no
rate limiting. What is real is the *shape*: one matcher, one gate, one function
to replace with a session library and a role check. Until that happens this
admin area must not be deployed publicly with real customer data behind it.

The banner across every staff page says the same thing, so nobody using it is in
any doubt.

### 5d. An order reference does not unlock personal data

The public tracking endpoint (`/api/orders/[reference]/status`) returns the
status and nothing else — no name, phone, address, items or total. An order
reference is a weak bearer token, so it must not be enough to read someone's
details. The customer's own copy of their order comes from their browser, where
it has been since they placed it.

Full customer details live behind the staff gate, where the kitchen genuinely
needs them to cook and deliver.

### 5e. The kitchen has to be open

`validateTiming` refuses an ASAP order when the restaurant is shut, and the same
function runs in the cart, at checkout, and inside `placeOrder`. Scheduling
ahead while closed is still allowed — ordering tomorrow's lunch at midnight is
normal — and is checked against the chosen slot's own opening hours.

This was found in QA: orders placed at 4am, or on a Monday when the restaurant
never opens, were accepted and paid for with nobody there to cook them.

### 5f. Free text is bounded on the server

`FIELD_LIMITS` caps every free-text field, and `placeOrder` truncates kitchen
notes to `RESTAURANT.ordering.maxNoteLength`. A `maxLength` on an input is a
courtesy to the customer; these are the actual limits. The API previously
accepted and stored a 5,000-character name.

### 6. Cart lines are content-addressed

A line's id is a hash of the item plus its sorted selections and notes. Adding
"large, extra cheese" twice increments one line; "large, no cheese" gets its own
row. Sorting first makes the id independent of the order the boxes were ticked.

### 7. Personal data stays out of localStorage

Two stores, deliberately different. The **cart** (`lib/cart/store.ts`) uses
localStorage: a basket is worth keeping for days, and a list of burgers
identifies nobody. The **order draft** (`lib/order/draft-store.ts`) holds a name,
phone number, email and home address, so it uses **sessionStorage** and is gone
when the tab closes. It persists at all only to survive the hop from cart to
checkout and a stray refresh.

The postal code is the one exception, kept in the cart so delivery can be priced
before the address form — a district is not a person.

---

## Project structure

```
src/
├── app/
│   ├── layout.tsx              Root shell: fonts, header/footer, skip link
│   ├── globals.css             ← the entire design system lives here
│   ├── page.tsx                Homepage
│   ├── about|contact/          Editorial pages
│   ├── privacy|terms/          What the app actually does with data
│   ├── menu/                   Menu listing + filtering
│   │   └── [slug]/             Product detail + customiser
│   ├── cart/                   Cart + order configuration
│   ├── checkout/               Checkout + mock payment
│   ├── order/[reference]/      Confirmation + status timeline
│   ├── order/track/            Order lookup
│   ├── (admin)/admin/          Staff dashboard, orders, menu, sign-in
│   ├── api/checkout/           ← recomputes prices, takes payment
│   ├── api/orders/…/status/    Public: status only, no personal data
│   └── api/admin/              Behind the staff gate
│   ├── order/track/            Order status                     (stage 6)
│   ├── admin/                  Staff area                       (stage 7)
│   └── api/                    Route handlers                   (stage 5+)
│
├── components/
│   ├── layout/                 SiteHeader, SiteFooter, Prose
│   ├── ui/                     Button, Badge, Container
│   ├── home/                   Hero, FeaturedMenu, PromoBanner, WhyChooseUs,
│   │                           Testimonials, SectionHeading
│   ├── menu/                   MenuItemCard, FoodImage, FoodGlyph,
│   │                           AddToCartButton, CategoryFilter,
│   │                           ProductCustomizer, OptionGroupField,
│   │                           QuantityStepper
│   ├── cart/                   CartView, CartLineRow, OrderSummary,
│   │                           PromoCodeForm, FulfillmentToggle,
│   │                           TimingPicker, CustomerForm, EmptyCart
│   ├── checkout/               CheckoutView, MockPaymentForm, EditableSection
│   ├── order/                  OrderConfirmation, OrderTimeline, TrackOrderView
│   └── admin/                  AdminNav, StatCard, OrdersBoard, OrderDetail,
│                               MenuManager, MenuItemForm, StaffLoginForm
│
└── lib/
    ├── types.ts                The domain model. Start here.
    ├── money.ts                Cents arithmetic, formatting, VAT extraction
    ├── config/restaurant.ts    Hours, fees, delivery zones — all configuration
    ├── data/
    │   ├── menu.ts             Seed menu (stands in for the DB)
    │   ├── option-groups.ts    ← composable customisation library
    │   ├── promotions.ts       Seed promo codes + validation
    │   ├── photos.ts           Server-side photo resolution
    │   └── repository.ts       ← the swap point for a real backend
    ├── cart/
    │   ├── store.ts            Zustand store, persisted
    │   ├── lines.ts            Line identity, option validation, defaults
    │   ├── customization.ts    ← customiser rules (pure, UI-free)
    │   ├── totals.ts           ← the pricing engine (pure, shared client/server)
    │   └── selectors.ts        Derived cart values
    ├── admin/
    │   ├── auth.ts             ← MOCK staff gate (read the warning)
    │   ├── menu-admin.ts       Menu create/edit/delete/availability
    │   └── stats.ts            Dashboard figures (pure)
    ├── server/
    │   └── store.ts            ← in-memory stand-in for the database
    ├── order/
    │   ├── validation.ts       ← order-config rules (pure, UI-free)
    │   ├── place-order.ts      ← authoritative order creation (server)
    │   ├── status.ts           Simulated progress, derived from the clock
    │   ├── reference.ts        Human-readable order numbers
    │   ├── draft-store.ts      Customer details (sessionStorage)
    │   ├── order-store.ts      The customer's own copy (sessionStorage)
    │   └── order-repository.ts ← server-side orders, shared with the kitchen
    ├── fulfillment/
    │   ├── postal-code.ts      Is this code inside the delivery area? One rule, three callers
    │   ├── delivery.ts         Postal code → zone, fee, minimum
    │   ├── address-autofill.ts What a lookup may overwrite — never a typed field
    │   ├── address-lookup.ts   ← the seam for a real lookup service (none connected)
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

## What actually works on the homepage

The brief was explicit that nothing should *look* functional without *being*
functional. So, on the homepage today:

| Control | What it really does |
| --- | --- |
| **Add to cart** | Adds a fully specified line using the item's default options. The header count updates, and re-adding the same configuration merges into one line at quantity 2. |
| **Order Delivery / Order Pickup** | Sets the cart's fulfilment mode — which drives delivery fees, minimums and lead times downstream — then goes to the menu. |
| **Apply to my order** | Writes `WELCOME20` into the cart, where `calculateTotals` picks it up. The code is stored, not the discount, and it is re-validated on every render. |
| **Cart badge** | Live count from the store, persisted across reloads. |
| **Menu filtering** | Real URLs (`/menu?category=burgers`) rendered on the server — shareable, back-button correct, and working before JS loads. |
| **Product customiser** | Live price as options change, quantity, special instructions, and required-option validation. Every choice reaches the cart. |
| **Cart** | Line quantities, removal, and live totals. Every figure is derived from the lines on each render — nothing is stored. |
| **Promo codes** | `WELCOME20` takes 20% off. Applying a second code replaces the first; the cart holds one code, so discounts cannot stack. |
| **Order configuration** | Delivery or pickup, ASAP or a real slot from opening hours, and contact details — all validated before you can continue. |
| **Checkout** | Posts to `/api/checkout`, which revalidates everything and recomputes every price from the menu. A tampered total is ignored. |
| **Confirmation** | A real order with a reference, at its own URL. Refreshing re-reads it rather than losing it. |
| **Tracking** | A status timeline derived from the clock, so a refresh lands on the same stage rather than resetting — until staff set a status, which then wins. |
| **Staff dashboard** | Live counts and revenue from real orders, behind a demonstration passcode. |
| **Order management** | Every order the kitchen has, with full customer details, and status changes that reach the customer's tracking page. |
| **Menu management** | Add, edit, remove and mark dishes unavailable; changes appear on the customer menu immediately. |

Two guards keep this honest. A unit test asserts every featured item is
genuinely quick-addable, so no card can ship an "Add to cart" button that
couldn't complete. And `AddToCartButton` degrades rather than pretends: an item
with a required choice and no sensible default renders "Choose options" and
links to the customiser instead of adding something half-specified; a sold-out
item renders a disabled "Sold out".

Required options are validated for real, and there is a product that proves it:
**Spring Water** deliberately has no default for "still or sparkling", because
guessing is a coin flip. Its menu card degrades to "Choose options" instead of
quick-adding, and the customiser blocks the add — moving focus to the offending
group — until the question is answered.

The **Contact page has no form** for the same reason — there is no mail
transport yet, so it gives the phone number and email address that actually
reach the restaurant rather than a form that would silently discard what people
type.

---

## Frontend-only now → backend later

| Concern | Today | Later |
| --- | --- | --- |
| Menu & categories | In-memory server store, editable by staff | Postgres, with the same repository interface |
| Cart | Zustand + localStorage | Unchanged — carts belong on the client |
| Pricing | Pure functions, client-side | Same functions, re-run server-side at checkout |
| Promo codes | Client validation | Server-authoritative, usage limits per customer |
| Orders | In-memory server store (resets on restart) | Persisted, queryable across devices |
| Payments | `MockPaymentProvider` | Stripe PaymentIntents + webhooks |
| Order status | Derived from the clock | Set by kitchen staff, pushed over SSE |
| Admin auth | Mock passcode gate in Proxy (*Middleware, renamed in v16*) | Per-user accounts, hashed credentials, roles, session expiry |

The staff gate is a demonstration, and is labelled as one on every page it
protects. It genuinely blocks access — the shape is right — but it is a shared
passcode and a constant cookie, not authentication. See §5c.

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
| **2. Visual foundation & homepage** | Brand, navigation, hero, featured menu with working add-to-cart, promo banner, why-us, testimonials, footer, legal pages | ✅ **Done** |
| **3. Menu & customisation** | Menu page, URL-driven category filtering, product detail pages, generic option customiser, quantity, special instructions | ✅ **Done** |
| **4. Cart & order configuration** | Cart with line editing, promo codes, delivery/pickup, ASAP or scheduled timing, customer details, validation | ✅ **Done** |
| **5. Checkout & confirmation** | Checkout, mock payment, `/api/checkout` recomputing totals server-side, order creation, confirmation and simulated tracking | ✅ **Done** |
| **6. Admin** | Dashboard, order queue, status transitions, menu management, availability toggle | ✅ **Done** |
| **8. Integration** | Stripe behind the existing adapter, database behind the existing repository, admin auth in Proxy | |

Each stage is shippable: nothing depends on a stage after it.

---

## Notes

Urban Table is fictional. **No real payments are processed and no card details
are collected or stored** — `MockPaymentProvider` simulates the gateway,
including its latency and failure paths, so the UI handles those states long
before a real processor arrives.

## Photography

**There are still no photographs in this repository.** This environment's egress
policy blocks every image host, so none could be downloaded — see
[public/menu/README.md](public/menu/README.md) for how to add them.

Everything around them is ready:

- **`src/lib/data/photography.ts`** — a brief per dish (subject, camera angle,
  ingredients that must appear, and the ones that must *not*), a shared
  `HOUSE_STYLE` shoot specification, and a `credit` slot recording source,
  licence and photographer so temporary stock can later be swapped for the
  restaurant's own work. A test keeps it one-to-one with the menu.
- **`npm run photos:check`** — coverage report; names the exact files still
  missing and flags any over 400KB.
- **The pipeline** — `resolvePhoto()` finds a file the moment it lands in
  `public/menu/`, and it renders through `next/image` as AVIF or WebP in a
  fixed 4:3 frame with `object-cover`. Verified with test images: a portrait
  source crops rather than distorting, and a 13KB JPEG served 1.2KB of AVIF.
- **Attribution** — `photoCredit()` renders a credit under the photograph only
  where the licence requires one.

Until files exist, cards render a fallback tile — a warm wash and a per-category
glyph on a ringed disc, marked `aria-hidden` because it depicts nothing. It is a
fallback, not the design: no broken images, no 404s, a missing file is never
requested.
