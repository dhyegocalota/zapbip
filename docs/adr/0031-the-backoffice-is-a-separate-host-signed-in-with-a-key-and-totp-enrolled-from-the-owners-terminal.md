# 0031. The backoffice is a separate host on the same Worker, signed in with a key and TOTP enrolled from the owner's terminal

- Status: Accepted
- Date: 2026-11-07
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's order of 2026-11-07 ("subir um painel admin com 2fa, metricas e adicoes de numeros de whatsapp") and its correction the same day (the feature is the backoffice at `backoffice.zapbip.com`; numbers are registered in it); [ADR 0009](0009-cloudflare-workers-with-one-durable-object-per-account.md); [ADR 0017](0017-connection-secrets-are-shown-once-and-stored-as-digests.md); [ADR 0027](0027-deploys-run-from-the-owners-machine-not-from-ci.md); RFC 6238

## Context

The operator needs a web backoffice that:

- registers WhatsApp numbers with their Meta credentials;
- shows read-only metrics.

It must:

- admit one person only, with two factors;
- use no third-party auth service and no new infrastructure;
- be unreachable to agents;
- fit the Workers Free plan, whose 10 ms CPU budget per request rules out slow password hashes.

The owner's terminal already holds the only deploy-capable credential, a scoped Cloudflare token (ADR 0027), so it is the natural root of trust. The channel Worker must open the registry's sealed credentials on every send and webhook, so it holds the registry master key whatever else is decided.

## Decision

1. **Two factors.**
   - A generated backoffice key: `zb_bo_` plus 32 random bytes in base64url.
   - A TOTP code: RFC 6238, SHA-1, 6 digits, 30 s, ±1 step, each step usable once.
   - The key is stored only as a SHA-256 digest. Its entropy makes a slow hash unnecessary, the same reasoning as ADR 0017.
2. **Enrollment only from the owner's terminal.**
   - `pnpm backoffice:enroll:<environment>` needs a TTY. It prints the key once and a TOTP QR code, and verifies a typed code before writing anything.
   - It sets `BACKOFFICE_KEY_DIGEST` and `BACKOFFICE_TOTP_SECRET` as Worker secrets through stdin.
   - It resets the operator row and drops every session in D1.
   - `guard-deploy.sh` blocks it for agents.
   - Re-enrollment is the only recovery, and there are no recovery codes.
3. **Sign-in hardening.**
   - One generic failure answer.
   - A per-address rate limit (`BACKOFFICE_RATE_LIMITER`, 5 per minute).
   - A D1 lockout after 10 consecutive failures for 15 minutes.
   - Sessions in a `__Host-` cookie (`Secure`, `HttpOnly`, `SameSite=Strict`), stored as digests, 30 minutes idle and 8 hours absolute.
   - A fresh TOTP code (step-up) for every registry change.
   - CSRF refused unless both the `Origin` check and an HMAC form token pass.
   - Every action written to an audit table.
4. **A separate host on the same Worker.**
   - `backoffice.zapbip.com` (staging `backoffice-staging.zapbip.com`) is a second custom domain on `zapbip-api`.
   - The Worker dispatches by the request URL host before routing. Neither app mounts the other's routes, and tests and a repository-shape rule pin that.
5. **Server-rendered Hono JSX with no client script.** This allows `Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`, plus HSTS, `X-Frame-Options: DENY`, `no-store` and `noindex` on every response.
6. **Passkeys come later as an added factor**, not a replacement, once the backoffice exists to register them from.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Passkeys (WebAuthn) only | phishing-resistant; no shared secret on the server | registration must happen in a browser on the backoffice origin, so bootstrap needs a one-time enrollment link instead of the terminal; COSE and attestation parsing needs a library such as `@simplewebauthn/server` | the owner asked for terminal bootstrap and TOTP; kept as the phase 2 extra factor |
| TOTP alone | simplest | one factor (possession); not "2FA" | does not meet the order |
| Human password + TOTP | familiar | needs PBKDF2 or Argon2 to resist offline guessing, which exceeds the 10 ms Free-plan CPU budget | a generated key gives more entropy at zero CPU |
| Cloudflare Access (Zero Trust) in front of the host | managed; email one-time PIN or IdP; no auth code | a new product and policy surface outside the repository; the factor is email; not testable in the local gate | "no third-party auth" and the gate (ADR 0005) |
| A separate `apps/backoffice` Worker | backoffice code and its secrets not in the MCP isolate | the registry master key must live in the channel Worker anyway; a second deploy, preflight and set of bindings (cross-script Durable Object binding) | the isolation gained is small; host dispatch plus tests gets most of it |
| Static SPA with a JSON API | richer interactions | a build step and asset pipeline; client-side token handling; the CSP must allow scripts; new dependencies | more attack surface for a single-operator tool |
| TOTP secret sealed in D1 instead of a Worker secret | rotation without a new Worker version | the enrollment script would need the sealing key in the owner's shell; one more key | a Worker secret is already encrypted at rest and write-only through the API |

## Consequences

- Production go-live adds steps to the runbook: deploy, enroll, sign in, register the number, then point the Meta webhook.
- `wrangler secret put` creates a new Worker version, so enrollment is a deploy act. That is acceptable because only the owner runs it.
- Anyone who reaches the host can lock the operator out for 15 minutes; the owner unlocks at once by re-enrolling. Accepted in exchange for bounded online guessing.
- TOTP remains open to a real-time phishing relay until passkeys arrive. Mitigations: an unlisted host, HSTS, step-up and the audit log.
- One Worker holds every secret. A code-execution flaw in any route reaches the registry key. The defence is the isolation tests, review and the security reviewer.
- Development relies on Chromium treating `*.localhost` as a secure context for `__Host-` cookies over `http`. The fallback is `wrangler dev --local-protocol https`.
- `apps/api/tsconfig.json` gains `jsx: react-jsx` and `jsxImportSource: hono/jsx`. Copy stays in `backoffice-copy.ts` (`pt_BR`, `en_US`).
- New dependencies, approved by the owner's delegation of 2026-11-06:
  - a terminal QR renderer for the script (recommended `uqr`, which has no dependencies);
  - `@playwright/test` in `apps/api` (already in the lockfile).

## Evidence

- RFC 6238 Appendix B vectors pin the TOTP implementation (`backoffice-totp.test.ts`).
- The Workers Free plan's 10 ms CPU limit, from the deploy-readiness spec (known risk 3).
- `apps/api/src/routes/install-page.ts` (feat/install-skills) already serves Worker-rendered private pages with `no-store`, `noindex`, `nosniff` and HSTS.
- `hono@4.13.16` ships `hono/jsx`; no new runtime dependency.

## Revisit when

- A second operator or a role is needed.
- Passkeys are added (phase 2): then decide whether TOTP stays as a fallback.
- The backoffice gains write access to owners' data (account actions), which may justify a separate Worker.
- The Workers Paid plan removes the CPU constraint, or a breach makes the shared isolate unacceptable.
