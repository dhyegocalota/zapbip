# Tester briefing: WhatsApp onboarding replies

## What changed

- `libs/types/src/constants.ts` — `ONBOARDING_SETUP_LINKS`, `ONBOARDING_REQUEST_ACCESS_LINKS`, `SITE_ORIGIN`, `DOCS_ORIGIN`
- `libs/core/src/accounts/account-copy.ts` — the `Waitlisted` reply is the onboarding text with both links
- `libs/core/src/accounts/use-cases/receive-account-message.ts` — the `Waitlisted` verdict goes through the `approvalCooldowns` port once a day
- `apps/api/src/inbound/owner-inbound.ts`, `apps/api/src/adapters/d1/d1-other-number-notices.ts`, `apps/api/migrations/0015_other_number_notices.sql` — the wrong-number notice carries the `wa.me` link and is sent once a day; the row goes with the account (`d1-account-directory.ts`)

## How to run

```bash
pnpm --filter @zapbip/core exec vitest run src/accounts/use-cases/receive-account-message.test.ts
cd apps/api && pnpm exec vitest run --config vitest.integration.config.mts --maxWorkers=2 test/integration/whatsapp-onboarding-replies.test.ts
```

## Red today, green after

| Test | Commit | Red text | Kind |
|------|--------|----------|------|
| `receive-account-message.test.ts` onboarding links | 9534d264 | `expected 'Você está na lista de espera…' to contain 'https://docs.zapbip.com/pt-br/get-started/how-to-start'` | red |
| `receive-account-message.test.ts` second message inside the cooldown | 9534d264 | `expected [ …(2) ] to have a length of 1 but got 2` | red |
| `receive-account-message.test.ts` redelivery | 9534d264 | green when it landed | pin |
| `whatsapp-onboarding-replies.test.ts` | 6b44c790 | not run before the code (integration was held during a deploy) | see report |

## Hypotheses for the tester

- A waitlisted phone gets one onboarding text a day and its commands keep working.
- A wrong-number customer gets one notice a day with the `wa.me` link of its home number, and no account, message or window changes.
- Deleting an account removes its `other_number_notices` row.

## Gaps

- An active account with no agent still hears "No agent is connected" with no setup instruction.
- The closed-number refusal has no cooldown.
- No real Meta send.
