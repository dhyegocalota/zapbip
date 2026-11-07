# Test plan: User-first docs in two languages

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). A test that is green when it lands is labelled `pin` in its commit and its briefing row; a pin never stands in for a red-first box.

Test areas, so tester sub-agents run in parallel: **T1** structure and copy (vitest, `tools/repository-shape`), **T2** links and build (mint), **T3** lane walks (Playwright, run by `gate_docs`), **T4** from-zero walk and language (Playwright, run by `gate_docs`), **T5** prove it for real (Playwright MCP), **T6** owner-run (outside the gate).

Conventions used throughout:
- "The docs" are every file under `apps/docs/**` with extension `.mdx`, `.md`, `.json` or `.jsx`, snippets included, with no exclusion.
- A developer link is a link whose href starts with a prefix in `DOCS_DEVELOPER_LINK_PREFIXES` (plan, contract block).
- Twins: the pt-BR twin of `a/b` is `pt-br/a/b`. pt-BR links use `/pt-br/<path>`. The locale code `pt-BR` is never a URL segment.
- The official number is either the sentinel `OFFICIAL_NUMBER_UNSET` or digits only; the tests accept both.

## The failing test first

- [x] `tools/repository-shape/src/docs-experience.test.ts` — input: the G0 Step 2 commit; expected: the suite fails with `AssertionError` on missing pages and `Error: <helper> is not implemented`, not with an import or syntax error. — evidence: 7902adb red run, 28 failed with `<helper> is not implemented`, ENOENT on missing snippets and AssertionError on duplicated or unlisted pages, no import or syntax error (results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967))
- [x] Confirmed for the right reason: the failure text is recorded verbatim in `tester-briefing.md` — evidence: (red commit hash, log path). — evidence: the briefing table matches the observed failure text (results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967))
- [x] Each lane's red test is committed on the lane branch before its pages — input: the lane branch at its first commit; expected: the test fails on missing text or sections, not on a missing file the test could have created. — evidence: git log: get-started 04ebbf0, agents-a 32168d1, agents-b 206332c, features fa16fb2, help bb38227, developers 5636b6f, mcp-reference f084e7c, language a97c250 each precede their pages (results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967)); red-first of ac724bf (docsOptionsOf is not implemented) and 8e75a90 (verify.test.sh gate_docs order) also PASS
- [x] `install-guides.test.ts`, the local-connector and webhook-wake docs checks: these checks live on slices already merged to main, so their red-first evidence is read from main's history, not recreated here — expected: `git log origin/main -- tools/repository-shape/src/install-guides.test.ts` lists 60d4318 (`test(docs): pin the install guides`, a pin, labelled so), whose facts checks are the ones reconciled here; the local-connector pages arrive with 363546d and f4f3146 and the webhook-wake pages with 80d2123 and 528f103, with the red runs recorded in `docs/features/local-connector/test-plan.md` and `docs/features/webhook-wake/test-plan.md`. The accounts-and-keys docs checks are read the same way from that feature's test plan. — evidence: tester A marked this BLOCKED at f44e967 because the checks live on merged slices; reworded in c0a4223 to read their history from main (60d4318 a labelled pin; 363546d, f4f3146, 80d2123, 528f103; red runs in the local-connector and webhook-wake test plans), and the install-guides test itself is updated to the four headings in the merge 1d2e653

## T1 Structure and copy (vitest, `tools/repository-shape`)

Each test has one ID and one owner. "green in G0" means green at the end of G0 Step 9. A lane-owned test is red in G0 only where the content is missing; it turns green when the named lane merges. Tests with "guard" stay green in every lane; a lane that breaks one fails its own merge.

| ID | Test (`docs-experience.test.ts` unless noted) | Expected | Turns green in |
|---|---|---|---|
| T1-01 | `docs-navigation.test.ts::both languages are published, the default first` — **pin** | `['en', 'pt-BR']` as `DocsLanguage` values | G0 (Step 5) |
| T1-02 | `docs-navigation.test.ts::both languages have the same top-level shape` — **pin** | five groups in each language | G0 (Step 5) |
| T1-03 | `docs-navigation.test.ts::the default language groups are user-first and in order` — **pin** | `DOCS_GROUPS[en]` in order | G0 (Step 5) |
| T1-04 | `pt-BR group names are in the same order` | `DOCS_GROUPS[pt-BR]` in order | G0 (Step 5) |
| T1-05 | `docs-navigation.test.ts::every page listed for each language exists` — **pin** on feat/agent-inbox-core, re-run | `[]` missing files | G0 (Step 6) |
| T1-06 | `docs-navigation.test.ts::every default page has its twin` — **pin**, re-run | `[]` missing twins | G0 (Step 6) |
| T1-07 | `docs-navigation.test.ts::every translated page has its English twin` — **pin**, re-run | `[]` orphans | G0 (Step 6) |
| T1-08 | every `.mdx` under `apps/docs` is listed in `docs.json` exactly once | no unlisted or duplicated page | G0 (Step 5) |
| T1-09 | edge: a page listed twice (fixture) — input: duplicate path; expected: fails naming the path | fails | G0 (Step 4) |
| T1-10 | edge: a pt-br file with no English file (fixture) — input: `pt-br/features/x`; expected: fails naming `features/x` | fails | G0 (Step 4) |
| T1-11 | each `InstallClient` and `DocsOnlyClient` value has an agent page in both languages | `agentPagePathOf` gives an existing file for each; `[]` missing | G0 (Step 6) |
| T1-12 | `agents/supported-agents.mdx` matrix has exactly eleven rows, one per `DocsAgentClient` value | eleven distinct rows | G0 (Step 6) |
| T1-13 | `Cursor`, `GeminiCli` and `any-mcp-client` appear in the matrix, the navigation and the agent pages | each name present once per place | G0 (Step 6) |
| T1-14 | edge: an enum value with no page (fixture) — input: a new value; expected: fails naming it | fails | G0 (Step 4) |
| T1-15 | edge: an agent page with no matrix row (fixture) — input: `agents/x`; expected: fails naming `x` | fails | G0 (Step 4) |
| T1-16 | each agent page has `AGENT_PAGE_HEADINGS` in order, both languages | the four headings in order | G0 (Step 6, skeletons) |
| T1-17 | edge: headings out of order (fixture) — input: `setupFromZero` before `howItListens`; expected: fails with the page and the order | fails | G0 (Step 4) |
| T1-18 | edge: pt-br agent page with English headings (fixture) — input: `## What works`; expected: fails | fails | G0 (Step 4) |
| T1-19 | each How-it-listens section names its rung label (`WAKE_RUNG_LABELS[lang][CLIENT_LISTEN_FACTS[client].rung]`) | label present in every section | G2 and G3 (last to merge) |
| T1-20 | each How-it-listens section states the 50-second pending loop (`ASK_MAX_WAIT_SECONDS` and `LISTEN_STATEMENT_TOKENS[lang].pending`) | both present | G2 and G3 |
| T1-21 | each How-it-listens section states the re-call loop (`recallsUntilAnswered`) | present | G2 and G3 |
| T1-22 | each How-it-listens section states no time limit (`noTimeLimit`) | present | G2 and G3 |
| T1-23 | a client with `expectedDelaySeconds` not null states it (`String(expectedDelaySeconds)`; ChatGPT as "3600 seconds (hourly)") | present where non-null | G2 and G3 |
| T1-24 | Codex How-it-listens states the loop and no time limit; its 900 s tool timeout is named as a per-call bound | both tokens present; the word "tool timeout" appears | G2 |
| T1-25 | `any-mcp-client` How-it-listens states the loop and `check_inbox` | tokens and `check_inbox` present | G3 |
| T1-26 | Cursor and Gemini CLI How-it-listens name `npx zapbip listen` in a code block and "background terminal" (pt-BR: `terminal em segundo plano`) | present in both | G2 (Cursor) and G3 (Gemini CLI) |
| T1-27 | edge: a How-it-listens section with only the rung (fixture) — input: a section without tokens; expected: fails naming the page and the missing token | fails | G0 (Step 4) |
| T1-28 | developer boundary: no page under `features/`, `help/`, `get-started/`, `index` has a developer link; `agents/*` pages have no developer link except `/developers/any-mcp-client` on every agent page, and `/developers/background-running` on `agents/claude-code` and `agents/codex` (both languages) | `[]` violations | G0 (Step 6); guards every lane |
| T1-29 | edge: a feature page links `/mcp-reference/send-message` (fixture) — expected: fails naming the page and the href | fails | G0 (Step 4) |
| T1-30 | edge: an agent page links `/developers/any-mcp-client` and `/developers/local-connector` (fixture) — expected: fails (one footer link only) | fails | G0 (Step 4) |
| T1-30a | edge: fixture pair — `agents/codex` links `/developers/background-running` (passes); `agents/claude-ai` links `/developers/background-running` (fails: not an allowed page); `pt-br/agents/claude-code` links `/pt-br/developers/background-running` (passes) | the two passes and the one failure, exactly | G0 (Step 4) |
| T1-31 | edge: a pt-br feature page links `/pt-br/mcp-reference/send-message` (fixture) — expected: fails | fails | G0 (Step 4) |
| T1-32 | every example chat has at most `CHAT_MAX_MESSAGES` (4) messages | each block `<= 4` | G0 (Step 6); guards every lane |
| T1-33 | edge: a five-message chat (fixture) — expected: fails naming the page and line | fails | G0 (Step 4) |
| T1-34 | no page says "coming soon", "em breve" or "beta" (case-insensitive) | `[]` matches | G0 (Step 6); guards every lane |
| T1-35 | the words `fake`, `simulator` and `simulador` never appear in the docs (case-insensitive) | `[]` matches | G0 (Step 6); guards every lane |
| T1-36 | edge: `simulador` in `snippets/pt-br/install-prompt.mdx` (fixture) — expected: fails naming the file | fails | G0 (Step 4) |
| T1-37 | no real code or secret: no match of `zb_inst_[A-Za-z0-9]{8,}`; every `/c/` and `/i/` path in the docs shows a `<placeholder>` | `[]` matches | G0 (Step 6); guards every lane |
| T1-38 | each install-prompt snippet has at most `INSTALL_PROMPT_MAX_LINES` (2) lines (`linesOf`) | `<= 2` in both | G0 (Step 6) |
| T1-39 | install-prompt snippets equal the accounts-and-keys copy template rendered with `zb_inst_<code>` (en_US, pt_BR) — **facts test**, runs on the branch that contains `main`, with install-skills and accounts-and-keys merged | each snippet equals its rendered template | facts merge (not G0) |
| T1-40 | edge: a real-looking code in a snippet (fixture) — input: `zb_inst_AbC123xyz987`; expected: fails | fails | G0 (Step 4) |
| T1-41 | edge: the pt-BR install snippet identical to the English one (fixture) — expected: fails | fails | G0 (Step 4) |
| T1-42 | `snippets/official-number.mdx` contains `+${OFFICIAL_WHATSAPP_NUMBER}` and `https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}`; the value is `OFFICIAL_NUMBER_UNSET` or digits only | both present; value accepted | G0 (Step 6) |
| T1-43 | `snippets/pt-br/official-number.mdx` matches the constant in the same way as T1-42 | both present | G0 (Step 6) |
| T1-44 | edge: a snippet digit that differs from the constant (fixture) — input: snippet `+5511999990000` with constant `5511999990001`; expected: fails | fails | G0 (Step 4) |
| T1-45 | `help/privacy-and-security.mdx` (both languages) states `RETENTION_DAYS[Queue]` and `[Questions]` days for queued messages and questions, and `RETENTION_DAYS[Media]` for media (values 7, 7, 30) | the three figures present in both languages | G5 |
| T1-46 | edge: a typed media figure of 14 days (fixture) — expected: fails naming `30` | fails | G0 (Step 4) |
| T1-47 | `scripts/verify.test.sh`: `gate_docs` runs `broken-links` then `test:walk`, in that order; `apps/docs/e2e/x.spec.ts` maps to the docs gate through the existing `apps/docs/*` row | the order is pinned; the mapping holds | G0 (Step 8) |
| T1-48 | `.agents/hooks/hooks.test.sh`: the existing `check_chromium` is pinned (no new doctor check) — **pin** | existing pin green | pin (no lane) |
| T1-49 | registry: each `McpToolName` value (from `@zapbip/types`) has `mcp-reference/<name>` in both languages; no `mcp-reference` page lacks a value | the sets are equal | G7 |
| T1-50 | `docs-navigation.test.ts` uses `DocsLanguage` values and no string literal `'pt-BR'` or `'en'` | the file contains no such literal | G0 (Step 4) |

Counts: 51 IDs (T1-30a added). At the end of G0, 40 are green: 39 that G0 turns green (including T1-30a) plus T1-48, which is already a pin. G2 and G3 turn T1-19 to T1-26 green; G5 turns T1-45 green; G7 turns T1-49 green; the facts merge turns T1-39 green. That accounts for all 50.

## T2 Links and build (mint)

- [x] `pnpm --filter @zapbip/docs broken-links` — input: the whole site; expected: exit `0`, zero broken links, both languages. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): `success no broken links found`; run again in the merge verify at 2693044
- [x] Edge: a link to a page that does not exist — input: a throwaway `[x](/features/nope)`; expected: non-zero exit naming `features/nope`. The throwaway is never committed. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): `found 1 broken links: features/whatsapp-commands.mdx -> /features/nope` (en and pt-br), throwaway not committed
- [x] Edge: a pt-br page links to an English page — input: `pt-br/features/x.mdx` links `/features/y`; expected: broken-links passes only if `features/y` exists; the page must link `/pt-br/features/y` for the pt-BR page, and that link must resolve. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): an existing English target passes, a missing one fails
- [x] `pnpm --filter @zapbip/docs dev` boots — input: `mint dev` on any free port; expected: HTTP 200 on `/` and on `/pt-br/index`; no error line in the log. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): `/` 200 and `/pt-br/index` 200
- [x] `pnpm --filter @zapbip/docs typecheck` — input: `apps/docs/e2e/**` and the support file; expected: exit `0`. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): `tsc --noEmit` no output; typecheck green again in verify at 2693044

## T3 Lane walks (Playwright, run by `gate_docs`, `apps/docs/e2e/`)

Each lane spec runs in both projects (`en-US`, `pt-BR`). A lane merges into `feat/docs-experience` only when its spec is green.

- [x] `get-started.spec.ts::Overview shows why, the picture and the examples in that order` — steps: open `/`; expected: headings in order "why", "how it works", "examples"; the picture loads with status 200; no "coming soon". — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `get-started.spec.ts::Get started is one ordered list with the number and the prompt` — steps: open `/get-started/how-to-start`; expected: one `ol`; the number snippet and the prompt snippet are visible; the prompt is at most two lines. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `get-started.spec.ts::each Overview chat has at most four messages` — expected: each chat `<= 4` bubbles. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `agents-a.spec.ts::claude-code, codex, claude-ai, chatgpt, cursor show the four sections in order` — expected: four headings in order in the page language. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `agents-a.spec.ts::the matrix shows eleven rows, each linking to a page with status 200` — steps: open `/agents/supported-agents`; expected: 11 rows; each link returns 200. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `agents-a.spec.ts::claude-code shows the channel command` — expected: `--dangerously-load-development-channels server:zapbip-channel` in a code block. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223; channel name `server:zapbip-channel` confirmed again in results in SCRATCH/test-results/docs-experience/tester-delta.md (babb166) (item 7)
- [x] `agents-b.spec.ts::grok-bot, grok-web, hermes, openclaw, gemini-cli, any-mcp-client show the four sections in order` — expected: as above. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `agents-b.spec.ts::any-mcp-client links to /developers/any-mcp-client` — expected: the link present and returns 200. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `features.spec.ts::each feature page has at least one example chat` — expected: six pages, each with `>= 1` chat. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `features.spec.ts::send-messages-and-media names every MessageKind` — input: `MessageKind` values from `@zapbip/types`; expected: each value appears on the page. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `help.spec.ts::five help pages render in both languages` — expected: status 200 and a non-empty `h1` for `troubleshooting`, `faq`, `privacy-and-security`, `revoke-and-rotate-keys`, `delete-your-account`. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `help.spec.ts::the FAQ answers the waitlist question` — steps: open `/help/faq`; expected: the question "What if my account is on the waitlist?" is visible (pt-BR: its twin) and its answer names the waiting step and `ajuda`. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `developers.spec.ts::twelve developer pages exist in both languages` — expected: status 200 for the five `developers/` pages and the seven `concepts/` pages. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `mcp-reference.spec.ts::eleven tool pages exist in both languages` — expected: 22 pages with status 200 (the registry match is T1-49). — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223

## T4 From-zero walk and language (Playwright, run by `gate_docs`)

- [x] `from-zero.spec.ts::en-US walk from the Overview to the WhatsApp step` — steps: open `/`, follow "Get started", follow each numbered step to the number step, open every linked Agents page and check its four sections, follow every internal link; expected: no dead end; every link returns 200; the walk stops with the official number shown as `+<value>` and as a wa.me link. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `from-zero.spec.ts::pt-BR walk from the Overview to the WhatsApp step` — the same steps in the `pt-BR` project, starting at `/pt-br/index`; expected: the same, with pt-BR text throughout; only product names and commands are in English. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `from-zero.spec.ts::1280 and 375 wide` — steps: both walks at both widths; expected: `document.documentElement.scrollWidth <= window.innerWidth`. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `from-zero.spec.ts::console and network clean` — steps: both walks; expected: zero console errors and zero failed requests, other than the entries of the allowlist in `apps/docs/e2e/support/docs-experience.ts`, each with its reason. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `language.spec.ts::pt-BR browser locale opens the pt-BR Overview` — input: locale `pt-BR`; expected: the pt-BR Overview at `/pt-br/index` if Mintlify selects by browser language; otherwise the switcher is visible and the spike result is in the briefing. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] `language.spec.ts::en-US browser locale opens the English Overview` — expected: English Overview; the switcher lists both languages. — evidence: tester A red: `the switcher lists both languages` failed 3 of 3 reruns at f44e967 with `optionNames` equal to `[]` (allInnerTexts does not wait); fix c0a4223 (web-first `toHaveText`); three runs of language.spec.ts in a row at c0a4223 all green (4 passed, 13.6 to 15.7 s)
- [x] `language.spec.ts::switching language keeps the page` — input: `/features/whatsapp-commands` switched to pt-BR; expected: `/pt-br/features/whatsapp-commands`. — evidence: results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967): 191 passed, 1 failed, 168 skipped by project; the one failure fixed in c0a4223, language.spec.ts 3/3 green at c0a4223
- [x] Edge: a page containing a real-looking code (`zb_inst_AbC123xyz987`) — expected: T1-40 fails before the walk runs. — evidence: T1-40 is in the shape suite, green in every verify; the secret check also ran in verify at 2693044 (results in SCRATCH/test-results/docs-experience/tester-a.md (f44e967) mutation list shows the shape tests catch navigation and heading regressions)

## T5 Prove it for real (Playwright MCP, tester)

- [x] Happy path, en-US, entry to exit: open the Overview, read the why, follow Get started to the number, open `agents/claude-code`, read its four sections — expected: each step shows the section the spec names; no step needs knowledge the page did not give. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): PASS, shots overview-en-1280, how-to-start-en-1280, claude-code-en-1280; the stale `server:zapbip` row text fixed in c0a4223
- [x] Happy path, pt-BR, entry to exit: the same flow from `/pt-br/index` — expected: the same, in pt-BR, with commands and product names unchanged. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): PASS, shot claude-code-pt-br-1280
- [x] Empty: open `/help/faq` with no filter — expected: every question listed; none blank. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): 10 questions, 10 non-blank answers, shots faq-en-1280-*
- [x] Single: open `/features/whatsapp-commands` — expected: each of the six commands shown once, with its English word. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): six commands once each with EN and PT word, shot whatsapp-commands-en-1280
- [x] Many: open `/agents/supported-agents` — expected: eleven rows; on 375 wide the last row is reachable by scrolling. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): 11 rows, all links 200, last row reachable at 375, shot supported-agents-en-375-last-row
- [x] Rejected input: open `/nope` — expected: a 404 page in the site's language with a link back to the Overview. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223) FAIL (/pt-br/nope in English, no in-body Overview link); fixed in babb166 (docs.json errors.404, bilingual); results in SCRATCH/test-results/docs-experience/tester-delta.md (babb166) item 1 PASS; not-found.spec.ts green
- [x] Browser Back mid-flow: open an agent page from the matrix, press Back — expected: the matrix with its scroll position. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): matrix scrollY 500 restored after Back from /agents/cursor
- [x] Reload mid-flow: reload `/get-started/how-to-start` at step 3 — expected: the same page at the top; no error. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): same page, no error; the browser restores the scroll position instead of the top, which is browser behaviour and accepted
- [x] Two authors in two browser contexts: not applicable (read-only docs) — expected: stated as n/a in the briefing. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): n/a, read-only docs
- [x] Latency: slow 3G on the Overview — expected: text readable before the picture loads; the picture shows its alt text while loading. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223) FAIL (image at 0 height, alt not visible); fixed in babb166 (width, height, aspect-ratio); results in SCRATCH/test-results/docs-experience/tester-delta.md (babb166) item 2 PASS, height 486 px while unloaded, shots .pr-media/docs-experience/*-fixed.png
- [x] Console and network clean on every page visited — expected: zero console errors, zero failed requests. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223) FAIL (favicon ERR_BLOCKED_BY_ORB); fixed in babb166 (/favicon.svg); results in SCRATCH/test-results/docs-experience/tester-delta.md (babb166) items 3 and 4 PASS, 16 pages with 0 console errors and 0 failed requests
- [x] Desktop 1280 — expected: the card grid on the Overview; no horizontal scroll. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): two-column card grid, scrollWidth 1280, shot overview-en-1280
- [x] Narrow 375 — expected: one column, 20 px side gutter (Mintlify's --page-padding), no horizontal page scroll; chats wrap inside their card. — evidence: results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223) FAIL on the stated 16 px (it is 20 px, Mintlify --page-padding); row corrected in c0a4223; results in SCRATCH/test-results/docs-experience/tester-delta.md (babb166) item 7 PASS, h1 left edge 20 px, no horizontal scroll
- [x] Screenshots in `.pr-media/docs-experience/`, video at `.pr-media/docs-experience/walk.mp4` — expected: both exist and are non-empty. — evidence: screenshots in .pr-media/docs-experience/; the recorder uploaded docs-experience-walkthrough.mp4 and .gif to the pr-media-docs-experience release (MCP cannot write walk.mp4 here, so the video is the recorder's walkthrough instead)

## T6 Owner-run (outside the gate, real number and real clients)

These need the real number, real accounts and real AI apps. The owner runs them; the tester writes the result in the briefing. They never block the gate and stay open until the owner runs them. They run after the deploy preflight has accepted the number (deploy-readiness).

- [ ] Signup: message the official number with any text from a phone — expected: the reply matches the Get started text; the waitlist state matches `WAITLIST_ENABLED`.
- [ ] Install prompt, Claude Code: paste the prompt into Claude Code — expected: the AI reads `/i/<code>`, configures the channel as the page says, sends the self-test; the owner receives it on WhatsApp.
- [ ] Channel flag: start `claude --dangerously-load-development-channels server:zapbip-channel` — expected: an owner message reaches the open session without a new command.
- [ ] Codex: paste the prompt into Codex — expected: the self-test arrives; a message triggers `codex exec resume` (owner checks the log line).
- [ ] claude.ai: paste the connector, then the API-trigger task — expected: a message is answered within the page's stated 16 s.
- [ ] ChatGPT: developer mode, app by URL, hourly "Run on this computer" task — expected: a message is answered within the hour.
- [ ] Grok Bot: routine with the webhook trigger — expected: the self-test arrives in the chat.
- [ ] Grok web: connector with a standby Grok Bot — expected: the standby answers, as the page says.
- [ ] Cursor and Gemini CLI: `npx zapbip listen` in a background terminal — expected: an owner message reaches the agent, as the page says.
- [ ] Hermes and OpenClaw: the install section — expected: the plugin route or the fallback works; no `(verify)` remains on the page.
- [ ] Revoke and rotate: `revogar <nome>`, then `girar <nome>` — expected: the old link answers 401; the new prompt arrives once.
- [ ] Delete account: `apagar conta`, then `apagar conta definitivamente` — expected: the account is gone; the next message starts a new waitlist account, as `help/delete-your-account` says.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [x] Claim 1: pt-BR pages are native, not translated sentence by sentence — attack: compare each pt-BR page with its English twin; flag identical sentence structure and any English word outside product names and commands; result: refuted | held. — evidence: REFUTED (results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): English leftovers job, merge, Monitor); fixed in babb166 (tarefa, integrada, `Monitor` as a product term); results in SCRATCH/test-results/docs-experience/tester-delta.md (babb166) item 5 PASS; guarded by the shape test `the pt-br pages use no English job or merge`
- [x] Claim 2: every fact on the agent pages matches the merged code — attack: take each command, flag, delay and cap on the agent pages and find its source in the merged install copy, the local-connector CLI help or the platform note; result: refuted | held. — evidence: REFUTED, minor (results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): self-test prompts differed from the install copy); fixed in babb166; results in SCRATCH/test-results/docs-experience/tester-delta.md (babb166) item 6 PASS; guide-parity.test.ts now pins the self-test command per client and language
- [x] Claim 3: the docs never mention the test double — attack: grep the docs for `fake`, `simulat`, `mock`, `localhost` (only the dev command allowed), and read the Help and Developers pages for a local walkthrough; result: refuted | held. — evidence: HELD (results in SCRATCH/test-results/docs-experience/tester-b.md (c0a4223): rg finds no fake, simulat, mock, localhost, 127.0.0.1 or ngrok in the docs)

## Coverage honesty

- The real WhatsApp round trip, the real AI apps and the platform steps (connector paste, ChatGPT hourly task, claude.ai second paste) cannot run in the gate. They are T6. Risk accepted: a platform UI change breaks a page between owner runs; the facts tests and the pages' own `(verify)` marks narrow that.
- Mintlify's browser-language behaviour is spiked, not guaranteed. If it changes, the language test records the switcher as the fallback. Risk accepted: a reader may need one click to change language.
- The walk asserts structure, links, sections and chat counts, not prose quality. Prose is checked by T5 and the adversarial review.
- T1-39 (copy template) and the other facts tests need `main` to carry the other slices' code, so they run at the facts merge. Risk accepted: a copy change after the facts merge is caught only by the walk and T6.
- The official number is the sentinel until the owner supplies it. The site cannot ship with the sentinel: the deploy-readiness preflight refuses the Worker and docs deploy while it is set. Until then the number is visible in the docs as the sentinel and is not tested for correctness.
- Gemini CLI's rung depends on install-skills separating it from Grok Bot; until then the page keeps the Local rung and the briefing records the open point.
