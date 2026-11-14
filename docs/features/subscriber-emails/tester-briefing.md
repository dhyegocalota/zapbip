# Tester briefing: Subscriber emails

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/src/emails/email-sender.ts`: the `EmailSender` port, `EmailKind`, `EmailSendOutcome` (`Sent | Failed | Disabled`) and `EmailDelivery`.
- `apps/api/src/emails/email-delivery.ts`: `createEmailSender` dispatches from a record keyed by `EmailDelivery`: Resend with `RESEND_API_KEY` (trimmed), the fake in development without it, the disabled sender elsewhere, which logs `email.disabled` with the kind per skipped message.
- `apps/api/src/adapters/email/resend-email-sender.ts`: POST to `https://api.resend.com/emails` with `Authorization: Bearer`, `Content-Type: application/json`, `Idempotency-Key` and a 10-second timeout; a non-2xx or a thrown fetch logs `email.send_failed` with the kind and status only.
- `apps/api/src/adapters/fake/fake-email-sender.ts`: keeps the messages it was given.
- `apps/api/src/emails/email-layout.ts`, `email-style.ts`, `render-email.ts`: the React Email layout (brand green, `apple-touch-icon.png`, system font stacks by direction, `lang` and `dir` from `LOCALE_PROFILES`, light colour scheme) rendered to HTML and plain text. Templates call `createElement` because the package's JSX is Hono's.
- `apps/api/src/emails/welcome-email.ts` and `welcome-email-copy*.ts`: the welcome in nine languages; idempotency key `welcome-<sha256 of the address>`.
- `apps/api/src/site/welcome-delivery.ts`: `scheduleWelcomeEmail` renders, claims `welcome_sent_at` with a conditional update, sends, then keeps the claim (Sent), clears it and stamps `welcome_failed_at` (Failed or a throwing sender) or clears it (Disabled), all inside `waitUntil`. Called from `join-route.ts` and `request-access-route.ts`; `joinWaitlist` now returns the normalized `email`.
- `apps/api/migrations/0016_welcome_emails.sql`: two nullable integer columns on `landing_waitlist`.
- `apps/api/src/operations/subscriber-digest*.ts`, `apps/api/src/emails/subscriber-digest-email*.ts`: the `subscriber_digest` job at 11:00 UTC, one D1 batch of selects, Portuguese copy, subject `zapbip · N novos inscritos (dd/mm)` (singular for one), key `subscriber-digest-<UTC day>`; Failed fails the tick, Disabled passes it.
- `apps/api/src/site/site-app.ts`, `site-env.ts`, `apps/api/src/backoffice/host-dispatch.ts`: `createSiteApp` takes `emailSenderOf`; production passes `createEmailSender` with the global `fetch`.
- `apps/api/src/operations/deploy-preflight.ts`, `worker-secret.ts`: `RESEND_API_KEY` is a warned secret; the deploy warns, never refuses.
- `apps/api/src/site/legal-copy*.ts`, `site-copy*.ts`: the privacy policy names the welcome, access news and Resend (purpose, providers, transfer) in nine languages; the waitlist note no longer says "only to invite you".
- `apps/api/tsconfig.e2e.json`, `tsconfig.test.json`, `package.json`: React's types declare empty DOM interfaces, so the Playwright specs moved to their own tsconfig with the DOM library and `typecheck` runs it; `totp.ts` and `base32.ts` annotate their byte arrays as `Uint8Array<ArrayBuffer>`.
- `apps/api/src/site/site-links.ts`: `startLinkOf`, now shared by the welcome and `setup-markdown.ts`.
- Docs: ADR 0058, `docs/runbooks/email.md`, `deploy.md` (secret row, migration `0016`), `.dev.vars.example`, `.claude/rules/site.md`, `apps/api/README.md`.

## How to run

```bash
pnpm --filter @zapbip/api typecheck
cd apps/api
pnpm exec vitest run --config vitest.unit.config.mts test/unit/resend-email-sender.test.ts test/unit/email-delivery.test.ts test/unit/welcome-email-copy.test.ts test/unit/email-templates.test.ts test/unit/subscriber-digest.test.ts test/unit/scheduled.test.ts test/unit/deploy-preflight.test.ts test/unit/legal-copy.test.ts
pnpm exec vitest run --config vitest.integration.config.mts test/integration/welcome-email.test.ts test/integration/subscriber-digest.test.ts test/integration/site-join.test.ts test/integration/site-request-access.test.ts
pnpm --filter @zapbip/api exec wrangler deploy --dry-run --outdir /tmp/zapbip-dry
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `test/unit/resend-email-sender.test.ts` (9) | `createResendEmailSender is not implemented` (`2e69ccb2`) | the adapter posts the request (`2ad31669`) |
| `test/unit/email-delivery.test.ts` (10) | `emailDeliveryOf is not implemented`, `createEmailSender is not implemented`, `createFakeEmailSender is not implemented` | the delivery record and the fake (`2ad31669`) |
| `test/unit/welcome-email-copy.test.ts`, `test/unit/email-templates.test.ts` (52) | `renderWelcomeEmailCopy is not implemented`, `welcomeMessageOf is not implemented` (`f0e75fb6`) | the copy and the template (`1d4dde41`) |
| `test/unit/deploy-preflight.test.ts` › warns when RESEND_API_KEY is not set | `expected [] to deeply equal [ { …(2) } ]` (`611ba05c`) | the warning table (`720adc24`) |
| `test/integration/welcome-email.test.ts` (9 of 10) | `expected [] to deeply equal [ [ 'welcome', …(2) ] ]`, `expected null to deeply equal Any<Number>`, `Matcher did not succeed in time` (`ad12afe5`) | the routes schedule the welcome (`84856d94`) |
| `test/integration/welcome-email.test.ts` › sends nothing when the captcha refuses the join | pin: green when it landed | — |
| `test/unit/subscriber-digest.test.ts`, `test/unit/scheduled.test.ts` (13) | `subscriberDigestMessageOf is not implemented`, `expected false to be true` (`4aff65bf`) | the template and `isDue` (`ac043e46`) |
| `test/integration/subscriber-digest.test.ts` (10) | `readSubscriberDigestFacts is not implemented`, `runSubscriberDigest is not implemented` (`4aff65bf`) | the queries and the job (`ac043e46`) |
| `test/unit/legal-copy.test.ts` (9) | `expected 'Privacy policy …' to contain 'Resend'` in each language (`9c39cecd`) | the policy copy (`599a2f89`) |

Last green runs: typecheck exit 0; 18 unit files, 459 tests; integration `welcome-email` 10, `subscriber-digest` + `scheduled` + `scheduled-budget-retention` 23, `site-join` + `site-request-access` + `join-waitlist` + `site-host` 119, `site-legal` + `site-weight` + `site-page` + `site-agentic-twins` 310.

## Hypotheses to attack

1. Hypothesis: a repeated join never sends a second welcome. Break it by: two concurrent `POST /join` for one address, and an agent request followed by a form join for the same address (the upsert turns the row into a form row and reports Joined).
2. Hypothesis: a slow or failing Resend never slows or fails the join. Break it by: a fetch that hangs past the 10-second timeout under `wrangler dev` with a dummy key; the page must answer at once.
3. Hypothesis: no address, subject or key reaches a log line. Break it by: grep the tail of a staging join and a digest tick for `@`.
4. Hypothesis: the welcome reads right to left in Arabic and stays light in dark clients. Break it by: the staging walk of `test-plan.md` in Gmail and Apple Mail dark mode.
5. Hypothesis: the digest counts are right across the day boundary. Break it by: a subscriber exactly 24 hours before the tick (excluded) and one exactly at the tick (included).
6. Hypothesis: the welcome stays under the Worker CPU limit. Break it by: watching `wrangler tail` for `exceededCpu` on the first join after a deploy; in Node the first render took 27 ms and later ones 1.9 ms.

## Known gaps

- The Hindi locale merged to `origin/main` after this branch was cut; merging it will need `welcome-email-copy-hindi.ts` and a Hindi entry in `WELCOME_EMAIL_COPY`, and the Hindi privacy policy will need the same three changes as the other languages.
- `@react-email/components` 1.0.12 and its parts are marked deprecated on npm in favour of `react-email` 6, which ships its preview CLI as runtime dependencies (ADR 0058).
- The bundle grows by 1234 KiB raw and 270 KiB gzip (3688.74 to 4922.70 KiB, 738.41 to 1008.88 KiB gzip); it includes prettier, which `@react-email/render` imports statically even when `pretty` is off.
- A subscriber who joined while delivery was disabled gets no welcome until they join again; the digest does not count them as failed.
- A render error is logged but not stamped, so the digest does not count it as a failed welcome.
- `tools/repository-shape/src/docs-visual.test.ts` › "the favicon and the navigation are unchanged from the baseline" fails on this branch; nothing under `apps/docs` or `tools` differs from the base commit `55dc9812`.
- Real delivery through Resend and rendering in real mail clients are not proven here; only the staging walk in `test-plan.md` covers them.
