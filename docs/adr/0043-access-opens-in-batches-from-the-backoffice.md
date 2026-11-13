# 0043. Access opens in batches from the backoffice

- Status: Accepted
- Date: 2026-11-13
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: the owner's order of 2026-11-13 ("the referral is not for the waitlist but for when everything is live, because we will release access to some members; releasing must be in batch and simple"); [ADR 0016](0016-accounts-start-on-the-first-message-and-wait-on-a-list.md) (accounts start waitlisted, "the operator moves a waitlisted account to active"); [ADR 0040](0040-the-waitlist-and-the-referral-cap-live-in-d1-and-the-cap-is-a-settings-row.md) (the email waitlist in D1); [ADR 0031](0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md) (backoffice writes behind CSRF and a step-up code)

## Context

A WhatsApp account is `waitlisted` while `WAITLIST_ENABLED` is true and nothing moves it to `active`. The site waitlist holds emails only, and no email provider exists, so an invitation cannot be mailed. The owner opens access to some members at a time and wants it simple.

## Decision

1. One backoffice page, Access, with two lists and one batch action each, behind CSRF, a fresh step-up code and a batch limit (`ACCESS_BATCH_LIMIT`, 10, because one release costs three subrequests and the Free plan allows 50 per request). Each batch writes one audit row whose target carries the counts.
2. **Release access** moves selected `waitlisted` accounts to `active` through the core use case `releaseAccountAccess`, one conditional `UPDATE ... WHERE state = 'waitlisted'`. A repeat is a no-op, and an account that is `suspended` or `deleting` is never touched. The release time is stored in `accounts.released_at` so the metrics can tell how many released accounts connected an agent.
3. Each released owner gets one WhatsApp message in their language through the account's Durable Object, with the existing delivery rule: a session message when the 24-hour window is open, otherwise the message is queued and the approved notice template (sender `zapbip`) asks the owner to tap Open. A failed delivery is reported as not notified in the batch result and never retried silently.
4. **Invite** creates, for each selected email-waitlist entry, a single-use code: random, stored as a digest in `waitlist_invites`, valid for `WAITLIST_INVITE_TTL_MS` (30 days). The backoffice shows the batch's links once (a text box to copy and a CSV download), because the digest cannot be reversed and no email is sent. The link is the start link's WhatsApp target carrying the code in the prefilled text.
5. The inbound handler finds a code in the first words of a message from a `waitlisted` account (new or existing), consumes it with one conditional `UPDATE` and releases the account. A used, expired, unknown or malformed code changes nothing, and the message is handled as any other. An account in another state never consumes a code.
6. An entry is eligible to be invited while it has no used or live code, so an expired invite can be issued again.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A global switch of `WAITLIST_ENABLED` | one flag | opens everything at once; the owner wants some members | fails the order |
| Release by editing D1 by hand | no code | no audit, no notice, error prone | not simple |
| Send the invitation by email | familiar | no provider exists (owner item A3) | cannot be built today |
| Store invite codes in plain text | the page could show them again | a database read leaks every open invite | the repository stores secrets as digests ([ADR 0017](0017-connection-secrets-are-shown-once-and-stored-as-digests.md)) |
| A template message to every released owner | always reaches them | needs an approved utility template of its own | the existing notice template plus the queue already carries it |

## Consequences

- Migration `0012` is additive: `waitlist_invites`, `accounts.released_at` and six indexes. Rolling it back means deploying the previous Worker first, then dropping them; the invites are lost.
- An invite link whose owner never taps Open stays queued until they write.
- The page never shows a code again after the batch result; a lost batch is invited again after it expires.

## Evidence

- The state change and the code rules are covered by unit tests in `libs/core/src/accounts`; the batches, the first message and the metrics by integration tests in `apps/api/test/integration`.

## Revisit when

- An email provider exists: the invite action then mails the link and the links page goes away.
- A release needs a schedule or a per-person quota.
