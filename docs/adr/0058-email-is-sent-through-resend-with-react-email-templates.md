# 0058. Email is sent through Resend with React Email templates

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's request of 2026-11-14 ("a daily digest of subscribers, and a welcome email to every subscriber, with React Email and Resend"); [ADR 0040](0040-the-waitlist-and-the-referral-cap-live-in-d1-and-the-cap-is-a-settings-row.md), which keeps the waitlist in D1

## Context

The waitlist collects an email address, a language and a source, and until now nothing was ever sent to it: a person who joined heard nothing until an invitation, and the owner read the list only in the backoffice. The owner wants two emails: a welcome to every subscriber in their language right after the join, and a daily summary of the list sent to the support address, which forwards to him. The Worker runs on workerd with `nodejs_compat`, has no outbound email of its own, and every surface speaks nine languages, one of them right to left.

## Decision

1. **One port, three deliveries.** `EmailSender` (`apps/api/src/emails/email-sender.ts`) sends one message (from, to, reply-to, subject, HTML, plain text, an idempotency key) and answers `Sent`, `Failed` or `Disabled`; it never throws. `createEmailSender` picks the delivery from a record keyed by `EmailDelivery`: `Resend` when the Worker secret `RESEND_API_KEY` is set, `Fake` in development without the key, and `Disabled` everywhere else. The disabled sender writes one `email.disabled` log line per message it skips and sends nothing; the deploy only warns while the secret is unset, so production deploys before the owner sets it.
2. **Resend over plain `fetch`.** The adapter POSTs to `https://api.resend.com/emails` with `Authorization: Bearer`, a JSON body and an `Idempotency-Key` per message (`welcome-<digest of the address>`, `subscriber-digest-<day>`), under a timeout. No SDK: the REST call is four fields, and a Node SDK brings code the Worker does not need.
3. **React Email templates, rendered at build time.** Templates are function components in `apps/api/scripts/emails/` built with `@react-email/components` and rendered by `@react-email/render`. `pnpm emails:generate` renders the welcome for every `OwnerLocale` and the digest's shell and one row into `apps/api/src/emails/generated/email-templates.ts`, HTML and plain text with `{{slot}}`s (the address, the referral link, the counts, the digest rows); `pnpm emails:check` and `generated-emails.test.ts` fail when that module is stale. At send time the Worker only fills slots, escaping every value it writes into HTML with `escapeHtml`, and imports no React package (`runtime-email-imports.test.ts`): the Worker runs on the free plan's 10 ms CPU, cron included, and pays every byte at cold start. The package's JSX belongs to Hono (`jsxImportSource: hono/jsx`) and a per-file pragma is a comment, so the templates call React's `createElement` instead of JSX. The layout carries the site's identity: brand green `#128C7E`, the PNG app icon the site serves, the system font stack, a white card that stays light in dark clients, `dir` and `lang` from the locale profile and Latin digits.
4. **The welcome is sent once, in the background.** After `joinWaitlist` answers Joined or AlreadyJoined, the site form and the agent request-access route hand the welcome to `waitUntil`, so the answer never waits for Resend. A conditional `UPDATE ... SET welcome_sent_at` claims the row first; a failure clears the claim and stamps `welcome_failed_at`, so a later join may try again, and a disabled delivery only clears the claim. Migration `0016` adds both columns.
5. **The digest is a scheduled job.** `subscriber_digest` runs on the existing `*/30` cron at 11:00 UTC (08:00 in Brazil) and sends the support address the last 24 hours: new subscribers with locale, source, referrer and time, the total, totals by locale, welcomes sent and failed, and the top referrers, in Portuguese. It is sent on a day with no new subscriber too.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Cloudflare Email Routing `send_email` binding | No new provider | Sends only to verified destination addresses | A welcome goes to any subscriber |
| Amazon SES or Postmark over `fetch` | Mature, cheap | A second console, signing (SES) or no React tooling | The owner chose Resend |
| The Resend Node SDK | Typed client | Node-only dependencies in a Worker for one POST | `fetch` covers the call |
| Hono JSX templates without React Email | No new dependency, same JSX as the site | Every email-client workaround written by hand | The owner chose React Email |
| JSX with a `@jsxImportSource react` pragma per template | Reads as JSX | A comment in every file, against the code conventions | `createElement` keeps the rule |
| The `react-email` 6 package | Maintained home of the components | Ships its preview CLI, esbuild and socket.io as runtime dependencies | `@react-email/components` holds only the components |
| Render React Email in the Worker at send time | No generator, no generated file | +1.2 MB at every cold start and a render inside the 10 ms CPU budget | Build time keeps the Worker within the free plan |
| Send the welcome inline before answering | Simpler | A slow or failing Resend slows or fails the join | `waitUntil` keeps the join fast |

## Consequences

- Resend becomes a processor of subscriber addresses; the privacy policy names it and the welcome among the purposes of the waitlist.
- React, React DOM and React Email are devDependencies; the Worker carries only the generated strings (the dry run of 2026-11-14: 4054.72 KiB, 787.31 KiB gzip, against 3910.83 KiB, 772.84 KiB gzip for main). A copy or layout change needs `pnpm emails:generate` in the same commit.
- `@react-email/components` 1.0.12 is marked deprecated on npm in favour of the `react-email` package; it is pinned and works, and moving to its successor is a dependency change, not a template rewrite.
- A subscriber who joined while delivery was disabled never gets a welcome unless they join again.
- Logs carry the email kind and the HTTP status only, never an address or a subject.

## Evidence

`apps/api/test/unit/resend-email-sender.test.ts`, `apps/api/test/unit/email-delivery.test.ts`, `apps/api/test/unit/email-templates.test.ts`, `apps/api/test/unit/generated-emails.test.ts`, `apps/api/test/unit/welcome-email-substitution.test.ts`, `apps/api/test/unit/runtime-email-imports.test.ts`, `apps/api/test/unit/subscriber-digest.test.ts`, `apps/api/test/integration/welcome-email.test.ts` and the dry-run bundle of 2026-11-14.

## Revisit when

Resend changes its emails endpoint, the bundle approaches the Worker size limit, or the welcome needs retries beyond a repeated join.
