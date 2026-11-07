# Test plan: Install skills

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). A box marked `pin` is green on arrival by design: it pins behaviour that already holds, and the tester records it as a pin in `tester-briefing.md`.

Test areas are grouped so that separate tester sub-agents can run them in parallel: **Core unit**, **Worker integration**, **Security**, **Docs and parity**, **Prove it for real**, **Owner-run** (outside the gate), **Adversarial review**. Gated areas use no live client and no network to a third party. The install-code lifecycle tests live with `accounts-and-keys`; the cases that touch the page are listed here as **Worker integration**.

## The failing test first

Printed failures the red runs must show. Copy stubs throw with the constant's name, so a section test prints its copy constant, not the section function.

- [ ] `libs/core/src/install/prompts/codex.test.ts::renders the Codex section` (IS-U11) — input: `renderCodexSection({connectionLink: "https://x.example/c/zb_conn_FAKE/mcp", locale: OwnerLocale.EnglishUs, standbyAgent: null})`; expected printed: `Error: CODEX_COPY is not implemented`.
- [ ] `libs/core/src/install/pick-standby-agent.test.ts` (IS-U17) — expected printed: `Error: pickStandbyAgent is not implemented`.
- [ ] `libs/core/src/install/render-install-page.test.ts` (IS-U3) — expected printed: `Error: renderInstallPage is not implemented`.
- [ ] `apps/api/test/integration/install-page.test.ts` (IS-W3) — expected printed: `Error: createInstallPageHandler is not implemented`.
- [ ] `apps/api/test/unit/client-name.test.ts` (IS-W4 unit cases) — expected printed: `Error: readInitializeClientName is not implemented`.
- [ ] `apps/api/test/integration/mcp-install.test.ts` IS-W1 — expected printed: `AssertionError: expected undefined to deeply equal …` on the `instructions` field.
- [ ] Each red run's printed failure is copied into `tester-briefing.md`. A test whose red run prints nothing from the list above is a pin, and is labelled as one.

## Core unit

Runner: `pnpm --filter @zapbip/core test:unit` (Vitest). Snapshots use `toMatchFileSnapshot` under `libs/core/src/install/snapshots/`.

### Rules and constants

- [ ] `pin` IS-U1 rules content — input: `AGENT_RULES`; expected: exactly six lines, naming `check_inbox`, `ask` and `wait_for_reply`, `WhatsApp`, `sender "owner"` with `verified true`, `reply_to`, and the pending rule on line six (`pending` and `wait_for_reply`).
- [ ] `pin` IS-U2 rules carry no secret — input: `AGENT_RULES`; expected: the text does not contain `zb_conn_` or `zb_inst_`.
- [ ] `pin` IS-U24 self-test text per locale — input: `INSTALL_SELF_TEST_TEXT`; expected: `[OwnerLocale.PortugueseBrazil] === "✅ instalado"` and `[OwnerLocale.EnglishUs] === "✅ installed"`.

### Page frame and sections

- [ ] IS-U3 frame order — input: `renderInstallPage({agent: "Ana", connectionLink, locale: OwnerLocale.PortugueseBrazil, standbyAgent: null})`; expected: the headings for identify, rules, and the eight clients appear once each, in that order, and the self-test line is the last non-empty line.
- [ ] IS-U4 every client appears in enum order — input: the same call; expected: ten client headings whose order follows `Object.values(InstallClient)`.
- [ ] `pin` IS-U9 dispatch covers every client — input: `Object.values(InstallClient)`; expected: each value is a key of `INSTALL_SECTIONS`, and the record has exactly eight keys.
- [ ] `pin` IS-U10 copy covers every locale — input: each `*-copy.ts` record and `install-page-copy.ts`; expected: keys are exactly `Object.values(OwnerLocale)`.
- [ ] IS-U5 each section ends with the self-test — input: each `INSTALL_SECTIONS[client]({...})` for both locales; expected: the last non-empty line contains `INSTALL_SELF_TEST_TEXT[locale]`.
- [ ] IS-U6 each section names only its own product — input: each section; expected: the text contains that product's name and no other product's `set_wake` mode line.
- [ ] IS-U7 rendering twice is identical — input: the same call twice; expected: strings equal by `===`.
- [ ] IS-U8 the connection URL appears only where a section needs it — input: `connectionLink = "https://x.example/c/zb_conn_FAKE/mcp"`; expected: every occurrence of `zb_conn_FAKE` is inside `connectionLink`, and the Claude Code, Codex and web sections contain it exactly.
- [ ] IS-U22 unsupported product stop line — input: the frame for each locale; expected: the localized stop sentence names zapbip and the owner.

### One section per client

- [ ] IS-U11 Claude Code — input: `renderClaudeCodeSection({connectionLink, locale: OwnerLocale.EnglishUs, standbyAgent: null})`; expected: contains `claude mcp remove --scope user zapbip`, `claude mcp add --transport http --scope user zapbip <link>`, `~/.claude/skills/zapbip/SKILL.md`, `name: zapbip`, the skill body equal to `AGENT_RULES`, `ZAPBIP_CONNECTION_URL=<link> npx zapbip connect --client claude-code`, `set_wake({mode: "local"})`, and the fresh-process self-test `claude -p` with `--allowedTools=mcp__zapbip__send_message`.
- [ ] IS-U12 Codex — input: `renderCodexSection({…})`; expected: contains `[mcp_servers.zapbip]`, `url = "<link>"`, `tool_timeout_sec = 900`, `default_tools_approval_mode = "approve"`, the owner warning about unattended tools, `set_wake({mode: "local"})`, and the fresh-process `codex exec -c 'mcp_servers.zapbip.default_tools_approval_mode="approve"'`.
- [ ] IS-U26 Hermes and OpenClaw — input: each section for both locales; expected: each names only its own product, sets `set_wake({mode: "scheduled", interval_minutes: 1})`, names the `check_inbox` job that runs every minute, ends with the self-test, and marks unverified commands `(verify)`.
- [ ] IS-U27 Claude Code listen mode — input: the Claude Code section; expected: names the channel as primary, contains `npx zapbip listen` with Monitor as fallback, the re-arm instruction on the timeout notice, and the `claude -p --resume` wake line.
- [ ] IS-U28 Cursor and Gemini CLI — input: the Cursor and Gemini CLI sections for both locales; expected: each names only its own product in the stop check, adds the MCP server over HTTP with `<link>`, starts `npx zapbip listen` in a background terminal, sets `set_wake({mode: "local"})`, has no scheduled step, ends with the self-test.
- [ ] IS-U29 Grok Bot identity by wake setting — input: `pickStandbyAgent` with a `None` connection whose `clientName` is `Cursor/1.0.0` and a `Webhook` connection whose `clientName` is `Cursor/1.0.0`; expected: the webhook one is picked (Grok Bot setup), the `None` one never is (a Cursor install without a webhook is never a standby).
- [ ] IS-U30 Cursor client name is its own — input: `readInitializeClientName` on an `initialize` whose `clientInfo.name` is `Cursor`; expected: `"Cursor"` is returned and stored as-is; the page renders the Cursor section and no Grok Bot wording for it.
- [ ] IS-U13 Grok Bot — expected: contains `set_wake({mode: "webhook"`, the instruction to add the MCP server named `zapbip`, and the owner's confirmation step.
- [ ] IS-U14 claude.ai — expected: asks the owner for the connector paste and for the fire URL and token of an API-trigger task; contains `set_wake({mode: "webhook"`; contains the hourly `check_inbox` safety-net instruction; contains the stop-at-none branch.
- [ ] IS-U15 ChatGPT — expected: contains `developer mode`, `No authentication`, `Run on this computer`, `Always allow`, `set_wake({mode: "scheduled", interval_minutes: 60})`.
- [ ] IS-U16 Grok web — input: `standbyAgent: "Ana Bot"` and `null`; expected: `Ana Bot` gives `set_wake({mode: "standby", standby_agent: "Ana Bot"})`; `null` gives `set_wake({mode: "none"})`.
- [ ] IS-U18 standby name is JSON-escaped — input: `standbyAgent: 'Ana "Bot"\n'`; expected: the call argument is the JSON string `"Ana \"Bot\"\n"`, and no unescaped quote or newline sits inside the `set_wake` call.
- [ ] IS-U21 re-paste is idempotent — expected: the Claude Code section removes the `zapbip` MCP entry before the add; the Codex section replaces the table, never appends a second one.

### Standby

- [ ] IS-U17 `pickStandbyAgent` — input: candidates for a third agent: a revoked one (absent from the list), a `Standby` one, a `None` one, a webhook one created last, a local one older, a `Local` mode one whose `clientName` is `Cursor/1.0.0`, and the agent itself; expected: the newest eligible one; the self, standby and none ones never picked; `clientName` never decides; `null` when no candidate is eligible.
- [ ] IS-U17b tie keeps the first listed — input: two eligible candidates with the same `createdAt`; expected: the first listed is picked.

### Snapshots

- [ ] IS-U19 snapshots — input: each section for each locale, and Grok web with `standbyAgent: "Ana Bot"` in each locale (18 files); expected: `toMatchFileSnapshot` passes; each file read once in review.

## Worker integration

Runner: `pnpm --filter @zapbip/api test:integration` (`@cloudflare/vitest-pool-workers`). Each case uses a fake clock and the development entry.

### MCP instructions and prompt

- [ ] IS-W1 `initialize` returns instructions — input: `initialize` with a valid Bearer; expected: `result.instructions` equals `AGENT_RULES`.
- [ ] IS-W2 prompt `zapbip-rules` — input: `prompts/list`, then `prompts/get` with `zapbip-rules`; expected: the list includes it, and the text equals `AGENT_RULES`.

### The install page

- [ ] IS-W3 valid code renders the page — input: create a connection through the owner simulator in each locale (`novo agente`), then `GET /i/<code>` from the reply; expected: `200`, `Content-Type` starts with `text/markdown`, the body contains the connection URL and the localized self-test text of the owner's locale.
- [ ] IS-W5b page carries the rules — expected: the body contains `AGENT_RULES` verbatim.
- [ ] IS-W8 first MCP call invalidates the code — input: `GET /i/<code>` `200`, then one MCP `initialize` on the connection, then `GET /i/<code>` again; expected: `410` with the localized text of the account locale asking for `girar <name>` (`rotate <name>` in en_US), and the body has no `/c/` path.
- [ ] IS-W9 expired code is `410` without the link — input: advance the clock 30 min and 1 ms; expected: `410`, the localized text, no `/c/` path and no `zb_conn_` in the body.
- [ ] IS-W9b the page holds the link only within TTL — input: `GET` at 29 min 59 s, then at 30 min 1 s; expected: `200` with the link, then `410` without it.
- [ ] IS-W10 unknown code is `404` — input: `GET /i/zb_inst_` followed by 22 random characters; expected: `404`, plain text, no detail.
- [ ] IS-W11 rate limit — input: 31 `GET` requests from one client IP inside one minute; expected: the first 30 get their normal status, the 31st gets `429` with `Retry-After`, and the lookup is not run for it.
- [ ] IS-W12 standby is picked per request — input: a Grok Bot connection created after the install page was first fetched; a fresh `GET /i/<code>` for another connection; expected: the Grok web section shows `set_wake({mode: "standby", standby_agent: "<Grok Bot name>"})`.
- [ ] IS-W13 revoke clears the code — input: revoke the connection, then `GET /i/<code>`; expected: `404`.
- [ ] IS-W14 rotate replaces the code — input: rotate the connection, `GET` the old code, then `GET` the new one; expected: old code `404`; new code `200` with the new connection URL.
- [ ] IS-W15 suspended or deleting account — input: suspend the account, `GET /i/<code>`; expected: `404`.

### Client name

- [ ] IS-W4 first `initialize` records the name — input: `initialize` with `clientInfo.name = "Claude Code"`; expected: after the response, the connection's `clientName` is `Claude Code`.
- [ ] IS-W4b second `initialize` does not overwrite — input: a second `initialize` with `Codex`; expected: `clientName` stays `Claude Code`, and no write is issued.
- [ ] IS-W5 oversized or unlabelled body is not recorded — input: a body above `INITIALIZE_BODY_MAX_BYTES`, and a body without `Content-Length`; expected: the request succeeds and `clientName` stays `null`.
- [ ] IS-W6 bad body does not fail the request — input: body `not json`, a batch array, a name longer than `CLIENT_NAME_MAX_CHARS`; expected: `200` from the MCP route (the request is handled as before), no write.
- [ ] IS-W7 the write does not block the response — input: a gated `recordClientName`; expected: the `200` arrives before the gate opens; the write completes after it.

## Security

- [ ] IS-S1 code entropy — input: 1 000 generated codes; expected: each is `zb_inst_` plus 22 base64url characters that decode to 16 bytes; 128 bits, above the 64-bit floor; no duplicate in the set.
- [ ] IS-S2 `no-store` and `noindex` on every response — input: the page responses `200`, `410`, `404`, `429`; expected: each carries `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
- [ ] IS-S3 the store holds no plaintext — input: the connection row after create, read through the test database; expected: no column contains `zb_inst_` or `zb_conn_`; `install_code_digest` is 64 hex characters.
- [ ] IS-S4 the sealed secret opens only with the code — input: open the sealed value with a code that differs in one character; expected: the open fails (AES-GCM tag mismatch), no partial text returned.
- [ ] IS-S5 logs carry the route template — input: captured logs for a `200`, a `410` and a `404`; expected: the path appears only as `/i/:installCode`; no code, no secret, no digest.
- [ ] IS-S6 standby name cannot break out of a call — covered by IS-U18; repeated here in the integration run with a name from a seeded connection.

## Docs and parity

- [ ] IS-D1 ten guides in both languages — input: `apps/docs/agents/*.mdx` and the `/pt-BR/` twins; expected: sixteen files, one per client per language.
- [ ] IS-D2 guides mirror the sections — input: each guide and its section; expected: the same ordered step verbs and the same `set_wake` modes; the section and the guide differ only in prose.
- [ ] IS-D3 every guide ends with the self-test — expected: the last step of each guide names `send_message` and the English self-test text.
- [ ] IS-D4 navigation lists the ten guides — expected: `apps/docs/docs.json` `Agents` group has the ten client pages in both languages.
- [ ] IS-D5 `mint broken-links` green — expected: exit `0`.
- [ ] IS-D7 the owner-run script never prints the link — input: `tools/install-e2e/claude-code.sh` with the link as a fixture; expected: stdout and stderr contain no `zb_conn_` and no `/c/`.

## Prove it for real

- [ ] PR-1 the page on a phone and a desktop — input: `GET /i/<code>` for the development connection, opened with Playwright MCP at 375 and 1 280 wide; expected: the Markdown reads as plain text, with no horizontal scroll and no console error.
- [ ] PR-2 the ten guides — input: the ten guides at 375 and 1 280 wide in both languages with `mint dev`; expected: zero console errors, zero failed requests, screenshots saved under the scratchpad folder, paths recorded in the PR.

- [ ] IS-S10 a reply carrying an install link is sent with `preview_url: false` — input: `novo agente alpha` then `girar alpha` through the webhook; expected: both Graph text bodies containing `/i/` have `preview_url: false`; an agent message with a link keeps `true`.
- [ ] IS-S11 link-preview crawlers get `404` and consume nothing — input: `GET /i/<code>` with each of WhatsApp, facebookexternalhit, Slackbot, Twitterbot, Discordbot, TelegramBot, LinkedInBot; expected: `404`, no connection link in the body, the next browser request is `200`.
- [ ] IS-S12 hardening headers and transport — input: any page status; expected: `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`; over plain http with an https public origin: `404`.
- [ ] IS-S13 an IPv4-mapped IPv6 client keys as its IPv4 address — input: `::ffff:203.0.113.7` and `::ffff:cb00:7107`; expected: `203.0.113.7`.
- [ ] IS-S14 a refused or malformed MCP call does not consume the install code — input: a batch and non-JSON POST; expected: 4xx and `first_call_at` stays null.
- [ ] IS-S15 the OpenClaw section tells the owner, before the install command, what the plugin may do — input: the section in en_US and pt_BR; expected: the notice precedes `openclaw plugins install`.
- [ ] IS-S16 the Gemini CLI self-test has no `--yolo` — input: the section; expected: `gemini -p "` and no `--yolo`.
- [ ] IS-S17 `tools/install-e2e/claude-code.sh` refuses without `ZAPBIP_E2E_CLAUDE_CONFIG_DIR`, with a relative path, with `$HOME` or `$HOME/.claude`; every `claude` call runs with `CLAUDE_CONFIG_DIR` and `HOME` set to it.
- [ ] IS-S18 every `set_wake` mode named in any install section is accepted by the server schema — red on main until scheduled-wake merges, green after.

## Owner-run (outside the gate)

These spend the owner's subscriptions or touch the owner's real clients. The owner runs them and records the output in the PR. None is part of `pnpm verify`.

- [ ] OR-1 scripted real Claude Code install — input: `ZAPBIP_E2E_CLAUDE_CONFIG_DIR=<an empty directory the owner prepared and logged Claude Code into> tools/install-e2e/claude-code.sh` after the owner sends `novo agente` and pastes the two lines; expected: `claude mcp list` shows one `zapbip` line; `~/.claude/skills/zapbip/SKILL.md` exists with `name: zapbip`; the fresh `claude -p` self-test exits `0`; the owner receives `✅ installed` (or `✅ instalado` for pt_BR).
- [ ] OR-2 link used once, then rotate — input: OR-1 run again with the same link; expected: the page answers `410` with the localized text; the owner sends `girar <nome>`; the new link works; `claude mcp list` still shows one `zapbip` line.
- [ ] OR-3 real Codex — input: the Codex section pasted into Codex; expected: `~/.codex/config.toml` has one `[mcp_servers.zapbip]` table after a re-run; the fresh `codex exec` self-test exits `0`; the owner receives the self-test; after the owner restarts Codex, a zapbip tool call works.
- [ ] OR-4 real Grok Bot — input: the Grok Bot section; the owner confirms the MCP server; expected: a routine with a webhook trigger exists; `set_wake` returns success; the self-test arrives. A bot that declines the server makes the section stop and report.
- [ ] OR-5 real claude.ai — input: the owner pastes the connection URL as a connector, creates the API-trigger task and pastes the fire URL and token; expected: `set_wake` returns success; the self-test arrives; at task start the chat calls `check_inbox` (record yes or no).
- [ ] OR-6 real ChatGPT — input: developer mode, the app added with "No authentication", the hourly "Run on this computer" task with "Always allow"; expected: the scheduled `set_wake` returns success (once scheduled-wake merged); the next hourly run calls `check_inbox`; the self-test arrives.
- [ ] OR-7 real Grok web — input: the connector by URL, then the chat sets the standby; expected: `set_wake` standby returns success when an eligible connection exists, `set_wake none` otherwise.
- [ ] OR-9 real Hermes — input: the Hermes section; expected: rung 1 plugin or the fallback job runs; a WhatsApp message is read within one minute (fallback) or immediately (plugin); `set_wake` success; self-test arrives. Owner-run, outside the gate.
- [ ] OR-10 real OpenClaw — input: the OpenClaw section with the `stream` job; expected: the job starts `npx zapbip listen`; a message reaches the agent; the job survives five short runs; self-test arrives. Owner-run.
- [ ] OR-11 Claude Code listen — input: the owner sends a message while the session (launched with the channel flag) is open and idle; expected: the channel pushes the message and the session calls `check_inbox` and answers; the fallback Monitor path is run once with the timeout re-arm. Owner-run.
- [ ] OR-13 OpenClaw stream after Gateway restart (verify) — input: restart the Gateway with the `stream` job active; expected: the watcher restarts, or the section's check reports it stopped and the owner is told. E2E in the gate uses a fake Gateway restart where possible; the real restart is owner-run.
- [ ] OR-14 Hermes watch_patterns with no delivery target (verify) — input: `terminal(background=true, watch_patterns=…)` on `npx zapbip listen` in a gateway session with no delivery target; expected: the pattern fires mid-run for a message; owner-run.
- [ ] OR-15 Monitor idle token cost (verify) — input: a Monitor on `npx zapbip listen` left idle for 30 minutes; expected: the usage view shows no model tokens while idle; owner-run, figures recorded in the PR.
- [ ] OR-12 pending answer
- [ ] OR-8 misdetection — input: the Codex section read by Claude Code; expected: the stop check fires and nothing runs, so no self-test reaches the owner; if it runs, `clientName` shows the claimed name for the owner to compare.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: claude.ai and ChatGPT fetch the install page and follow it — attack: paste the two lines into a fresh claude.ai chat and ask it to quote the page's first step; expected: it fetches the URL and quotes the step; result: `held` or `refuted` with the transcript.
- [ ] Claim 2: the code cannot be used after the first MCP call, even when two calls race — attack: send `GET /i/<code>` and two `initialize` requests at once; expected: the page `200` may come from before the call, but the next `GET` is `410`; the sealed secret is absent after the first call; result: `held` or `refuted`.
- [ ] Claim 3: the standby is never a revoked, standby or none connection — attack: an account with a revoked connection, a standby-mode connection, a none-mode Grok Bot connection and a webhook connection created last; render for a third agent; expected: the revoked, standby and none ones are never picked, and the newest eligible one is; result: `held` or `refuted`.

## Coverage honesty

What is not tested and why.

- Real client behaviour beyond OR-1 to OR-8: clients change without notice and cannot run in the gate; the owner's manual runs record it.
- The wake rungs themselves (`set_wake` webhook, scheduled, standby, local): built and tested by webhook-wake, local-connector and scheduled-wake. The install tests check only the text of each call.
- Whether claude.ai and ChatGPT fetch a URL from a pasted message and follow the page: unmeasured (ADR 0020); OR-5 and adversarial claim 1 are the only evidence.
- Whether claude.ai and ChatGPT inject server `instructions` into the model: unmeasured (ADR 0021); the page's rules section is the second channel.
- The `npx zapbip` package: local-connector. A missing package fails at the owner's step, which the section tells the AI to report.
- Grok Bot's refusal to add an MCP server without confirmation: product behaviour, covered by OR-4.

## Notes from the integration pass (owner delegated 2026-11-06)

- Commit e9673b9 (`install-copy.test.ts`, the C1 to C6 cases) is red only at the import (`Cannot find module './wake-notes'`), not at each assertion; the tester judges red-first for those cases by the assertions in the fixing commit.
- C6 (the Codex 900 s timeout, the ChatGPT 60 minute interval, the 1 minute heartbeat) is a `pin`: the constants already held when the test landed.
