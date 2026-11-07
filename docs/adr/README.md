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
| [0015](0015-commands-are-bare-words-routed-before-agents.md) | Commands are bare words, routed before agents | Accepted | 2026-11-06 |
| [0016](0016-accounts-start-on-the-first-message-and-wait-on-a-list.md) | Accounts start on the first message and wait on a list | Accepted | 2026-11-06 |
| [0017](0017-connection-secrets-are-shown-once-and-stored-as-digests.md) | Connection secrets are shown once and stored as digests | Accepted | 2026-11-06 |
| [0018](0018-webhook-wake-carries-no-message-content.md) | A webhook wake carries no message content | Accepted | 2026-11-06 |
| [0019](0019-outbound-wake-targets-pinned-providers-and-guarded-generic-hosts.md) | Outbound wake targets: pinned provider hosts and guarded generic hosts | Accepted | 2026-11-06 |
| [0020](0020-one-install-link-per-connection-the-ai-reads-the-instructions.md) | One install link per connection, the AI reads the instructions | Accepted | 2026-11-06 |
| [0021](0021-the-agent-rules-come-from-the-mcp-server.md) | The agent rules come from the MCP server | Accepted | 2026-11-06 |
| [0022](0022-a-hibernatable-websocket-for-the-local-connector.md) | A hibernatable WebSocket for the local connector | Accepted | 2026-11-06 |
| [0023](0023-the-local-session-is-the-newest-one-in-the-working-directory.md) | The local session is the newest one in the working directory | Accepted | 2026-11-06 |
