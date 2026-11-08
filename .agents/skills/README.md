# Skills

The single source of skills: Claude Code reads it through the `.claude/skills` symlink, Codex reads `.agents/skills` natively ([ADR 0001](../../docs/adr/0001-one-source-per-agent-surface.md)). Each skill's own `SKILL.md` says when to use it.

- Vendored from superpowers 6.4.1 (obra/superpowers, MIT), cross-references rewritten to this repository: brainstorming, writing-plans, executing-plans, subagent-driven-development, test-driven-development, systematic-debugging, verification-before-completion.
- In-house: feature, adr, learning, verify, check-ui, open-pr, scenario.

Claude Code invokes a skill as `/<name> <arguments>`; Codex as `$<name>` followed by the arguments.
