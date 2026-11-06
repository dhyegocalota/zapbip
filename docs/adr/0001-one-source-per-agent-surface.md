# 0001. One source per agent surface, a thin adapter per tool

- Status: Accepted
- Date: 2026-11-04
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [superdoc-collab ADR 0014](https://github.com/dhyegocalota/superdoc-collab/blob/main/docs/adr/0014-one-source-per-agent-surface.md), ported with the harness

## Context

The harness is tool-agnostic: Claude Code, Codex and any agent that reads `AGENTS.md` follow the same phases. Each tool reads its instructions, skills, roles, hooks and MCP servers from a different place and in a different format. Codex edits files through `apply_patch`, so the touched paths reach a hook as `*** Update File:` headers inside `tool_input.command`, not as `tool_input.file_path`. Codex has no instruction file scoped by glob.

## Decision

Every agent surface has one source under `.agents/` and a thin adapter per tool that only points at it:

| Surface | Source | Claude Code adapter | Codex adapter |
|---|---|---|---|
| Instructions | `AGENTS.md` | `CLAUDE.md` symlink | read natively |
| Process | `.claude/HARNESS.md` | linked from `AGENTS.md` | linked from `AGENTS.md` |
| Skills | `.agents/skills/<name>/SKILL.md` | `.claude/skills` symlink; `/<name>` | read natively; `$<name>` |
| Roles | `.agents/roles/<role>.md` | `.claude/agents/<role>.md` | `.codex/agents/<role>.toml` |
| Hooks | `.agents/hooks/*.sh` | `.claude/settings.json` | `.codex/hooks.json` |
| Domain rules | `.claude/rules/*.md` | loaded by `paths:` globs | `AGENTS.md` tells the agent to open each rule whose globs match |
| MCP servers | `.mcp.json` and `.codex/config.toml` | `.mcp.json` | `.codex/config.toml` |

The hook scripts read the touched files from `tool_input.file_path` when present and from the `apply_patch` headers otherwise (`.agents/hooks/touched-files.sh`), so one script serves both shapes.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| One source under `.agents/`, thin adapters per tool (chosen) | nothing is written twice; adding a tool is one adapter; hooks and skills are tested once | adapters must follow format changes; a reader follows one pointer | — |
| Copy each surface into `.codex/` | each tool self-contained | three copies drift within a week | duplication is the failure the repository guards against in code |
| Claude Code only | zero extra files | the owner uses both tools; Codex would run without the guards | contradicts the harness |

## Consequences

- Codex sessions get the same guards, skills and roles as Claude Code.
- Codex runs project hooks only after the project is trusted and the hooks reviewed with `/hooks`.
- Open gaps, accepted: Codex has no equivalent of the `permissions.deny` entries that stop Claude Code from reading `.env*`, and Codex roles do not carry the per-agent `tools` and `model` restrictions; there the rule rests on the instructions.

## Evidence

`.agents/hooks/hooks.test.sh` feeds both input shapes to every script; `tools/repository-shape/src/agent-surfaces.test.ts` fails when a role lacks either wrapper or its Codex registration.

## Revisit when

- Codex ships glob-scoped instruction files or per-role tool permissions.
- A third tool joins with a format that cannot read any of the sources.
