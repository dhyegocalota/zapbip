# Tester briefing: User-first docs in two languages

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

### G0 contract (cut early from main, 2026-11-06; lanes G1 to G8 wait for install-skills and scheduled-wake)

- `libs/types/src/enums.ts`, `constants.ts` — `DocsLanguage`, `DocsOnlyClient`, `DocsRetentionKind`, `OFFICIAL_NUMBER_UNSET`, `OFFICIAL_WHATSAPP_NUMBER`, and a byte-identical copy of install-skills' `InstallClient` (the merge takes the identical hunk).
- `tools/repository-shape/src/docs-experience.ts` — the contract data and the helpers. Additions beyond the plan's list: `messageCountOf`, `missingListenTokens`, `developerLinkViolations`, `docsNavigationOf`, `navigationPagesOf`, `AGENT_PAGE_SECTIONS`. The contract uses `WakeRung.Scheduled` and `WakeRung.Standby` from `@zapbip/types`, now that scheduled-wake is on main.
- `tools/repository-shape/src/docs-experience.test.ts` — the T1 tests that are green in G0 and their fixtures. `docs-navigation.test.ts` reads `DocsLanguage` values and the shared navigation helpers. `docs-walk-support.test.ts` covers `docsOptionsOf`.
- `apps/docs/docs.json`, 36 skeleton pages, `snippets/install-prompt.mdx`, `snippets/official-number.mdx` (both languages), `agents/supported-agents` with the eleven-row matrix; `guides/webhook-wake` moved to `developers/webhook-wake`.
- Content edits the new guards forced on existing pages: the quickstart's install code is `zb_inst_<code>` and its chat is split in two (both languages); `send-messages-and-media` and `many-agents-on-one-number` split chats of more than four messages (both languages); `help/troubleshooting` no longer links `developers/errors`; `developers/webhook-wake` says "the routine headers" instead of "beta headers"; `set-wake` and `wake-ladder` link the new webhook-wake path.
- `apps/docs/package.json`, `tsconfig.json`, `playwright.config.ts`, `e2e/support/docs-experience.ts`; `@playwright/test` `1.65.0` exact; `pnpm-lock.yaml`.
- `scripts/verify.sh`, `scripts/verify.test.sh` — `gate_docs` runs `broken-links` then `test:walk`.

### G7 MCP reference (branch `feat/docs-experience-g7`)

- `libs/types/src/enums.ts` now holds `McpToolName`; `apps/api/src/contract/tool-definitions.ts` imports it from `@zapbip/types` and re-exports it so no other file in `apps/api` changes (`e9f5dd5`).
- `apps/docs/snippets/message-kinds.mdx` and its pt-br twin: the Kind column holds the `MessageKind` values in backticks (`choice` replaces "buttons and list", `audio` carries the `voice` note), and the row for quotes stays (`5b58b27`).
- `tools/repository-shape/src/docs-experience.test.ts`: `docs experience: mcp reference` (T1-49 registry in both languages plus two fixtures, and the message-kind coverage of both snippets). `apps/docs/e2e/mcp-reference.spec.ts`: six message-sending tool pages in both languages show a table with every kind.
- Red text at `f084e7c`: `TypeError: Cannot convert undefined or null to object` (`McpToolName` absent from `@zapbip/types`); `AssertionError: expected [ 'missing text', …(9) ] to deeply equal []` (snippets listed no kind value).
- Hypotheses: the registry test fails naming `missing`/`extra` pages when `accounts-and-keys` or `scheduled-wake` add a tool at the facts merge; the walk passes 24 of 24 in both browser locales.
- Gap: the eleven pages were not reworded beyond the tables, because their text already matched the tool contract; the facts merge should recheck the input tables against `mcp-schemas.ts`.

## How to run

```bash
pnpm --filter @zapbip/repository-shape test:unit
bash scripts/verify.test.sh
pnpm verify all
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `docs-experience.test.ts` (28 failing at `7902adb`) | `Error: agentPagePathOf is not implemented`, `twinPathOf`, `headingsOf` and the other stubs; `AssertionError: expected { duplicated: [ …(2) ], unlisted: [] } to deeply equal { duplicated: [], unlisted: [] }`; `AssertionError: expected 'import { existsSync } from …' not to match /['"](en\|pt-BR)['"]/` | helpers `0aafb88`, navigation `19e9271`, pages `b7d9a8f` |
| `docs-walk-support.test.ts::docsOptionsOf …` (4 tests) | `Error: docsOptionsOf is not implemented` (`ac724bf`) | `9d9c509` |
| `scripts/verify.test.sh::a docs site change checks the links, then runs the walk` | `FAIL … expected 'broken-links\ntest:walk', got 'broken-links'` (`8e75a90`) | `1eb0089` |

Pins (green when they landed): the fixture tests built on test-local validators and `the docs never name the test double`, in `7902adb`.

## Hypotheses for the tester

- Every page in `docs.json` exists in both languages and nothing is listed twice.
- `pnpm --filter @zapbip/docs broken-links` finds no broken link after the move of `guides/webhook-wake`.
- `pnpm --filter @zapbip/docs test:walk` passes with no specs.

## Gaps

- The agent pages are skeletons: four headings, no body. The walk, the listen tests (T1-19 to T1-26), the retention test (T1-45), the registry test (T1-49) and the copy facts test (T1-39) belong to the lanes.
- `McpToolName` lives in `apps/api/src/contract/tool-definitions.ts`; G7 moves it to `libs/types`.
- The official number is the sentinel; the sentinel is rendered by the snippets.

## G6 developers and concepts (branch `feat/docs-experience-g6`)

### What changed

- `apps/docs/e2e/developers.spec.ts`: per language, the twelve pages open with a title, a body and the Logic Bit footer; the local connector page names `--client`, `--cwd`, `--session` and `ZAPBIP_CONNECTION_URL`; background running names launchd, systemd and `600`; webhook wake states 5, 10, 20 and 40 seconds; the wake ladder lists every `WAKE_RUNG_LABELS` label and the delays 7, 6, 9 and 16; owner notices name both templates, the quick replies and the 5 minute / 6 hour retry; the channel page has its three sections and a table; each concept page links only to `concepts/`, `developers/` and `mcp-reference/`.
- `concepts/owner-notices` and `concepts/whatsapp-channel`: restored from `main` (the G0 skeletons had dropped them), with the template bodies, quick replies (`Open`/`Reply`, `Abrir`/`Responder`), a `Chat` example and the notice retry backoff (5 minutes doubling to 6 hours). `main`'s Portuguese table listed `Open` as the Portuguese quick reply of the question template; the page now matches `whatsapp-templates.ts`.
- `concepts/wake-ladder`: the five rungs with expected delays and the client per rung. `concepts/inbox`: the forwarded-message sentence is back.
- `developers/local-connector`: a Commands table (`connect`, `listen`, `channel`, as `apps/connector` help prints them) and the session id as a UUID. `developers/background-running` and `developers/webhook-wake`: developer wording, launchd and systemd named. Portuguese twins written natively.
- The moved-path reads from Step 33 have no test to update on this base: the local-connector and webhook-wake docs checks live on their slice branches.

### Red today, green after

| Test | Red before because | Green after |
|------|--------------------|-------------|
| `developers.spec.ts` (`5636b6f`: 8 failed, 42 passed) | `Expected substring: "zapbip_agent_notice"` / `Received string: "ConceptsOwner noticesThe notices zapbip sends you when an AI is not listening…"` (both languages); `expect(locator).toBeVisible() failed ... element(s) not found` (wake ladder rows and channel sections); `Expected substring: "launchd"` on background running | `b7dff7f`: 50 passed (the spec also gained `.first()` on the table locators, which matched two tables) |

### Hypotheses for the tester

- `pnpm --filter @zapbip/docs broken-links` reports no broken link; the shape tests (347) pass.
- Every number on the wake ladder equals `CLIENT_LISTEN_FACTS`; every template and quick-reply text equals `whatsapp-templates.ts`; the connector flags equal `apps/connector/src/cli.ts`.
- No page under `concepts/` or `developers/` names a simulator or a test double.

### Gaps

- The Scheduled and Standby rows, their `mode: scheduled` / `mode: standby` values and the 1 to 1440 minute interval come from the scheduled-wake branch (facts at the scheduled-wake merge).
- `concepts/questions` and `concepts/routing` were not reworded beyond the existing text; `developers/errors` and `developers/any-mcp-client` are unchanged.
- The Playwright Chromium for 1.65.0 (build 1254) was not installed; it was installed with `pnpm exec playwright install chromium`.

## G1 get started and overview (branch `feat/docs-experience-g1`)

### What changed

- `apps/docs/e2e/get-started.spec.ts`: per language, the Overview opens with the h2s why, how it works, examples in that order; the picture loads and its alt text is in the page language; three or four example chats, each at most `CHAT_MAX_MESSAGES`; Get started is one `ol`, shows the official-number link and the `zb_inst_<code>` prompt, and the footer names Logic Bit.
- `index.mdx` and `pt-br/index.mdx`: why, how it works (picture and three steps), four examples written natively (the deploy and photo cards dropped to stay within four), who it is for, links. The official number snippet and the statement that the owner can start conversations are on the page.
- `get-started/how-to-start.mdx` and twin: five numbered steps as a Markdown ordered list (`<Steps>` renders no `ol`): message the number, `new agent claude`, get the prompt, paste, first message `✅ installed`. The chats and the prompt wording follow the accounts-and-keys copy (`Created`, `NoAgents`, `renderInstallLines`) read from `origin/feat/accounts-and-keys`; the self-test line follows install-skills' `INSTALL_SELF_TEST_TEXT`.

## G4 features (branch `feat/docs-experience-g4`)

### What changed

- `apps/docs/e2e/features.spec.ts`: per language, the six feature pages open with at least one `<Chat>`; `send-messages-and-media` names every `MessageKind` value; `owner-starts-conversations` names the rungs, the delays 7, 6, 9 and 16 and shows the not-listening notice; `whatsapp-commands` lists every command word in both languages and states the reserved-names rule and the forwarded-message rule.
- `features/send-messages-and-media`: the list became a table of what the person sees against the kind. `features/owner-starts-conversations` (new): the owner writes first, the wake ladder in plain words, the not-listening notice, the closed-window notice (one template notice per closed window; zapbip's own notices take the same path). `features/whatsapp-commands` (new on this base): the command words in both languages side by side, the reserved-names rule, forwarded messages never run a command.
- `ask-with-buttons-and-lists`, `many-agents-on-one-number` and `the-24-hour-window` already read for the person and keep every conversation at four messages or fewer; unchanged. pt-BR twins are native.

## G5 help (branch `feat/docs-experience-g5`)

### What changed

- `apps/docs/e2e/help.spec.ts`: per language, the six help pages open with a title and the Logic Bit footer; privacy states the `RETENTION_DAYS` figures and Meta and Cloudflare; revoke and rotate names both words and says a rotated link is sent once; delete your account gives both phrases, what Meta and Cloudflare keep and the new waitlist account; the FAQ shows the waitlist question and its answer names the zapbip team and `help` (`ajuda`); no FAQ answer is blank.
- `tools/repository-shape/src/docs-experience.test.ts`: `docs experience: help` (T1-45, both languages).
- `help/privacy-and-security`, `revoke-and-rotate-keys`, `delete-your-account`, `faq`, `troubleshooting` and their `pt-br/` twins written natively. `about` is unchanged (it already renders `COMPANY` through the snippet, unset facts are not shown).
- Facts come from `origin/feat/accounts-and-keys` (`account-copy.ts`, its manage-your-agents and delete pages): the two deletion phrases and the 10 minute window, the reply texts shown in the chats, the 30 minute single-use link, the 8 AI limit, the name rules, and that a failed rotate keeps the old connection.

### Red today, green after

| Test | Red before because | Green after |
|------|--------------------|-------------|
| `get-started.spec.ts` (`04ebbf0`: 6 failed, 4 passed) | `Expected: 1 / Received: 0` on `locator('#content-area').locator('ol')`; `Expected: <= 4 / Received: 6` example chats; the h2 order was Why, What it looks like, How it works | `69b12de` (after the test fix `958576a`: the anchor adds a zero-width space to each h2, and the chats are awaited before counting) |

### Hypotheses for the tester

- The Overview and Get started in both languages reach the WhatsApp step with no dead end; `broken-links` reports none.
- The prompt on the page equals the accounts-and-keys install lines for `en_US` and `pt_BR` with `https://zapbip.com/i/zb_inst_<code>`.
- A first message of plain text on an account with no agent gets "No agent is connected. Your message is saved." (`InboxCopyKey.NoAgents`), unless the account is on the waitlist.

### Gaps

- Step 13 facts: T1-39 (snippets equal the copy template) is "facts at the accounts-and-keys and install-skills merge"; the constants are not on this branch, so the snippets were compared by hand only. The snippet files were not changed.
- The first-message reply in the quickstart chat is `NoAgents` from core; accounts-and-keys may send a welcome instead at the facts merge.
- The official number renders the sentinel `OFFICIAL_NUMBER_UNSET` until the owner supplies the digits.

| `features.spec.ts` (`fa16fb2`: 14 failed, 8 passed) | `Expected substring: "new agent"` / `Received string: "FeaturesWhatsApp commandsThe words you send to zapbip to manage your AIs..."`; `Expected substring: "connector"`; `expect(locator).toBeVisible() failed ... element(s) not found` | 027b395: 22 passed |

### Hypotheses for the tester

- Every command word on `whatsapp-commands` equals `COMMAND_WORDS` of accounts-and-keys (facts at the accounts-and-keys merge); the reserved-name and example replies equal its `account-copy.ts`.
- The not-listening and closed-window notice bubbles quote `INBOX_COPY` (the repository-shape notice test enforces it).
- The Scheduled and Standby rows of the wake table, and the "one template notice per closed window" wording, hold at the scheduled-wake and whatsapp-cloud-channel merges (facts at the scheduled-wake merge).

### Gaps

- The `forwarded messages never run a command` rule is stated from the cross-slice decision; the code that enforces it lands with accounts-and-keys.
- `help/delete-your-account` is a skeleton until G5; the link resolves.

| `docs-experience.test.ts` privacy page (2 tests, `bb38227`) | `questions: expected 7 days`, `queue: expected 7 days`, `media: expected 30 days` | the pages commit |
| `help.spec.ts` (`bb38227`: 8 failed, 14 passed; the render tests and the blank-answer test are pins) | `Expected pattern: /7\s+days/`; `getByText('What if my account is on the waitlist?') ... element(s) not found`; missing `Cloudflare` and `revoke` | the pages commit: 22 of 22 per language project |

### Hypotheses for the tester

- A person on the waitlist who reads the FAQ and troubleshooting knows to wait and to send `help` when access opens.
- Every command word on the help pages equals the accounts-and-keys copy (`revoke`, `rotate`, `delete account`, `delete account permanently`, `new agent`, and their Portuguese words).
- Every reply quoted in a chat on these pages equals the `AccountReplyIntent` copy.

### Gaps

- The accounts-and-keys docs checks (Step 27's second red) are not on this base: there is no test to move to `features/whatsapp-commands` and `help/delete-your-account`.
- Step 32 facts rows depending on accounts-and-keys constants not on this branch: facts at the accounts-and-keys merge (the `10 minutes`, `30 minutes` and `8` figures are typed from its copy and spec).
- Mintlify on port 3310 was held by another lane's server, so the spec ran against a scratch config on another port (deleted).

## G2 agents A (branch `feat/docs-experience-g2`)

### What changed

- `apps/docs/e2e/agents-a.spec.ts`: per language and per client of `claude-code`, `codex`, `claude-ai`, `chatgpt`, `cursor`: the four headings in order, at least one chat, the rung label, the delay from `CLIENT_LISTEN_FACTS` (skipped when none), `50`, and the `LISTEN_STATEMENT_TOKENS`; the Claude Code channel flag, the Codex `900` and "one call", the claude.ai hourly safety net, the Cursor `npx zapbip@<connector version> listen` (read from `apps/connector/package.json`), the background-running link on Claude Code and Codex; `supported-agents` has eleven rows, each linking its page.
- The five pages and `supported-agents`, in `apps/docs/agents/` and `apps/docs/pt-br/agents/`. English reworded from `origin/feat/install-skills`; the pt-BR twins are written natively. Setup shows the number, the `new agent <client>` chat, the install prompt snippet and the first-message chat.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `agents-a.spec.ts` (`32168d1`: 28 failed, 2 passed; the matrix row test is a pin) | `expect(locator).toBeVisible()` on `#content-area [role="group"][aria-label^="WhatsApp"]` (skeleton pages had no chat); `Expected substring: "claude --dangerously-load-development-channels server:zapbip-channel"` | pages `f7337ef` (30 passed) |

### Hypotheses for the tester

- Each page's How it listens states its rung label, its delay and the 50 second pending loop in the `LISTEN_STATEMENT_TOKENS` words, in both languages.
- Claude Code and Codex are the only agent pages linking `developers/background-running`; no agent page links another developer page.
- The quoted install prompt and the `new agent` replies equal the install copy and the accounts-and-keys copy.

### Gaps

- Claude Code's flag is `server:zapbip-channel` (install-skills copy, which registers the `zapbip-channel` server). The local-connector guide on its branch says `server:zapbip`. They disagree; the owner-run channel check decides, and the other page changes.
- `install-guides.test.ts` is not on this base. On `feat/install-skills` it demands exactly three sections per guide (IS-D1); these pages have four. At the facts merge that test changes to the four headings (the plan's path update) or it fails.
- Step 17 facts waiting on other merges: the pinned `npx zapbip@0.1.0 listen` (facts at the install-skills merge); the ChatGPT Scheduled wording and the `1 hour` row (facts at the scheduled-wake merge). Commands `connect --client`, `listen` and `channel` equal `apps/connector` help on this base.
- Mintlify was reached through `reuseExistingServer`; the walk ran on the configured port.

## G3 agents B (branch `feat/docs-experience-g3`)

### What changed

- `apps/docs/e2e/agents-b.spec.ts`: per language, the six pages show the four headings in order; each How-it-listens section holds its rung label, `50`, the three `LISTEN_STATEMENT_TOKENS` and the delay where `CLIENT_LISTEN_FACTS` gives one; Grok web names the Grok Bot stand-in and the 60 second cap; Gemini CLI shows `npx zapbip@0.1.0 listen` in a code block and the background terminal; Hermes and OpenClaw show the plugin command, `chmod 600` and `check_inbox`; any-mcp-client states `check_inbox` and links `/developers/any-mcp-client`.
- `apps/docs/agents/{grok-bot,grok-web,hermes,openclaw,gemini-cli,any-mcp-client}.mdx` and their `pt-br/agents/` twins: user-first pages, each with one footer link to `developers/any-mcp-client`.

### Red then green

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `agents-b.spec.ts` (`206332c`: 26 failed, 26 skipped for the other locale) | the four headings had no body; the heading assertion also compared the anchor's zero-width space, which the green commit strips | pages and spec fix in `c4d796a`: 26 of 26 |

### Hypotheses for the tester

- A person following any of the six pages ends with `✅ installed` (`✅ instalado`) on WhatsApp.
- `pip install zapbip-platform==0.1.0`, `openclaw plugins install @zapbip/openclaw-plugin@0.1.0 --force --accept-capabilities`, `chmod 600` and `npx zapbip@0.1.0 listen` match the hermes-openclaw and local-connector pages on main.
- The walk passes on its own port; port 3310 can be held by another lane's server serving that lane's pages (this lane ran on a scratch config, deleted).

### Gaps

- Grok Bot routine details, the Grok web connector and standby wording, and the 2 minute Grok Bot wait come from the install-skills pages: facts at the install-skills merge. The Standby rung label and the Grok web standby choice: facts at the scheduled-wake merge.
- Gemini CLI keeps Local with `npx zapbip@0.1.0 listen`; whether install-skills separated it from Grok Bot is an open point for the facts merge.
- The `(verify)` marks of hermes-openclaw are not carried: the pages state only the commands that main's pages state.
- The Hermes and OpenClaw environment variables and the OpenClaw capability list are summarised, not itemised, because the user pages name no developer detail.

## G8 walk and language (branch `feat/docs-experience-g8`)

### What changed

- `apps/docs/e2e/language.spec.ts`: the en-US and pt-BR browser locales both open the English Overview at `/` with the switcher visible; the switcher lists `English` and `Português (BR)`; switching on `/features/whatsapp-commands` lands on `/pt-br/features/whatsapp-commands`.
- `apps/docs/e2e/from-zero.spec.ts`: per language and per viewport (1280, 375): Overview, the How to start card, the five numbered steps with the number as `+<value>` and a wa.me link, Supported agents, every matrix link with its four headings in order, then every internal link seen on those pages returns below 400 with an `h1`, no 404 text, no horizontal overflow, and in pt-BR stays under `/pt-br`. Console errors, page errors, failed requests and responses of 400 or more fail the walk, except the allowlist in `apps/docs/e2e/support/docs-experience.ts`.
- `docs/adr/0030-...md` and its index row: the audience, information architecture and language rules.
- `apps/docs/pt-br/concepts/wake-ladder.mdx`, `apps/docs/pt-br/mcp-reference/set-wake.mdx`: headings `Agendada` and `Em espera`.

### Spike result (step 40)

`mint@4.2.1207 dev --client-version 0.0.4077`, Playwright contexts `en-US` and `pt-BR`: both open `/` in English with `<html lang="en">`; there is no redirect to `/pt-br/index`. The switcher is `#localization-select-trigger` with two `menuitem` entries and keeps the page. `/nope` renders "Page Not Found" in the English shell. Only `mint dev` was exercised; the hosted site is unverified. No redirect script is added.

### Red then green

| Test | State | Evidence |
|------|-------|----------|
| `language.spec.ts` pt-BR locale | red in `a97c250`: `Expected: "Por que o zapbip existe"  Received: "Why zapbip exists"`; rewritten to the spike result in `95ac40e` | the switcher tests are pins |
| `from-zero.spec.ts` | pin in `7a8b2a0`: all four walks green on landing | mutation: "How it listens" renamed on `agents/codex` fails with `/agents/codex`; a dead Overview link fails with `404` on `/features/the-24-hour-windows`; both restored |

### Hypotheses for the tester

- The walk, run against a clean `mint dev` on the port in `playwright.config.ts`, passes: 8 walk and language tests plus the other specs (192 passed, 168 skipped for the other locale on a scratch port 3311).
- The only allowlisted noise is the aborted `socket.io` live-reload polling request of `mint dev`.
- The pt-BR pagination "previous" link on How to start points to `/pt-br`, the pt-BR home; the walk accepts it.

### Gaps

- Port 3310 can be held by another lane's server serving that lane's pages; this lane ran on a scratch config on 3311, deleted before the commit, so `pnpm --filter @zapbip/docs test:walk` on 3310 was not run here.
- No page needed install-skills or deploy-readiness facts for the walk to pass.
- The pt-BR body prose of the wake ladder still says "reserva" and "agendado" as nouns; only the headings were asked for.
