# Plan: Waitlist landing page

**Spec:** [spec.md](spec.md)
**Tier:** 🔴 structural
**Seam:** `apps/api/src/backoffice/host-dispatch.ts` (a new host kind for the site, the www redirect), `apps/api/src/backoffice/backoffice-paths.ts` and `backoffice-audit-action.ts` (the Waitlist page and its audit actions), `apps/api/wrangler.jsonc` (`vars`, `routes`, `assets`, per environment), `apps/api/migrations/` (`0010`), `libs/types/src/constants.ts` and `enums.ts` (shared constants and enums).
**Assumptions (decided, owner can override):**
- The design comes first: `docs/features/waitlist-landing/design.md` is written by the frontend-designer before any step in group G3 starts. Groups G1, G2, G4 and G5 do not depend on it.
- The copy for both languages lives in `site-copy.ts` and in the backoffice copy file, never inline in JSX.
- Turnstile's published test keys are used in development and staging; the production secret is an owner step.
- `INSTALL_PAGE_LIMITER` is reused for the join POST (spec, ADR 0039 decision 5).
- Demo media is produced once by `apps/api/scripts/record-landing-demo.ts` and committed; re-recording is a manual run.
- The site's `SITE_ORIGIN` for development is `http://site.localhost:8787`, the same pattern as `BACKOFFICE_ORIGIN`.
- The stored referral code is 12 characters from a base32 alphabet without look-alike characters.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/migrations/0010_landing_waitlist.sql`, `libs/types/src/constants.ts` (waitlist constants), `libs/types/src/enums.ts` (waitlist and setting enums), `apps/api/src/site/join-waitlist.ts`, `apps/api/src/site/referral-code.ts`, `apps/api/src/site/turnstile.ts`, `apps/api/src/site/site-settings.ts`, their unit and integration tests | `developer-1` |
| G2 | `apps/api/src/site/site-app.ts`, `apps/api/src/site/site-policy.ts`, `apps/api/src/site/robots-and-sitemap.ts`, `apps/api/src/backoffice/host-dispatch.ts` and its test, `apps/api/src/index.ts` (only the dispatch wiring if needed), `apps/api/src/backoffice/auth/require-configured.ts` (site secret check), `apps/api/wrangler.jsonc`, `apps/api/src/contract/env.ts`, `apps/api/src/site/*.test.ts` for routes | `developer-2` |
| G3 | `apps/api/src/site/views/**`, `apps/api/src/site/site-copy.ts`, `apps/api/src/site/site-styles.ts`, `apps/api/src/site/site-scripts.ts`, `apps/api/site-public/**`, `apps/api/scripts/record-landing-demo.ts`, the E2E specs under `apps/api/e2e/landing-*.spec.ts` | `developer-3` |
| G4 | `apps/api/src/backoffice/waitlist/**`, `apps/api/src/backoffice/backoffice-paths.ts`, `apps/api/src/backoffice/backoffice-audit-action.ts`, `apps/api/src/backoffice/backoffice-copy.ts` (Waitlist keys only), `apps/api/src/backoffice/components/primary-navigation.tsx` (one nav entry), the backoffice unit and E2E tests for the Waitlist page | `developer-4` |
| G5 | `docs/features/waitlist-landing/tester-briefing.md`, `docs/features/README.md` (row), `docs/adr/README.md` (rows 0039 to 0041), `docs/runbooks/dns.md`, `docs/runbooks/deploy.md`, `docs/features/deploy-readiness/spec.md` and `plan.md` (secrets list line only), `tools/repository-shape/src/**` (new shape tests for the site directory and the seed), `apps/api/src/config/` (none) | `developer-5` (after G1 to G4 land) |

G2 and G4 both touch `backoffice-paths.ts`, so G4 owns that file for Waitlist paths and G2 adds nothing to it; G2 owns `host-dispatch.ts` only. `libs/types` is owned by G1; G2, G3 and G4 read the constants and enums and never edit `libs/types` on their own. A developer that needs a change in another group's file stops and notes it in its tester briefing.

## Sequencing

1. **Design first.** The frontend-designer writes `design.md` (states, components, tokens, copy, motion, options with a recommendation). The owner answers its options. No G3 step starts before that.
2. **Parallel, no design needed:** G1 (data and shared constants) first, because G2 and G4 import from it. G2 and G4 start after G1's constants and migration land on the lane branch; G1 commits its red tests first.
3. **After G1, in parallel:** G2 (site routing, wrangler, Turnstile wiring) and G4 (backoffice Waitlist).
4. **After design and G2:** G3 (public UI, copy, media, motion). G3 depends on G2's routes and on the design.
5. **Last:** G5 (docs, runbooks, shape tests, indexes) once the code paths it names exist, so the `docs` class gate sees real files.
6. The tester, the reviewer and the security reviewer run after every group is merged into the feature branch, in the order of the Z section.

Lane branches merge into `feat/waitlist-landing` by merge, never rebase. `main` moves only through the lead.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1 (data and shared constants)

- [x] **Step 1:** Red test: `apps/api/src/site/join-waitlist.test.ts` and `apps/api/src/site/referral-code.test.ts` for the outcomes in the test plan (unit section), committed alone. Then the migration `0010_landing_waitlist.sql` and the constants and enums in `libs/types`; the red run confirms the missing module, not a broken test. — evidence: d69cb9b1 red, 83c7c793 green
- [x] **Step 2:** `referral-code.ts`: 12 characters from WebCrypto, base32 without look-alike characters; the unit test pins length and alphabet and that two calls differ. — evidence: referral-code.test.ts, 83c7c793
- [x] **Step 3:** `site-settings.ts`: `readReferralCap` throws when the row is missing and returns the integer otherwise; `writeReferralCap` validates the range `WAITLIST_REFERRAL_CAP_MIN..WAITLIST_REFERRAL_CAP_MAX` and throws outside it. Test: the migration seed equals `DEFAULT_WAITLIST_REFERRAL_CAP`. — evidence: site-settings.test.ts, 83c7c793
- [x] **Step 4:** `join-waitlist.ts`: one D1 batch that inserts the row, with the credit decided by the single SQL statement from ADR 0040 decision 4; duplicate email is a no-write `AlreadyJoined`; self-referral and an unknown code join uncredited; a code clash is retried at most three times. Test: a concurrency case with two joins for one referrer at cap minus one. — evidence: join-waitlist.test.ts, 83c7c793
- [x] **Step 5:** `turnstile.ts`: `verifyTurnstileToken` checks `success`, the hostname and the action; any fetch failure, non-2xx or malformed JSON returns `false` and never logs the token. Test: each refusal path and the missing-secret path (the caller decides, the function is never called with an empty secret). — evidence: turnstile.test.ts, 41f9c49b and 53efcc6c
- [x] **Step 6:** Integration test against D1 in `@cloudflare/vitest-pool-workers`: migration applies on an empty database; the duplicate unique index rejects a second email; `credited` is constrained to 0 or 1. — evidence: migration-0010.test.ts, d69cb9b1

### G2 (site routing, configuration, Turnstile wiring)

- [x] **Step 7:** Red test: `host-dispatch.test.ts` cases for the site host, `www` (301 to `SITE_ORIGIN` with path and query kept), the development site host, and an unknown host still going to MCP. Commit alone. — evidence: 18a42eb3
- [x] **Step 8:** `host-dispatch.ts`: new host kinds `Site` and `WwwRedirect`, selected from `SITE_ORIGIN`; the MCP fallback and the backoffice branch are unchanged. — evidence: 75adeaf5
- [x] **Step 9:** `site-app.ts`: `createSiteApp()` with `/` (rendered by G3's view, a stub returning the locale for now), `/join`, `/robots.txt`, `/sitemap.xml`, the assets prefix `/site/*` and a not-found page. The join route runs the rate limiter, then `verifyTurnstileToken`, then `joinWaitlist`, and maps each `WaitlistJoinOutcome` to a notice. — evidence: 4514c00e (join-route.ts, site-app.ts)
- [x] **Step 10:** `site-policy.ts`: the site's content security policy and headers as a constant, matching ADR 0041 decision 4; a test pins the exact string. — evidence: site-policy.test.ts, 75adeaf5
- [ ] ~~**Step 11:** `require-configured.ts` and `contract/env.ts`: `TURNSTILE_SECRET_KEY` and `SITE_ORIGIN` and `TURNSTILE_SITE_KEY` added to `Bindings`; the site check throws a configuration error when the secret is missing or whitespace in production and staging, and the site renders the unavailable notice in its place (the render path reads a boolean, it does not throw).~~ struck: the site check is one boolean, `site-configuration.ts`, uniform across environments; `require-configured.ts` untouched. Evidence: struck: uniform site-configuration.ts, see tester-briefing
- [x] **Step 12:** `wrangler.jsonc`: `vars` (`SITE_ORIGIN`, `TURNSTILE_SITE_KEY`) per environment, `routes` (`zapbip.com`, `www.zapbip.com` in production; `staging.zapbip.com` in staging), the `assets` block for `apps/api/site-public/` under `/site/`, and development's test secret entry. A shape test reads the file and checks the route list per environment. — evidence: wrangler-config.test.ts, 75adeaf5
- [x] **Step 13:** `robots-and-sitemap.ts`: `robots.txt` allows `/`, points at the sitemap, and the sitemap lists the canonical URLs for both locales from the same constants as the page. Test: the output for production origin. — evidence: robots-and-sitemap.test.ts, 75adeaf5

### G3 (public UI, after design.md)

- [x] **Step 14:** Red E2E: `apps/api/e2e/landing-first-fold.spec.ts` for the above-the-fold copy in both languages, reading the strings from `site-copy.ts`. Commit alone. — evidence: landing-first-fold.spec.ts, 0d547f98 (pin)
- [x] **Step 15:** `site-copy.ts`: every string in `pt_BR` and `en_US` under `SiteCopyKey`, including the notices, the privacy note, the FAQ and the thank-you state. Copy follows design.md; no inline strings in views. — evidence: 45836bd4, 0ef64eef
- [x] **Step 16:** `site-styles.ts` and the layout view: tokens on `:root` with a dark theme and the theme switcher (cookie, server-rendered, as in the backoffice); 16 px side gutter; 375 px and 1280 px layouts; no horizontal scroll at 375 px. — evidence: 4514c00e
- [x] **Step 17:** The hero: headline, subhead, email field, Join button, privacy note, Turnstile widget mount (rendered only when `TURNSTILE_SITE_KEY` is set and the secret is present), the poster image with explicit `width` and `height` so there is no layout shift. — evidence: 4514c00e
- [x] **Step 18:** Sections below the fold: how it works, what agents can do, works with, privacy and the official Cloud API, FAQ, final call to action. Images and video below the fold use `loading="lazy"`. — evidence: 4514c00e
- [x] **Step 19:** `record-landing-demo.ts`: records the real flow (terminal agent asks, phone mock gets a WhatsApp message with buttons, tap, the agent continues) with Playwright `recordVideo` against the fake WhatsApp channel, converts with ffmpeg to mp4 and webm and writes a poster frame into `apps/api/site-public/`. Each file under 2 MB. The recording is committed. — evidence: c1ee8746
- [x] **Step 20:** `site-scripts.ts`: a small script for the copy and share buttons and the Turnstile reset on a notice; served from `/site/` with `script-src 'self'`. The script never writes a value into the page that came from the server other than the referral link already on the page. — evidence: 4514c00e
- [x] **Step 21:** Motion: CSS-only micro animations; `@media (prefers-reduced-motion: reduce)` shows the poster and removes the animations and the video autoplay; a unit test pins that the stylesheet contains the reduced-motion block. — evidence: site-stylesheet.test.ts, 4514c00e
- [x] **Step 22:** Thank-you state: the person's referral link, the copy button, the share button and the "N of CAP friends invited" line, identical markup for a new join and a duplicate. — evidence: 4514c00e
- [x] **Step 23:** SEO and social: title, description, canonical, Open Graph and Twitter image (`apps/api/site-public/og.png`), favicon, `lang` attribute from the locale. — evidence: site-page.test.ts, 4514c00e

### G4 (backoffice Waitlist)

- [x] **Step 24:** Red test: `apps/api/src/backoffice/waitlist/waitlist-csv.test.ts` and `referral-cap-settings.test.ts`, committed alone. — evidence: 859ce30d
- [x] **Step 25:** `waitlist-csv.ts`: quoted cells, a formula-looking cell prefixed with an apostrophe; a test with `=HYPERLINK(...)` as an email (it cannot be stored by the validator, but the export is defensive). — evidence: waitlist-csv.test.ts, 376f2888
- [x] **Step 26:** `referral-cap-settings.ts` and `waitlist-queries.ts`: the list ordered by credited count descending and join time ascending; the total; the cap read. — evidence: waitlist-queries.test.ts, 376f2888
- [x] **Step 27:** `waitlist-routes.tsx` and `waitlist-page.tsx`: `GET /waitlist` behind `requireSession`, `GET /waitlist/export.csv` behind `requireSession` with an audit row, `POST /waitlist/cap` behind CSRF and the step-up gate, with an audit row. Copy in `backoffice-copy.ts`, `pt_BR` and `en_US`. — evidence: backoffice-waitlist.test.ts, 376f2888
- [x] **Step 28:** `backoffice-paths.ts` and `backoffice-audit-action.ts`: the new paths and actions; `primary-navigation.tsx` gets one entry. Existing pages stay unchanged. — evidence: 376f2888
- [x] **Step 29:** E2E: owner signs in, opens Waitlist, edits the cap, the next join by a referred friend uses the new cap with no deploy (the cap read is in the same request). — evidence: landing-cap.spec.ts, 0d547f98 (pin)

### G5 (docs, runbooks, shape tests)

- [x] **Step 30:** `docs/runbooks/dns.md`: replace step 5 (redirect the bare domain to docs) with the new owner steps (remove the apex `A` record, the `www` CNAME and the redirect rule before the first production deploy; check `zapbip.com` and `www.zapbip.com` after the deploy). `docs/runbooks/deploy.md`: the new secrets and the D1 backup step. Runbook shape tests stay green. — evidence: 0ef64eef
- [x] **Step 31:** `docs/features/deploy-readiness/spec.md` and `plan.md`: the secrets list gains `TURNSTILE_SECRET_KEY` (a line only, no other change). — evidence: 0ef64eef
- [x] **Step 32:** Indexes: `docs/features/README.md` row (`Approved`, moves below the last shipped row when it ships); `docs/adr/README.md` rows 0039 to 0041 in number order with status and date; `document-indexes.test.ts` green. — evidence: 0ef64eef
- [x] **Step 33:** Shape test: the site directory is not agent-facing and not mounted by the MCP app (extends `backoffice-isolation.test.ts`); the migration seed equals the constant (reads the SQL file). — evidence: backoffice-isolation.test.ts, 0ef64eef

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | Migration `0010` fails on a database that already has `0009` | the integration test prints a SQL error; staging deploy fails at migrate | drop the two tables in a new migration `0011`; never edit `0010` once applied |
| 4 | Two joins for one referrer both credited at cap minus one | the concurrency test counts credited rows above the cap | revert the join to the single-statement form; the test pins it |
| 5 | Hostname check fails with the test keys (the test response hostname is not the site host) | the integration test with the always-pass test key returns `false` | fall back to the action check plus the secret; record the test-key exception in ADR 0039 before merging, never by skipping the hostname check in production |
| 8 | Host dispatch sends `zapbip.com` to MCP | the host-dispatch test and the production smoke show MCP JSON on `/` | revert `host-dispatch.ts`; the custom domain is only attached after the deploy |
| 11 | Production starts without the secret and the site accepts signups | the production smoke join returns a 200 with a fake token | the owner sets the secret; a deploy with the bad config is reverted by `wrangler rollback` |
| 12 | `routes` create the apex record while the old `A` record still exists | the deploy fails with a conflicting record error | owner step 1 is done first; the runbook says so |
| 16 | Horizontal scroll at 375 px | the Playwright width check finds `scrollWidth > clientWidth` | fix the grid; the test is the gate |
| 19 | Demo video over 2 MB or missing from the assets | the file size test; the poster-only fallback shows in the walk | re-record with a lower bitrate; the page still renders |
| 20 | Inline script blocked by the site CSP | the console shows a CSP violation in the walk | move the handler to `site-scripts.ts` under `/site/`; never add `unsafe-inline` |
| 25 | A formula-looking cell in the export | the CSV test with `=HYPERLINK` | revert the quoting helper; the test pins it |
| 27 | A cap POST without a step-up code is accepted | the E2E sends a cap change without TOTP and expects a refusal | remove the route until the gate is wired; the step-up helper is the existing one |
| 30 | A runbook step points the bare domain at docs again | the runbook test and the production smoke | revert the runbook edit; the DNS is the owner's |

**Steps with no backout:** Step 19 (the recorded media is replaced, not undone, if it is wrong; the page keeps the poster fallback meanwhile) and Step 12 once a production deploy has run (rollback is `wrangler rollback`, the DNS records stay removed).

## Z. Prove and ship

- [ ] **Tester briefing:** each developer wrote its part of `tester-briefing.md`; G5 consolidated it.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** a fresh `security-reviewer` sub-agent returned `Security verdict`; the Turnstile, the duplicate response, the cap race and the CSV export are in its lens.
- [ ] **/check-ui:** screenshots at 1280 and 375 px, the reduced-motion walk and the walkthrough video are recorded and uploaded (UI touched).
- [ ] **Owner-only steps:** the five steps in the spec are done by the owner before the production deploy; staging deploy and its smoke run first.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened with the blast radius (sensitive: Turnstile, DNS, D1 migration, secrets).
