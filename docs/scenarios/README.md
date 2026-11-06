# Scenarios

Agentic walks of the product's core in real browsers, one file per flow, run with `/scenario <slug>` ([ADR 0003](../adr/0003-agentic-scenario-runs-with-one-browser-per-user.md)). A scenario boots the whole stack on its own ports with fake external services, drives every user through its own Playwright MCP server, runs every test, hunts the edge cases listed and any found, and reports pass/fail with screenshots under `.pr-media/scenario-<slug>/`.

Before a merge, `/open-pr` names the scenarios whose `paths` the diff touches; the owner decides whether to run them.

| Scenario | Authors | Covers |
|----------|---------|--------|

## File shape

Front matter: `name`, `title`, `authors` (how many users, so how many Playwright MCP servers the run needs), `paths` (globs, the same shape as `.claude/rules/`). Body: `## Setup` naming the command that boots the stack, `## Tests` with one `### Tn <title>` per test and exactly one `Expect:` line each, `## Edge cases to hunt during the run`. `tools/repository-shape/src/scenarios.test.ts` checks the shape and that this index lists every file.
