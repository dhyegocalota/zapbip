# Architecture Decision Records

An ADR records one architecturally significant decision: the context that forced it, the option chosen, the options rejected and why, and the conditions under which it should be reopened. ADRs are short, immutable once accepted, and written from [`_template.md`](_template.md).

## Numbering

- File name: `NNNN-kebab-slug.md`, four digits, assigned in order of creation.
- Numbers are never reused and never renumbered.
- The index lists every record in number order, with the title, status and date the record states; `tools/repository-shape/src/document-indexes.test.ts` checks it.
- A decision is changed by writing a new ADR and marking the old one `Superseded by [NNNN](NNNN-slug.md)`. The old file stays in place.

## Status lifecycle

- `Proposed`: written, not yet confirmed by the owner or pending a spike.
- `Accepted`: confirmed; the code follows it.
- `Superseded by [NNNN](NNNN-slug.md)`: replaced; kept for history.

A `Proposed` ADR moves to `Accepted` by editing its status line and date. Any other change of substance requires a new ADR.

## Index

| Number | Title | Status | Date |
|--------|-------|--------|------|
| [0001](0001-one-source-per-agent-surface.md) | One source per agent surface, a thin adapter per tool | Accepted | 2026-11-04 |
| [0002](0002-mechanical-security-gates-and-a-security-reviewer.md) | Mechanical security gates and a dedicated security reviewer before every PR | Accepted | 2026-11-04 |
| [0003](0003-agentic-scenario-runs-with-one-browser-per-user.md) | Agentic scenario runs with one Playwright MCP server per user | Accepted | 2026-11-04 |
| [0004](0004-the-agent-repairs-its-own-machine-doctor-reports-never-installs.md) | The agent repairs its own machine: a doctor reports at session start and never installs | Accepted | 2026-11-04 |
| [0005](0005-the-local-gate-runs-what-the-diff-can-break.md) | The local gate runs what the diff can break | Accepted | 2026-11-04 |
| [0006](0006-one-secret-per-connection-in-the-mcp-url.md) | One secret per connection in the MCP URL | Accepted | 2026-11-06 |
| [0007](0007-a-durable-inbox-and-a-wake-ladder.md) | A durable inbox and a wake ladder | Accepted | 2026-11-06 |
| [0008](0008-a-pure-core-behind-ports.md) | A pure core behind ports | Accepted | 2026-11-06 |
| [0009](0009-cloudflare-workers-with-one-durable-object-per-account.md) | Cloudflare Workers with one Durable Object per account | Accepted | 2026-11-06 |
| [0010](0010-public-docs-on-mintlify.md) | Public docs on Mintlify | Accepted | 2026-11-06 |
| [0011](0011-the-24-hour-window-queues-and-sends-one-notice.md) | The 24-hour window queues messages and sends one notice | Accepted | 2026-11-06 |
| [0012](0012-owner-identity-by-wa-id-on-the-shared-number.md) | The owner is identified by WhatsApp ID on the shared number | Accepted | 2026-11-06 |
| [0013](0013-webhook-acknowledged-after-a-durable-commit-and-deduplicated-by-message-id.md) | Webhooks are acknowledged after a durable commit and deduplicated by message id | Accepted | 2026-11-06 |
| [0014](0014-inbound-media-stored-in-r2-at-webhook-time.md) | Inbound media is stored in R2 when the webhook arrives | Accepted | 2026-11-06 |
| [0015](0015-commands-are-bare-words-routed-before-agents.md) | Commands are bare words, routed before agents | Accepted | 2026-11-06 |
| [0016](0016-accounts-start-on-the-first-message-and-wait-on-a-list.md) | Accounts start on the first message and wait on a list | Accepted | 2026-11-06 |
| [0017](0017-connection-secrets-are-shown-once-and-stored-as-digests.md) | Connection secrets are shown once and stored as digests | Accepted | 2026-11-06 |
| [0018](0018-webhook-wake-carries-no-message-content.md) | A webhook wake carries no message content | Accepted | 2026-11-06 |
| [0019](0019-outbound-wake-targets-pinned-providers-and-guarded-generic-hosts.md) | Outbound wake targets: pinned provider hosts and guarded generic hosts | Accepted | 2026-11-06 |
| [0020](0020-one-install-link-per-connection-the-ai-reads-the-instructions.md) | One install link per connection, the AI reads the instructions | Accepted | 2026-11-06 |
| [0021](0021-the-agent-rules-come-from-the-mcp-server.md) | The agent rules come from the MCP server | Accepted | 2026-11-06 |
| [0022](0022-a-hibernatable-websocket-for-the-local-connector.md) | A hibernatable WebSocket for the local connector | Accepted | 2026-11-06 |
| [0023](0023-the-local-session-is-the-newest-one-in-the-working-directory.md) | The local session is the newest one in the working directory | Accepted | 2026-11-06 |
| [0024](0024-a-standby-gets-a-copy-of-the-owner-message.md) | A standby gets a copy of the owner's message, never its primary's inbox | Accepted | 2026-11-06 |
| [0025](0025-a-stale-poller-degrades-the-effective-rung.md) | Pollers are recorded per connection, and a stale poller degrades the effective rung | Accepted | 2026-11-06 |
| [0026](0026-runbooks-live-in-the-repository-not-on-mintlify.md) | Runbooks live in the repository, not on Mintlify | Accepted | 2026-11-06 |
| [0027](0027-deploys-run-from-the-owners-machine-not-from-ci.md) | Deploys run from the owner's machine, and CI does not deploy | Accepted | 2026-11-06 |
| [0028](0028-the-native-channel-plugin-is-the-first-rung-for-openclaw-and-hermes.md) | The native channel plugin is the first rung for OpenClaw and Hermes | Accepted | 2026-11-06 |
| [0029](0029-a-plugin-acknowledges-a-handoff-and-a-listener-does-not.md) | A plugin acknowledges after the handoff; a listener acknowledges after it prints | Accepted | 2026-11-06 |
| [0030](0030-the-docs-speak-to-any-ai-user-in-two-languages-and-the-switcher-picks-the-language.md) | The docs speak to any AI user in two languages, and the switcher picks the language | Accepted | 2026-11-06 |
| [0031](0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md) | The backoffice is a separate host on the same Worker, signed in with a key and TOTP enrolled from the owner's terminal | Accepted | 2026-11-07 |
| [0032](0032-whatsapp-numbers-are-rows-in-a-sealed-registry-not-worker-secrets.md) | WhatsApp numbers are rows in a sealed registry, not Worker secrets | Accepted | 2026-11-07 |
| [0033](0033-one-folder-per-supported-agent.md) | One folder per supported agent; everything else is generated from it | Accepted | 2026-11-07 |
| [0034](0034-the-hermes-wheel-is-self-hosted-and-installed-by-a-pinned-hash.md) | The Hermes wheel is self-hosted and installed by a pinned hash | Accepted | 2026-11-07 |
| [0035](0035-a-start-link-on-the-worker-picks-the-number-new-owners-write-to.md) | A start link on the Worker picks the number new owners write to | Accepted | 2026-11-08 |
| [0036](0036-one-fixed-meta-app-and-numbers-join-through-embedded-signup.md) | One fixed Meta app, and numbers join through Embedded Signup | Accepted | 2026-11-11 |
| [0037](0037-only-the-onboarding-page-loads-the-facebook-sdk-under-its-own-policy.md) | Only the onboarding page loads the Facebook SDK, under its own policy | Accepted | 2026-11-11 |
| [0038](0038-the-backoffice-signs-in-with-a-password-and-then-a-code-held-in-a-server-side-second-step.md) | The backoffice signs in with a password, then a code held in a server-side second step | Accepted | 2026-11-11 |
| [0039](0039-the-public-waitlist-is-guarded-by-turnstile-and-fails-closed.md) | The public waitlist is guarded by Cloudflare Turnstile and fails closed | Accepted | 2026-11-12 |
| [0040](0040-the-waitlist-and-the-referral-cap-live-in-d1-and-the-cap-is-a-settings-row.md) | The waitlist and the referral cap live in D1, and the cap is a settings row | Accepted | 2026-11-12 |
| [0041](0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md) | The public site is served by the API Worker, selected by host, next to the backoffice | Accepted | 2026-11-12 |
| [0042](0042-the-customer-web-app-signs-in-with-a-one-time-link-sent-over-whatsapp.md) | The customer web app signs in with a one-time link sent over WhatsApp | Accepted | 2026-11-13 |
| [0043](0043-access-opens-in-batches-from-the-backoffice.md) | Access opens in batches from the backoffice | Accepted | 2026-11-13 |
| [0044](0044-an-agent-requests-access-without-the-captcha-under-weighted-limits.md) | An agent requests access without the captcha, under weighted limits | Accepted | 2026-11-13 |
| [0046](0046-an-operator-agent-runs-the-backoffice-through-mcp-with-a-scoped-key.md) | An operator agent runs the backoffice through MCP with a scoped key | Accepted | 2026-11-13 |
| [0045](0045-an-agent-manages-the-account-through-mcp-with-the-owner-approving-on-whatsapp.md) | An agent manages the account through MCP, with the owner approving on WhatsApp | Accepted | 2026-11-13 |
