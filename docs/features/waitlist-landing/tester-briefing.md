# Tester briefing: Waitlist landing page

Written by the developer. Nothing here says the feature works; each behaviour is a hypothesis for the tester.

## What changed and where

- Shared: `libs/types` constants and enums (waitlist, cap, `SiteSettingKey`, `WaitlistJoinOutcome`, `HttpStatus.MovedPermanently`); migration `apps/api/migrations/0010_landing_waitlist.sql`.
- Site: `apps/api/src/site/**` (join, referral code, Turnstile, settings, routes, copy, views, stylesheet, script, agents from the registry); `apps/api/src/backoffice/host-dispatch.ts` (site host, `www` 301); `apps/api/wrangler.jsonc` (routes, `SITE_ORIGIN`, public site keys, assets).
- Backoffice: `apps/api/src/backoffice/waitlist/**`, nav entry, audit actions, copy keys.
- Media: `apps/api/site-public/site/` (mp4, webm, two posters, `og.png`, touch icon), produced by `apps/api/scripts/record-landing-demo.ts` with `apps/api/scripts/landing-demo/*.html`.
- Docs: `.claude/rules/site.md`, `dns.md` step 5, `deploy.md` secrets row and backup, deploy-readiness lines.

## How to run

- Unit: `pnpm --filter @zapbip/api test:unit`; integration: `pnpm --filter @zapbip/api test:integration`; shape: `pnpm --filter @zapbip/repository-shape exec vitest run`.
- Landing walk (needs internet for the Turnstile test widget): `pnpm --filter @zapbip/api test:landing` (40 specs, desktop 1280x720 and mobile 375x812).
- Re-record the media: `pnpm --filter @zapbip/api exec tsx scripts/record-landing-demo.ts` (needs ffmpeg and Chromium).

## Red-first record (failure text the red runs printed)

- `join-waitlist`, `referral-code`, `site-settings`: `<name> is not implemented`; the migration tests are pins.
- Host dispatch: `expected 404 to be 301`, `expected 404 to be 200`, `expected 200 to be 404`; policy `expected '' to be <policy>`; wrangler pins.
- Page, join, stylesheet: `expected 404 to be 200` and an empty stylesheet; assets: missing files.
- Turnstile verdict: `verifyTurnstileToken is not implemented`; testing key: only the accepting case red.
- Backoffice waitlist: `<name> is not implemented`, `expected 404 to be 200`.
- Registry names: `expected [ ... ] to deeply equal` on tile names.
- Pins (green on landing): migration tests, the 40 Playwright specs, two join-route testing-key tests, the contact-link test.

## Hypotheses to test

- A duplicate email returns byte-identical markup and writes nothing; timing was not measured.
- Twenty concurrent joins for one referrer at cap minus one credit exactly one (integration test, same code path as production D1).
- The page renders with the secret missing or blank, with no form and no widget script; a direct POST writes nothing.
- `www.` answers 301 keeping path and query; the MCP host answers 404 for `/join`.
- The cap change applies to the next join with no deploy; a wrong or empty step-up code leaves it unchanged with a failed step-up audit row.
- The CSV neutralises `=`, `+`, `-`, `@` and quotes every cell; the page caps at 500 rows, the CSV does not.
- Reduced motion keeps the video paused and `document.getAnimations()` empty; LCP under Slow 4G is the poster.

## Gaps and deviations

- Tests live in `apps/api/test/{unit,integration}` and `apps/api/e2e/landing`, following the repository layout, not the `src/**/*.test.ts` paths of the test plan.
- The site secret check is uniform: the site is open only when `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY` are both non-blank, in every environment; `require-configured.ts` is untouched.
- `verifyTurnstileToken` returns a verdict (Accepted, Refused, Unavailable), and accepts Cloudflare's testing-key result only in development (measured 2026-11-12: hostname `example.com`, no action). Staging and production use real widgets.
- Staging uses its real widget key `0x4AAAAAAF-QWj6u4g-pvrUT`, not the test pair.
- The "one D1 batch with a forced failure" case is covered by a batch-count test only; D1 batches are atomic.
- The defensive "referrer email equals new email" clause was not written: a self-referral is always a duplicate email, which writes nothing.
- The staging-host E2E (`staging.zapbip.com`) cannot run locally; host dispatch is proven on the apex and `www` shapes.
- Not done here: the Playwright MCP walk, `/check-ui` recordings, the owner-only steps, deploys.
- The works-with tiles show every registry agent (11), not the designer's eight, because ADR 0033 forbids naming agents outside their folders.
- Below-the-fold reveals start at opacity 0.35 so a full-page screenshot is readable.
