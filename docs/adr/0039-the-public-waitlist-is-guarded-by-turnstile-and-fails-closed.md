# 0039. The public waitlist is guarded by Cloudflare Turnstile and fails closed

- Status: Accepted
- Date: 2026-11-12
- Deciders: Dhyego Calota (owner, delegated 2026-11-12); Claude (advisor)
- Inspired by: the owner's order of 2026-11-12 ("tem que ter captcha"); [ADR 0017](0017-connection-secrets-are-shown-once-and-stored-as-digests.md) (secrets as Worker secrets); [ADR 0031](0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md) (generic answers, rate limit per address)

## Context

The landing page at `zapbip.com` has one action: joining a waitlist, because self checkout is not open yet. The form is public and writes a row per email, so bots would fill the list, poison the referral counts and make the owner's export noisy. The Worker already runs a rate limiter per client address, but a rate limit alone does not stop a botnet that rotates addresses.

The zone is on Cloudflare already ([deploy runbook](../runbooks/dns.md)), the Worker runs on Cloudflare, and the Workers Free plan allows the verification call.

## Decision

1. The signup form renders the Cloudflare Turnstile widget in managed mode. The site key is a public `vars` entry per environment in `apps/api/wrangler.jsonc`.
2. Every `POST` to the signup route calls Turnstile `siteverify` from the Worker with the secret `TURNSTILE_SECRET_KEY`, a Worker secret per environment. The Worker accepts the signup only when all three hold:
   - `success` is true;
   - `hostname` equals the host of the environment's site origin;
   - `action` equals the constant `waitlist-join` that the widget was rendered with.
3. Fail closed. A missing or whitespace-only secret, a timeout, a non-2xx response or a malformed body means no row is written. The page renders the unavailable notice in place of the form, and the POST answers with the same notice. The page itself still renders.
4. Development and the end-to-end suite use Turnstile's published always-pass test keys. Staging uses the same test keys until the owner creates a staging widget. The production secret is set by the owner with `wrangler secret put` and is never read or copied by an agent.
5. The per-address rate limiter (`INSTALL_PAGE_LIMITER`, shared with the install page) runs before the Turnstile call, so a flood does not spend verification calls.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Honeypot field and time check only | no third party, no network call | a scripted client passes it; the owner asked for a captcha | not a captcha |
| Google reCAPTCHA | familiar | Google script and cookies on a page whose privacy note says what is stored; a second vendor relationship | Turnstile is on the same account and needs no tracking cookie |
| hCaptcha | privacy-focused | a second vendor and account; no existing secret store | same reason as above |
| Cloudflare Managed Challenge on the whole page | no widget code | challenges every visitor, including search crawlers and the owner's own preview; not a per-form guard | the form, not the page, is the abuse surface |
| Fail open when Turnstile is unreachable | never blocks a real user | a Turnstile outage or a missing secret opens the list to bots | the owner asked for a captcha; the cost of a short pause is lower than a poisoned list |

## Consequences

- One new Worker secret for production and staging, written by the owner. The deploy preflight does not know it yet, so [deploy-readiness](../features/deploy-readiness/spec.md) gets a line in its secrets list in the same change.
- Each signup makes one outbound call to Cloudflare. It adds latency to the Join button, which the test plan measures.
- Turnstile tokens are single-use. A retry after a server-side refusal needs a fresh widget; the page resets the widget on every notice.
- The test keys accept any token. Development and staging do not prove that production rejects a bad token, so the production smoke test (spec, Owner-only steps) submits one invalid token and expects the refusal.

## Evidence

- Turnstile server-side validation is the documented `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with the secret, the token and the optional remote address. The hostname and action fields of the response are documented and are checked here.
- The exact always-pass test key values are in Cloudflare's Turnstile documentation; they are not copied into the repository.

## Revisit when

- Abuse passes Turnstile in production (the referral or duplicate counts show a pattern from one network).
- The owner wants signups from a second channel that cannot run the widget.
