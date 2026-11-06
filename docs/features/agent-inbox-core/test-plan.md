# Test plan: Agent inbox core

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Test areas, each runnable by its own tester sub-agent in parallel: **Core unit**, **Worker integration**, **E2E MCP client** (default in the `e2e` gate), **E2E Claude Code session** (opt-in, `ZAPBIP_CLAUDE_E2E=1`), **Docs links**, **Security checks**, **Production build**. A tester runs the areas it owns and never edits product code (HARNESS §5).

Notation: `CU-n` core unit, `WI-n` Worker integration, `E2E-n` MCP client, `CC-n` Claude Code, `DOC-n` docs, `SEC-n` security, `PB-n` production build. Error text is what the core or the edge produces; field names are wire names.

Fixtures: the owner phone `5511999990000` with agents `alpha` and `beta` (seeded), and a second account with phone `5511888880000` for isolation.

## The failing test first

Each red commit is a step of `plan.md`. The tester checks each red commit with `git log` and by running the named test on that commit in a throwaway worktree.

- [ ] S0.2 red `tools/repository-shape/src/delivery-docs.test.ts` — input: the tree before Step 0; expected: fails listing the missing `apps` and `libs` roots and the four missing READMEs.
- [ ] S1.1 red `scripts/verify.test.sh` gate pins — input: `apps/api/src/x.ts`, `libs/types/src/x.ts`, `apps/docs/docs.json`; expected: fails because `integration`, `e2e` and `docs` are not gates and the rows fall through to `apps/*`.
- [ ] S2.1 red `libs/core/src/inbox/*.test.ts` (rules and copy) — input: the cases below; expected: each fails with `<name> is not implemented`.
- [ ] S2.3 red `libs/core/src/inbox/use-cases/*.test.ts` — input: the use-case cases below; expected: each fails with `createInMemoryDependencies is not implemented` or `<use case> is not implemented`.
- [ ] S3.1 red `apps/api/test/unit/{signing,connection-secret,no-interpolated-sql}.test.ts` — input: the cases below; expected: each fails with `signLink is not implemented` or a missing generator.
- [ ] S3.3 red `apps/api/test/integration/{d1-directory,d1-message-index,sqlite-repository}.test.ts` — input: the seeded rows; expected: each fails with `<method> is not implemented`.
- [ ] S3.5 red `apps/api/test/integration/account-inbox.test.ts` — input: the Durable Object cases; expected: each fails with `<method> is not implemented`.
- [ ] S3.7 red `apps/api/test/integration/dev-seed.test.ts` — input: the seed run; expected: fails with `not implemented`.
- [ ] S4.1 red `apps/api/test/integration/mcp-auth.test.ts` — input: the secret cases; expected: `expected 401, received 500` (the route stub throws).
- [ ] S4.3 red `apps/api/test/integration/mcp-tools.test.ts` and `mcp-inline-images.test.ts` — input: each tool call; expected: each returns an MCP tool error containing `<use case> is not implemented`.
- [ ] S5.1 red `apps/api/test/integration/upload-route.test.ts` — input: a valid PUT; expected: `expected 201, received 500`.
- [ ] S5.3 red `apps/api/test/integration/media-route.test.ts` — input: a valid signed link; expected: `expected 200, received 500`.
- [ ] S5.5 red `apps/api/test/integration/dev-owner.test.ts` — input: a text owner message; expected: `expected 200, received 500`.
- [ ] S5.9 red `apps/api/test/e2e/mcp-client.e2e.test.ts` — input: the first tool call after `globalSetup`; expected: fails at the tool call with `<use case> is not implemented`, not at `wrangler dev` startup.
- [ ] S6.1 red `apps/docs` `mint broken-links` — input: `index.mdx`; expected: one broken link, to `mcp-reference/send-message`.
- [ ] Pins, labelled `pin` and not counted as red: S5.7 (`production-entry.test.ts`), S5.8 (`production-bundle.e2e.test.ts`).
- [ ] Confirmed each red run failed for the right reason: the failure text in each lane's `tester-briefing.md` section matches the text above.

## Core unit

Runner: `pnpm --filter @zapbip/core test:unit` (Vitest 5.0.5). Ports are the in-memory adapters of `libs/core/src/inbox/testing/in-memory.ts`. Time comes from the fake clock.

### Validation (`validation.test.ts`)

- [ ] CU-1 `normalizeText` — input: `"  olá   mundo \n"`; expected: `"olá mundo"`.
- [ ] CU-2 `normalizeText` NFC — input: `"é"`; expected: `"é"`, one code point.
- [ ] CU-3 `assertMaxChars` text at the limit — input: 4096 times `a`, field `text`; expected: no throw.
- [ ] CU-4 `assertMaxChars` text over the limit — input: 4097 times `a`, field `text`; expected: `InboxError` `invalid_input`, message `text: must be at most 4096 characters`.
- [ ] CU-5 `assertMaxChars` counts code points — input: 4096 times `😀` (8192 UTF-16 units), field `text`; expected: no throw.
- [ ] CU-6 `assertMaxChars` empty after trim — input: `"   "`, field `text`; expected: `invalid_input`, message `text: must not be empty`.
- [ ] CU-7 caption at the limit — input: 1024 times `c`, field `caption`; expected: no throw.
- [ ] CU-8 caption over the limit — input: 1025 times `c`, field `caption`; expected: message `caption: must be at most 1024 characters`.
- [ ] CU-9 question over the limit — input: 1025 times `q`, field `question`; expected: message `question: must be at most 1024 characters`.
- [ ] CU-10 `parseOptions` one option — input: `["Sim"]`; expected: `render` `buttons`, `titles` `["Sim"]`.
- [ ] CU-11 `parseOptions` no options — input: `[]`; expected: message `options: must have 1 to 10 entries`.
- [ ] CU-12 `parseOptions` eleven options — input: 11 titles; expected: message `options: must have 1 to 10 entries`.
- [ ] CU-13 `parseOptions` three buttons at the title limit — input: three titles of 20 characters; expected: `render` `buttons`, no throw.
- [ ] CU-14 `parseOptions` button title over the limit — input: three titles, the first 21 characters; expected: message `options[0]: button title must be at most 20 characters`.
- [ ] CU-15 `parseOptions` four options become a list — input: four titles of 24 characters; expected: `render` `list`, no throw.
- [ ] CU-16 `parseOptions` list row over the limit — input: four titles, the second 25 characters; expected: message `options[1]: list row title must be at most 24 characters`.
- [ ] CU-17 `parseOptions` four options with a 21-character title — input: four titles, the first 21 characters; expected: `render` `list`, no throw.
- [ ] CU-18 `parseTimeoutMs` at the minimum — input: `{seconds: 1}`; expected: `1000`.
- [ ] CU-19 `parseTimeoutMs` at the maximum — input: `{seconds: 50}`; expected: `50000`.
- [ ] CU-20 `parseTimeoutMs` below the minimum — input: `{seconds: 0}`; expected: message `timeout_seconds: must be between 1 and 50`.
- [ ] CU-21 `parseTimeoutMs` above the maximum — input: `{seconds: 51}`; expected: the same message as CU-20.
- [ ] CU-22 `parseEmoji` empty — input: `""`; expected: `null`.
- [ ] CU-23 `parseEmoji` one emoji — input: `"👍"`; expected: `"👍"`.
- [ ] CU-24 `parseEmoji` one grapheme of two code points — input: `"👍🏽"`; expected: `"👍🏽"`.
- [ ] CU-25 `parseEmoji` two emoji — input: `"👍👍"`; expected: message `emoji: must be one emoji`.
- [ ] CU-26 `parseEmoji` a letter — input: `"a"`; expected: message `emoji: must be one emoji`.
- [ ] CU-27 `assertHttpsLink` https — input: `"https://example.com/a.pdf"`; expected: no throw.
- [ ] CU-28 `assertHttpsLink` http — input: `"http://example.com/a.pdf"`; expected: message `link: must be an https URL`.
- [ ] CU-29 `assertHttpsLink` other scheme — input: `"ftp://example.com/a.pdf"`; expected: the same message as CU-28.
- [ ] CU-30 `assertMediaFits` image at the limit — input: `image`, `image/jpeg`, 5000000 bytes; expected: no throw.
- [ ] CU-31 `assertMediaFits` image over the limit — input: `image`, `image/jpeg`, 5000001 bytes; expected: message `size_bytes: image must be at most 5000000 bytes`.
- [ ] CU-32 `assertMediaFits` image with a video type — input: `image`, `video/mp4`; expected: message `mime_type: image must be an image/* type`.
- [ ] CU-33 `assertMediaFits` audio with a video type — input: `audio`, `video/mp4`; expected: message `mime_type: audio must be an audio/* type`.
- [ ] CU-34 `assertMediaFits` voice note on an audio type — input: `audio`, `audio/ogg`, voice `true`; expected: no throw.
- [ ] CU-35 `assertMediaFits` voice flag on a video — input: `video`, voice `true`; expected: message `voice: only audio can be a voice note`.
- [ ] CU-36 `assertMediaFits` sticker webp at the limit — input: `sticker`, `image/webp`, 100000 bytes; expected: no throw.
- [ ] CU-37 `assertMediaFits` sticker over the limit — input: `sticker`, `image/webp`, 100001 bytes; expected: message `size_bytes: sticker must be at most 100000 bytes`.
- [ ] CU-38 `assertMediaFits` sticker as png — input: `sticker`, `image/png`, 1000 bytes; expected: message `mime_type: sticker must be image/webp`.
- [ ] CU-39 `assertMediaFits` document at the limit — input: `document`, `application/pdf`, 100000000 bytes; expected: no throw.
- [ ] CU-40 `assertMediaFits` document over the limit — input: `document`, `application/pdf`, 100000001 bytes; expected: message `size_bytes: document must be at most 100000000 bytes`.
- [ ] CU-41 `assertMediaFits` link source with unknown type and size — input: `document`, `null`, `null`; expected: no throw.
- [ ] CU-42 `assertUploadDeclaration` one byte — input: `application/pdf`, 1 byte; expected: no throw.
- [ ] CU-43 `assertUploadDeclaration` zero bytes — input: `application/pdf`, 0 bytes; expected: message `size_bytes: must be at least 1`.
- [ ] CU-44 `assertUploadDeclaration` empty type — input: `""`, 10 bytes; expected: message `mime_type: must be at least 3 characters`.
- [ ] CU-45 `assertUploadDeclaration` type over 127 characters — input: 128 characters, 10 bytes; expected: message `mime_type: must be at most 127 characters`.
- [ ] CU-46 `parseAgentName` valid — input: `"claude-code"`; expected: `"claude-code"`.
- [ ] CU-47 `parseAgentName` upper case — input: `"Claude"`; expected: message `agent: must match ^[a-z0-9][a-z0-9-]{0,19}$`.
- [ ] CU-48 `parseAgentName` leading hyphen — input: `"-x"`; expected: the same message as CU-47.
- [ ] CU-49 `parseAgentName` at 20 characters — input: `"a"` followed by 19 `b`; expected: accepted.
- [ ] CU-50 `parseAgentName` at 21 characters — input: `"a"` followed by 20 `b`; expected: the same message as CU-47.
- [ ] CU-51 `parseOptionDescriptions` list row description over 72 characters — input: a 73-character description; expected: message `options[0]: description must be at most 72 characters`.

### Option ids and keys (`option-id.test.ts`, `question-key.test.ts`)

- [ ] CU-52 `formatOptionId` — input: `qst_1`, index `0`; expected: `"qst_1:0"`.
- [ ] CU-53 `parseOptionId` round trip — input: `"qst_1:2"`; expected: `{questionId: "qst_1", optionIndex: 2}`.
- [ ] CU-54 `parseOptionId` without an index — input: `"qst_1"`; expected: `null`.
- [ ] CU-55 `parseOptionId` non-numeric index — input: `"qst_1:x"`; expected: `null`.
- [ ] CU-56 `formatRouteOptionId` — input: message `msg_1`, agent `beta`; expected: `"route:msg_1:beta"`.
- [ ] CU-57 `parseRouteOptionId` round trip — input: `"route:msg_1:beta"`; expected: `{messageId: "msg_1", agent: "beta"}`.
- [ ] CU-58 `parseRouteOptionId` wrong prefix — input: `"qst_1:0"`; expected: `null`.
- [ ] CU-59 `buildQuestionKey` same question, different case and spacing — input: agent `alpha`, `"Deploy?"` and `" deploy?  "`, same options; expected: equal keys.
- [ ] CU-60 `buildQuestionKey` different agent — input: `alpha` and `beta`, same text and options; expected: different keys.
- [ ] CU-61 `buildQuestionKey` reordered options — input: `["Sim", "Não"]` and `["Não", "Sim"]`; expected: different keys.

### Window (`window.test.ts`)

- [ ] CU-62 never a message from the owner — input: `lastOwnerMessageAt: null`, now `0`; expected: closed.
- [ ] CU-63 one millisecond after the last message — input: last `T`, now `T + 1`; expected: open.
- [ ] CU-64 one millisecond before the closing boundary — input: last `T`, now `T + WINDOW_MS - WINDOW_SAFETY_MARGIN_MS - 1`; expected: open.
- [ ] CU-65 exactly at the closing boundary — input: last `T`, now `T + WINDOW_MS - WINDOW_SAFETY_MARGIN_MS`; expected: closed (strict).
- [ ] CU-66 long after the last message — input: last `T`, now `T + 2 * WINDOW_MS`; expected: closed.

### Routing (`routing.test.ts`)

- [ ] CU-67 rule 1 is applied by the caller, not `routeOwnerMessage` — input: a button reply with an option id; expected: `routeOwnerMessage` is not called for it (asserted by the receive use case, CU-132).
- [ ] CU-68 rule 2 quoted reply to an agent message — input: text `"ok"`, `referencedMessage` sent by `alpha`; expected: rule `quoted_or_reaction`, agent `alpha`, no answered question.
- [ ] CU-69 rule 2 reaction to an open prompt — input: text `null`, `referencedMessage` the prompt of open question `qst_1` of `alpha`, `referencedQuestion` `qst_1`; expected: rule `quoted_or_reaction`, agent `alpha`, `answersQuestionId` `qst_1`.
- [ ] CU-70 rule 2 quoted held message — input: `referencedMessage` with agent `null`, text `"oi"`, one agent `beta`, no questions, `routingListOpen` false; expected: not rule 2; resolved by rule 5 or 6.
- [ ] CU-71 rule 3 mention — input: text `"@beta faça X"`, agents `[alpha, beta]`; expected: rule `agent_mention`, agent `beta`, `textForAgent` `"faça X"`.
- [ ] CU-72 rule 3 unknown mention — input: text `"@ghost oi"`, agents `[alpha]`; expected: not rule 3; resolved by rules 4 to 6.
- [ ] CU-73 rule 3 without the trailing space — input: text `"@beta"`, agents `[beta]`; expected: not rule 3.
- [ ] CU-74 rule 4 one agent with one open question — input: text `"sim"`, open `[qst_1 of alpha]`, agents `[alpha, beta]`; expected: rule `open_question`, agent `alpha`, `answersQuestionId` `qst_1`.
- [ ] CU-75 rule 4 two agents with open questions, newest wins — input: open questions newest first `[qst_2 of beta, qst_1 of alpha]`; expected: agent `beta`, `answersQuestionId` `qst_2`. (Review Focus 1.)
- [ ] CU-76 rule 4 one agent with two open questions — input: `[qst_3 of alpha, qst_1 of alpha]`; expected: agent `alpha`, `answersQuestionId` `qst_3`.
- [ ] CU-77 mention beats an open question — input: text `"@beta oi"`, open `[qst_1 of alpha]`; expected: agent `beta`, `answersQuestionId` `null`.
- [ ] CU-78 mention answers the mentioned agent's newest open question — input: text `"@alpha sim"`, open `[qst_1 of alpha]`; expected: agent `alpha`, `answersQuestionId` `qst_1`, `textForAgent` `"sim"`.
- [ ] CU-79 rule 5 recent agent — input: no open questions, `lastAgentWrite` `gamma`; expected: rule `recent_agent`, agent `gamma`.
- [ ] CU-80 rule 6 with agents and no open list — input: no open questions, `lastAgentWrite` `null`, agents `[alpha, beta]`, `routingListOpen` false; expected: rule `ask_owner`, agent `null`, `sendsRoutingList` `true`.
- [ ] CU-81 rule 6 with a list already open — input: as CU-80 with `routingListOpen` true; expected: rule `ask_owner`, agent `null`, `sendsRoutingList` `false` (the message joins the held ones, A22).
- [ ] CU-82 rule 6 with zero agents — input: all empty; expected: rule `ask_owner`, agent `null`, `sendsRoutingList` `false` (the caller sends the no-agents notice).
- [ ] CU-83 media does not answer — input: text `null`, no reference, open `[qst_1 of alpha]`; expected: rule `open_question`, agent `alpha`, `answersQuestionId` `null` (A17).

### Waiters (`waiters.test.ts`)

- [ ] CU-84 agent message wakes the waiter before the timeout — input: `awaitAgentMessage` 5000 ms; `resolveAgentMessage` at 1000 ms; expected: the promise resolves at 1000 ms.
- [ ] CU-85 timeout resolves and removes the waiter — input: `awaitAgentMessage` 5000 ms, advance 5000 ms; expected: resolves, and `hasLiveWaiter` is `false`.
- [ ] CU-86 live waiter for a pending question — input: `awaitQuestionAnswer` for `alpha`; expected: `hasLiveWaiter({agent: alpha})` `true`; after `resolveQuestionAnswer` `false`.
- [ ] CU-87 resolving a question nobody awaits — input: `resolveQuestionAnswer` for `qst_9`; expected: no throw.
- [ ] CU-88 two waiters on one agent — input: two `awaitAgentMessage` for `alpha`, one `resolveAgentMessage`; expected: both resolve.

### Copy (`inbox-copy.test.ts`)

- [ ] CU-89 (pin: green when it lands, because the copy table is complete in Step 0) every key in both locales — input: each `InboxCopyKey` and each `OwnerLocale`; expected: a non-empty string for each pair.
- [ ] CU-90 `renderCopy` fills a token — input: `AgentNotListening`, `pt_BR`, `{agent: "alpha"}`; expected: `"O agente alpha não está ouvindo agora. Sua mensagem espera no inbox."`.
- [ ] CU-91 `renderCopy` with a missing token — input: `AgentNotListening`, `en_US`, `{}`; expected: `invalid_input`, message `copy: missing value for agent`.
- [ ] CU-92 `renderCopy` in English — input: `NoticeQuickReply`, `en_US`; expected: `"Open"`.

### Use cases (`libs/core/src/inbox/use-cases/*.test.ts`, in-memory dependencies, window open unless stated)

- [ ] CU-93 `sendText` inside the window — input: `"oi"`, agent `alpha`; expected: `delivery` `sent`; the sender's `session` called once with a `text` message; the stored message `delivery` `sent`.
- [ ] CU-94 two concurrent sends outside the window produce one notice — input: window closed, two `sendText` started together, the template sender delayed; expected: `template` called exactly once; both messages `queued`; `noticeSentForClosedWindow` saved as `true` before the template call completes, through the atomic `InboxRepository.claimNotice()`: of two concurrent callers exactly one gets `true`. (Review finding 15.)
- [ ] CU-95 `sendText` outside the window — input: last owner message `WINDOW_MS` ago; expected: `queued`; `session` not called; one `template` call of kind `notice`, locale of the connection, parameters `[alpha, <preview>]`.
- [ ] CU-96 second queued message in the same closed window — input: two sends while closed; expected: exactly one `template` call in total.
- [ ] CU-97 a new closed window sends a new notice — input: owner message, window closes, two sends; expected: one `template` after the owner message closes the window again.
- [ ] CU-98 notice preview sanitised — input: text with a newline and 100 characters; expected: preview with no newline, at most 60 characters.
- [ ] CU-99 send failure is never reported as sent — input: sender `session` throws; expected: stored `delivery` `failed`; `InboxError` code `delivery_failed`, message naming the kind `text`.
- [ ] CU-100 `sendText` reply to an unknown message — input: `replyToMessageId` `msg_missing`; expected: `not_found`, message `reply_to: message not found`.
- [ ] CU-101 `sendMedia` link source — input: kind `image`, link `https://example.com/a.jpg`; expected: `session` receives an `image` message with source `link`; `delivery` `sent`.
- [ ] CU-102 `ask` answered by the owner while held — input: the owner taps option 0 while `ask` waits; expected: `{status: answered, answer: "Sim", messageId: <owner answer id>}` before the timeout.
- [ ] CU-103 `ask` retry after the answer returns the answer (Review Focus 3) — input: question answered, then the same `ask` within `ASK_RETRY_WINDOW_MS`; expected: `{status: answered, answer: "Sim", messageId: <answer id>}`; no new `session` call.
- [ ] CU-104 `ask` open retry sends nothing new — input: the same `ask` twice within `ASK_RETRY_WINDOW_MS` while the first is open; expected: `session` called once in total; the second result `pending` with the same `questionId`.
- [ ] CU-105 `ask` retry after the retry window is a new question — input: the same `ask` `ASK_RETRY_WINDOW_MS + 1` ms after the answer; expected: new `session` call and new `questionId`.
- [ ] CU-106 `ask` is not idempotent across agents — input: the same text and options from `alpha` and `beta`; expected: two questions, two `session` calls.
- [ ] CU-107 `ask` normalises the key — input: `"Deploy?"` with `["Sim"]`, then `"  Deploy?  "` with `["  Sim "]`; expected: the second call returns the first `questionId`.
- [ ] CU-108 `ask` at the maximum wait — input: `timeoutMs` `ASK_MAX_WAIT_MS`, no answer; expected: `pending` at exactly `ASK_MAX_WAIT_MS`.
- [ ] CU-109 `ask` outside the window — input: window closed, no notice yet; expected: the question message `queued`; one `template` of kind `question_notice`; no `session` call.
- [ ] CU-110 `ask` outside the window after the notice — input: notice already sent; expected: `queued`; no `template` call.
- [ ] CU-111 `waitForReply` on an answered question — input: answered `qst_1` of `alpha`; expected: the answer immediately; the answer message `readByAgent` `true`.
- [ ] CU-112 answers stay bound to their question — input: `qst_1` answered, `waitForReply(qst_1)` called three times; expected: the same answer each time.
- [ ] CU-113 `waitForReply` for another agent's question — input: `qst_1` of `alpha`, called by `beta`; expected: `not_found`, message `question_id: question not found`.
- [ ] CU-114 `waitForReply` unknown question — input: `qst_missing`; expected: the same message as CU-113.
- [ ] CU-115 `waitForReply` without a question returns unread at once — input: two unread for `alpha`; expected: `{status: message, messages: [both]}`, both `readByAgent` `true`, no wait.
- [ ] CU-116 `waitForReply` without a question waits for the next message — input: no unread; owner text at 500 ms; expected: `{status: message, messages: [it]}` at 500 ms.
- [ ] CU-117 `waitForReply` without a question times out — input: nothing arrives, timeout 1000 ms; expected: `{status: timeout}` at 1000 ms.
- [ ] CU-118 two concurrent `waitForReply` on one agent — input: one owner message; expected: one returns `message`; the other re-waits and returns `timeout` at its deadline.
- [ ] CU-119 owner reaction does not flush the queue — input: a closed window with one queued message, then an owner reaction; expected: the message stays `queued`; no `session` call; the window's `lastOwnerMessageAt` unchanged. (A17, spec Domain table.)
- [ ] CU-120 a reaction to a question prompt answers it — input: reaction with emoji `👍` on the prompt of open question `qst_1`; expected: the answer is stored with `text` `"👍"`, `optionIndex` `null`; the question is answered. The window is not opened by the reaction (CU-119).
- [ ] CU-121 `getMessages` limit and unread order — input: 8 unread, `limit` 5; expected: `unread` has the 5 oldest; 3 stay unread; `history` has the last 5 exchanged messages in order.
- [ ] CU-122 `getMessages` marks as read — input: two calls; expected: the second `unread` empty; `history` still lists the messages.
- [ ] CU-123 `getMessages` limit zero — input: `limit` 0; expected: `invalid_input`, message `limit: must be between 1 and 20`.
- [ ] CU-124 `getMessages` limit above the history cap — input: `limit` 21; expected: the same message as CU-123.
- [ ] CU-125 `checkInbox` empty — input: no unread; expected: `{status: empty, messages: []}`.
- [ ] CU-126 `checkInbox` caps at `HISTORY_LIMIT` — input: 25 unread; expected: `{status: new}` with 20 messages; 5 still unread.
- [ ] CU-127 `createUpload` — input: `application/pdf`, 1000 bytes; expected: `expiresAt` = now + `UPLOAD_TTL_MS`; stored media origin `upload`, `receivedAt` `null`.
- [ ] CU-128 `describeUpload` unknown — input: `med_missing`; expected: `not_found`, message `upload_id: upload not found`.
- [ ] CU-129 `describeUpload` expired — input: pending upload past `expiresAt`; expected: `upload_expired`, message `upload_id: upload expired`.
- [ ] CU-130 `describeUpload` already received — input: received upload; expected: `upload_unavailable`, message `upload_id: upload already received`.
- [ ] CU-131 `completeUpload` sets retention — input: pending upload, now `T`; expected: `receivedAt` `T`, `retentionUntil` `T + MEDIA_RETENTION_MS`.
- [ ] CU-132 `receiveOwnerMessage` text with the window closed — input: text `"oi"`, no prior owner message, `alpha` waiting; expected: window opened; routed to `alpha`, `readByAgent` `false`; waiter resolved; waker not called.
- [ ] CU-133 flush order — input: three queued messages for `alpha` at `T1 < T2 < T3`, then an owner text; expected: sent in order, each `sent`, no new notice.
- [ ] CU-134 flush expiry — input: a queued message older than `QUEUE_RETENTION_MS` and one newer; expected: the old one `expired` and not sent; the new one `sent`.
- [ ] CU-135 flush failure continues — input: sender throws on the second of three queued; expected: first `sent`, second `failed`, third `sent`.
- [ ] CU-136 button tap on an open question — input: choice of option 1 on open `qst_1`; expected: answer stored with `optionIndex` 1 and the option title; the answer message is a `choice` with `selected` set, routed to `alpha`.
- [ ] CU-137 stale tap on an answered question (Review Focus 2) — input: a second tap on `qst_1` after it was answered; expected: no second answer; the message routed to `alpha` as a `text`-like message with `replyToMessageId` equal to the prompt message id.
- [ ] CU-138 tap on an unknown question — input: option id `qst_missing:0`, title `"Sim"`; expected: no error; routed by rules 3 to 6 with the title as text.
- [ ] CU-139 route choice assigns every held message — input: two held messages and a list; owner taps `route:<first>:beta`; expected: both held messages get agent `beta`; `beta`'s waiter resolved; the list is no longer open.
- [ ] CU-140 stale route choice — input: `route:<message>:alpha` after that message was already assigned; expected: no re-assignment; routed by rules 3 to 6 with the option title as text.
- [ ] CU-141 a second unmatched message joins the held ones (A22) — input: one held message with the list open, then another unmatched text; expected: no new list `template` or `session`; the second message is held with agent `null`.
- [ ] CU-142 routing list is the ten most recent agents — input: twelve agents with distinct `lastSeenAt`; expected: the list has ten options, most recent first, ids `route:<first held id>:<agent>`.
- [ ] CU-143 no agents — input: owner text, zero agents; expected: no list; one text message to the owner with `NoAgents` copy in the connection's locale; the message held with agent `null`.
- [ ] CU-144 notice quick reply only opens and flushes (decision) — input: a closed window with a queued message for `alpha`, then a choice tap with optionId `NOTICE_QUICK_REPLY_ID`; expected: window open, queued message `sent`; no message stored for `alpha`; `ReceiveResult.messageId` `null`; `alpha`'s unread count unchanged.
- [ ] CU-145 `NoneWaker` notice once per unread batch — input: owner text 1 for `alpha` (unread 0 to 1), then owner text 2 (unread 1 to 2), no live waiter; expected: one waiting notice in total, after text 1.
- [ ] CU-146 live waiter skips the waker — input: `alpha` in `waitForReply`; owner text; expected: waker not called; waiter resolved.
- [ ] CU-147 owner window update clears the notice flag — input: notice sent in a closed window, then an owner text; expected: `noticeSentForClosedWindow` `false`.
- [ ] CU-148 owner media stored with retention — input: owner image with `mediaId` `wamid.1`, 1000 bytes; expected: stored media origin `owner`, `receivedAt` now, `retentionUntil` = now + `MEDIA_RETENTION_MS`.
- [ ] CU-149 owner media does not answer — input: owner image with open question of `alpha`; expected: routed to `alpha` by rule 4; the question stays open (A17).
- [ ] CU-150 duplicate channel message is ignored — input: `receiveOwnerMessage` twice with the same `channelMessageId`; expected: second returns `duplicate: true`, `messageId` `null`; one stored message.
- [ ] CU-151 `voice` on a non-audio kind — input: owner image with `voice: true`; expected: `invalid_input`, message `voice: only audio can be a voice note`.
- [ ] CU-152 `sweepExpired` media, queue, questions, receipts — input: media past retention, a queued message older than `QUEUE_RETENTION_MS`, a question asked before `QUESTION_RETENTION_MS`, a receipt older than `RECEIPT_RETENTION_MS`; expected: media deleted from the store and the repository; queued message `expired`; question removed; receipt removed.
- [ ] CU-153 `sweepExpired` next due time — input: pending upload expiring at `T + 5`, media retained until `T + 9`; expected: `nextDueAt` `T + 5`; with nothing stored, `nextDueAt` `null`.
- [ ] CU-154 `sendLocation` latitude out of range — input: latitude `91`; expected: `invalid_input`, message `latitude: must be between -90 and 90`.
- [ ] CU-155 `sendContacts` eleven cards — input: 11 cards; expected: `invalid_input`, message `contacts: must have 1 to 10 entries`.
- [ ] CU-156 `react` to an owner message — input: target `msg_1`, emoji `"👍"`; expected: stored reaction, `delivery` `sent`.
- [ ] CU-157 `react` removal — input: emoji `null`; expected: stored reaction with `emoji` `null`.
- [ ] CU-158 `react` unknown target — input: `msg_missing`; expected: `not_found`, message `message_id: message not found`.
- [ ] CU-159 every message kind round-trips — input: one message of each of the ten kinds (text, image, video, audio with voice, document, sticker, location, contacts, reaction, choice); expected: the in-memory repository returns an equal object for each.

## Worker integration

Runner: `pnpm --filter @zapbip/api test:integration` (Vitest 4.1.12, pool-workers 0.23.0, real workerd, D1, R2, Durable Objects). Fixtures come from `apps/api/test/support/`.

### D1 directory, message index and owner directory

- [ ] WI-1 resolve an active digest — input: connection seeded for `acc_1` and `alpha` with owner locale `pt_BR`; expected: `{accountId: "acc_1", agent: "alpha", ownerLocale: "pt_BR"}`.
- [ ] WI-2 resolve a digest with no row — input: digest of a secret never seeded, or a row deleted; expected: `null`.
- [ ] WI-3 resolve with no owner identity — input: a connection whose account has no `owner_identities` row; expected: `null`.
- [ ] WI-4 digest stored, not the secret — input: seed, then read every column of `connections`; expected: no column equals the plaintext secret; `secret_digest` equals the SHA-256 hex of the secret.
- [ ] WI-5 digest vector — input: `zb_conn_` plus 43 `A` characters; expected: the SHA-256 hex, 64 lowercase hex characters.
- [ ] WI-6 duplicate agent in one account — input: two connections for `acc_1` named `alpha`; expected: the second insert fails on `UNIQUE (account_id, agent)`.
- [ ] WI-7 message index records once — input: `record` twice for `wamid.1`; expected: first `true`, second `false`; `find` returns `{accountId: "acc_1"}`.
- [ ] WI-8 message index unknown id — input: `find` `wamid.none`; expected: `null`.
- [ ] WI-9 owner directory by phone — input: `5511999990000`; expected: `{accountId, ownerLocale: "pt_BR"}`; an unknown phone gives `null`.

### Repository and Durable Object (`sqlite-repository.test.ts`, `account-inbox.test.ts`)

- [ ] WI-10 `findNextExpiry` minimum — input: pending upload expiring at `T + 5`, media retained until `T + 9`, queued message at `T`; expected: `T + 5` (the queued message's expiry is `T + QUEUE_RETENTION_MS`, later).
- [ ] WI-11 `findNextExpiry` empty — input: no rows; expected: `null`.
- [ ] WI-12 `findRecentQuestion` scoping — input: `alpha`'s question with key `k` asked at `T`; lookups: `beta` with `k`; `alpha` with another key; `alpha` with `k` and `askedAfter` `T + 1`; expected: `null` for all three; `alpha` with `k` and `askedAfter` `T - 1` returns the question.
- [ ] WI-13 `listAgentHistory` limit — input: 25 messages for `alpha`, limit 20; expected: the last 20 in order.
- [ ] WI-14 state survives a restart — input: a message stored; the instance dropped and a new instance created over the same storage; expected: `getMessages` returns it.
- [ ] WI-15 two accounts are isolated — input: `alpha` of `acc_1` sends text; `acc_2` reads `alpha`; expected: empty history; `readScreen` of `acc_2` empty.
- [ ] WI-16 the alarm sweeps an expired upload — input: upload record with `expiresAt` in the past, no receipt; `runDurableObjectAlarm`; expected: record and R2 object gone.
- [ ] WI-17 the alarm sweeps an expired queued message — input: queued message older than `QUEUE_RETENTION_MS`; `runDurableObjectAlarm`; expected: `expired`.
- [ ] WI-18 an upload arms the alarm — input: `createUpload`; expected: `ctx.storage.getAlarm()` equals `findNextExpiry()` (Review finding 6).
- [ ] WI-19 the armed alarm moves earlier — input: an upload expiring sooner than the armed alarm is created; expected: the alarm moves to the earlier time.
- [ ] WI-20 `channel_receipts` duplicate — input: `receiveOwnerMessage` twice with the same wamid; expected: the second returns `duplicate: true` with no second stored message.
- [ ] WI-21 development clock survives a restart — input: `advanceClock({advanceMs: WINDOW_MS})`, then a restart; expected: the returned offset equals `WINDOW_MS`; `sendText` after the restart is `queued`.
- [ ] WI-22 screen order — input: one session text, one template notice, one prompt; expected: `readScreen` lists them in send order with `messageId`, `template` and `options`.
- [ ] WI-23 `ask` holds and returns pending — input: `ask` with `timeoutMs` 1000, no answer, via RPC; expected: `{ok: true, value: {status: pending, questionId}}` after about 1 s.
- [ ] WI-24 RPC keeps the error code — input: `sendText` with an unknown reply target; expected: `{ok: false, errorCode: "not_found", message: "reply_to: message not found"}`.
- [ ] WI-25 DO eviction mid-wait — input: `ask` held with timeout 10 s; the instance is dropped while it waits (`runInDurableObject` restart); then the owner's tap is stored through a new instance, and the client retries `waitForReply(questionId)`; expected: the held call returns an error rather than an answer; the retry returns `answered` with the tapped option. (Review finding 14.)
- [ ] WI-123 a throwing due-time provider leaves the alarm armed — input: two registered `DueTimeProvider`s, the first throws in `runDue`; `runDurableObjectAlarm`; expected: the second provider ran, `ctx.storage.getAlarm()` is not null and equals the earliest `nextDueAt()` of the providers that still have work. (Owner: S3.5.)
- [ ] WI-26 logs carry no text — input: a session with owner text `segredo-123` and caption `legenda-456`; expected: no captured log line contains either string, and every line is JSON with an `event` field.

### MCP auth (`mcp-auth.test.ts`)

- [ ] WI-27 unknown secret on the path — input: `/c/zb_conn_` plus 43 characters not seeded; expected: `401` with body `UNAUTHORIZED_BODY`.
- [ ] WI-28 deleted connection — input: a seeded connection row deleted; expected: `401`, body byte-equal to WI-27.
- [ ] WI-29 malformed secret — input: `/c/zb_conn_short/mcp`; expected: `401`, same body; the directory is not queried (counted).
- [ ] WI-30 Bearer on `/mcp` — input: valid Bearer; expected: `200`, `tools/list` returns exactly the names in `Object.keys(TOOL_DEFINITIONS)`.
- [ ] WI-31 `/mcp` without a header — input: no `Authorization`; expected: `401`, same body.
- [ ] WI-32 `/mcp` with a wrong Bearer — input: an unknown Bearer; expected: `401`, same body.
- [ ] WI-33 path secret wins over Bearer — input: valid path secret with a wrong Bearer on `/c/<secret>/mcp`; expected: `200`.

### MCP tools (`mcp-tools.test.ts`)

- [ ] WI-34 `tools/list` names the registered tools — input: `tools/list`; expected: exactly the values of `McpToolName`, in the order of `Object.keys(TOOL_DEFINITIONS)`; no count is asserted.
- [ ] WI-35 `send_message` — input: `{text: "oi"}`; expected: `message_id` non-empty, `delivery` `sent`; the screen shows `oi`.
- [ ] WI-36 `send_message` over the limit — input: 4097 characters; expected: tool error naming `text`, message `text: must be at most 4096 characters`.
- [ ] WI-37 `send_message` unknown reply target — input: `reply_to` `msg_missing`; expected: `reply_to: message not found`.
- [ ] WI-38 `send_media` image by link — input: `{kind: "image", url: "https://example.com/a.jpg"}`; expected: `delivery` `sent`.
- [ ] WI-39 `send_media` video by upload — input: create_upload for `video/mp4`, PUT, `send_media` kind `video`; expected: `delivery` `sent`; the screen shows a video with a signed link.
- [ ] WI-40 `send_media` audio as a voice note — input: kind `audio`, `voice: true`, `audio/ogg` by upload; expected: `delivery` `sent`; the screen shows a voice note.
- [ ] WI-41 `send_media` document by upload — input: `application/pdf`; expected: `delivery` `sent`.
- [ ] WI-42 `send_media` sticker by upload — input: `image/webp` at 100000 bytes; expected: `delivery` `sent`.
- [ ] WI-43 `send_media` sticker over the limit — input: `image/webp` at 100001 bytes; expected: tool error naming `size_bytes`.
- [ ] WI-44 `send_media` plain http link — input: `url` `http://example.com/a.jpg`; expected: tool error naming `url`, message `link: must be an https URL`.
- [ ] WI-45 `send_media` both `url` and `upload_id` — input: both set; expected: tool error naming `url` and `upload_id`, message `exactly one of url and upload_id is required`.
- [ ] WI-46 `send_media` neither — input: neither set; expected: the same message as WI-45.
- [ ] WI-47 `send_media` upload not received — input: `upload_id` with no PUT; expected: tool error naming `upload_id`, message `upload_id: upload has not been received`.
- [ ] WI-48 `send_media` kind and MIME mismatch — input: kind `image` with `video/mp4` upload; expected: tool error naming `mime_type`.
- [ ] WI-49 `send_location` latitude 91 — input: `latitude: 91`; expected: tool error naming `latitude`.
- [ ] WI-50 `send_contact` eleven cards — input: 11 cards; expected: tool error naming `contacts`.
- [ ] WI-51 `react` with an empty emoji removes the reaction — input: `emoji: ""` on an owner message; expected: `delivery` `sent`; stored `emoji` `null`.
- [ ] WI-52 `react` with two emoji — input: `"👍👍"`; expected: tool error naming `emoji`.
- [ ] WI-53 `ask` list row over the limit — input: four options, the first 25 characters; expected: tool error naming `options[0]`, message `options[0]: list row title must be at most 24 characters`.
- [ ] WI-54 `ask` button title over the limit — input: three options, the first 21 characters; expected: tool error naming `options[0]`, message `options[0]: button title must be at most 20 characters`.
- [ ] WI-55 `ask` with `timeout_seconds` 51 — input: `timeout_seconds: 51`; expected: tool error naming `timeout_seconds`.
- [ ] WI-56 `ask` answered by the owner while held — input: the simulator taps option 0 at 500 ms; expected: `{status: answered, answer, message_id}` within 50 s; `question_id` null.
- [ ] WI-57 `ask` pending — input: `timeout_seconds: 1`, no tap; expected: `{status: pending, question_id}`; `answer` null.
- [ ] WI-58 `wait_for_reply` with an unknown question — input: `question_id` `qst_missing`; expected: tool error naming `question_id`, message `question_id: question not found`.
- [ ] WI-59 `wait_for_reply` without a question returns the owner text — input: the simulator sends `oi` at 500 ms; expected: `{status: message, messages: [oi]}` with `sender` `owner`, `verified` `true`.
- [ ] WI-60 `wait_for_reply` timeout — input: `timeout_seconds: 1`, nothing arrives; expected: `{status: timeout}`.
- [ ] WI-61 `get_messages` default limit — input: no arguments, 25 unread; expected: 20 unread returned.
- [ ] WI-62 `check_inbox` empty is immediate — input: no unread; expected: `{status: empty, messages: []}` in under 1 s.
- [ ] WI-63 `check_inbox` new messages — input: one owner text; expected: `{status: new}` with it; `read` `true` afterwards.
- [ ] WI-64 `create_upload` — input: `{filename: "a.pdf", mime_type: "application/pdf", size_bytes: 1000}`; expected: `upload_id` non-empty, `upload_url` with `/c/` and `/u/` and `exp=` and `sig=`, `expires_at` an ISO 8601 string in the future.
- [ ] WI-65 `create_upload` with an empty type — input: `mime_type: ""`; expected: tool error naming `mime_type`.
- [ ] WI-66 `create_upload` over the document limit — input: `size_bytes: 100000001`; expected: tool error naming `size_bytes`.
- [ ] WI-67 wire timestamps — input: any call returning messages; expected: every `at` matches ISO 8601.
- [ ] WI-68 wire contact with null organization — input: an owner contact card without organization; expected: `contacts[0].organization` is `null` and the output validates against `messageWireSchema` (Review finding 3).

### Inline images (`mcp-inline-images.test.ts`)

- [ ] WI-69 image at the inline limit — input: owner image of `INLINE_IMAGE_MAX_BYTES` bytes; expected: `get_messages` returns an image content block with the bytes, and `url`.
- [ ] WI-70 image over the inline limit — input: owner image of `INLINE_IMAGE_MAX_BYTES + 1` bytes; expected: no image block; `url` present.

### Uploads (`upload-route.test.ts`), check order: signature, existence and expiry, length, type

- [ ] WI-71 valid upload — input: PUT with `Content-Length` equal to the declared size and the declared type; expected: `201`, the R2 object exists, `receivedAt` set.
- [ ] WI-72 tampered signature — input: `sig` with one character changed; expected: `403`, no R2 object.
- [ ] WI-73 expired signature — input: `exp` in the past; expected: `403`, no R2 object.
- [ ] WI-74 unknown upload id with a valid signature — input: an id no record holds, signed with the upload key; expected: `404`, no R2 object.
- [ ] WI-75 upload past its deadline — input: a valid signature for a record with `expiresAt` in the past; expected: `410`, no R2 object.
- [ ] WI-76 upload already received — input: second PUT; expected: `409`.
- [ ] WI-77 missing `Content-Length` — input: a streamed body with no length; expected: `411`, no R2 object.
- [ ] WI-78 body larger than declared — input: `Content-Length` one byte above; expected: `413`, no R2 object.
- [ ] WI-79 body smaller than declared — input: `Content-Length` one byte below; expected: `400`, no R2 object.
- [ ] WI-80 wrong `Content-Type` — input: `video/mp4` for a declared `application/pdf`; expected: `415`, no R2 object.
- [ ] WI-81 type parameters and case — input: declared `image/png`, sent as `IMAGE/PNG; charset=binary`; expected: `201`.
- [ ] WI-82 unknown secret on the upload path — input: `/c/<unknown>/u/<id>` with a valid signature for the id; expected: `401`, body `UNAUTHORIZED_BODY`.
- [ ] WI-83 another account's upload through my secret — input: an upload of `acc_2` PUT through `acc_1`'s secret; expected: `404`.
- [ ] WI-84 signature made with the media key — input: a PUT signed with `MEDIA_LINK_SIGNING_KEY`; expected: `403` (the keys are not interchangeable).

### Signed media links (`media-route.test.ts`)

- [ ] WI-85 valid link — input: `GET /m/<acc>/<id>?exp=&sig=` fresh; expected: `200`, the stored bytes and type.
- [ ] WI-86 forged signature — input: `sig` altered; expected: `403`.
- [ ] WI-87 expired link — input: `exp` in the past; expected: `403`.
- [ ] WI-88 link for another media id — input: a signature of `med_1` used on `med_2`; expected: `403`.
- [ ] WI-89 valid signature, no object — input: signed id with no R2 object; expected: `404`.
- [ ] WI-90 link signed with the upload key — input: a read link signed with `UPLOAD_LINK_SIGNING_KEY`; expected: `403`.

### Owner simulator, phone-keyed (`dev-owner.test.ts`, development entry)

- [ ] WI-91 owner text — input: `POST /dev/owner/5511999990000/messages` with `{kind: "text", text: "oi"}`; expected: `200`; `alpha`'s `get_messages` shows it with `sender` `owner`, `verified` `true`.
- [ ] WI-92 owner image within the inline limit — input: base64 of 100 KB, `image/png`; expected: R2 object at `accounts/<acc>/media/<wamid>`; `get_messages` returns `url` and an inline block.
- [ ] WI-93 owner image over the inline limit — input: base64 of 1.1 MB; expected: `url` present, no inline block.
- [ ] WI-94 owner video, document and sticker — input: each kind with its MIME; expected: stored; `get_messages` shows each with its `kind` and `media_id`. (Review finding 14, inbound.)
- [ ] WI-95 owner voice note — input: kind `audio` with `voice: true`; expected: stored; `voice` `true` on the wire.
- [ ] WI-96 owner location and contacts — input: one location, one contact card without organization; expected: both stored with their fields.
- [ ] WI-97 owner reaction to an agent message — input: reaction with the target's id; expected: routed to the target's agent; no window change (WI-98).
- [ ] WI-98 owner reaction does not open the window — input: a closed window with a queued message, then a reaction; expected: the message stays `queued`.
- [ ] WI-99 owner quoted reply (Review finding 14) — input: text with `reply_to` set to an `alpha` message; expected: routed to `alpha` by rule 2; `reply_to` shown on the wire.
- [ ] WI-100 owner choice tap of an open question — input: option id of the open question; expected: the question answered; `ask` returns `answered`.
- [ ] WI-101 owner choice with a malformed option id — input: `optionId` `"garbage"`, title `"Sim"`; expected: `200`, routed as text by rules 3 to 6.
- [ ] WI-102 owner notice quick reply — input: a choice with `NOTICE_QUICK_REPLY_ID`; expected: `200`, `messageId` `null`, the queue flushed, nothing stored for any agent.
- [ ] WI-103 owner duplicate delivery — input: the same `wamid` posted twice; expected: the second `200` with `duplicate: true`; one stored message.
- [ ] WI-104 screen lists sends — input: one `send_message` and one `ask` after an owner text; expected: `GET /dev/owner/<phone>/screen` lists both in order.
- [ ] WI-105 clock offset — input: `POST /dev/owner/<phone>/clock` with `{advance_ms: WINDOW_MS}`; expected: `200`; the next `send_message` is `queued`; a notice is on the screen.
- [ ] WI-106 unknown phone — input: `POST /dev/owner/5500000000000/messages`; expected: `404`.
- [ ] WI-107 malformed phone — input: `/dev/owner/abc/messages`; expected: `404`.
- [ ] WI-108 owner media type not allowed — input: a sticker with `image/png`; expected: `invalid_input` naming `mime_type`.

### Production entry (`production-entry.test.ts`), pin

- [ ] WI-109 simulator absent on `index.ts` — input: `POST /dev/owner/<phone>/messages` on the production entry; expected: `404`.
- [ ] WI-110 screen absent on `index.ts` — input: `GET /dev/owner/<phone>/screen`; expected: `404`.
- [ ] WI-111 clock absent on `index.ts` — input: `POST /dev/owner/<phone>/clock`; expected: `404`.
- [ ] WI-112 MCP works on `index.ts` — input: `tools/list` on `/c/<secret>/mcp`; expected: `200`, the tools of `Object.keys(TOOL_DEFINITIONS)`.

### Dev seed (`dev-seed.test.ts`)

The seed logic is a pure function that returns SQL; the tests run that SQL through D1. The script runs it with `wrangler d1 execute --local --persist-to <dir>` under `tsx`.

- [ ] WI-113 seed creates the account — input: `--phone 5511999990000 --agents claude-code,codex --json --persist-to <dir>`; expected: one `accounts` row, one `owner_identities` row with `pt_BR`, two `connections` rows with distinct digests, output JSON with two URLs.
- [ ] WI-114 seed rejects a repeated phone — input: the same command again; expected: `invalid_input`, nothing written.
- [ ] WI-115 seed rejects an agent name over 20 characters — input: a 21-character agent; expected: `invalid_input` naming `agents[0]`, nothing written.

- [ ] WI-116 (owner: S5.3) swapped account id in a media path — input: a link signed for `acc_1` requested at `/m/acc_2/<media id>` with the same `exp` and `sig`; expected: `403`; the same link at `/m/acc_1/...` returns `200`.
- [ ] WI-117 (owner: S5.7) `GET /health` — input: `GET /health`; expected: `200` with body `{"ok": true}`.
- [ ] WI-118 (owner: S3.5) migration runner on a fresh object — input: a new object; expected: `schema_versions` contains `1` and the `v1` tables exist.
- [ ] WI-119 (owner: S3.5) migration runner is idempotent — input: a second run on the object of WI-118; expected: no version applied, no error, `schema_versions` unchanged.
- [ ] WI-120 (owner: S3.5) migration runner applies missing versions in ascending order — input: registry `{1, 2, 3}` with `{1}` applied; expected: versions 2 then 3 applied, in that order (recorded by a spy).
- [ ] WI-121 (owner: S3.5) migration runner fills gaps — input: registry `{1, 3}` with `{1}` applied, and a second registry `{2, 1}` with nothing applied; expected: the first applies only 3; the second applies 1 then 2.
- [ ] WI-122 (owner: S5.7) base class has no development methods — input: the base `AccountInbox` exported by `index.ts`; expected: `readScreen` and `advanceClock` are absent from its prototype; `DevAccountInbox` has both.

## E2E MCP client

Runner: `pnpm --filter @zapbip/api test:e2e`, default in the `e2e` gate. `globalSetup` picks a free port, applies `0001_core` to local D1, seeds the phone `5511999990000` with `alpha` and `beta` through `scripts/dev-seed.ts --json`, starts `wrangler dev` (the top-level development block) with the two link keys as `--var`, and polls `GET /health` for at most 30 s. The client is `@modelcontextprotocol/sdk` `Client` over `StreamableHTTPClientTransport`. The owner is the simulator over HTTP.

- [ ] E2E-1 `tools/list` — input: client connects to `/c/<alpha secret>/mcp`; expected: the tools of `Object.keys(TOOL_DEFINITIONS)`, each with the input and output schema of its definition.
- [ ] E2E-2 text with emoji — input: `send_message` `"olá 👋"`; expected: `delivery` `sent`; the screen shows `olá 👋`.
- [ ] E2E-3 text at the limit — input: 4096 characters; expected: `delivery` `sent`.
- [ ] E2E-4 text over the limit — input: 4097 characters; expected: tool error naming `text`; screen unchanged.
- [ ] E2E-5 upload cycle — input: `create_upload` for a 1 KB PNG, PUT the bytes with the declared length and type, `send_media` with `upload_id`; expected: `201` on the PUT; `delivery` `sent`; the screen shows the image with a link; the link returns the same bytes.
- [ ] E2E-6 link media — input: `send_media` `url` `https://example.com/a.jpg`; expected: `sent`; the screen shows the link.
- [ ] E2E-7 each outbound kind — input: `send_media` for video (upload), audio as voice note (upload), document (upload), sticker (upload, webp 100 KB); expected: each `sent`; the screen shows each kind.
- [ ] E2E-8 location, contact and reaction — input: `send_location`, `send_contact`, `react` on an owner message; expected: each `sent`; the screen shows them in order.
- [ ] E2E-9 `ask` answered during the hold — input: `ask` with two options; the simulator taps option 1 at 1 s; expected: `answered`, answer = option 1's title, `message_id` = the tap's message id, within 50 s.
- [ ] E2E-10 `ask` pending then answered — input: `ask` with `timeout_seconds: 1`; the simulator taps option 0; `wait_for_reply(question_id)`; expected: first `pending` with `question_id`; then `answered` with option 0's title; the same answer on a second call.
- [ ] E2E-11 owner text reaches `check_inbox` — input: simulator text `"olá"`, then `check_inbox`; expected: `new` with `"olá"`; then `empty`.
- [ ] E2E-12 `get_messages` marks read — input: two `get_messages` after one owner text; expected: the first returns it in `unread`; the second returns `unread` empty and the text in `history`.
- [ ] E2E-13 `wait_for_reply` returns a text sent during the hold — input: simulator sends `"sim"` at 1 s; expected: `message` with `"sim"` within 50 s.
- [ ] E2E-14 inbound image inline — input: simulator image of 100 KB; expected: `get_messages` returns the message with `url` and an image block; the link returns `200`.
- [ ] E2E-15 inbound image over the inline limit — input: simulator image of 1.1 MB; expected: `url` only.
- [ ] E2E-16 inbound kinds — input: simulator video, document, sticker and voice note; expected: each shows in `get_messages` with its kind and `media_id`.
- [ ] E2E-17 quoted reply routes to its agent — input: simulator text with `reply_to` set to a `beta` message; expected: `beta`'s `check_inbox` returns it; `alpha` sees nothing.
- [ ] E2E-18 routing to the open question's agent — input: `alpha` with an open `ask`, owner text `"sim"` with no mention; expected: `alpha`'s `ask` answers `sim`; `beta` sees nothing.
- [ ] E2E-19 routing list and assignment — input: no open questions, owner text `"oi"`; expected: the screen shows the list with `alpha` and `beta` (ids `route:<id>:alpha`, `route:<id>:beta`); the simulator taps `beta`; `beta`'s `wait_for_reply` returns `"oi"`.
- [ ] E2E-20 second unmatched message joins the list — input: after E2E-19's list is open and unanswered, owner text `"segunda"`; expected: no second list on the screen; after the tap on `beta`, both `oi` and `segunda` reach `beta`.
- [ ] E2E-21 closed window and flush — input: the simulator advances the clock by `WINDOW_MS`; `alpha` sends `"a"` and `"b"`; the owner taps the notice's quick reply; expected: one notice on the screen; `"a"` and `"b"` sent in that order after the tap; no message reached `alpha`'s inbox from the tap.
- [ ] E2E-22 unknown secret — input: a digest that was never seeded; expected: the transport reports `401`; no tools listed.
- [ ] E2E-23 Bearer header — input: `/mcp` with the Bearer; expected: the same tools as E2E-1.

## E2E Claude Code session (opt-in)

Runner: `ZAPBIP_CLAUDE_E2E=1 pnpm --filter @zapbip/api test:e2e`. Each case calls the model through the owner's logged-in Claude Code, so the tester runs these only after the owner's go-ahead, with a budget of six prompts in total. Each case is one `claude -p --mcp-config <file> --strict-mcp-config` run against the `globalSetup` stack.

- [ ] CC-1 Claude Code sends a message — input: prompt "send the text `teste` to the owner with send_message"; expected: within 60 s the screen shows `teste`, and the output reports `delivery` `sent`.
- [ ] CC-2 Claude Code reads an owner message — input: simulator sends `"qual é o plano?"`; prompt "call check_inbox and quote the owner's message"; expected: the answer contains `qual é o plano?`.
- [ ] CC-3 Claude Code asks and gets the tap — input: prompt "ask the owner with two options `Sim` and `Não` using the ask tool"; simulator taps `Não` after 3 s; expected: Claude reports the answer `Não`.
- [ ] CC-4 abandoned call still recovers — input: Claude Code killed after 10 s during `wait_for_reply` for a question answered at 15 s; a second prompt calls `wait_for_reply` with that `question_id`; expected: the answer on the second call. (ADR 0009: client aborts are not observable.)
- [ ] CC-5 upload from Claude Code — input: prompt "upload this PNG with create_upload, PUT it with curl, then send it with send_media"; expected: the screen shows the image and its link returns the bytes.
- [ ] CC-6 an unknown secret is refused — input: a digest that is not seeded, prompt "send the text `x`"; expected: Claude reports an authorization failure; the screen does not gain `x`.

## Docs links

Runner: `pnpm --filter @zapbip/docs exec mint broken-links` (gate `docs`).

- [ ] DOC-1 broken links — input: `apps/docs`; expected: exit `0`, no broken link.
- [ ] DOC-2 navigation matches files — input: every page of `docs.json`; expected: each exists as an `.mdx` file; each tool of `Object.keys(TOOL_DEFINITIONS)` has `mcp-reference/<tool>.mdx` (underscores become hyphens); no path is duplicated.
- [ ] DOC-3 `mint dev` serves the site — input: `mint dev`; expected: `GET /` returns `200`; the Introduction renders.
- [ ] DOC-4 pages render without console errors — input: Introduction, `concepts/routing` and `mcp-reference/send-message` in Playwright MCP at 1280 and 375 widths; expected: no console errors; no horizontal scroll at 375 (recorded by `/check-ui`).

## Security checks

Each row names where its proof lives.

- [ ] SEC-1 secrets hashed at rest — input: seed, read `connections`; expected: only `secret_digest` derives from the secret (WI-4).
- [ ] SEC-2 enumeration-safe `401` — input: an unseeded and a deleted connection on the same route; expected: same status, byte-equal body (WI-27, WI-28).
- [ ] SEC-3 account isolation on the MCP surface — input: `acc_1`'s agent reacts to a message id of `acc_2`; expected: `message_id: message not found`; `acc_2` unchanged (WI-15 and this case).
- [ ] SEC-4 no route takes an account id except the signed media path — input: `/c/<secret>/mcp?account=acc_2` and `/c/<secret>/u/<id>?account=acc_2`; expected: the query is ignored and the response comes from `acc_1` only; the media path is covered by WI-116.
- [ ] SEC-5 signed links reject tampering — input: a media link with `sig` altered, `exp` altered, or the media id or account id swapped; expected: `403` each (WI-86, WI-88, WI-116).
- [ ] SEC-6 each key works only for its purpose — input: a read link signed with the upload key, and an upload PUT signed with the media key; expected: `403` each (WI-84, WI-90).
- [ ] SEC-7 secrets never in logs — input: a full E2E run with the `wrangler dev` output captured; expected: no connection secret string in the output.
- [ ] SEC-8 message text never in logs — input: owner text `segredo-123` and caption `legenda-456`; expected: neither appears in the captured output (WI-26).
- [ ] SEC-9 tool errors echo no message body — input: `send_message` with 4097 characters of `segredo`; expected: the error text does not contain `segredo`.
- [ ] SEC-10 no interpolated SQL — input: `no-interpolated-sql.test.ts` over `apps/api/src/**/*.ts`; expected: no match outside drizzle's `sql` tag.
- [ ] SEC-11 upload size ceiling at the schema — input: `create_upload` with `size_bytes` 100000001; expected: rejected by the use case before the Durable Object stores anything (WI-66).
- [ ] SEC-12 malformed secret does not reach the directory — input: `/c/zb_conn_short/mcp`; expected: `401`; no D1 query (WI-29).
- [ ] SEC-13 deleted connection stops at once — input: a connection serves a call, its row is deleted, then it calls again; expected: `401` (no cache of the directory result).
- [ ] SEC-14 owner messages are verified — input: any owner message read through MCP; expected: `sender` `owner` and `verified` `true`; no agent message has `verified` `true` (WI-59, E2E-11).
- [ ] SEC-15 simulator absent in production — input: the simulator routes on the production entry; expected: `404` each (WI-109 to WI-111).
- [ ] SEC-16 signature comparison — input: review of `apps/api/src/signing.ts`; expected: the comparison is `crypto.subtle.verify`; no `===` on signatures (the reviewer records it).
- [ ] SEC-17 link keys are separate secrets — input: the wrangler config and the vitest config; expected: `MEDIA_LINK_SIGNING_KEY` and `UPLOAD_LINK_SIGNING_KEY` are distinct names and are not in `wrangler.jsonc`.

## Production build

Runner: `pnpm --filter @zapbip/api test:e2e` (`production-bundle.e2e.test.ts`), default in the `e2e` gate.

- [ ] PB-1 dry-run bundle builds — input: `wrangler deploy --dry-run --env production --outdir <scratch>`, where `env.production.main` is `src/index.ts`; expected: exit `0`, one bundle written. If the installed wrangler needs a login for dry-run, the box is recorded `not run` in coverage honesty, and PB-2 uses the bundler output of the same entry.
- [ ] PB-2 bundle has no development surface — input: the bundle from PB-1; expected: no `/dev/owner/` string, no `owner-simulator` identifier, no `advanceClock` and no `readScreen`.
- [ ] PB-3 development bundle has the development surface — input: `wrangler deploy --dry-run --outdir <scratch>` on the top-level block, whose `main` is `src/index.dev.ts`; expected: `/dev/owner/`, `advanceClock` and `readScreen` present, so PB-2 is not vacuous.
- [ ] PB-4 wrangler config shape — input: `wrangler.jsonc` parsed; expected: the top-level `main` is `src/index.dev.ts`; `env.production.main` is `src/index.ts`; `env.production` repeats `ACCOUNT_INBOX`, `CONNECTIONS`, `MEDIA`, `vars.PUBLIC_ORIGIN` and `migrations` (tag `v1`, `AccountInbox` in `new_sqlite_classes`); neither `MEDIA_LINK_SIGNING_KEY` nor `UPLOAD_LINK_SIGNING_KEY` appears in the file.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: a held `ask` returns `pending` at exactly 50 s and never later — attack: a fake-clock run and a real-time run measuring the Durable Object hold while a `wait_for_reply` runs concurrently; result: <refuted | held>.
- [ ] Claim 2: one notice per closed window holds under concurrent sends — attack: CU-94 with the notice send failing once, then retried; result: <refuted | held>.
- [ ] Claim 3: two accounts never share state through an agent name collision — attack: agent `alpha` in `acc_1` and `acc_2`, a route choice tapped on `acc_2` carrying an `acc_1` message id; result: <refuted | held>.

## Coverage honesty

What is not tested and why.

- Real WhatsApp Cloud API: webhook signatures, Meta media download and template approval belong to `whatsapp-cloud-channel`; the fake channel stands in.
- Production Cloudflare behaviour: only local workerd runs here. Eviction under real load and the free-tier hold budget (about 2 080 holds of 50 s a day, ADR 0009) are not measured. WI-25 simulates eviction through the pool, which may differ from a real eviction.
- Client abort propagation: not observable locally (spike, ADR 0009). The tests assume an abort is invisible and cover recovery through `question_id`.
- Real 24-hour window: closed-window paths use the development clock offset (A18), not a real day.
- Claude Code session (CC-1 to CC-6): opt-in, not run in CI, and run only after the owner's go-ahead, because it calls the model.
- `database_id` in `wrangler.jsonc` is a local identifier; deploy-readiness replaces it with the id of the created D1 database.
- PB-1 may be `not run` if `wrangler deploy --dry-run` needs a Cloudflare login.
- Concurrency beyond a handful of waiters per account: covered by CU-88 and WI-23, not by load.
- The Mintlify site is not published (ADR 0010). DOC-3 and DOC-4 check the local `mint dev` only.
- Owner-facing copy: written by the developer in `pt_BR` and `en_US`; the owner has not reviewed the wording.
- Rate limits, abuse controls, quotas: out of scope (spec non-goals).
- Connection revocation and secret rotation: accounts-and-keys (not slice 1); the tests use deleted rows as the only "gone" state.
