# Tester briefing: Subscriber emails

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/src/emails/email-sender.ts`: the `EmailSender` port, `EmailKind`, `EmailSendOutcome` (`Sent | Failed | Disabled`) and `EmailDelivery`.
- `apps/api/src/emails/email-delivery.ts`: `createEmailSender` dispatches from a record keyed by `EmailDelivery`: Resend with `RESEND_API_KEY` (trimmed), the fake in development without it, the disabled sender elsewhere, which logs `email.disabled` with the kind per skipped message.
- `apps/api/src/adapters/email/resend-email-sender.ts`: POST to `https://api.resend.com/emails` with `Authorization: Bearer`, `Content-Type: application/json`, `Idempotency-Key` and a 10-second timeout; a non-2xx or a thrown fetch logs `email.send_failed` with the kind and status only.
- `apps/api/src/adapters/fake/fake-email-sender.ts`: keeps the messages it was given.
- `apps/api/scripts/emails/`: the React Email layout, style, renderer, the welcome template and the digest shell and row, and `cli.ts` (`pnpm emails:generate`, `pnpm emails:check`). Build time only; templates call `createElement` because the package's JSX is Hono's.
- `apps/api/src/emails/generated/email-templates.ts`: the generated welcome for each of the ten locales and the digest shell and row, HTML and plain text with `{{slot}}`s. Never edited by hand.
- `apps/api/src/emails/email-slot.ts`, `escape-html.ts`: `slotOf`, `filledTextOf`, `filledHtmlOf` (escapes every value) and `escapeHtml`, the first HTML escape helper of the repository (named in `AGENTS.md`).
- `apps/api/src/emails/welcome-email.ts`, `subscriber-digest-email.ts`: the runtime messages; they only fill the generated strings. The digest builds its lines from `subscriber-digest-email-copy.ts` and fills them into the row template.
- `apps/api/src/emails/welcome-email-copy*.ts`: the welcome copy in ten languages, Hindi included.
- `apps/api/src/site/welcome-delivery.ts`: `scheduleWelcomeEmail` builds the message, claims `welcome_sent_at` with a conditional update, sends, then keeps the claim (Sent), clears it and stamps `welcome_failed_at` (Failed or a throwing sender) or clears it (Disabled), all inside `waitUntil`. Called from `join-route.ts` and `request-access-route.ts`; `joinWaitlist` returns the normalized `email`.
- `apps/api/migrations/0016_welcome_emails.sql`: two nullable integer columns on `landing_waitlist`.
- `apps/api/src/operations/subscriber-digest*.ts`: the `subscriber_digest` job at 11:00 UTC, one D1 batch of selects; subject `zapbip · N novos inscritos (dd/mm)` (singular for one), key `subscriber-digest-<UTC day>`; Failed fails the tick, Disabled passes it.
- `apps/api/src/site/site-app.ts`, `site-env.ts`, `apps/api/src/backoffice/host-dispatch.ts`: `createSiteApp` takes `emailSenderOf`.
- `apps/api/src/operations/deploy-preflight.ts`, `worker-secret.ts`: `RESEND_API_KEY` is a warned secret.
- `apps/api/src/site/legal-copy*.ts`, `site-copy*.ts`: the privacy policy names the welcome, access news and Resend in ten languages; the waitlist note no longer says "only to invite you".
- `apps/api/package.json`: `react`, `react-dom`, `@react-email/components`, `@react-email/render` and their types are devDependencies. `apps/api/tsconfig.e2e.json` stays: the test project loads React through the generator and its staleness test, and React's types declare empty DOM interfaces that break the Playwright specs (9 errors when they share the test project).
- Docs: ADR 0058, `docs/runbooks/email.md`, `deploy.md`, `.dev.vars.example`, `.claude/rules/site.md`, `apps/api/README.md`, `AGENTS.md`.

## How to run

```bash
pnpm emails:check
pnpm --filter @zapbip/api typecheck
cd apps/api
pnpm exec vitest run --config vitest.unit.config.mts test/unit/resend-email-sender.test.ts test/unit/email-delivery.test.ts test/unit/welcome-email-copy.test.ts test/unit/email-templates.test.ts test/unit/welcome-email-substitution.test.ts test/unit/generated-emails.test.ts test/unit/runtime-email-imports.test.ts test/unit/welcome-email-template.test.ts test/unit/escape-html.test.ts test/unit/email-slot.test.ts test/unit/subscriber-digest.test.ts test/unit/scheduled.test.ts test/unit/deploy-preflight.test.ts test/unit/legal-copy.test.ts
pnpm exec vitest run --config vitest.integration.config.mts test/integration/welcome-email.test.ts test/integration/subscriber-digest.test.ts test/integration/site-join.test.ts test/integration/site-request-access.test.ts
pnpm --filter @zapbip/api exec wrangler deploy --dry-run --outdir /tmp/zapbip-dry
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `test/unit/resend-email-sender.test.ts` (9) | `createResendEmailSender is not implemented` (`2e69ccb2`) | the adapter posts the request (`2ad31669`) |
| `test/unit/email-delivery.test.ts` (10) | `emailDeliveryOf is not implemented`, `createEmailSender is not implemented`, `createFakeEmailSender is not implemented` | the delivery record and the fake (`2ad31669`) |
| `test/unit/welcome-email-copy.test.ts`, `test/unit/email-templates.test.ts` | `renderWelcomeEmailCopy is not implemented`, `welcomeMessageOf is not implemented` (`f0e75fb6`) | the copy and the template (`1d4dde41`), then the generated module (`b9040ccc`) |
| `test/unit/deploy-preflight.test.ts` › warns when RESEND_API_KEY is not set | `expected [] to deeply equal [ { …(2) } ]` (`611ba05c`) | the warning table (`720adc24`) |
| `test/integration/welcome-email.test.ts` (9 of 10) | `expected [] to deeply equal [ [ 'welcome', …(2) ] ]`, `Matcher did not succeed in time` (`ad12afe5`) | the routes schedule the welcome (`84856d94`) |
| `test/integration/welcome-email.test.ts` › sends nothing when the captcha refuses the join | pin | — |
| `test/unit/subscriber-digest.test.ts`, `test/unit/scheduled.test.ts` (13) | `subscriberDigestMessageOf is not implemented`, `expected false to be true` (`4aff65bf`) | the template and `isDue` (`ac043e46`) |
| `test/integration/subscriber-digest.test.ts` (10) | `readSubscriberDigestFacts is not implemented` (`4aff65bf`) | the queries and the job (`ac043e46`) |
| `test/unit/legal-copy.test.ts` | `expected 'Privacy policy …' to contain 'Resend'` in each language (`9c39cecd`; again for hi after the merge `718c1cb0`) | `599a2f89`, `51f64e3b` |
| `test/unit/runtime-email-imports.test.ts` | `expected [ …(5) ] to deeply equal []` (`8e01e8bf`) | the templates moved to `scripts/emails` (`b9040ccc`) |
| `test/unit/escape-html.test.ts`, `test/unit/email-slot.test.ts` (11) | `escapeHtml is not implemented`, `slotOf is not implemented`, `filledTextOf is not implemented`, `filledHtmlOf is not implemented` (`b27469c6`) | `b9040ccc` |
| `test/unit/welcome-email-substitution.test.ts`, `generated-emails.test.ts`, `welcome-email-template.test.ts` | landed with `b9040ccc`; they need the generated module to exist, so no honest red run | — |

Last green runs: `pnpm emails:check` exit 0; typecheck exit 0; 23 unit files, 471 tests; integration `welcome-email`, `subscriber-digest`, `scheduled`, `site-join`, `site-request-access`, `join-waitlist`, `site-legal`: 301 tests; `pnpm --filter @zapbip/repository-shape exec vitest run`: see the final report.

Bundle (`wrangler deploy --dry-run`): 4054.72 KiB, 787.31 KiB gzip on this branch; 3910.83 KiB, 772.84 KiB gzip on `origin/main` `747214ca`; 4922.70 KiB, 1008.88 KiB gzip with runtime React before `b9040ccc` (on the older base of 3688.74 KiB, 738.41 KiB gzip). The generated module is 88 KB of source.

## Hypotheses to attack

1. Hypothesis: a repeated join never sends a second welcome. Break it by: two concurrent `POST /join` for one address, and an agent request followed by a form join for the same address.
2. Hypothesis: a slow or failing Resend never slows or fails the join. Break it by: a fetch that hangs past the 10-second timeout under `wrangler dev` with a dummy key.
3. Hypothesis: no address, subject or key reaches a log line. Break it by: grep the tail of a staging join and a digest tick for `@`.
4. Hypothesis: every value written into the HTML is escaped. Break it by: a digest whose locale name or referrer email holds `<`, `&` or a quote (the email pattern refuses most; try the copy and the counts).
5. Hypothesis: the generated module is never stale on `main`. Break it by: change one word in `welcome-email-copy-hindi.ts` without `pnpm emails:generate` and run `generated-emails.test.ts`.
6. Hypothesis: the welcome reads right to left in Arabic, in Devanagari in Hindi, and stays light in dark clients. Break it by: the staging walk of `test-plan.md`.
7. Hypothesis: the digest counts are right across the day boundary. Break it by: a subscriber exactly 24 hours before the tick (excluded) and one exactly at the tick (included).

## Known gaps

- `b27469c6` (the red commit for the slots) also carries the first copies of the three moved files under `apps/api/scripts/emails/`, staged earlier by `git mv`; `b9040ccc` deletes the originals. History is not rewritten.
- `@react-email/components` 1.0.12 and its parts are marked deprecated on npm in favour of `react-email` 6, which ships its preview CLI as runtime dependencies (ADR 0058). Both are now devDependencies only.
- A subscriber who joined while delivery was disabled gets no welcome until they join again; the digest does not count them as failed.
- A thrown error while building the message is logged but not stamped, so the digest does not count it as a failed welcome.
- The welcome's referral block is left out at build time while `REFERRAL_SHARING_OPEN` is `false`; flipping it needs `pnpm emails:generate`.
- Real delivery through Resend and rendering in real mail clients are not proven here; only the staging walk in `test-plan.md` covers them.
