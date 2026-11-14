# Features

One folder per feature or fix: `docs/features/<slug>/`. Slugs are kebab-case, without dates.

## Required files

`spec.md`, `plan.md` and `test-plan.md` are required together. Never one without the others. `tester-briefing.md` is written by the developer when the build ends.

## Start a new one

Use the `feature` skill, or copy [`_template/`](_template/) to `docs/features/<slug>/` by hand.

## Rules

- A fix gets the same folder. Its spec may be ten lines; it still exists.
- Folders stay after shipping. They are the history of why the code is the way it is.
- The header of `spec.md` carries the status line: `**Status:** Draft | In review | Approved | Building | Shipped YYYY-MM-DD`. The folder's row below carries the same status, plus the PR link once shipped; `tools/repository-shape/src/feature-status.test.ts` fails when they disagree, when a folder has no row, or when a merged pull request from a branch named after a folder (`<type>/<slug>`, whatever the type) left its spec unshipped ([HARNESS §7 → Status](../../.claude/HARNESS.md#7-ship)).
- Order of approval: spec approved by the owner, then plan, then test plan, then code.
- Process details: [`.claude/HARNESS.md`](../../.claude/HARNESS.md).

## Index

One row per folder, in the order the features ship; a row that turns `Shipped <date>` moves below the last row shipped on or before that date.

| Feature | Delivers | Status |
|---------|----------|--------|
| [`agent-inbox-core`](agent-inbox-core/) | The core, the durable inbox per account, the MCP contract, the 24-hour window, routing and media, with a WhatsApp test double for development | Shipped 2026-11-06 ([PR #2](https://github.com/dhyegocalota/zapbip/pull/2)) |
| [`webhook-wake`](webhook-wake/) | The webhook wake rung: `set_wake`, Grok Bot and claude.ai routine webhooks, a generic signed webhook, coalescing, retries and encrypted targets | Shipped 2026-11-06 ([PR #3](https://github.com/dhyegocalota/zapbip/pull/3)) |
| [`local-connector`](local-connector/) | `npx zapbip connect`: a hibernatable WebSocket per connection and a local Claude Code or Codex session resumed for each owner message | Shipped 2026-11-06 ([PR #4](https://github.com/dhyegocalota/zapbip/pull/4)) |
| [`whatsapp-cloud-channel`](whatsapp-cloud-channel/) | The real Meta WhatsApp Cloud API adapter: signed inbound webhook, session and template sends for every kind, media to R2 and window facts | Shipped 2026-11-06 ([PR #5](https://github.com/dhyegocalota/zapbip/pull/5)) |
| [`accounts-and-keys`](accounts-and-keys/) | Account creation over WhatsApp, the command grammar in pt-BR and en, connection create, list, revoke and rotate, waitlist, abuse controls and account deletion | Shipped 2026-11-07 ([PR #6](https://github.com/dhyegocalota/zapbip/pull/6)) |
| [`hermes-openclaw`](hermes-openclaw/) | Channel plugins for Hermes and OpenClaw that keep the agent listening over the connector socket, with a scheduled fallback | Shipped 2026-11-07 ([PR #7](https://github.com/dhyegocalota/zapbip/pull/7)) |
| [`scheduled-wake`](scheduled-wake/) | Scheduled pollers and the standby: every `check_inbox` recorded, the expected-delay note, one stale notice per episode, a standby copy of the owner message and an indexed unread count | Shipped 2026-11-07 ([PR #8](https://github.com/dhyegocalota/zapbip/pull/8)) |
| [`install-skills`](install-skills/) | The install page per client: one link the AI reads, the rules through MCP, the first-call record, a self-test, one guide per client | Shipped 2026-11-07 ([PR #9](https://github.com/dhyegocalota/zapbip/pull/9)) |
| [`hermes-plugin-flake`](hermes-plugin-flake/) | Heartbeat and backoff tests of the Hermes plugin that hold on a busy machine, and a typecheck that covers the tests | Shipped 2026-11-07 ([PR #10](https://github.com/dhyegocalota/zapbip/pull/10)) |
| [`test-timeouts-under-load`](test-timeouts-under-load/) | Explicit Vitest and Playwright timeouts sized for a loaded machine, and an outbound MCP test that settles its calls before resetting | Shipped 2026-11-07 ([PR #11](https://github.com/dhyegocalota/zapbip/pull/11)) |
| [`logic-bit-facts`](logic-bit-facts/) | The Logic Bit company facts from the official site, shown on the about pages | Shipped 2026-11-07 ([PR #12](https://github.com/dhyegocalota/zapbip/pull/12)) |
| [`deploy-readiness`](deploy-readiness/) | What an owner needs to deploy: the wrangler environments, the bindings, the secrets, the preflight, the runbooks and the smoke test | Shipped 2026-11-07 ([PR #13](https://github.com/dhyegocalota/zapbip/pull/13)) |
| [`verify-secrets-scan-head`](verify-secrets-scan-head/) | The local secrets gate scans the history of `HEAD`, not every branch of the shared repository | Shipped 2026-11-07 ([PR #14](https://github.com/dhyegocalota/zapbip/pull/14)) |
| [`docs-experience`](docs-experience/) | User-first Mintlify docs for any AI user in English and pt-BR, with a from-zero walk test in the docs gate | Shipped 2026-11-07 ([PR #15](https://github.com/dhyegocalota/zapbip/pull/15)) |
| [`hermes-wheel-hosting`](hermes-wheel-hosting/) | The Hermes plugin wheel served from the Worker and installed by a sha256-pinned direct reference, since the owner has no PyPI account | Shipped 2026-11-07 ([PR #16](https://github.com/dhyegocalota/zapbip/pull/16)) |
| [`backoffice`](backoffice/) | The operator backoffice at `backoffice.zapbip.com`: sign-in with a key and TOTP, a WhatsApp numbers registry sealed at rest and one webhook for every number | Shipped 2026-11-08 ([PR #17](https://github.com/dhyegocalota/zapbip/pull/17)) |
| [`backoffice-metrics`](backoffice-metrics/) | The backoffice metrics page: activity counted in each account's Durable Object, flushed hourly to D1, shown read-only with number and period filters and SVG charts | Shipped 2026-11-08 ([PR #19](https://github.com/dhyegocalota/zapbip/pull/19)) |
| [`ui-polish`](ui-polish/) | The "Signal" visual direction for the backoffice and the docs: one brand light, bubble-shaped surfaces, AA in both themes, CSS-only motion | Shipped 2026-11-08 ([PR #20](https://github.com/dhyegocalota/zapbip/pull/20)) |
| [`agent-registry`](agent-registry/) | One folder per supported agent under `libs/agents/supported/`: enums, install sections, docs pages, the matrix, the navigation and the tests are generated from or iterate the registry | Shipped 2026-11-08 ([PR #21](https://github.com/dhyegocalota/zapbip/pull/21)) |
| [`readme-review`](readme-review/) | Every README reviewed against the code after the agent registry lands: concise, correct, purpose only, with the purpose-only rule pinned by a shape test | Shipped 2026-11-08 ([PR #22](https://github.com/dhyegocalota/zapbip/pull/22)) |
| [`lifecycle-ci-install`](lifecycle-ci-install/) | The lifecycle proofs install with a cold metadata cache like a CI runner, so the resolving install no longer needs `--offline` metadata | Shipped 2026-11-08 ([PR #23](https://github.com/dhyegocalota/zapbip/pull/23)) |
| [`channel-test-race`](channel-test-race/) | The connector channel tests wait for the notification and the log line on the child's pipes instead of inferring them from a socket frame | Shipped 2026-11-08 ([PR #27](https://github.com/dhyegocalota/zapbip/pull/27)) |
| [`install-limiter-test-load`](install-limiter-test-load/) | The IS-S1 limiter test starts in a fresh rate-limit window and sends one burst, so a minute boundary inside the loop cannot hide the 429 | Shipped 2026-11-08 ([PR #28](https://github.com/dhyegocalota/zapbip/pull/28)) |
| [`preflight-pre-launch`](preflight-pre-launch/) | The Worker deploy preflight stops refusing an unset official number and an unpublished npm package (a warning instead), so everything else can deploy before launch | Shipped 2026-11-08 ([PR #24](https://github.com/dhyegocalota/zapbip/pull/24)) |
| [`install-route-readiness`](install-route-readiness/) | The deploy preflight sees the install route that the app mounts with `app.all`, proven against the real `createApp` | Shipped 2026-11-08 ([PR #25](https://github.com/dhyegocalota/zapbip/pull/25)) |
| [`start-link`](start-link/) | A stable start link on the Worker that sends a new owner to an active registry number, and the removal of the fixed official number from the docs and the preflight | Shipped 2026-11-08 ([PR #26](https://github.com/dhyegocalota/zapbip/pull/26)) |
| [`meta-onboarding`](meta-onboarding/) | One fixed Meta app with its secret as a Worker secret, and numbers connected through Meta Embedded Signup in the backoffice instead of a typed form | Shipped 2026-11-11 ([PR #30](https://github.com/dhyegocalota/zapbip/pull/30)) |
| [`backoffice-switchers`](backoffice-switchers/) | Language and theme switchers with icons in the backoffice header, cookie-backed and server-rendered, with no script and the CSP unchanged | Shipped 2026-11-11 ([PR #29](https://github.com/dhyegocalota/zapbip/pull/29)) |
| [`backoffice-password-sign-in`](backoffice-password-sign-in/) | The backoffice signs in with an email and a password, then a TOTP code on a second page held by a single-use server-side state; the key goes away and enrollment asks for the password in the owner terminal | Shipped 2026-11-12 ([PR #31](https://github.com/dhyegocalota/zapbip/pull/31)) |
| [`waitlist-landing`](waitlist-landing/) | The public sales page on `zapbip.com` with a Turnstile-guarded waitlist, a referral link capped at 5 per person with the cap editable in the backoffice, a demo video, a Waitlist page with CSV export, and `www` redirected to the apex | Shipped 2026-11-12 ([PR #32](https://github.com/dhyegocalota/zapbip/pull/32)) |
| [`landing-motion-free-tier`](landing-motion-free-tier/) | The landing page tells the differentiators with scroll animations, offers a per-agent "Get started free" and a free-tier pricing section | Shipped 2026-11-12 ([PR #33](https://github.com/dhyegocalota/zapbip/pull/33)) |
| [`landing-quick-start`](landing-quick-start/) | The works-with tiles become one "start in 30 seconds" block: official logos and a copy-paste snippet per agent, taken from the agent registry | Shipped 2026-11-12 ([PR #34](https://github.com/dhyegocalota/zapbip/pull/34)) |
| [`landing-round-seven`](landing-round-seven/) | The landing page gets language URLs and a flag select, USD and BRL pricing with a free trial of 5 messages, calm one-time reveals, no own-number wording and a redirect from http to https | Shipped 2026-11-13 ([PR #35](https://github.com/dhyegocalota/zapbip/pull/35)) |
| [`client-app`](client-app/) | A minimal customer web app on `app.zapbip.com`: sign in with a one-time link sent by the `login` command, then list, connect and revoke agents | Shipped 2026-11-13 ([PR #36](https://github.com/dhyegocalota/zapbip/pull/36)) |
| [`legal-pages`](legal-pages/) | Terms of use and a privacy policy under Brazilian law (LGPD), in English and Portuguese, linked from the site footer, the waitlist note and the docs | Shipped 2026-11-13 ([PR #37](https://github.com/dhyegocalota/zapbip/pull/37)) |
| [`site-polish`](site-polish/) | The language menu moves to the footer, the call to action becomes Request access, the quick start shows an example link, referral sharing closes until launch, pt-BR copy is rewritten, the footer gets columns and a huge wordmark | Shipped 2026-11-13 ([PR #40](https://github.com/dhyegocalota/zapbip/pull/40)) |
| [`oss-polish`](oss-polish/) | Open-source polish: PR media moves out of Releases to a private media repository, a release runbook and changelogs for the published packages, and a README, code owners and dependency updates modeled on successful monorepos | Shipped 2026-11-13 ([PR #41](https://github.com/dhyegocalota/zapbip/pull/41)) |
| [`access-release`](access-release/) | Access opens in batches from the backoffice: release waitlisted WhatsApp accounts, invite email entries with single-use codes, and metrics on usage and the waitlist | Shipped 2026-11-13 ([PR #46](https://github.com/dhyegocalota/zapbip/pull/46)) |
| [`web-shell`](web-shell/) | One shared header and footer for the site, the app and the backoffice: the flag language menu and the theme switch in the footer, languages as data, and a hero sign-in page for the app | Shipped 2026-11-13 ([PR #48](https://github.com/dhyegocalota/zapbip/pull/48)) |
| [`agentic-site`](agentic-site/) | The site becomes agent-ready: Markdown twins and llms files, WebMCP tools, discovery documents, and a captcha-free JSON path to request access under weighted limits | Shipped 2026-11-13 ([PR #49](https://github.com/dhyegocalota/zapbip/pull/49)) |
| [`agentic-backoffice`](agentic-backoffice/) | An operator's agent runs the backoffice through MCP: operator keys minted on an Agent keys page, and a `/mcp` endpoint on the backoffice host with six tools that reuse the Access and Metrics use cases | Building |
