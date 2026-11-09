---
paths:
  - "apps/api/src/backoffice/**"
  - "apps/api/src/numbers/**"
  - "apps/api/src/routes/start-link.ts"
  - "apps/api/src/routes/start-link-copy.ts"
  - "apps/api/src/routes/start-link-language.ts"
  - "apps/api/src/routes/start-link-page.ts"
  - "apps/api/src/routes/start-link-style.ts"
  - "apps/api/src/routes/start-link-target.ts"
---

# Backoffice facts

Spec: `docs/features/backoffice/spec.md`. Start link: `docs/features/start-link/spec.md`. Decisions: `docs/adr/0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md` and `docs/adr/0032-whatsapp-numbers-are-rows-in-a-sealed-registry-not-worker-secrets.md`.

- **One Worker, two hosts.** `apps/api/src/backoffice/host-dispatch.ts` sends a request to the backoffice app only when its host and port equal `BACKOFFICE_ORIGIN`. The MCP host answers `404` to every backoffice path, and a host with a trailing dot answers `404` on every path. Neither app mounts the other's routes.
- **Two factors, one operator.** The backoffice key (`zb_bo_` plus 32 random bytes) is stored only as the SHA-256 digest in `BACKOFFICE_KEY_DIGEST`; the TOTP secret is `BACKOFFICE_TOTP_SECRET`. Both are written only by `pnpm backoffice:enroll:<environment>` from the owner's terminal, which `.agents/hooks/guard-deploy.sh` blocks for agents. Never add a way to create, read back or reset them from the web.
- **Sign-in is flat and generic.** One failure answer for every cause. A per-address rate limit, then a D1 lockout of 15 minutes after 10 consecutive failures of a valid key with a wrong code (a wrong key is rate limited and audited but never counted), checked before the factors. Both factors are always checked, with no short-circuit. A TOTP step is accepted once.
- **Sessions.** The `__Host-` cookie holds a random token; D1 stores only its digest. 30 minutes idle, 8 hours absolute.
- **Step-up on every registry change.** Registering, verifying, changing state and replacing a credential each need a fresh TOTP code, which shares the sign-in failure counter and lockout. A locked operator never has a code consumed.
- **Rejected forms redirect.** A failed sign-in is `303` to `/sign-in?notice=SignInFailed`; a rejected numbers form is `303` to its page with a single-use flash in `backoffice_sessions.flash` (one minute, same path only, non-secret values only, never a key, code, token or secret). The redirected GET answers the stored status: `401` code not accepted, `409` duplicate, `422` invalid.
- **CSRF.** A state-changing request needs an `Origin` equal to `BACKOFFICE_ORIGIN` and a valid HMAC form token; a missing `Origin` is refused.
- **No script, strict headers.** Pages are server-rendered Hono JSX with no client script. Every response carries the strict `Content-Security-Policy`, HSTS, `X-Frame-Options: DENY`, `no-store` and `noindex`; only the stylesheet is cacheable.
- **Sealed credentials.** Access tokens and Meta app secrets are sealed with AES-256-GCM under `NUMBER_REGISTRY_KEY`, with the row and field as associated data, so a copied value fails to open. Plaintext exists only inside the Worker, for one request. Pages show "set, last changed" and never a value, a prefix or a length. Only `apps/api/src/numbers/**`, `apps/api/src/backoffice/numbers/**`, `apps/api/src/adapters/d1/d1-number-registry.ts`, `apps/api/src/adapters/d1/d1-number-admin.ts` and the development seed name the `sealed_` columns; `tools/repository-shape/src/backoffice-isolation.test.ts` pins that.
- **Number states.** `pending` is ignored and refused; `pending` becomes `active` only when verified; `active` and `closed` switch both ways; `disabled` ignores inbound and refuses sends.
- **Nothing identifying reaches an agent or a log.** No MCP result, connector frame, error message or log line carries a phone number ID, WABA ID, display number, token, app secret, key or client address. Logs carry event names and kinds only.
- **Audit.** Every action writes a `backoffice_audit` row with its outcome and the client address, kept 365 days and pruned by the daily scheduled job.
- **Isolation.** Nothing under `apps/api/src/mcp`, `apps/api/src/routes`, `apps/api/src/account-inbox`, `apps/connector` or `libs/` imports the backoffice or names a `backoffice_` table.
- **Metrics are read-only.** `GET /metrics` runs one `D1Database.batch` of `SELECT` statements; no other method is routed. Activity counts are written in the account's Durable Object (`activity_meter`, v8) and flushed hourly by `createActivityProvider` to `activity_daily` with the account's `number_id`; the page never adds a D1 write per message. Charts are inline SVG sized by attributes, so the strict Content-Security-Policy stays.
- **One stylesheet, tokens in two blocks.** `apps/api/src/backoffice/assets/backoffice.css` names every colour only inside its two `:root` blocks (light, then dark); every animation is switched off under `prefers-reduced-motion`, and a `forced-colors` block gives the hero card and the sparklines system colours. The contrast of the token pairs is proven from the file by `tools/repository-shape/src/backoffice-contrast.test.ts`.
- **The home is one batch of selects.** `apps/api/src/backoffice/home-sparklines.ts` reads the state counts and three 14-day series (numbers registered, messages, audit entries) in one `D1Database.batch` of `SELECT` statements, with `dailySeries` and `utcDay` from the metrics.
- **The start link follows the registry.** `GET /start` on the MCP host reads one display number per request, the oldest `active` one by `created_at` then `id`, with no cache, and answers `302` to a `wa.me` link built from a fixed origin, the validated digits and the fixed text of the `lang` locale; nothing else from the request reaches the target. No active number, or a stored number that fails the `+` and 7 to 15 digits pattern, answers the `503` page and never a redirect. It reuses `INSTALL_PAGE_LIMITER` under the `start:` key prefix. Closing a number sends new owners to the next active one on the next request (`docs/adr/0035-a-start-link-on-the-worker-picks-the-number-new-owners-write-to.md`).
