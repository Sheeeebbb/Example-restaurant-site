# Internationalisation

English and Dutch, with the architecture built so a third language is data
rather than a deployment.

## The shape of it

| Concern | Where |
| --- | --- |
| Which languages exist, and how one is chosen | `src/i18n/config.ts` |
| Resolving the request's language and loading its words | `src/i18n/request.ts` |
| Remembering an explicit choice | `src/i18n/actions.ts` |
| UI strings | `messages/en.json`, `messages/nl.json` |
| Menu content | `menu_item_translations`, `category_translations` |
| A translator for pure, non-React code | `src/i18n/messages.ts` |
| Order status → words, without touching the stored value | `src/i18n/status.ts` |

## Adding a language

1. Add it to `LOCALES` and `FORMATTING` in `config.ts`.
2. Copy `messages/en.json` to `messages/<code>.json` and translate it.
3. Add rows to `menu_item_translations` / `category_translations` (see
   `src/lib/data/menu-nl.ts` for the shape, and `db/seed.ts` for the upsert).

Nothing else changes. The selector, the negotiation, the `lang` attribute, the
number and date formatting and the fallback all read the list.

`npm test` fails if any language is missing a key English has, holds a key
English does not, leaves a translation blank, or drops an interpolation
placeholder.

## Why a cookie and not `/nl/…` URLs

The alternative was moving every page under `app/[locale]/`. That buys separately
indexable URLs and costs: every order-tracking link already in a customer's
messages breaks, every API route moves, and the proxy — which today matches
`/admin` only — has to run on every request to redirect `/` somewhere.

For a single restaurant serving one city in two languages, that trade did not
pay. The cookie is read on the server, so pages arrive already translated with a
correct `lang` attribute; what is lost is a distinct URL per language, which
matters for search and not for anything else here.

If that changes, the move is contained: `resolveLocale` already takes the
locale from wherever the caller found it, so a `[locale]` segment would feed the
same function and no component would change.

## The staff area is English-only, deliberately

Translating it would mean a second catalogue, kept in step, for an audience of a
handful of people who all work in one building — and a half-translated admin is
worse than an English one, because a manager cannot tell whether "Klaar" and
"Ready" are the same state.

What was done instead: the staff subtree declares `lang="en"` so a screen reader
reads it correctly even when the customer side is Dutch, and no string is shared
between the two — the customer's status labels come from `order.status.*` in the
catalogue, while `lib/order/status.ts` keeps the English ones the kitchen board
uses. Neither can leak into the other.

## What is never translated

- **Stored values.** `"preparing"` is the status in the database, on the wire
  and in every permission check, in every language. `src/i18n/status.ts` maps it
  to words at the last step before a pixel and never writes back.
- **Identity.** Menu item ids and slugs, order references, permission names.
  A dish has one record and one URL whatever it is called on screen.
- **History.** An order stores the dish name and price as they were when it was
  placed. Switching language does not rewrite a receipt.
- **Legal pages.** `/privacy` and `/terms` fall back to English on purpose —
  they are binding documents, and their Dutch wording should come from whoever
  is accountable for the English.
