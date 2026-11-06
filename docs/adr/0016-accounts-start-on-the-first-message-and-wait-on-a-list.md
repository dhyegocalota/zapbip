# 0016. Accounts start on the first message and wait on a list

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: the owner's idea that a message from the phone proves the phone, so there is no OTP and no dashboard; the pre-sale plan

## Context

A message from the owner's phone is the identity proof, once the channel verifies the signature. Creating the account then costs nothing extra for the owner. A shared public number, though, lets anyone with a WhatsApp number create an account, and the product is not open to everyone before the sale.

## Decision

1. The first message from an unknown phone creates the account, with no confirmation step.
2. A new account is `waitlisted` while `WAITLIST_ENABLED` is true, and `active` otherwise. The operator moves a waitlisted account to `active`.
3. A waitlisted account can use `ajuda` and `apagar conta` only. It cannot create connections.
4. A daily cap, `NEW_ACCOUNTS_PER_DAY_LIMIT`, limits new accounts in a rolling 24 h window.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| First message creates, waitlisted by default (chosen) | no friction; the phone proves itself; pre-sale control in one flag | every number can create an account, so a cap and a blocklist are needed | the cap and blocklist are part of this slice |
| Confirmation reply before creation | one more proof of intent | one more round trip; a bot can answer it | the phone already proves intent |
| Invitation codes issued by the operator | no open creation | operator work for every owner; codes leak | too heavy before the sale |
| First message creates, active at once | simplest | no pre-sale control | the owner asked for a waitlist |

## Consequences

- Accounts created during the pre-sale remain in the database after enabling; enabling changes only the state.
- A deleted owner who writes again gets a new waitlisted account.
- The daily cap can silently drop a real owner on a busy day. The operator must watch the log event `account.daily_cap`.

## Evidence

- The owner's pre-sale requirement and the approved slice list.

## Revisit when

- The sale opens and the waitlist flag is set to false in production.
- Abuse of the open creation outruns the cap and the blocklist.
