# Waitlist landing page

**Status:** Approved
**Tier:** 🔴 structural
**Owner approval:** approved 2026-11-12 (owner delegated)
**ADRs:** [0039](../../adr/0039-the-public-waitlist-is-guarded-by-turnstile-and-fails-closed.md) (Turnstile, fails closed); [0040](../../adr/0040-the-waitlist-and-the-referral-cap-live-in-d1-and-the-cap-is-a-settings-row.md) (waitlist and cap in D1); [0041](../../adr/0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md) (public site on the API Worker by host); reads [0030](../../adr/0030-the-docs-speak-to-any-ai-user-in-two-languages-and-the-switcher-picks-the-language.md) and [0031](../../adr/0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md)
**Not changing:** the MCP host and its routes, the backoffice sign-in, sessions and step-up, the account waitlist (`WAITLIST_ENABLED`, `waitlisted` state of [accounts-and-keys](../accounts-and-keys/spec.md), a different thing with the same word), the docs host `docs.zapbip.com` on Mintlify, the start link, the registry and every number state, the audit retention, the Embedded Signup page and its policy

## Problem

zapbip has no public page. Self checkout is not open, so the only action a visitor can take is joining a waitlist. The owner wants a sales page at `zapbip.com` for AI enthusiasts, with a referral loop that brings more people in before there is a sign-up.

The owner's words (2026-11-12, translated): a sales page; a captcha on the form; a very simple first fold that any AI enthusiast understands; a sexy page with videos and animations like datafa.st and aquavoice.com (structure and feel only, no copied text, art or layout); refer-a-friend for waitlisters, capped at 5 per person to start, with the cap easy to change later.

Facts found in the code that shape the design:

- The apex `zapbip.com` redirects to the docs host today ([DNS runbook](../../runbooks/dns.md), step 5). The first production deploy needs those records removed first.
- `apps/api/src/backoffice/host-dispatch.ts` already picks the app by request host. The MCP app is the fallback for every other host, so a public host needs its own branch.
- The backoffice pattern is server-rendered Hono JSX with a generated stylesheet (`assets/stylesheet.ts`), cookie-backed language and theme (`locale.ts`, `preference-cookie.ts`) and a strict CSP (`backoffice-constants.ts`). The public site reuses the rendering and cookie patterns and not the backoffice's policy.
- `OwnerLocale` in `libs/types` already has `pt_BR` and `en_US`, and `resolveLocale` already reads `Accept-Language`.
- `INSTALL_PAGE_LIMITER` (30 requests per minute per client) is the existing public-page limiter.
- The latest migration is `0009`. The backoffice operator is the singleton row; there is no settings table.

## Goals

- A public page at `https://zapbip.com/` (production) and `https://staging.zapbip.com/` (staging), in `pt_BR` and `en_US`, with the language from the `Accept-Language` header and the existing switcher.
- A first fold a non-expert AI user understands in five seconds: one headline, one subhead, the email field with a Join button, and a looping muted demo in view.
- Sections below the fold: how it works (three steps), what agents can do, works with (Claude Code, Codex, any MCP client), privacy and the official Cloud API, a short FAQ, a final call to action.
- A Turnstile check on every join, server-side, failing closed in production when its secret is missing.
- One row per email in D1. Joining twice with the same email creates no second row and changes nothing.
- A referral link `https://zapbip.com/?ref=<code>`. A referred join credits the referrer while the referrer is under the cap. Past the cap the friend still joins, uncredited. Self-referral and a repeated email never credit.
- The thank-you state (after a successful join) shows the person's own referral link, a copy button, a share button and "N of CAP friends invited".
- The cap is a settings row, editable in the backoffice. The change applies to the next join, with no deploy.
- A backoffice Waitlist page: total, the list (email, joined, credited referrals, referred by), CSV export and the cap setting, in `pt_BR` and `en_US`.
- Motion: a short looping muted demo (mp4 and webm, with a poster) of a real flow, plus CSS-only micro animations. `prefers-reduced-motion` turns the loop into the poster and stops the animations.
- Lazy loading below the fold, no layout shift, a 375 px layout with no horizontal scroll, LCP under 2.5 s on mobile.
- SEO and social: title, description, canonical, Open Graph and Twitter image, favicon, `robots.txt`, `sitemap.xml`.
- A privacy note next to the form: what is stored (email, language, referral data) and what is not (no IP address, no tracking cookies).
- `www.zapbip.com` answers `301` to the apex with the same path and query.

## Non-goals

- Checkout, payment, plans or any account creation from the page.
- Sending email. There is no email provider yet. Confirmation and invitation emails are a follow-up that needs a provider decision from the owner.
- Storing IP addresses or any analytics tracking. Page analytics are a follow-up.
- A queue position shown to the visitor. The reward is the order in the backoffice list; showing a number is a follow-up.
- Editing or deleting a waitlist row from the backoffice, and a public unsubscribe. A deletion request is handled by hand in v1; the privacy note says so.
- A second referral reward or referral levels.
- Changing the existing account waitlist or `WAITLIST_ENABLED`.
- A second demo cut per language. One video with the English product screens serves both languages; see the open questions.

## Design

The frontend-designer writes `docs/features/waitlist-landing/design.md` (states, components, tokens, copy in both languages, motion spec, options with a recommendation). It comes before any UI build step, and the owner answers its open options there. The public page gets its own bold marketing look; it reuses the backoffice's token names where they fit, without copying its chrome.

### Data flow

Visitor, public page:

```
GET https://zapbip.com/?ref=<code>
  -> host dispatch: site host -> site app; www host -> 301 to SITE_ORIGIN (path and query kept)
  -> locale: cookie if set, else Accept-Language, else DEFAULT_LOCALE (existing resolveLocale)
  -> referral code: the ref query value, kept only when it matches the code shape; carried into the form as a hidden field
  -> 200 page: hero, demo (poster first, lazy video), sections, Turnstile widget (when the site key and secret are configured)
```

Join:

```
POST /join  (email, locale, referralCode, cf-turnstile-response)
  -> rate limit: INSTALL_PAGE_LIMITER, same key as the install page
  -> validate email shape; normalise: trim and lower-case
  -> Turnstile siteverify (secret, token): success && hostname === site host && action === 'waitlist-join'
       no -> notice Unavailable or Captcha (no write)
  -> one D1 batch:
       insert the row with a fresh referral code (retry on the unique code clash)
         credited = 1 only when: referral code given, it exists, its email differs from this email,
         and its credited count < cap read from site_settings in the same statement
       on a duplicate email (unique conflict): no write
  -> respond 200 with the thank-you state (same markup for new and duplicate), showing
       the row's referral link and "credited / cap"
```

The credit rule is one SQL statement, so two concurrent joins for the last slot of one referrer cannot both be credited. The duplicate case writes nothing and returns the same markup as a new join.

Backoffice:

```
GET /waitlist                 -> list, total, cap; session required
GET /waitlist/export.csv      -> CSV of the list; session required; audit row written
POST /waitlist/cap            -> CSRF, step-up TOTP, validate integer 1..100, update site_settings; audit row written
```

### Interfaces

Shared (`libs/types`):

- `WAITLIST_REFERRAL_CODE_LENGTH = 12`, `WAITLIST_EMAIL_MAX_LENGTH = 254`, `DEFAULT_WAITLIST_REFERRAL_CAP = 5`, `WAITLIST_REFERRAL_CAP_MIN = 1`, `WAITLIST_REFERRAL_CAP_MAX = 100`.
- `SiteSettingKey` enum with `WaitlistReferralCap = 'waitlist_referral_cap'`.
- `WaitlistJoinOutcome` enum: `Joined`, `AlreadyJoined`, `Unavailable`, `CaptchaFailed`, `InvalidEmail`, `RateLimited`.
- `TURNSTILE_ACTION_WAITLIST_JOIN = 'waitlist-join'`.

Site (`apps/api/src/site/`):

- `site-app.ts`: `createSiteApp(): Hono<SiteEnv>`, routes for `/`, `/join`, `/robots.txt`, `/sitemap.xml`, `/site/*` assets, and a not-found page.
- `site-copy.ts`: every visible string in `pt_BR` and `en_US`, keyed by a `SiteCopyKey` enum.
- `join-waitlist.ts`: `joinWaitlist(input: { database; email; locale; referralCode; now })` returns `WaitlistJoinResult` with the outcome and the stored row's referral code and credited count.
- `referral-code.ts`: `createReferralCode(input: { randomBytes })` from WebCrypto, base32 alphabet without look-alike characters.
- `turnstile.ts`: `verifyTurnstileToken(input: { secret; token; expectedHostname; fetchImplementation })` returns a boolean; any network or shape error returns `false` and is logged without the token.
- `site-policy.ts`: the site's content security policy and headers, a constant.

Backoffice (`apps/api/src/backoffice/waitlist/`):

- `waitlist-routes.tsx`, `waitlist-page.tsx`, `waitlist-csv.ts` (`toWaitlistCsv(input: { rows })`, quoting every cell and prefixing a cell that starts with `=`, `+`, `-` or `@` with an apostrophe), `waitlist-queries.ts`, `referral-cap-settings.ts` (`readReferralCap(input: { database })` throws when the row is missing; `writeReferralCap(input: { database; value; now })`).
- `BackofficeAuditAction` gains `WaitlistExported = 'waitlist.exported'` and `ReferralCapChanged = 'waitlist.referral_cap_changed'`.
- `BackofficePath` gains `Waitlist`, `WaitlistExport`, `WaitlistCap`.

Database (`apps/api/migrations/0010_landing_waitlist.sql`):

```sql
CREATE TABLE landing_waitlist (
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by TEXT,
  credited INTEGER NOT NULL DEFAULT 0 CHECK (credited IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE INDEX landing_waitlist_referred_by ON landing_waitlist (referred_by, credited);
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO site_settings (key, value, updated_at) VALUES ('waitlist_referral_cap', '5', '<migration date>');
```

The column names follow the snake_case of the existing migrations; the developer confirms against `0005` and `0009` before writing.

Configuration (`apps/api/wrangler.jsonc`, per environment):

- `vars`: `SITE_ORIGIN` (`https://zapbip.com`, `https://staging.zapbip.com`, `http://site.localhost:8787` in development), `TURNSTILE_SITE_KEY` (the public key per environment; the test key in development and staging).
- `routes`: production gets `zapbip.com` and `www.zapbip.com`; staging gets `staging.zapbip.com`; development gets none.
- `assets`: a directory `apps/api/site-public/` with the demo video, poster, Open Graph image and favicon, under `/site/`.
- Worker secret `TURNSTILE_SECRET_KEY` per environment, written by the owner. Development uses the published always-pass test secret through its `vars` entry, not a file under `.env*`.
- `WAITLIST_ENABLED` is untouched.

Demo media: recorded locally from the real product (the fake WhatsApp channel, Playwright `recordVideo`, then ffmpeg to mp4 and webm, with a poster frame). The recording script lives in `apps/api/scripts/record-landing-demo.ts`. The media is committed under `apps/api/site-public/`, each file under 2 MB, the total under 6 MB.

Environment handling: `requireConfigured` for the site checks `TURNSTILE_SECRET_KEY` only in production and staging, and treats an empty or whitespace-only value as missing.

### Failure handling

| Failure | What the visitor sees | What is written |
|---|---|---|
| Secret missing or whitespace (production, staging) | the form is replaced by the unavailable notice; the page renders | nothing |
| Turnstile timeout, 5xx or malformed body | the unavailable notice, and the widget resets | nothing |
| Turnstile says the token is invalid, or hostname or action mismatch | "Please confirm you are not a robot" and the widget resets | nothing |
| Invalid email shape | the field error, the typed value kept | nothing |
| Rate limit exceeded | 429 with `Retry-After`, the rate-limit notice | nothing |
| Duplicate email | the same thank-you state as a new join | nothing |
| Referral code unknown, malformed or self | joins without credit; the page does not say why | the row, `credited = 0` |
| Referrer at or above the cap | joins without credit | the row, `credited = 0` |
| Referral code clash on insert | retried with a fresh code, at most three attempts | the row once |
| Cap row missing | backoffice list shows an error notice and the cap cannot be read; the join returns the unavailable notice | nothing |
| CSS, video or poster missing | the page renders with the gradient fallback; no broken image | nothing |

Every notice is a `WaitlistJoinOutcome` mapped to `site-copy.ts`. No response carries an email back, no stack trace, no token and no row id.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Hosting for the public page | Mintlify · Cloudflare Pages · the API Worker by host | The API Worker by host (recommended: it has the D1 binding and the Turnstile secret path) | 2026-11-12 |
| Captcha | Turnstile · reCAPTCHA · hCaptcha · honeypot only | Turnstile, fail closed in production ([ADR 0039](../../adr/0039-the-public-waitlist-is-guarded-by-turnstile-and-fails-closed.md)) | 2026-11-12 |
| Waitlist and cap storage | `wrangler` var · Durable Object · D1 settings row | D1 settings row editable in the backoffice ([ADR 0040](../../adr/0040-the-waitlist-and-the-referral-cap-live-in-d1-and-the-cap-is-a-settings-row.md)) | 2026-11-12 |
| Starting referral cap and how to change it | constant · settings row | 5 per person at the start, a settings row in the backoffice; no deploy to change | 2026-11-12 |
| Reward for a credited referral | queue position · early access · nothing | Each credited referral moves the referrer ahead in the backoffice queue order; no position shown to the visitor in v1 | 2026-11-12 |
| Duplicate email response | new-row response · generic error · identical thank-you | Identical thank-you state; no write. The count on that page is shown to whoever types the address (accepted risk, reviewed by the security pass) | 2026-11-12 |
| Self-referral | block by email only · block by code owner | Block when the referral code's email equals the new email after normalisation. Alias addresses (plus tags, dots) are not detected in v1; the cap bounds the damage | 2026-11-12 |
| Email sending in v1 | none · a provider | None; confirmation and invite email are a follow-up that needs a provider decision | 2026-11-12 |
| IP storage | none · hashed · raw | None. The existing per-address limiter keeps its own short-lived counter, which the site does not persist | 2026-11-12 |
| Demo language | one video for both · two videos | One video with English product screens; the captions on the page are localised. A second cut is a follow-up | 2026-11-12 |
| Domain for `www` | Cloudflare redirect rule · Worker 301 | Worker 301 in the repository, pinned by a test ([ADR 0041](../../adr/0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md)) | 2026-11-12 |
| Turnstile in development and staging | real widgets · published test keys | Published always-pass test keys; staging moves to a real widget when the owner creates one | 2026-11-12 |
| Backoffice cap change needs a step-up code | yes · no | Yes, the same rule as registry changes; a cap change is a write that changes who gets credit | 2026-11-12 |

## Owner-only steps

These are never run by an agent. The agent never reads or copies a secret.

1. Before the first production deploy, in the Cloudflare dashboard for `zapbip.com`: delete the apex `A` record and the `www` CNAME, and delete the bare-domain redirect rule. The DNS runbook lists the steps.
2. Create the Turnstile widget for production and staging (dashboard). Copy only the public site key into the repository. Keep the production widget's hostname list to `zapbip.com` and `staging.zapbip.com`.
3. `! wrangler secret put TURNSTILE_SECRET_KEY` for production, and `--env staging` when staging gets a real widget.
4. Export a D1 backup before the first production deploy (migration `0010` is additive, rollback drops the two new tables).
5. Run the production smoke: load `https://zapbip.com/`, submit one join with a valid widget, submit one join with an invalid token and expect the refusal.

## Test strategy summary

Unit (Vitest), integration (`@cloudflare/vitest-pool-workers` against D1 and the Worker), end-to-end (Playwright specs in `apps/api/e2e`), and a Playwright MCP walk recorded for the PR, at 1280 and 375 px. The full checklist is in [test-plan.md](test-plan.md); the plan sequencing is in [plan.md](plan.md).
