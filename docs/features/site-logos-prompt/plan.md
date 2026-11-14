# Plan: Site logos and the one-line setup prompt

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `quick-start-entries.ts` and `markdown-pages.ts` already read the registry; the setup page is a third reader.
**Assumptions (decided, owner can override):**
- Codex and ChatGPT share the OpenAI Blossom, like Claude Code and claude.ai share one file.
- The Grok mark stays as initials: the owner's brand page allows logos only from an account-free download that this agent could not reach.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/site-public/site/logos/**`, `libs/agents/supported/*/install.ts`, `apps/api/test/unit/site-logos.test.ts` | `developer` |
| G2 | `apps/api/src/site/**`, `apps/api/test/**`, `.claude/rules/site.md`, `docs/features/site-logos-prompt/**` | `developer` |

## Sequencing

G1 first (data), then G2.

## Steps

### G1

- [x] **Step 1:** red logo test (every mark has a file and a dated source), then the three SVG files and the four `officialLogo` stems — evidence: b1548fb7, e649311e.

### G2

- [x] **Step 2:** red integration tests for the prompt, the collapsed manual section, `/setup.md` and the links, then the copy keys in eight languages, the setup page, the routes and the view — evidence: f52bcebf, 2b924d84.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | A mark the vendor did not allow | `NOTICE.md` row without terms | delete the file and set `officialLogo: null` |
| 2 | A language lacks a key | `pnpm typecheck` fails on `Record<WebLocale, …>` | add the key |
