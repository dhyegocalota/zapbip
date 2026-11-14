# 0049. A phone gets one onboarding reply a day, and a customer on another number is pointed home

- Status: Accepted
- Date: 2026-11-13
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: the owner's question of 2026-11-13 about what a stranger or an existing customer on the wrong number sees; [ADR 0015](0015-commands-are-bare-words-routed-before-agents.md); [ADR 0016](0016-accounts-start-on-the-first-message-and-wait-on-a-list.md); [ADR 0035](0035-a-start-link-on-the-worker-picks-the-number-new-owners-write-to.md); [ADR 0043](0043-access-opens-in-batches-from-the-backoffice.md)

## Context

Writing to a zapbip number creates an account on the spot ([ADR 0016](0016-accounts-start-on-the-first-message-and-wait-on-a-list.md)), so "not a customer" means a phone that just became a waitlisted account. It got a two-line waitlist reply to every message, with no way forward. An account has one home number ([ADR 0035](0035-a-start-link-on-the-worker-picks-the-number-new-owners-write-to.md)); a customer who wrote to another number was told the number on every message, with no link.

## Decision

1. A waitlisted account's reply to a message that is not a command becomes an onboarding reply: what zapbip is, that access is by waitlist and the phone is on it, the setup link and the request-access link of the owner's language. Both links are constants per language in `libs/types`; the setup link is the docs get-started page until a setup document replaces it.
2. The reply is sent once per `ONBOARDING_REPLY_COOLDOWN_MS` (one day). The cooldown lives in the account's Durable Object through the existing `approvalCooldowns` port, because the waitlist decision is made there, and it starts only after a reply was sent for a message that was not a redelivery. Inside the cooldown a message that is not a command is dropped: commands (`ajuda`, `entrar`, `apagar conta`) bypass the gate and keep working.
3. A customer writing to a number that is not the home of its account gets the home number and its `wa.me` link once per `OTHER_NUMBER_NOTICE_COOLDOWN_MS` (one day). The decision is made in the Worker before the Durable Object is reached, so the time of the last notice lives in D1 (`other_number_notices`, one row per account, removed with the account). Nothing is created or routed.
4. The replies answer an inbound message, so the 24-hour window is open and no template is involved.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Reply to every message | no state | repeated noise; a person talking to the waitlist hears the same text again and again | the owner asked for one clear reply |
| One D1 table for both cooldowns | one mechanism | the Durable Object would reach D1 for a decision it already owns, or the Worker would learn the waitlist rules | each decision keeps its own store |
| Drop the cooldown for the other-number notice | simpler | a customer typing to the wrong number gets the same text each time | same noise |
| Wake the Durable Object of the account for the other-number notice | one store | the account would see traffic it never routes | the wrong number must touch nothing |

## Consequences

- Migration `0015` is additive. Rolling it back means deploying the previous Worker first, then dropping `other_number_notices`.
- Inside the cooldown a waitlisted phone's plain messages get no answer; they were never stored, so nothing is lost.
- An `active` account with no agent keeps the "No agent is connected" notice; a setup instruction there is a separate change.

## Evidence

- Unit: `libs/core/src/accounts/use-cases/receive-account-message.test.ts`. Integration: `apps/api/test/integration/whatsapp-onboarding-replies.test.ts`.

## Revisit when

A setup document replaces the get-started link, or the six languages land and the copy moves to them.
