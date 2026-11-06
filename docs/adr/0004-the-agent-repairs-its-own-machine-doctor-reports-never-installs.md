# 0004. The agent repairs its own machine: a doctor reports at session start and never installs

- Status: Accepted
- Date: 2026-11-04
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [superdoc-collab ADR 0026](https://github.com/dhyegocalota/superdoc-collab/blob/main/docs/adr/0026-the-agent-repairs-its-own-machine-doctor-reports-never-installs.md), ported with the harness; [ADR 0001](0001-one-source-per-agent-surface.md); [ADR 0002](0002-mechanical-security-gates-and-a-security-reviewer.md)

## Context

The harness depends on tools nothing else names: `jq` for every hook, `gh` for `/open-pr` and the recorder, `ffmpeg` for the recorder, `gitleaks` for the gate, the Playwright Chromium for the MCP servers, Node and pnpm at the versions the repository pins. Without `jq` the guards would read no input and silently allow everything. A prose list of requirements is never read before a task and drifts from reality.

## Decision

1. `.agents/hooks/doctor.sh` is the one executable list of requirements. It prints one line per tool: `<tool> | ok|missing|skipped | required|optional | lost: <what the harness cannot do> | fix: <the exact command>`, with the command chosen from the platform and the package manager present.
2. It runs as a `SessionStart` hook for both tools, as gate 0 of `pnpm verify` and in CI.
3. It reports and never installs; the agent asks before running any `fix:` line. Installing a tool joins **Ask first** in the autonomy contract.
4. The blocking guards fail closed: without `jq` they exit 2 with the doctor's fix line.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Doctor at session start, reports only (chosen) | the agent knows the machine before the first task; one executable list | a turn spent on repairs when something is missing | — |
| Doctor that installs | zero friction | a session hook running package managers is a supply-chain and consent problem | irreversible actions need consent |
| Prose setup section | no code | nobody runs a list; it drifts | prose is not compiled |

## Consequences

- The doctor validates what it reads from the repository (`.nvmrc` digits only, `packageManager` as `pnpm@x.y.z`) before comparing, because a crafted value would otherwise execute at session start ([learning](../learnings/2026-10-17-a-session-start-hook-runs-whatever-a-repository-file-contains.md)).
- Every caller runs the script, never `pnpm doctor`, which is pnpm's own built-in ([learning](../learnings/2026-10-17-a-script-named-like-a-pnpm-built-in-never-runs.md)).

## Evidence

`.agents/hooks/hooks.test.sh` drives the doctor with a fake `PATH` and a forced platform, so the `fix:` lines for macOS and Linux are pinned.

## Revisit when

- The tool list outgrows one readable script, and a devcontainer becomes the cheaper answer.
- Claude Code or Codex ship a native required-tools manifest.
