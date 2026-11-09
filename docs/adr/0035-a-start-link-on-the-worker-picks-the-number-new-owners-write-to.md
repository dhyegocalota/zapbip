# 0035. A start link on the Worker picks the number new owners write to

- Status: Accepted
- Date: 2026-11-08
- Deciders: Dhyego Calota (owner, delegated 2026-11-06); Claude (advisor)
- Inspired by: the owner on 2026-11-08: "nao teremos 1 unico numero oficial eu acredito"; [ADR 0016](0016-accounts-start-on-the-first-message-and-wait-on-a-list.md); [ADR 0032](0032-whatsapp-numbers-are-rows-in-a-sealed-registry-not-worker-secrets.md); `apps/api/src/inbound/owner-inbound.ts`

## Context

A new owner starts by sending a WhatsApp message to a zapbip number; that first message creates the account (ADR 0016) and binds it to the number it was written to (`accounts.number_id`, ADR 0032). Numbers are already rows the operator registers, activates, closes and disables in the backoffice, but the docs still print one fixed number: `OFFICIAL_WHATSAPP_NUMBER` in `libs/types`, a `wa.me` snippet in both languages, and a production-only preflight that refuses to publish while the constant is `OFFICIAL_NUMBER_UNSET`. Changing the number today means editing a constant, merging and republishing the docs. A new owner is also refused when the number they wrote to is `closed`, so a docs link frozen to one number goes stale the day the operator closes it.

## Decision

1. The Worker serves `GET /start` on the MCP host. It answers `302` to `https://wa.me/<digits>?text=<prefilled>`, where `<digits>` come from one number in the registry.
2. The number is the **oldest active number**: `state = 'active'`, ordered by `created_at` then `id`, the first row. `closed`, `pending` and `disabled` numbers are never chosen. The operator spreads load by closing a full number, which already refuses new accounts (ADR 0032); the link then moves to the next active number on the next request.
3. With no active number the route answers `503` with a friendly HTML page in both locales and a `Retry-After`, and never redirects.
4. The prefilled text is a fixed constant per locale, chosen by `?lang=en` or `?lang=pt-BR`; an absent `lang` is the product default locale and an unknown one is `400`. The redirect target has a fixed host and path shape: nothing from the request is copied into it.
5. The docs link to the start link, built from `PRODUCTION_PUBLIC_ORIGIN`. `OFFICIAL_WHATSAPP_NUMBER`, `OFFICIAL_NUMBER_UNSET`, the `official-number` snippets and the preflight number check are removed.
6. Account semantics do not change: one owner, one account, bound to the number of its first message. The link only chooses where a new owner starts.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Oldest active number (chosen) | one indexed `LIMIT 1` read; deterministic and testable; the operator's `closed` state is already the capacity control | all new owners land on one number until it is closed | simplest rule that is safe; capacity is a one-click operator action |
| Deterministic rotation (hash of the client address or of the minute) | spreads new accounts without operator action | the same person gets different numbers on two clicks; address hashing is unstable behind mobile networks; hard to explain in a test; spreads onto a number that is nearly full | accounts bind permanently, so spreading buys little and costs predictability |
| Least loaded (count accounts per number) | even spread | a `COUNT` per active number on a public, unauthenticated route; needs a capacity rule to be useful; the limit that matters is Meta's per-number tier, which zapbip does not read | revisit when a number approaches its tier |
| Random active number | no state | untestable without injecting randomness; same drawbacks as rotation | no gain over the first |
| Keep one constant in `libs/types` | no code | contradicts the owner; every number change is a merge and a docs publish | the owner said there will not be one number |
| Docs call the Worker and render the number | docs show the real number | docs are static Mintlify pages with no script; the number would leak to every crawler | a link, not a render |

## Consequences

- The docs never print a phone number. A reader who wants to type the number gets it from WhatsApp after the redirect.
- A closed or disabled number never receives new owners from the link. Owners who saved the number earlier still reach it, and an existing owner who writes to another number gets the "your account is on the other number" notice (ADR 0032).
- `/start` is a public, unauthenticated read of the registry. It reveals one display number per request to anyone who asks, which is the same fact the number's own `wa.me` link would reveal. It enumerates nothing else, and it is rate limited per client address.
- A closed-all state (no active number) turns the docs call to action into a friendly page, not a dead link.
- The deploy preflight no longer needs the number, so the docs publish no longer waits on a constant edit.

## Evidence

- `apps/api/src/inbound/owner-inbound.ts`: `refuseNewAccount` for a new owner on a `closed` number, `refuseOtherNumber` for an account on another number, and `openOwnerAccount` with `homeNumberId` set at creation.
- `apps/api/src/numbers/number-state.ts`: `active` and `closed` switch both ways; only `active` is meant for new accounts.
- `apps/api/src/routes/install-page.ts` and `INSTALL_PAGE_LIMITER` in `apps/api/wrangler.jsonc`: the repository's pattern for a public GET with a per-client rate limit.
- `apps/api/src/backoffice/numbers/registration-form.ts`: display numbers are validated as `+` and 7 to 15 digits before they are stored.

## Revisit when

- A number approaches its Meta messaging tier before the operator closes it: move to least loaded with a capacity field.
- The product shows a per-agent or per-campaign start link: add a signed `ref`, never a free `text`.
- An owner needs to move an account to another number.
