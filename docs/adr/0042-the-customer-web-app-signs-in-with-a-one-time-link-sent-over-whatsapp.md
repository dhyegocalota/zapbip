# 0042. The customer web app signs in with a one-time link sent over WhatsApp

- Status: Accepted
- Date: 2026-11-13
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: [ADR 0012](0012-owner-identity-by-wa-id-on-the-shared-number.md) (the phone is the identity), [ADR 0015](0015-commands-are-bare-words-routed-before-agents.md) (commands), [ADR 0017](0017-connection-secrets-are-shown-once-and-stored-as-digests.md) (digests at rest), [ADR 0035](0035-a-start-link-on-the-worker-picks-the-number-new-owners-write-to.md) (the start number), [ADR 0041](0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md) (host dispatch)

## Context

Customers manage everything over WhatsApp commands. The owner asked for a minimal web app ("keep it minimum", "make all decisions"). The phone is the only identity zapbip has: an account is created by the first message from a `wa_id`, and there is no password, no email and no OTP. A web sign-in must not add a second identity, and it must not make the customer type a code.

## Decision

1. The app lives on `app.zapbip.com` (production) and `app-staging.zapbip.com` (staging), served by the API Worker through host dispatch, one `APP_ORIGIN` var per environment (development `http://app.localhost:8787`).
2. Sign-in is a bare-word command, `login` in English and `entrar` in Portuguese ([ADR 0015](0015-commands-are-bare-words-routed-before-agents.md)). The reply carries one link `<APP_ORIGIN>/sign-in/<token>`. The token is 32 random bytes, stored only as a SHA-256 digest in D1, bound to the account, valid for 10 minutes and single use. A new `login` replaces the account's earlier unused token.
3. WhatsApp fetches link previews, so `GET /sign-in/<token>` never consumes the token: it renders a page with a Continue button. `POST /sign-in/<token>` consumes it in one `DELETE ... RETURNING` statement, creates a session and sets the cookie `__Host-zapbip_app` (HttpOnly, Secure, SameSite=Lax, Path=/). The POST is rate limited per client, checks the `Origin` and a CSRF token derived from the link token.
4. A session is a random 32-byte id stored as a digest, valid for 30 days. Every request joins the session to the account and accepts only `waitlisted` and `active`; `suspended`, `deleting` and a deleted account end every session at once. Sign-out deletes the row.
5. The stored copy of the WhatsApp reply is masked once sent, like an install link ([ADR 0017](0017-connection-secrets-are-shown-once-and-stored-as-digests.md)).
6. The app calls the same use cases as the commands, through the account Durable Object. It adds no business rule. Deleting the account stays a WhatsApp command; the app links to the docs page.
7. The app ships a strict policy of its own: no script, `style-src 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `Referrer-Policy: same-origin` (`no-referrer` makes Chrome send `Origin: null` on form posts, which the Origin check refuses), HSTS outside development.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Email and password | familiar | a second identity, resets, breaches; the phone already proves identity | contradicts ADR 0012 |
| A six-digit code typed on the web | no link to forward | the customer types a code, phishing-friendly, needs a second step | the link is one tap from the chat |
| A magic link consumed on GET | one fewer click | WhatsApp and browsers prefetch links and would burn the token | previews would lock customers out |
| A WhatsApp Login with Meta OAuth | no command | a new Meta product and review, not in the official Cloud API scope used here | out of scope |

## Consequences

- Two additive D1 tables (`client_app_sign_in_tokens`, `client_app_sessions`); rollback is dropping them and the `login` word; no existing row changes.
- The words `login` and `entrar` become reserved agent names.
- The words `login` and `entrar` become bare command words ([ADR 0015](0015-commands-are-bare-words-routed-before-agents.md)): a message that is exactly one of them is a command, and an agent cannot take them as a name.
- The stored copy of the reply is masked only once the reply reached `sent`; a send that fails after the link was stored keeps the clear token until the reply is retried or the token expires (10 minutes), the same edge as an install link.
- Workers Logs and Cloudflare request logs see the path `/sign-in/<token>`. The token is single use and lives 10 minutes, and the app logs no path. After use or expiry the logged path opens nothing.
- A successful sign-in ends the account's earlier sessions, and sign-out ends every session of the account.
- The link is a bearer credential for ten minutes; forwarding it hands the session to whoever opens it first. The Continue step and the single use bound the exposure.
- The earlier non-goal "no web dashboard" of `accounts-and-keys` is superseded for this one page.

## Evidence

`docs/features/client-app/test-plan.md`.

## Revisit when

Billing, usage meters or editing agents reach the web, or a second identity (an email) is needed.
