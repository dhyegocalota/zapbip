# User-first docs in two languages

**Status:** Shipped 2026-11-07
**Tier:** 🟡
**Owner approval:** owner order 2026-11-06 (binding: user-first Mintlify docs for any AI user, en-US and pt-BR twins chosen by browser language, from-zero walk test, Cursor and Gemini CLI included). Information architecture, language, number and path decisions delegated 2026-11-06 and recorded in the answers table. Revised 2026-11-06 after the plan review (13 findings).
**ADRs:** [0010](../../adr/0010-public-docs-on-mintlify.md), [0026](../../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md), 0030 (reserved: the audience, information architecture and language rules, written at build)
**Not changing:** the MCP tools and their contract; the wake ladder; the install page the Worker serves at `/i/<install-code>` (AI-facing Markdown, not a Mintlify page); the `Chat` snippet component; `docs-navigation.test.ts` on `feat/agent-inbox-core` (kept and extended here, its pins listed in the test plan).

## Problem

The docs were written for a developer who reads the MCP reference first. The people zapbip is for are any AI user: someone who uses ChatGPT, Claude, Grok, Codex, Cursor or Gemini and wants the AI to reach them on WhatsApp. They do not know what an MCP server is, and they should not need to. Today the overview does not say why zapbip exists, setup starts from the MCP URL, the Portuguese reader gets an English site with a translated title, and nothing proves that a new person can get from zero to the first WhatsApp message by following the docs alone.

Owner's words, binding: "isso não é só pra developers de forma alguma, é pra qualquer usuário de AI em geral" and "temos que suportar i18n em tudo desde o início: pt-br e en-us… a depender do browser".

## Goals

1. The Overview opens with why zapbip exists, a picture of how it works, and use-case examples a reader grasps in ten seconds.
2. **Get started** takes a person from zero to the first WhatsApp message: message the official zapbip number on WhatsApp, get the install prompt, paste it into the AI, see the AI's first message.
3. The install prompt is one or two lines. The AI reads the instructions online at `/i/<install-code>`. The person does nothing else, except the one step a platform forces (adding a connector in claude.ai, ChatGPT or Grok web settings).
4. **Agents** has one page per supported client, and a matrix of all eleven. Each client page says what works, how the client keeps listening with no time limit, and gives the from-zero setup steps.
5. **Features** covers every message kind, asking with buttons and lists, the owner starting a conversation, several agents on one number, the WhatsApp commands, the 24-hour window and templates, and media.
6. **Help** covers troubleshooting, FAQ (including the waitlist), privacy and what zapbip stores, revoking and rotating keys, and deleting the account.
7. **For developers** holds the MCP reference, the concepts, the wake ladder, the errors, the local connector, background running and the webhook wake. It is one group, not the front door.
8. Every page exists in `en` and `pt-BR`. The reader's browser language picks the start language where Mintlify supports it; otherwise the switcher does.
9. A fresh tester who follows only the docs, in each language, reaches the end of the from-zero path on `mint dev` with a clean console. The walk runs in the gate.
10. The docs never mention the test double for WhatsApp. The local simulator walkthrough lives in the repository's contributor docs, not on Mintlify.

## Non-goals

- Translating the MCP tool schemas or the agent-facing rules. They stay English because the agent reads them (install-skills, ADR 0021).
- A web dashboard, search tuning, analytics, or a custom domain. Publishing the site waits for the owner's Mintlify account (deploy-readiness runbook).
- Documenting behaviour that is not merged. "Coming soon" text is removed, not moved.
- Self-hosting and local-stack pages on Mintlify. They are runbooks in the repository ([ADR 0026](../../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md)).

## Design

### Ownership across slices

- Every other slice (install-skills, local-connector, webhook-wake, accounts-and-keys, scheduled-wake, hermes-openclaw, whatsapp-cloud-channel, deploy-readiness) writes its **English** pages on its own branch, at the new IA path where it can, and lists them in its tester briefing. It does not write pt-BR pages and does not edit `docs.json`.
- This feature's branch `feat/docs-experience` is cut from `main` only after install-skills, scheduled-wake and local-connector have merged, because G0 imports their enums (`InstallClient`, `WakeRung`). Every name taken from them is marked `(contract: confirm at build)` in the plan, and a plan-refresh step checks them first.
- This feature merges into `main` **after all of them**. It owns: the moves of any page still at an old path, the rewording for the user-first audience, every pt-BR twin, `docs.json`, and the test path updates (listed in the plan).
- When an English page written by its owning slice is on `main`, that version wins the merge; docs-experience's rewording follows as a later commit.

### Information architecture

The navigation is the single `apps/docs/docs.json`, in `en` (default) and `pt-BR`, with the same five groups in the same order. The pt-BR twin of `<path>` is the file `pt-br/<path>.mdx`: the folder is lowercase `pt-br` (existing tree), the language code in `docs.json` is `pt-BR`.

| Group | Pages (en path) |
|---|---|
| Get started | `index` (Overview), `get-started/how-to-start` |
| Agents | `agents/supported-agents` (the matrix), `agents/claude-code`, `agents/codex`, `agents/claude-ai`, `agents/chatgpt`, `agents/cursor`, `agents/grok-bot`, `agents/grok-web`, `agents/hermes`, `agents/openclaw`, `agents/gemini-cli`, `agents/any-mcp-client` |
| Features | `features/send-messages-and-media`, `features/ask-with-buttons-and-lists`, `features/owner-starts-conversations`, `features/many-agents-on-one-number`, `features/whatsapp-commands`, `features/the-24-hour-window` |
| Help | `help/troubleshooting`, `help/faq`, `help/privacy-and-security`, `help/revoke-and-rotate-keys`, `help/delete-your-account` |
| For developers | `developers/any-mcp-client`, `developers/errors`, `developers/local-connector`, `developers/background-running`, `developers/webhook-wake`, `concepts/inbox`, `concepts/questions`, `concepts/24-hour-window`, `concepts/routing`, `concepts/wake-ladder`, `concepts/whatsapp-channel`, `concepts/owner-notices`, and the eleven `mcp-reference/*` pages |

Moves from the old paths (owned here): `install/<client>` → `agents/<client>`; `connect/local-connector` → `developers/local-connector`; `connect/background-running` → `developers/background-running`; `guides/commands` → `features/whatsapp-commands`; `guides/agents-and-links` → split between `features/many-agents-on-one-number` and `help/revoke-and-rotate-keys`; `guides/account-deletion` → `help/delete-your-account`; `guides/webhook-wake` → `developers/webhook-wake`.

### Clients

Eleven entries in the matrix. Ten are install clients from `InstallClient` (install-skills' enum, extended once there with `Cursor` and `GeminiCli`). `any-mcp-client` is a docs-only entry (`DocsOnlyClient`), because it is not an install section.

### Each agent page

Every page under **Agents** has the same four sections, in this order, with the headings in `AGENT_PAGE_HEADINGS`:

1. **What works**: a short table of what the client does with zapbip (send, receive, ask with buttons, media, start a conversation), and what it cannot do, if anything.
2. **How it listens**: the rung (its localized label from `WAKE_RUNG_LABELS`), the expected delay when `CLIENT_LISTEN_FACTS` gives one, and the listen loop in plain words. The loop states: `ask` and `wait_for_reply` return pending at most every 50 seconds, and the AI calls again until the owner answers, with no time limit. The page says what the person does to keep it running.
3. **Set up from zero**: numbered steps. The first is always "message the zapbip number on WhatsApp" (the wording of the signup copy). The AI does the rest; the person does only what the platform forces.
4. **Check it works**: the self-test: ask the AI to send the localized self-test line from the install copy and confirm it arrives on WhatsApp.

Listen facts per client, from `CLIENT_LISTEN_FACTS`:

| Client | Rung | Expected delay |
|---|---|---|
| Claude Code | Local | 7 s |
| Codex | Local | 6 s |
| Cursor | Local (`npx zapbip listen` in a background terminal) | not measured |
| Gemini CLI | Local (`npx zapbip listen` in a background terminal) | not measured |
| Hermes, OpenClaw | Local (platform plugin), fallback Scheduled | not measured |
| Grok Bot | Webhook | 9 s |
| claude.ai | Webhook | 16 s |
| ChatGPT | Scheduled | 3600 s (hourly) |
| Grok web | Standby | not measured |
| any MCP client | Inbox (the owner's messages wait in the inbox until the agent calls `check_inbox`; the page states the loop) | not measured |

Codex's page states the re-call loop and that it has no time limit; the 900 s tool timeout bounds one call, not the listening. claude.ai states its expected delay. Cursor's and Gemini CLI's rung depends on install-skills telling them apart from Grok Bot (being fixed there).

### Install prompt

The WhatsApp reply to a new agent carries one or two lines, produced by `accounts-and-keys` from the copy module. `snippets/install-prompt.mdx` (and its pt-BR twin) shows the same lines with `zb_inst_<code>` as the placeholder. A test proves the snippet matches the copy template, so docs and product cannot drift. No example shows a real code or secret.

### The official number

`libs/types/src/constants.ts` declares `OFFICIAL_NUMBER_UNSET` (the explicit sentinel) and `OFFICIAL_WHATSAPP_NUMBER`, which holds the sentinel until the owner supplies the digits at deploy (cross-slice decision, 2026-11-06). `snippets/official-number.mdx` and its pt-BR twin render that same value as `+<value>` and as a `https://wa.me/<value>` link, so the snippet always shows what the constant holds. Tests accept either the sentinel or digits (digits only when set), and a test checks that both snippets match the constant. Building, testing and merging do not wait on the digits; the deploy-readiness preflight refuses to deploy the Worker or the docs while the constant is the sentinel.

### Language

- `navigation.languages` lists `en` first, then `pt-BR`.
- Every page has a twin at the mirrored path. The pt-BR twin of `a/b` is the file `pt-br/a/b.mdx`. The folder is lowercase `pt-br` everywhere (files, links, URLs). The language code `pt-BR` appears only as the `docs.json` language name and as `DocsLanguage.PortugueseBrazil`. pt-BR pages link to pt-BR pages with `/pt-br/<path>`. `docs-navigation.test.ts` enforces the twins in both directions.
- Mintlify chooses the start language from the browser where it supports it. A spike (G8) checks whether it does. If not, the switcher is the rule. No custom redirect script is added.
- Product copy the reader sees (install lines, command replies) is in `*-copy.ts` keyed by `OwnerLocale`. Docs prose is not generated from copy; the snippets must match it.

### Wording rules

- No "coming soon" and no "beta" on any page.
- Brand names stay as they are. Each acronym is spelled out on its first use on a page.
- The words `fake`, `simulator` and `simulador` never appear in `apps/docs/**`. The scan covers every file under `apps/docs`, snippets included, with no exclusion.
- Examples use fictional names (Maria, Lisboa), never real owners or phone numbers.

### Failure handling

Docs do not fail at runtime. The failure modes are a broken link, a page that states a rung or delay that did not ship, a pt-BR page that drifted from its English twin, a wrong number, and a secret or code in an example. Each one is a test (plan and test plan) or a tester check.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|---|---|---|---|
| Which clients get a page? The order names Cursor and Gemini CLI. | build the nine without them · add them | added: Cursor and Gemini CLI are install clients with pages, rows in the matrix and entries in `InstallClient` (install-skills) | owner order 2026-11-06 |
| Grok: one page or two? | one · two | two: Grok Bot and Grok web, matching install-skills' clients and rungs | owner delegated 2026-11-06 |
| Where do per-client pages live? | `install/` and `connect/` as their slices planned · `agents/` and `developers/` | `agents/` and `developers/`; other slices write their English pages at those paths where they can | owner delegated 2026-11-06 |
| Background running (launchd, systemd) for the connector: where? | `connect/` · `developers/` | `developers/background-running`, linked from the Claude Code and Codex pages | owner delegated 2026-11-06 |
| Self-hosting and local-stack pages on Mintlify? | yes · no | no: runbooks live in the repository (ADR 0026); the simulation is never named on a public page | owner delegated 2026-11-06 |
| Does Mintlify pick the language from the browser? | rely on it · custom redirect · switcher only | spike first (G8). Fallback: the switcher only; no custom redirect | owner delegated 2026-11-06 |
| The official number | none in the specs · owner supplies it | the sentinel until the owner supplies the digits at deploy; the deploy-readiness preflight refuses deploys while it is the sentinel | owner delegated 2026-11-06 |
| Command names for the connector: `npx zapbip connect` (local-connector) or `listen` and `channel` (cross-slice, install-skills) | pick one now · use what the merged package prints | the docs use what `npx zapbip --help` prints on the merged branch; the facts check runs on each command a page shows | owner delegated 2026-11-06 |
| Does the docs site repeat the AI-facing install instructions? | copy them · link | the docs explain the flow and show the one- or two-line prompt; the full instructions stay at `/i/<install-code>`, served by the Worker | owner delegated 2026-11-06 |
| What happens on the waitlist (`WAITLIST_ENABLED`)? | hide it · document it · drop the FAQ entry | document it: the FAQ has the question "What if my account is on the waitlist?", answered with the first step the person takes next and what the waitlist means; a FAQ box in the plan and the test plan checks it | owner delegated 2026-11-06 |
| Playwright as a dev dependency of the docs walk | none · owner delegated | owner delegated 2026-11-06: `@playwright/test` `1.65.0` exact (`npm view`, latest stable on 2026-11-06, not installed here). The browser check is the existing `check_chromium` in `.agents/hooks/doctor.sh`, whose fix is `pnpm exec playwright install chromium`; no new doctor check is added | owner delegated 2026-11-06 |
| ADR number for the audience and language rules | reuse 0010 · new | new ADR 0030, reserved, written with the first docs commit | owner delegated 2026-11-06 |
| Cursor and Gemini CLI listen rung | Grok Bot's rung · Local | Local (`npx zapbip listen` in a background terminal), contingent on install-skills separating them from Grok Bot | owner delegated 2026-11-06 |
| Rung of any MCP client | depends on the client · Inbox | Inbox: the owner's messages wait until the agent calls `check_inbox` | owner delegated 2026-11-06 |
| Official number while unset | block the build · sentinel | sentinel `OFFICIAL_NUMBER_UNSET` (cross-slice decision, 2026-11-06); the deploy-readiness preflight refuses deploys while it is set to the sentinel | owner delegated 2026-11-06 |

## Test strategy summary

- **Red first, per lane.** G0's structure tests are committed red before any page content. Each lane's walk spec is committed red on the lane branch and turns green before the lane merges.
- **Structure and copy tests** run in the `shape` gate (`tools/repository-shape`).
- **The docs gate runs the walk.** `gate_docs` runs `mint broken-links`, then `test:walk`. No new gate row is added: the walk specs sit under `apps/docs/`, which the existing `apps/docs/*` row already maps to the docs gate. G0 owns `scripts/verify.sh` and `scripts/verify.test.sh`.
- **From-zero walk** runs in an `en-US` and a `pt-BR` context at 1280 and 375 wide. It stops where WhatsApp begins, because the real number and the real AI clients cannot run in the gate.
- **Owner-run** checks with the real number and the real clients are listed in the test plan, outside the gate.
- The docs-lane exception in HARNESS §1 does not apply: the pages are followed step by step, so the full set runs (spec, plan, test plan, tester, reviewer). The security reviewer runs per HARNESS §6; the diff has no code path, so its expected verdict is NOT APPLICABLE or CLEAR.
