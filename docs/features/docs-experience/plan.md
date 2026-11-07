# Plan: User-first docs in two languages

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `apps/docs/docs.json` (the one navigation), the `apps/docs/**` pages, `tools/repository-shape/src/docs-experience.ts` (shared helpers and the registry check), `apps/docs/e2e/` (the walk, run by `gate_docs`), `libs/types` (enums and the number constant).
**Cut point:** `feat/docs-experience` is cut from `main` only after install-skills, scheduled-wake and local-connector have merged. Until then nothing is committed; lanes draft in the scratchpad.
**Merge target:** every lane merges into `feat/docs-experience`. `feat/docs-experience` merges into `main` after every other feature's docs are on `main`.
**Assumptions (decided, owner can override):**
- Mintlify stays `mint@4.2.1207`. Its language switcher is the fallback; browser-language selection is spiked in G8.
- `@playwright/test` `1.65.0` exact is a devDependency of `apps/docs` (owner delegated 2026-11-06). The browser check is the existing `check_chromium` in `.agents/hooks/doctor.sh`.
- The official number is the sentinel `OFFICIAL_NUMBER_UNSET` until the owner supplies the digits at deploy (cross-slice decision, 2026-11-06). Building, testing and merging do not wait on it.
- Per-client pages live under `agents/`, background running under `developers/`. Other slices write their English pages at those paths where they can.
- Names taken from other slices are marked `(contract: confirm at build)` and checked in Step 1.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G0 contract | `apps/docs/docs.json`; `apps/docs/**` skeletons for every IA path in both languages; `apps/docs/snippets/install-prompt.mdx`, `snippets/pt-br/install-prompt.mdx`, `snippets/official-number.mdx`, `snippets/pt-br/official-number.mdx`; `apps/docs/README.md`; `apps/docs/package.json`; `apps/docs/tsconfig.json`; `apps/docs/playwright.config.ts`; `apps/docs/e2e/support/docs-experience.ts`; `libs/types/src/enums.ts` (additions only); `libs/types/src/constants.ts` (additions only); `tools/repository-shape/src/docs-experience.ts`; `tools/repository-shape/src/docs-experience.test.ts`; `tools/repository-shape/src/docs-navigation.test.ts` (switched to `DocsLanguage`); `tools/repository-shape/package.json` and `tsconfig.json`; `scripts/verify.sh` and `scripts/verify.test.sh` | `developer-0` |
| G1 get started and overview | `apps/docs/index.mdx`, `apps/docs/get-started/how-to-start.mdx`, their `pt-br/` twins, `apps/docs/images/**`, `apps/docs/e2e/get-started.spec.ts` | `developer-1` |
| G2 agents A | `apps/docs/agents/supported-agents.mdx` (prose), `agents/claude-code.mdx`, `agents/codex.mdx`, `agents/claude-ai.mdx`, `agents/chatgpt.mdx`, `agents/cursor.mdx` and their `pt-br/` twins; `tools/repository-shape/src/install-guides.test.ts` (path update only); `apps/docs/e2e/agents-a.spec.ts` | `developer-2` |
| G3 agents B | `apps/docs/agents/grok-bot.mdx`, `agents/grok-web.mdx`, `agents/hermes.mdx`, `agents/openclaw.mdx`, `agents/gemini-cli.mdx`, `agents/any-mcp-client.mdx` and their `pt-br/` twins; `apps/docs/e2e/agents-b.spec.ts` | `developer-3` |
| G4 features | `apps/docs/features/**`, `apps/docs/pt-br/features/**`, `apps/docs/e2e/features.spec.ts` | `developer-4` |
| G5 help | `apps/docs/help/**`, `apps/docs/pt-br/help/**`, the accounts-and-keys docs test (path update only), `apps/docs/e2e/help.spec.ts` | `developer-5` |
| G6 developers and concepts | `apps/docs/developers/**`, `apps/docs/concepts/**`, their `pt-br/` twins; the local-connector and webhook-wake docs checks (path update only); `apps/docs/e2e/developers.spec.ts` | `developer-6` |
| G7 MCP reference | `apps/docs/mcp-reference/**`, `apps/docs/pt-br/mcp-reference/**`, `apps/docs/e2e/mcp-reference.spec.ts` | `developer-7` |
| G8 walk and language | `apps/docs/e2e/from-zero.spec.ts`, `apps/docs/e2e/language.spec.ts` | `developer-8` |

Lead-owned, never a lane: `docs/features/**`, `docs/adr/**` (ADR 0030), both indexes, status flips, `.claude/**`, `AGENTS.md`, `README.md`.

The three path-hard-coding tests and their lanes: `install-guides.test.ts` (install-skills IS-D1 and IS-D4) → G2; the accounts-and-keys guides checks → G5; the local-connector `connect/` checks and the webhook-wake `guides/webhook-wake` checks → G6.

## Contract (G0 Step 3, fixed before the lanes start)

Each block names its file. Stubs throw `<name> is not implemented`, so the red commit typechecks and fails on the assertion. Names marked `(contract: confirm at build)` come from other slices (Step 1).

```ts
// libs/types/src/enums.ts (additions)
export enum DocsLanguage {
  English = 'en',
  PortugueseBrazil = 'pt-BR',
}

export enum DocsOnlyClient {
  AnyMcpClient = 'any-mcp-client',
}

export enum DocsRetentionKind {
  Questions = 'questions',
  Queue = 'queue',
  Media = 'media',
}
```

```ts
// libs/types/src/constants.ts (additions)
export const OFFICIAL_NUMBER_UNSET = 'OFFICIAL_NUMBER_UNSET';
export const OFFICIAL_WHATSAPP_NUMBER = OFFICIAL_NUMBER_UNSET;
```

```ts
// tools/repository-shape/src/docs-experience.ts
import { DAY_MS, DocsLanguage, DocsOnlyClient, DocsRetentionKind, InstallClient, McpToolName, OFFICIAL_WHATSAPP_NUMBER, WakeRung } from '@zapbip/types'; // InstallClient, WakeRung, McpToolName: (contract: confirm at build)
import { ASK_MAX_WAIT_SECONDS, MEDIA_RETENTION_MS, QUEUE_RETENTION_MS, QUESTION_RETENTION_MS } from '@zapbip/core'; // (contract: confirm the core index re-exports these at build)

export type DocsAgentClient = InstallClient | DocsOnlyClient;

export enum AgentPageSection {
  WhatWorks = 'whatWorks',
  HowItListens = 'howItListens',
  SetupFromZero = 'setupFromZero',
  CheckItWorks = 'checkItWorks',
}

export const AGENT_PAGE_HEADINGS: Record<DocsLanguage, Record<AgentPageSection, string>>;

export const WAKE_RUNG_LABELS: Record<DocsLanguage, Record<WakeRung, string>>;

export const CLIENT_LISTEN_FACTS: Record<DocsAgentClient, { rung: WakeRung; expectedDelaySeconds: number | null }>;

export const LISTEN_STATEMENT_TOKENS: Record<DocsLanguage, { pending: string; recallsUntilAnswered: string; noTimeLimit: string }>;

export const DOCS_GROUPS: Record<DocsLanguage, string[]>;

export const DOCS_DEVELOPER_LINK_PREFIXES: string[];

export const CHAT_MAX_MESSAGES: number;

export const INSTALL_PROMPT_MAX_LINES: number;

export const RETENTION_DAYS: Record<DocsRetentionKind, number>;

export const PAGE_LANGUAGE_FOLDER: string;

export function agentPagePathOf(input: { client: DocsAgentClient; language: DocsLanguage }): string {
  throw new Error('agentPagePathOf is not implemented');
}

export function twinPathOf(input: { path: string; language: DocsLanguage }): string {
  throw new Error('twinPathOf is not implemented');
}

export function sectionOf(input: { markdown: string; heading: string }): string {
  throw new Error('sectionOf is not implemented');
}

export function headingsOf(input: { markdown: string }): string[] {
  throw new Error('headingsOf is not implemented');
}

export function chatBlocksOf(input: { markdown: string }): string[] {
  throw new Error('chatBlocksOf is not implemented');
}

export function linksOf(input: { markdown: string }): string[] {
  throw new Error('linksOf is not implemented');
}

export function linesOf(input: { text: string }): string[] {
  throw new Error('linesOf is not implemented');
}
```

Values, fixed here:
- `CHAT_MAX_MESSAGES = 4`; `INSTALL_PROMPT_MAX_LINES = 2`.
- `DOCS_DEVELOPER_LINK_PREFIXES = ['/developers/', '/mcp-reference/', '/concepts/', '/pt-br/developers/', '/pt-br/mcp-reference/', '/pt-br/concepts/']`.
- `PAGE_LANGUAGE_FOLDER = 'pt-br'`. The pt-BR twin of `a/b` is `pt-br/a/b`. Links use the same form.
- `RETENTION_DAYS` is derived: `QUESTION_RETENTION_MS / DAY_MS` for `Questions`, `QUEUE_RETENTION_MS / DAY_MS` for `Queue`, `MEDIA_RETENTION_MS / DAY_MS` for `Media`. Values 7, 7, 30.
- `CLIENT_LISTEN_FACTS`: Claude Code Local 7; Codex Local 6; Cursor Local null; Gemini CLI Local null; Hermes Local null; OpenClaw Local null; Grok Bot Webhook 9; claude.ai Webhook 16; ChatGPT Scheduled 3600; Grok web Standby null; any MCP client Inbox null.
- `LISTEN_STATEMENT_TOKENS`: en `pending`, `again`, `no time limit`; pt-BR `pendente`, `de novo`, `sem limite de tempo`. Matching is case-insensitive.
- `DOCS_GROUPS`: en `Get started`, `Agents`, `Features`, `Help`, `For developers`; pt-BR `Primeiros passos`, `IAs`, `Funcionalidades`, `Ajuda`, `Para desenvolvedores`.
- `twinPathOf` is the only twin rule: pt-BR twin is `pt-br/` + path; the English path of a `pt-br/` file is the path without that prefix.

```ts
// apps/docs/e2e/support/docs-experience.ts
import { DocsLanguage } from '@zapbip/types';

export enum DocsViewport {
  Desktop = 'desktop',
  Narrow = 'narrow',
}

export const DOCS_PORT = 3310;
export const DESKTOP_WIDTH_PX = 1280;
export const NARROW_WIDTH_PX = 375;
export const DOCS_VIEWPORT_HEIGHT_PX = 800;
export const DOCS_LOCALE_OF: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'en-US',
  [DocsLanguage.PortugueseBrazil]: 'pt-BR',
};

export function docsOptionsOf(input: { language: DocsLanguage; viewport: DocsViewport }): {
  locale: string;
  viewport: { width: number; height: number };
} {
  throw new Error('docsOptionsOf is not implemented');
}
```

`DOCS_LOCALE_OF` is the Playwright locale map only; it is not a link form. Links never use the locale code.

## Sequencing

1. **Cut.** `main` carries install-skills, scheduled-wake and local-connector. `feat/docs-experience` is cut from `main` then. ~~Cut after install-skills and scheduled-wake land~~ owner delegated 2026-11-06: G0 cut early from main; lanes wait.
2. **G0 first, on `feat/docs-experience`.** Steps 1 to 9 in order. Afterwards G0 is green alone (see the list in test-plan T1, "green in G0").
3. **Lanes G1 to G7 branch from G0's last commit** and run in parallel in their own worktrees. Each lane's first commit is its red walk spec or its red test (test-plan T1 rows marked for the lane). A lane merges into `feat/docs-experience` when its tests are green.
4. **G8 last** among the lanes: the walk and the language spike need every page.
5. **When another slice's English page lands on `main`,** its version wins the merge into `feat/docs-experience` for English text. The rewording is a later commit in the owning lane.
6. **Facts merge.** `feat/docs-experience` merges `main` into itself (never rebase). The facts tests run (T1-39 and the facts tests in T3 and T4); each command, delay, retention figure and copy line is checked against the merged code.
7. **Final merge** into `main` after every other feature's docs are on `main`.

Hard dependencies for facts: install-skills (clients, copy, listen rows, `InstallClient` with Cursor and GeminiCli), local-connector, hermes-openclaw, accounts-and-keys (copy, commands, deletion, waitlist), webhook-wake, scheduled-wake, whatsapp-cloud-channel, deploy-readiness (sentinel and preflight).

## Steps

Author this list with every box empty. Step numbers are fixed: the number contract is Step 3 everywhere it is cited.

### G0 contract

- [x] **Step 1 (plan refresh):** diff the names this plan takes from other slices against `main`: `InstallClient` and its values (`Cursor`, `GeminiCli` added by install-skills), `WakeRung` and its values (`Local`, `Webhook`, `Scheduled`, `Standby`, `Inbox`), `McpToolName`, `ASK_MAX_WAIT_SECONDS`, the three retention constants, `DAY_MS`, the sentinel and the deploy-readiness preflight. Correct any drift in this plan and commit it before Step 2. Nothing else changes in Step 1.

  Drift found on 2026-11-06 against `origin/main` (dcfebc9), `origin/feat/install-skills` and `origin/feat/scheduled-wake`:
  - `InstallClient` (ten values incl. `Cursor`, `GeminiCli`, `ChatGpt`) exists only on `feat/install-skills` (lands with install-skills). Step 3 adds a byte-identical copy to `libs/types/src/enums.ts` so G0 typechecks; the install-skills merge takes the identical hunk.
  - `WakeRung.Scheduled` and `WakeRung.Standby` exist only on `feat/scheduled-wake` (lands with scheduled-wake). Main has `Inbox`, `Local`, `Webhook`. Step 3 adds the two values identically for the same reason.
  - `McpToolName` is not in `@zapbip/types` on any branch: it lives in `apps/api/src/contract/tool-definitions.ts`. T1-49 needs it in `libs/types` with `tool-definitions.ts` importing it; that move is G7's first step, not G0 (G0 never reads it).
  - `ASK_MAX_WAIT_SECONDS`, `QUESTION_RETENTION_MS`, `QUEUE_RETENTION_MS`, `MEDIA_RETENTION_MS` and `DAY_MS` are on main (`libs/core/src/inbox/constants.ts`, `libs/types/src/constants.ts`); the core index re-exports the first four. Confirmed.
  - `OFFICIAL_NUMBER_UNSET` and `OFFICIAL_WHATSAPP_NUMBER` are on no branch; Step 3 adds them. `COMPANY` and `COMPANY_FACT_UNSET` are on main and are reused.
  - The deploy-readiness preflight is not on main (lands with deploy-readiness); nothing in G0 depends on it.
  - `apps/docs` already has `agents/supported-agents`, `developers/*`, `concepts/*`, `features/*` (four), `help/{about,faq,troubleshooting}`, `guides/webhook-wake`, the `snippets/chat.jsx`, `company.mdx` and `message-kinds.mdx` snippets and the pinned `--client-version 0.0.4077`; Step 6 adds only what is missing and moves `guides/webhook-wake` to `developers/webhook-wake`.
- [x] **Step 2 (red):** `tools/repository-shape/src/docs-experience.test.ts` with the T1 tests marked "green in G0" and the fixture tests, all imported from `docs-experience.ts`. Commit alone. The run fails on the stubs and the missing pages, not on an import error.
- [x] **Step 3 (contract and the number):** `libs/types/src/enums.ts` and `constants.ts` additions (including `OFFICIAL_NUMBER_UNSET` and `OFFICIAL_WHATSAPP_NUMBER`), the helper stubs in `docs-experience.ts`, `apps/docs/e2e/support/docs-experience.ts` with its values. Typecheck green.
- [x] **Step 4 (helpers and navigation):** implement the helpers; switch `docs-navigation.test.ts` to `DocsLanguage` values (no string literals `'en'` or `'pt-BR'`). The fixture tests turn green. Pins stay pins.
- [x] **Step 5 (navigation):** `apps/docs/docs.json` with the full IA of the spec, both languages, five groups in order, `DOCS_GROUPS` names.
- [x] **Step 6 (skeletons and snippets):** one `.mdx` for every IA path in both languages, with the frontmatter `title` and `description` and the headings of its kind (the four `AGENT_PAGE_HEADINGS` for `agents/*`; no body text). `agents/supported-agents.mdx` and its twin carry the eleven matrix rows (client, rung, two-way, cap, link) as data. `snippets/official-number.mdx` and its pt-BR twin render `+${OFFICIAL_WHATSAPP_NUMBER}` and `https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}`, so both show the sentinel today. `snippets/install-prompt.mdx` carries the copy template with `zb_inst_<code>`: en `Connect yourself to my WhatsApp with zapbip: read https://zapbip.com/i/zb_inst_<code> and follow the instructions.`; pt-BR `Conecte-se ao meu WhatsApp pelo zapbip: leia https://zapbip.com/i/zb_inst_<code> e siga as instruções.`
- [x] **Step 7 (package and tooling):** `apps/docs/package.json`: `"test:walk": "playwright test"`, `"typecheck": "tsc --noEmit -p tsconfig.json"`, devDependency `@playwright/test` `1.65.0` exact, dependency `@zapbip/types` as a workspace dependency. `apps/docs/tsconfig.json` covers `e2e/`. `apps/docs/playwright.config.ts`: two projects from `DOCS_LOCALE_OF`, a `webServer` running `pnpm dlx mint@4.2.1207 dev --port ${DOCS_PORT}`, `testDir: 'e2e'`, `retries: 0`. `tools/repository-shape/package.json` and `tsconfig.json`: workspace dependencies `@zapbip/types` and `@zapbip/core`.
- [x] **Step 8 (gate):** `scripts/verify.sh`: `gate_docs` runs `pnpm --filter @zapbip/docs broken-links` and then `pnpm --filter @zapbip/docs test:walk`, in that order, stopping at the first failure. No new row in `scripts/verify-gates.tsv`: the existing `apps/docs/*` row already maps to the docs gate. `scripts/verify.test.sh`: pins the two commands in that order for the docs gate (red first, in Step 2's commit or its own red commit before the script change).
- [x] **Step 9 (README):** `apps/docs/README.md`: one line of purpose, that the site is for any AI user. Commit `docs(docs): skeleton for the user-first site`.

G0 evidence (2026-11-06): Step 1 `ab7d8dc`; Step 2 red `7902adb` (carries the enums, the sentinel and the stub helpers, so the run reaches the assertions); Step 3 `7902adb` and `a27fe5c`; Step 4 `0aafb88`; Step 5 `19e9271`; Step 6 `b7d9a8f`; Step 7 `290b621`, with `docsOptionsOf` red `ac724bf` then green `9d9c509`; Step 8 red `8e75a90` then green `1eb0089`; Step 9 `e1a73d6`. Deviations, all recorded in `tester-briefing.md`: `ScheduledWakeRung` (a local copy of the two scheduled-wake values, replaced by `WakeRung` when scheduled-wake merges); `InstallClient` is a byte-identical copy of install-skills' enum; `messageCountOf`, `missingListenTokens`, `developerLinkViolations`, `docsNavigationOf` and `navigationPagesOf` are added to `docs-experience.ts`; `test:walk` carries `--pass-with-no-tests` until the first lane spec lands.

### G1 get started and overview

- [x] **Step 10:** Red: `apps/docs/e2e/get-started.spec.ts`: Overview headings in order (why, how it works, examples); the picture loads; Get started is one ordered list; the number snippet and the install-prompt snippet are visible; each chat has at most `CHAT_MAX_MESSAGES` messages. Evidence: red `04ebbf0`, fix `958576a`.
- [x] **Step 11:** Overview (`index.mdx` and `pt-br/index.mdx`): why zapbip exists in plain words; `images/how-it-works-en.svg` and `images/how-it-works-pt-br.svg` (existing; the pt-BR picture is checked for pt-BR text); three or four use-case cards, one chat each, written natively. Remove the "Coming soon" card line. Evidence: `69b12de` (four cards, not three or four plus the earlier six).
- [x] **Step 12:** Quickstart (`get-started/how-to-start.mdx` and twin): zero to the first message in numbered steps: message the official number with any text (the first message creates the account); get the one- or two-line prompt; paste it into the AI; see the AI's first message. Links to the FAQ waitlist entry. Evidence: `69b12de`.
- [ ] **Step 13 (facts, at the facts merge):** the signup wording matches the accounts-and-keys reply; the prompt snippet equals the install copy template (T1-39). G1: wording follows the accounts-and-keys copy by hand (`69b12de`); T1-39 waits for the merge.

### G2 agents A

- [x] **Step 14 (`32168d1`: 28 failed, 2 passed; the `install-guides.test.ts` red is not applicable on this base, the file lives on `feat/install-skills`):** Red: `apps/docs/e2e/agents-a.spec.ts`: the four agent headings in order for `claude-code`, `codex`, `claude-ai`, `chatgpt`, `cursor` in both languages; `supported-agents` has eleven rows, each linking to its page. Red: `install-guides.test.ts` reads `agents/` (IS-D1, IS-D4), committed red before the paths move.
- [x] **Step 15 (`f7337ef`):** `agents/supported-agents.mdx` and twin: prose introducing the matrix, a link to each client page, and the rung column in plain words.
- [x] **Step 16 (`f7337ef`; Claude Code names `server:zapbip-channel`, as the install copy does):** Reword the English install-skills pages for `claude-code`, `codex`, `claude-ai`, `chatgpt`, `cursor` to the user-first audience; write their pt-BR twins natively. Each How-it-listens section names the rung label, the expected delay when `CLIENT_LISTEN_FACTS` gives one, the 50-second pending loop, the re-call loop and no time limit, in the `LISTEN_STATEMENT_TOKENS` words. Codex states the loop and that the 900 s tool timeout bounds one call, not the listening. claude.ai states its 16 s delay and the hourly safety net. Claude Code names `claude --dangerously-load-development-channels server:zapbip` and links `developers/background-running`. Codex links `developers/background-running` too (the only other agent page allowed to). Cursor names `npx zapbip listen` in a background terminal.
- [x] **Step 17 (facts; `f7337ef`; the ChatGPT scheduled wording and the pinned `0.1.0` wait for the scheduled-wake and install-skills merges):** each command, flag and delay matches the merged install copy and the local-connector CLI help.

### G3 agents B

- [x] **Step 18:** Red: `apps/docs/e2e/agents-b.spec.ts`: the same four headings for `grok-bot`, `grok-web`, `hermes`, `openclaw`, `gemini-cli`, `any-mcp-client`; the listen statements; the Grok web standby sentence; `any-mcp-client` links to `developers/any-mcp-client`. Evidence: `206332c` (26 failed, 26 skipped).
- [x] **Step 19:** `grok-bot` (routine with a webhook trigger, MCP server named `zapbip`, the confirm step) and `grok-web` (connector paste, standby with a Grok Bot connection or inbox only, the 60 s per-call cap as the reason for the standby). English reworded from install-skills; pt-BR twins native. Evidence: `c4d796a` (26 of 26 per language project).
- [x] **Step 20:** `hermes` and `openclaw`: the platform plugin as the better option; the scheduled fallback; the `(verify)` items from hermes-openclaw resolved at the facts merge or removed. Evidence: `c4d796a` (26 of 26 per language project).
- [x] **Step 21:** `gemini-cli` (Local: `npx zapbip listen` in a background terminal; the MCP server added to the client's config as its install section says) and `any-mcp-client` (Inbox: the URL and header, the listen loop in plain words, `check_inbox` polling, a link to `developers/any-mcp-client`). If install-skills has not separated Gemini CLI from Grok Bot by the facts merge, the page keeps Local and the briefing records the open point. Evidence: `c4d796a` (26 of 26 per language project).

### G4 features

- [x] **Step 22:** Red: `apps/docs/e2e/features.spec.ts`: each feature page has at least one chat; `send-messages-and-media` names every `MessageKind` value from `@zapbip/types`. Evidence: `fa16fb2` (14 failed, 8 passed).
- [x] **Step 23:** Reword `send-messages-and-media`, `ask-with-buttons-and-lists`, `many-agents-on-one-number`, `the-24-hour-window` (English from agent-inbox-core; pt-BR twins). Each page describes what the person sees. Evidence: 027b395 (22 passed).
- [x] **Step 24:** `owner-starts-conversations` (new, English and twin): the owner messages first; the wake ladder in plain words; the notice when the 24-hour window is closed; the expected delay from `CLIENT_LISTEN_FACTS`. Evidence: 027b395 (22 passed).
- [x] **Step 25:** `whatsapp-commands` (English from the accounts-and-keys command words, moved from `guides/commands`): `novo agente <nome>`, `agentes`, `revogar <nome>`, `girar <nome>`, `ajuda`, `apagar conta`, with the English word beside each; the reserved-names rule. Evidence: 027b395 (22 passed).
- [x] **Step 26 (facts):** every command word equals the accounts-and-keys copy keys; the window and template wording match whatsapp-cloud-channel. Evidence: facts: command words from accounts-and-keys `command-words.ts`; rows depending on scheduled-wake marked in the briefing.

### G5 help

- [x] **Step 27:** Red: `apps/docs/e2e/help.spec.ts`: the five pages exist in both languages; `privacy-and-security` shows the `RETENTION_DAYS` figures; `faq` has the waitlist question. Red: the accounts-and-keys docs checks read `features/whatsapp-commands` and `help/delete-your-account`, committed before the moves. Evidence: `bb38227`.
- [x] **Step 28:** `troubleshooting` and `faq` (English and twin): symptoms the person sees, each with one fix. The FAQ entry "What if my account is on the waitlist?" says: the account is held until the zapbip team activates it; the person waits; meanwhile `ajuda` lists the commands. Evidence: `b1208f0`.
- [x] **Step 29:** `privacy-and-security` (English and twin): what zapbip stores and for how long (queued messages and questions 7 days, media 30 days, the secret only as a digest, logs without message text), what Meta and Cloudflare keep after deletion, what zapbip never reads. The figures come from `RETENTION_DAYS`. Evidence: `b1208f0`.
- [x] **Step 30:** `revoke-and-rotate-keys` (English and twin): `revogar <nome>` and `girar <nome>`, what each does to the link, that a rotated link is sent once. Evidence: `b1208f0`.
- [x] **Step 31:** `delete-your-account` (English and twin, from accounts-and-keys): `apagar conta`, then `apagar conta definitivamente`; what is deleted; what Meta and Cloudflare keep; the next message starts a new account on the waitlist. Evidence: `b1208f0`.
- [x] **Step 32 (facts):** the deletion steps match accounts-and-keys. Evidence: `b1208f0`.

### G6 developers and concepts

- [x] **Step 33:** Red: `apps/docs/e2e/developers.spec.ts`: the twelve developer pages exist in both languages. Red: the local-connector checks read `developers/local-connector` and `developers/background-running`; the webhook-wake checks read `developers/webhook-wake`. Committed before the moves. Evidence: red `5636b6f` (8 failed, 42 passed), green `b7dff7f`. No test on this base reads the old `connect/` or `guides/webhook-wake` paths (the moved-path checks live on the slice branches), so the moved-path reads are not applicable here.
- [x] **Step 34:** `developers/any-mcp-client`, `developers/errors`, `developers/local-connector` (the command, `--client`, `--cwd`, `--session`, the environment variable, logs), `developers/background-running` (launchd and systemd, file mode 600, not installed by the package), `developers/webhook-wake`. English reworded for a developer; pt-BR twins native. Evidence: `b7dff7f`.
- [x] **Step 35:** `concepts/inbox`, `questions`, `24-hour-window`, `routing`, `wake-ladder`, `whatsapp-channel`, `owner-notices` (English and twin). Concepts link only within `concepts/` and to `developers/`. No simulator and no test double. Evidence: `b7dff7f`.
- [x] **Step 36 (facts):** the wake-ladder rung table and times match `CLIENT_LISTEN_FACTS`; the owner-notice templates and quick-reply texts match whatsapp-cloud-channel. Evidence: `b7dff7f`; the Scheduled and Standby rows wait for the scheduled-wake merge.

### G7 MCP reference

- [x] **Step 37 (`f084e7c`, enum move `e9f5dd5`):** Red: the registry check in `tools/repository-shape/src/docs-experience.test.ts` (T1-49): each `McpToolName` value has a page `mcp-reference/<name>` in both languages, and no `mcp-reference` page lacks a value. The check imports `McpToolName` from `@zapbip/types`; it never imports `apps/api`. Red: `apps/docs/e2e/mcp-reference.spec.ts`: a message-sending tool page has a message-kind table.
- [x] **Step 38 (`5b58b27`; the eleven pages already read for developers and `set-wake` is already twinned, so only the shared message-kinds tables changed):** Update the eleven pages for the developer audience; English reworded; pt-BR twins native. `set-wake` is written by webhook-wake (English) and twinned here.

### G8 walk and language

- [ ] **Step 39:** Red: `apps/docs/e2e/language.spec.ts`: a `pt-BR` context opens the pt-BR Overview if Mintlify selects by browser language; otherwise the test asserts the switcher is visible and the spike result is written to the tester briefing.
- [ ] **Step 40 (spike):** `mint dev` run locally in an `en-US` and a `pt-BR` context; the result (selected language, or switcher only) goes into the tester briefing and ADR 0030 (lead).
- [ ] **Step 41:** Red: `apps/docs/e2e/from-zero.spec.ts`: starts at the Overview, follows Get started, follows each numbered step to the number step, opens every linked Agents page and checks its four sections, follows every internal link, at both viewports, in both languages. The walk stops at the WhatsApp step.
- [ ] **Step 42:** Green the walk by page work only; no walk assertion is weakened to pass.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | a name from another slice has moved | the refresh diff shows the drift | correct this plan before Step 2 |
| 3 | the sentinel and the snippet disagree | the number test (T1-42, T1-43) fails | regenerate the snippets from the constant |
| 5 | docs.json lists a page with no file | the navigation test "every page listed exists" fails | Step 6 lands in the same branch before any push |
| 8 | `gate_docs` skips the walk or runs it first | `verify.test.sh` pin fails | revert the script change |
| 11 | a "Coming soon" card stays on the Overview | T1-34 fails | remove the card |
| 12 | the quickstart names a reply the product does not send | Step 13 facts check | the page reverts to the skeleton until the reply exists on `main` |
| 16 | a delay or the 50-second loop is misstated | T1-20 to T1-23 fail on that page | fix the page from `CLIENT_LISTEN_FACTS` |
| 16 | Claude Code's channel flag differs from the install copy | Step 17 facts check and the owner-run channel check | the install copy wins |
| 19 | the Grok web standby sentence is wrong | the agents-b spec and the owner-run standby check | fix the sentence |
| 20 | Hermes or OpenClaw promises an unpublished plugin | facts check against hermes-openclaw's `(verify)` marks | keep the fallback steps only |
| 21 | Gemini CLI is wrongly separated from Grok Bot | install-skills' answer is missing at the facts merge | the page keeps Local; the briefing records the open point |
| 25 | a command word differs from the copy | Step 26 facts check against the copy keys | copy the word from the copy module |
| 28 | the waitlist answer contradicts the accounts-and-keys reply | the FAQ box (T3, help spec) and the facts check | rewrite the answer from the reply |
| 29 | a retention figure is typed by hand | T1-45 compares the page with `RETENTION_DAYS` | fix the page |
| 31 | the deletion page promises a result the flow does not give | Step 32 facts check | state what the flow sends |
| 33 | a feature page carries a developer link | T1-28 fails | move the link to the Agents footer or remove it |
| 38 | a tool page names a tool that `McpToolName` lacks | T1-49 fails | remove the page |
| 40 | Mintlify ignores the browser language | the language test records the switcher as the fallback | keep the switcher; ADR 0030 records it |
| 41 | the walk passes on heading-only skeletons | the walk asserts section text and chat counts, not headings alone | tighten the assertion; never weaken it |
| facts merge | a page states a fact the product lacks | the facts checks and the owner-run list | revert that page; its lane re-merges |
| final merge | another slice lands English text after the lane merged | conflict on an IA path | take the other slice's English text; re-run the walk |

**Steps with no backout:** none. Every step is a docs, test or contract commit; reverting the merge restores the previous navigation.

## Z. Prove and ship

- [ ] **Tester briefing:** each lane writes its section of `tester-briefing.md` (the lead owns the file), including the spike result and the pins.
- [ ] **Tester run:** a fresh `tester` followed the docs only, in `en-US` and `pt-BR`, from the Overview to the WhatsApp step, and ticked every box of `test-plan.md` with evidence.
- [ ] **Reviewer:** a fresh `reviewer` returned a verdict; the refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** runs per HARNESS §6; the diff has no code path, so the expected verdict is NOT APPLICABLE or CLEAR.
- [ ] **/check-ui:** screenshots of the Overview and Get started in both languages at 1280 and 375, uploaded per HARNESS §7.
- [ ] **/open-pr:** gates passed, learnings sweep stated, ADR 0030 written, `docs/features/README.md` row added, PR opened.
