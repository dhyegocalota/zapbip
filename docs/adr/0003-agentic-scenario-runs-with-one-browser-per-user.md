# 0003. Agentic scenario runs with one Playwright MCP server per user

- Status: Accepted
- Date: 2026-11-04
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [superdoc-collab ADR 0023](https://github.com/dhyegocalota/superdoc-collab/blob/main/docs/adr/0023-agentic-scenario-runs-with-one-browser-per-author.md), ported with the harness; `@playwright/mcp` 0.0.83

## Context

Each feature is proven by its own test plan. Nothing walks the product's core end to end, in real browsers, after a change that touches it. Playwright MCP exposes one page in one profile: two tabs share cookies and are the same user, and `browser_run_code_unsafe` cannot hand a second context back as first-class tools.

## Decision

1. Scenarios are files under `docs/scenarios/<slug>.md`: front matter with the paths they cover and how many users they need, a body with setup, numbered tests with one `Expect` each, and edge cases to hunt.
2. `/scenario <slug>` boots the stack on its own ports with fake external services and a fresh database, so a run is deterministic, free and never collides with another run.
3. Each user is driven through its own Playwright MCP server: `.mcp.json` and `.codex/config.toml` declare `playwright`, `playwright-second` and the spare `playwright-third`, all `--isolated`.
4. `/open-pr` suggests the scenarios whose paths the diff touches before the merge, never before the PR opens; the owner decides whether to run them.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| One MCP server per user, `--isolated` (chosen) | every user first-class; sessions truly separate | one browser process per user | — |
| One server, extra contexts through code | no config change | the second user is blind: no snapshot, no click, no console | the agent cannot see what the second user sees |
| Real external services | closest to production | costs money, sends real WhatsApp messages, non-deterministic | the scenario tests the product, not the vendor |

## Consequences

- A scenario run writes screenshots and a report under the git-ignored `.pr-media/scenario-<slug>/`; defects become learnings or fix features, never inline fixes.
- A session started before `.mcp.json` changed lacks the extra servers; the skill stops rather than falling back to two tabs.

## Evidence

`tools/repository-shape/src/scenarios.test.ts` pins the file shape and that both agent configurations declare the same number of Playwright servers.

## Revisit when

- A scenario needs more users than there are servers.
- Playwright MCP exposes several contexts as first-class tools in one server.
