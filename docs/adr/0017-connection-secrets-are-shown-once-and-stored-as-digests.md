# 0017. Connection secrets are shown once and stored as digests

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: [ADR 0006](0006-one-secret-per-connection-in-the-mcp-url.md), which makes each connection's secret a credential in a URL

## Context

A connection's secret is the only credential its agent holds. The owner needs the link once, to paste into the agent. After that, zapbip only has to recognise it. The owner's phone number is personal data. zapbip needs it in plain text to reply, and ADR 0012 keys the owner's identity on it.

## Decision

1. A secret is `zb_conn_` followed by 32 random bytes in base64url. It is returned once, in the create reply and the rotate reply, and never stored.
2. Its SHA-256 digest is stored. Resolution looks up the digest and compares the stored digest with the computed one in constant time.
3. The owner's number stays in plain text as `wa_id` in `owner_identities`, as [ADR 0012](0012-owner-identity-by-wa-id-on-the-shared-number.md) requires. Only the secrets are digested.
4. Rotation replaces the digest; revocation sets `revoked_at`. Both take effect on the next request.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Digest of a random secret, shown once (chosen) | a leak of the directory reveals no usable link | a lost link cannot be shown again; the owner rotates | the owner can rotate in one command |
| Reversible encryption, so the owner can see the link again | the link can be re-shown | a key that decrypts every link; a leak of the key exposes every agent | the blast radius is every connection |
| Slow hash such as bcrypt or argon2 for the secret | defence against a leaked directory | 256 random bits cannot be guessed, so a slow hash adds cost and no protection | unneeded for random tokens |
| Keyed digest of the phone, as an earlier draft proposed | no plain number in D1 | the channel must send to the number, so a second readable store is needed; it also breaks the `wa_id` key of ADR 0012 | the owner's number is read by the channel for every reply |

## Consequences

- The create and rotate replies are the only places a secret appears; the install prompt warns the owner that the link is a password.
- Losing the link means rotating, which invalidates the old one. This is the owner's only recovery path.
- The owner's number is plain text in D1, so access to D1 is limited to the Worker and the operator. LGPD deletion removes the row.

## Evidence

- ADR 0006: the connection URL is the credential, one per connection.

## Revisit when

- A client needs to show the link again without rotating.
- OAuth becomes the default in the clients that matter, as ADR 0006 anticipates.
