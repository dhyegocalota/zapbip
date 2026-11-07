# zapbip — agent guide

Read by Claude Code (`CLAUDE.md`), Codex (`AGENTS.md`) and Gemini (`GEMINI.md`): the three names are the same file.

**Process lives in `.claude/HARNESS.md`. Read it before any feature, fix or review.**
Domain facts live in `.claude/rules/*.md`. Claude Code loads them by the `paths:` globs in their front matter; every other tool opens, before editing a file, each rule whose globs match it. Decisions live in `docs/adr/`. Traps live in `docs/learnings/`.

## What this is

A personal WhatsApp channel for AI agents. A developer connects their own agents (Claude Code, Codex and any MCP client) to their own phone through one official WhatsApp Cloud API number shared by every account: one API key, one MCP server, working in five minutes. Agents send messages, ask questions with buttons or lists and wait for the reply; outside the 24-hour customer-service window they reach the owner through an approved utility template. Several agents share one number, and a reply is routed back to the agent it answers. Only the official Cloud API is used; the owner talks only to their own agents, never to third parties.

The product core lives in `libs/core` (the inbox, routing and delivery rules) and `apps/api` (the Cloudflare Worker, its MCP server and the per-account Durable Object). Each further part arrives as a feature under `docs/features/`, starting with the `brainstorming` skill.

## Layout

```
apps/api                the Cloudflare Worker: MCP server, Durable Object per account, D1 directory, R2 media, fake WhatsApp channel
apps/connector          the local connector: `connect` resumes the owner's Claude Code or Codex session for each owner message, `listen` prints one line per message, `channel` relays them into an open Claude Code session
apps/docs               the Mintlify documentation site
libs/core               the inbox rules as plain TypeScript behind ports
libs/types              shared enums and constants, no logic
tools/repository-shape  tests about the repository itself: README links, root entries, workflows, feature statuses, indexes, scenarios, agent surfaces
docs/adr                architecture decision records
docs/learnings          dated traps, with what inspired them and when they were revisited
docs/features           one folder per feature: spec.md + plan.md + test-plan.md
docs/scenarios          agentic walks of the product core, one file per flow, run with /scenario
.agents/skills          skills (single source; `.claude/skills` links here)
.agents/roles           agent role bodies shared by `.claude/agents` and `.codex/agents`
.agents/hooks           hook scripts shared by `.claude/settings.json` and `.codex/hooks.json`
scripts                 the local gate and its tests
```

Applications go under `apps/`, shared libraries under `libs/`; a feature that adds one adds its line here and, for a new root entry, its entry to `delivery-docs.test.ts`.

Every workspace package has a `README.md` that states purpose only: no commands, configuration, file paths or symbols, because prose is not compiled. Update a README in the same change as the code it describes ([HARNESS → Build](.claude/HARNESS.md#4-build)).

## Language

Everything in the repo is in English: code, identifiers, comments-free code, docs, ADRs, learnings, commits, PR titles and bodies. Conversation with the owner may be in Portuguese; files never are. The one exception is owner-facing product copy: it lives in `*-copy.ts` modules, in `pt_BR` and `en_US`; repo prose and identifiers stay English.

## Code conventions

- No comments; names carry the meaning. The one exception is a pointer to a decision: one line, `// NB ADR NNNN: <the rule in one sentence>`, placed on the constant or function that embodies it. It never explains mechanics, and a rule that deserves one deserves the ADR first. No acronyms in identifiers.
- Flat `if`s, early returns, no `else`.
- A compound condition gets a name (`isServedReply`, `isOnEditingSurface`) before the `if` that uses it.
- A name says what the variable holds: a promise is a `…Connection` or `…Promise`, never a `client`.
- One handler per request kind, dispatched from a record keyed by the kind, instead of one function with interleaved `if`s.
- Recurring mechanics have one shared helper. Search before adding a local copy; a new one goes under `libs/` or the owning feature, and its name joins this line: `accountInboxOf`, `resolveConnection`, `renderCopy`, `mediaStoreOf`.
- Durations cross boundaries in milliseconds and convert at the edge (a `Retry-After` header, a label).
- Copy strings never sit inline in JSX; they live in a `*-copy.ts` file or `libs/types`.
- Never `?? defaultValue` to mask a missing value. Model absence explicitly: throw, return early or make the field required upstream.
- Enums over string literals. Constants over magic literals, declared at the top of the file or in `libs/types`.
- Function declarations for functions, components and hooks. Named parameters whenever a function takes more than one.
- Array methods over loops. Short files with one purpose.
- No `.js` extensions in imports. Type everything.
- Read neighbouring code first and match it; the repo must read as if one engineer wrote it.

## Commits and branches

- Branches: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.
- Commits: Conventional Commits, `type(scope): summary`, en-US. Never `git add -A`, `git add .` or `--no-verify`.
- Commit and push only when the owner asks. Never commit from `main`; branch first.
- Attribution lines required by the agent harness go at the end of the commit body.

## Tests are mandatory

A change without tests is not done. Unit with Vitest, E2E with Playwright, and the user-facing walk with Playwright MCP recorded for the PR. Details in `.claude/HARNESS.md` → Prove.

## Tooling

- `.mcp.json` (Claude, Cursor) and `.codex/config.toml` (Codex) declare the same MCP servers: `playwright`, `context7`.
- One source per agent surface, thin adapters per tool ([ADR 0001](docs/adr/0001-one-source-per-agent-surface.md)): skills in `.agents/skills` (`.claude/skills` links there), roles in `.agents/roles` (wrapped by `.claude/agents/*.md` and `.codex/agents/*.toml`), hook scripts in `.agents/hooks` (wired by `.claude/settings.json` and `.codex/hooks.json`).
- TypeScript intelligence: Claude Code uses the `typescript-lsp` plugin; everyone else runs `pnpm typecheck`.
- Secrets live in `.env` files that agents never edit; `.env.example` documents them.
