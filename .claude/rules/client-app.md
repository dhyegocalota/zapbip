---
paths:
  - "apps/api/src/client-app/**"
  - "apps/api/e2e/client-app/**"
  - "apps/api/migrations/0011_client_app.sql"
  - "apps/api/src/adapters/d1/d1-sign-in-links.ts"
---

# Customer web app facts

Spec: `docs/features/client-app/spec.md`. Decision: `docs/adr/0042-the-customer-web-app-signs-in-with-a-one-time-link-sent-over-whatsapp.md`.

- **One Worker, one more host.** `apps/api/src/backoffice/host-dispatch.ts` sends `APP_ORIGIN`'s host to `createClientApp`. Nothing under `apps/api/src/mcp`, `apps/api/src/routes`, `apps/api/src/account-inbox`, `apps/connector` or `libs/` imports the app (`tools/repository-shape/src/backoffice-isolation.test.ts`).
- **Sign-in.** The bare word `login` (the word of each language: `entrar`, `acceder`, `anmelden`, `connexion`, `ログイン`, `로그인`, `登录`) replies with `<APP_ORIGIN>[<language prefix>]/sign-in/<token>`: 32 random bytes, only the SHA-256 digest stored in `client_app_sign_in_tokens`, one live token per account, 10 minutes. `GET` never consumes it; `POST` runs one `DELETE ... RETURNING`, then creates a session. Waitlisted and active accounts may sign in; `suspended` and `deleting` get the usual refusal. The stored copy of the reply is masked once sent (`apps/api/src/account-inbox/install-code-redaction.ts`).
- **Sessions.** The `__Host-zapbip_app` cookie holds a random token, D1 stores its digest for 30 days, and every request joins the session to `accounts` and `owner_identities`, so a removed, suspended or deleting account is signed out at once. The scheduled tick prunes expired rows.
- **CSRF.** Every `POST` needs an `Origin` equal to `APP_ORIGIN` and an HMAC token derived from the session token, or from the link token on the Continue page. The policy is `Referrer-Policy: same-origin`, because `no-referrer` makes Chrome send `Origin: null` (`docs/learnings/2026-11-13-no-referrer-makes-chrome-send-origin-null-on-form-posts.md`).
- **No second business rule.** Connect and revoke call `AccountInbox.applyWebCommand`, which runs `applyOwnerCommand` with the same use cases as the WhatsApp commands; the page maps their reply intents to its own copy.
- **Pages.** Server-rendered Hono JSX, no script, copy in `apps/api/src/client-app/client-app-copy.ts` (keys in `client-app-copy-keys.ts`, one `client-app-copy-<language>.ts` per language beyond English and Portuguese), English at `/` and every other `OwnerLocale` under its prefix (`/pt-br`, `/es`, `/de`, `/fr`, `/ja`, `/ko`, `/zh`, `/ar`), the account's language after sign-in. The header holds the brand and sign out; the footer is the compact shared footer with the language menu and the theme switch from `apps/api/src/web-shell` ([rule](web-shell.md)), posting to `POST /locale` and `POST /theme` (theme cookie `__Host-zb_app_theme`). The signed-out page is a hero: headline, one primary `wa.me` link, a trust line, an agents line to the docs and a phone mock of the `login` exchange drawn in HTML and CSS (`views/signed-out-page.tsx`). The sign-in button opens `wa.me/<start number>?text=login|entrar`, and the page answers `503` while no number is active.
- **Agent surface.** `GET /` with `Accept: application/json` answers the overview the page shows (`accountOverviewWireSchema`: state, masked phone, plan, agents) through `apps/api/src/accounts/overview-wire.ts`, the same builder the `list_agents` and `account_status` tools use, and `401` `{"error":"sign_in_required"}` when signed out; every home response carries `Vary: Accept`. Actions stay CSRF forms. Decision: `docs/adr/0045-an-agent-manages-the-account-through-mcp-with-the-owner-approving-on-whatsapp.md`.
