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
| [`preflight-pre-launch`](preflight-pre-launch/) | The Worker deploy preflight stops refusing an unset official number and an unpublished npm package (a warning instead), so everything else can deploy before launch | Shipped 2026-11-08 ([PR #24](https://github.com/dhyegocalota/zapbip/pull/24)) |
