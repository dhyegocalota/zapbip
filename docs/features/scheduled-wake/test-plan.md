# Test plan: Scheduled wake and standby

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Time in core tests comes from the fake `Clock`. `MINUTE_MS` and `HOUR_MS` come from `libs/types`. "Interval 60" means `intervalMinutes: 60`. Owner locale comes from the connection identity: `ownerLocale: OwnerLocale.PortugueseBrazil` unless stated.

Refresh (plan R1-R20, 2026-11-06): a revoked connection is a connection with no `agent_wake` row (slice 3 deletes it), so every `revokedAt` case below is a "standby record `null`" case; `AgentWaker.notify` has no `firstUnread` (it is only called on a 0 to 1 arrival); the poll fields live in `PollState` (`findPollState`); `Local` is slice 6's; copy functions are `expectedDelayNoteCopy` and `staleNoticeCopy`; the dispatcher is `createDispatchingAgentWaker`; factories replace classes; docs exist in en and pt-br.

Test areas, for parallel tester sub-agents: **A** core rules (pure), **B** wakers and core use cases (in memory), **C** Worker storage, **D** Worker alarm, handoff, payload and revoke flow, **E** MCP over HTTP, **F** E2E in the owner simulator, **G** docs, **H** security, **I** owner-run.

## The failing test first

- [x] `libs/core/src/wake/wake-rung.test.ts::table` — input: each row of the rung table; expected: the `scheduled` (fresh and stale) and `standby` (valid, missing, standby-mode) rows fail with `wakeRungFor is not implemented` before S2.2; the `webhook` and `none` rows are pins (Step 0 keeps slice 4's behaviour for them). — evidence: PASS ad62d11 (retest-head.md); red proved at Step 0
- [x] `apps/api/test/integration/mcp-scheduled-wake.test.ts::scheduled set_wake` — input: `tools/call set_wake` with `{mode: "scheduled", interval_minutes: 60}`; expected: a tool error whose text contains `saveScheduled is not implemented` before S4.2 (plan R11). — evidence: PASS ad62d11 (retest-head.md); red proved at Step 0
- [x] `apps/api/test/integration/scheduled-wake-storage.test.ts::findWake round trip` — input: a stored scheduled row with interval 60; expected: `findWake` throws `not implemented` before S1.2. (R7: the round trip reads `findWake` for the mode-owned fields and `findPollState` for the poll fields; the red text is the first of the two stubs the test reaches.) — evidence: PASS ad62d11 (retest-head.md); red proved at Step 0
- [x] Confirmed it fails for the right reason: each red run's first failure is the named stub, not a compile error. The printed text goes into `tester-briefing.md`. — evidence: PASS ad62d11 (retest-head.md); red proved at Step 0

## A. Core rules (pure, `libs/core/src/wake/*.test.ts`)

### A1 Wake setting validation (`wake-setting.test.ts`)

- [x] `assertWakeSetting` — input: scheduled, `intervalMinutes: 0`; expected: throws `InboxError` `InvalidInput` whose message contains `interval_minutes` and `1`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `assertWakeSetting` — input: scheduled, `intervalMinutes: 1`; expected: returns (Hermes and OpenClaw poll every minute). — evidence: PASS ad62d11 (retest-head.md)
- [x] `assertWakeSetting` — input: scheduled, `intervalMinutes: 60`; expected: returns. — evidence: PASS ad62d11 (retest-head.md)
- [x] `assertWakeSetting` — input: scheduled, `intervalMinutes: 1440`; expected: returns. — evidence: PASS ad62d11 (retest-head.md)
- [x] `assertWakeSetting` — input: scheduled, `intervalMinutes: 1441`; expected: throws `InvalidInput` naming `interval_minutes` and `1440`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `assertWakeSetting` — input: scheduled, `intervalMinutes: 90.5`; expected: throws `InvalidInput` naming `interval_minutes` and `whole number`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Edge: negative interval — input: scheduled, `intervalMinutes: -60`; expected: throws `InvalidInput` naming `interval_minutes`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Edge: scheduled with `intervalMinutes: null`; expected: throws `InvalidInput` naming `interval_minutes` (the mode requires it; null is never read as a default). — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~`assertWakeSetting` — input: standby `grok-bot`, a stored standby record in mode `webhook`, not revoked; expected: returns.~~ `assertWakeSetting` — input: standby `grok-bot`, a stored standby record in mode `webhook`; expected: returns. (R4: revocation is absence) — evidence: PASS ad62d11 (retest-head.md)
- [x] `assertWakeSetting` — input: standby, `standbyAgent` equal to the caller `grok-web`; expected: throws `InvalidInput` naming `standby_agent` and `itself`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `assertWakeSetting` — input: standby, standby record `null` (no connection of this account has that name); expected: throws `InvalidInput` naming `standby_agent` and `not connected to this account`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `assertWakeSetting` — input: standby, standby record in mode `standby`; expected: throws `InvalidInput` naming `standby_agent` and `one hop`. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Write-time revoke check — input: standby, standby record with `revokedAt` set; expected: throws `InvalidInput` naming `standby_agent` and `revoked`.~~ Write-time revoke check — input: a standby that was revoked, so `findWake` returns `null`; expected: throws `InvalidInput` naming `standby_agent` and `not connected to this account`, the same text as an unknown name (a caller cannot tell revoked from unknown). (R4) — evidence: PASS ad62d11 (retest-head.md)
- [x] Edge: `standbyAgent: null` with mode standby; expected: throws `InvalidInput` naming `standby_agent`. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~`assertWakeSetting` — input: `none`, and `local`; expected: returns for both.~~ `assertWakeSetting` — input: `none`; expected: returns. (R3: `local` is slice 6's) — evidence: PASS ad62d11 (retest-head.md)
- [x] Foreign fields (R12) — input: scheduled with `url` set; scheduled with `standbyAgent` set; standby with `intervalMinutes` set; standby with `token` set; expected: each throws `InvalidInput` naming the foreign field and the mode. — evidence: PASS ad62d11 (retest-head.md)
- [x] Pin: `WakeMode` values — input: `Object.values(WakeMode)`; expected: includes `scheduled` and `standby` exactly once each — pin (passes on arrival after S0.1). — evidence: PASS ad62d11 (retest-head.md)

### A2 Poller staleness (`poller.test.ts`)

- [x] `isPollerStale` — input: scheduled interval 60, `lastPolledAt` = now − (2 × HOUR_MS − 1); expected: `false`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `isPollerStale` — input: scheduled interval 60, `lastPolledAt` = now − 2 × HOUR_MS; expected: `true` (boundary is stale). — evidence: PASS ad62d11 (retest-head.md)
- [x] `isPollerStale` — input: scheduled interval 120, `lastPolledAt` = now − 4 × HOUR_MS; expected: `true`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `isPollerStale` — input: scheduled interval 120, `lastPolledAt` = now − 3 × HOUR_MS; expected: `false`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Edge: never polled counts from creation — input: scheduled interval 60, `hasPolled: false`, `lastPolledAt` = creation, now = creation + 2 × HOUR_MS; expected: `true`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Edge: never polled, not yet stale — input: scheduled interval 60, `hasPolled: false`, now = creation + HOUR_MS; expected: `false`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `isPollerStale` — input: mode `webhook`, `lastPolledAt` = now − 10 × HOUR_MS; expected: `false`. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~`isPollerStale` — input: scheduled, `revokedAt` set, now − 10 × HOUR_MS; expected: `false`.~~ `isPollerStale` — input: a standby-mode wake 10 × HOUR_MS since its poll; expected: `false`. (R4: no `revokedAt`; a revoked connection has no row, so `listScheduledWakes` cannot return it) — evidence: PASS ad62d11 (retest-head.md)
- [x] `pollerDeadline` — input: scheduled interval 60, `lastPolledAt` = T, not notified; expected: `T + 2 × HOUR_MS`. — evidence: PASS 22b8b4f (delta-head.md)
- [x] `pollerDeadline` — input: scheduled, `pollerStaleNotified: true`; expected: `null`. — evidence: PASS 22b8b4f (delta-head.md)
- [x] `pollerDeadline` — input: mode `standby`; expected: `null`. — evidence: PASS 22b8b4f (delta-head.md)

### A3 Effective rung (`wake-rung.test.ts`)

- [x] ~~Table, row `local` — input: mode `local`; expected: `WakeRung.Local`.~~ row dropped (R3: `Local` arrives with slice 6). — evidence: PASS ad62d11 (retest-head.md)
- [x] Table, row `webhook` — input: mode `webhook`; expected: `WakeRung.Webhook`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Table, row `scheduled` not stale — input: mode `scheduled`, now = lastPolledAt + HOUR_MS; expected: `WakeRung.Scheduled`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Table, row `scheduled` stale — input: mode `scheduled`, now = lastPolledAt + 2 × HOUR_MS (interval 60); expected: `WakeRung.Inbox`, and the input object's `mode` is still `scheduled` afterwards (no mutation). — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Table, row `standby` valid — input: mode `standby`, standby record in mode `webhook`, not revoked; expected: `WakeRung.Standby`.~~ Table, row `standby` valid — input: mode `standby`, standby record in mode `webhook`; expected: `WakeRung.Standby`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Table, row `standby` missing — input: mode `standby`, standby `null`; expected: `WakeRung.Inbox`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Table, row `standby` in standby mode — input: standby record in mode `standby`; expected: `WakeRung.Inbox`. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Table, row `standby` revoked — input: standby record with `revokedAt` set; expected: `WakeRung.Inbox`.~~ merged into the `standby` missing row (R4). — evidence: PASS ad62d11 (retest-head.md)
- [x] Table, row `none` — input: mode `none`; expected: `WakeRung.Inbox`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Edge: `pollState` is `null` for a scheduled wake — input: scheduled mode, `pollState: null`; expected: throws (R8), never a rung. — evidence: PASS ad62d11 (retest-head.md)
- [x] Edge: a stale scheduled connection polls again — input: stale wake whose `lastPolledAt` is set to now; expected: `WakeRung.Scheduled`, no stored change. — evidence: PASS ad62d11 (retest-head.md)

### A4 Copy (`wake-copy.test.ts`)

- [x] `expectedDelayNoteCopy` in pt-BR (R10) — input: interval 60, elapsed 12 min; expected: contains `de hora em hora` and `há 12 min`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Cadence — input: interval 120; expected: contains `a cada 2 horas`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Cadence — input: interval 90; expected: contains `a cada 90 minutos`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Elapsed — input: elapsed 0; expected: contains `há 0 min`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Elapsed — input: elapsed 59 min; expected: contains `há 59 min`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Elapsed boundary — input: elapsed 60 min; expected: contains `há 1 h`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Elapsed rounding — input: elapsed 125 min; expected: contains `há 2 h` (not `há 3 h`). — evidence: PASS ad62d11 (retest-head.md)
- [x] Never polled — input: `elapsedSinceLastPollMs: null`; expected: contains `Ainda não olhou a caixa.` (capitalised, as declared in `WAKE_COPY`). — evidence: PASS ad62d11 (retest-head.md)
- [x] `expectedDelayNoteCopy` in en-US — input: interval 60, elapsed 12 min; expected: contains `every hour` and `12 min ago`. — evidence: PASS ad62d11 (retest-head.md)
- [x] English never polled — input: `null`; expected: contains `has not checked the inbox yet`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `staleNoticeCopy` — input: agent `chatgpt`, elapsed 3 h, pt-BR; expected: contains `chatgpt` and `há 3 h`, and no message body text. — evidence: PASS ad62d11 (retest-head.md)
- [x] Both locales present — input: every `WakeCopyKey` of `WAKE_COPY`; expected: each has the two `OwnerLocale` entries, none empty (a `wake_failed` pin included). — evidence: PASS ad62d11 (retest-head.md)
- [x] Missing token throws — input: `fillCopyTokens` with a value missing for `{agent}`; expected: throws `InvalidInput` naming `agent`. — evidence: PASS ad62d11 (retest-head.md)

### A5 Owner message id (`message.test.ts`)

- [x] `ownerMessageIdOf` on a primary row — input: message with `messageId` `m1` and `originMessageId: null`; expected: `m1`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `ownerMessageIdOf` on a copy — input: message with `messageId` `c1` and `originMessageId` `m1`; expected: `m1`. — evidence: PASS ad62d11 (retest-head.md)

### A6 Constants (`constants.test.ts`; pin: the values are declared at Step 0, so these pass on arrival)

- [x] `SCHEDULED_MIN_INTERVAL_MINUTES` — input: the constant; expected: `1`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `SCHEDULED_MAX_INTERVAL_MINUTES` — input: the constant; expected: `1440`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `STALE_POLL_INTERVAL_MULTIPLE` — input: the constant; expected: `2`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `SAFETY_NET_CRON` — input: the constant; expected: `0 * * * *`. — evidence: PASS ad62d11 (retest-head.md)

## B. Wakers and core use cases (in-memory repository, fake clock)

### B1 `setWake` (`set-wake.test.ts`)

- [x] `setWake` scheduled — input: caller `chatgpt`, setting scheduled 60, identity `ownerLocale` pt-BR; expected: `{status: 'saved', wakeMode: 'scheduled', effectiveRung: 'scheduled', provider: null}`; saved row has `ownerLocale` pt-BR. — evidence: PASS ad62d11 (retest-head.md)
- [x] `setWake` scheduled 0 — input: as above with 0; expected: `InvalidInput`; `saveWake` called zero times. — evidence: PASS ad62d11 (retest-head.md)
- [x] `setWake` keeps the poll — input: `lastPolledAt` = T, `setWake` scheduled 60 at T + 30 min; expected: stored `lastPolledAt` still T. — evidence: PASS ad62d11 (retest-head.md)
- [x] `setWake` standby — input: caller `grok-web`, standby `grok-bot` present in mode `webhook`; expected: `{wakeMode: 'standby', effectiveRung: 'standby'}`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `setWake` standby missing — input: standby name not in the repository; expected: `InvalidInput`, nothing saved. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~`setWake` standby revoked — input: standby with `revokedAt` set; expected: `InvalidInput` naming `standby_agent`, nothing saved.~~ merged into "standby missing" (R4). — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~`setWake` `local` and `none` — input: each; expected: stored mode equals the input mode.~~ `setWake` `local` and `none` — input: `none`; expected: stored mode equals the input mode. (R3) — evidence: PASS ad62d11 (retest-head.md)

### B2 Polls (`poll-inbox.test.ts`)

- [x] `pollInbox` on an empty box — input: agent `chatgpt`, no unread; expected: `{status: 'empty', messages: []}`, `recordPoll` called once with `polledAt` = now and `ownerLocale` = the identity's. — evidence: PASS ad62d11 (retest-head.md)
- [x] `pollInbox` empty reads no bodies — input: as above, spy on `listUnread` and `markRead`; expected: both called zero times, `countUnread` once (R9: today's `checkInbox` always runs `listUnread`; the count-first path is new). — evidence: PASS ad62d11 (retest-head.md)
- [x] `checkInbox` empty reads no bodies — input: the same spy on slice 1's `checkInbox`; expected: `listUnread` zero times (the extracted `readInbox`). — evidence: PASS ad62d11 (retest-head.md)
- [x] `pollInbox` registers the agent first — input: agent never seen, `pollInbox`; expected: `registerAgent` before `recordPoll` (the `UPDATE` needs the row). — evidence: PASS ad62d11 (retest-head.md)
- [x] `pollInbox` with two unread — input: two unread messages; expected: `{status: 'new'}` with two messages, both marked read. — evidence: PASS ad62d11 (retest-head.md)
- [x] `pollInbox` clears the stale flag — input: `pollerStaleNotified: true`; expected: after the call `pollerStaleNotified` false and `hasPolled` true. — evidence: PASS ad62d11 (retest-head.md)
- [x] `getMessages` records no poll — input: `getMessages` for `chatgpt`; expected: `recordPoll` zero times (`getMessages` does not call `pollInbox`). — evidence: PASS ad62d11 (retest-head.md)
- [x] `ask` records no poll — input: `ask` returning pending; expected: `recordPoll` zero times. — evidence: PASS ad62d11 (retest-head.md)
- [x] `waitForReply` records no poll — input: `waitForReply` with no answer; expected: `recordPoll` zero times. — evidence: PASS ad62d11 (retest-head.md)

### B3 Scheduled waker (`scheduled-agent-waker.test.ts`)

- [x] ~~Note on 0 → 1 — input: owner message stored for `chatgpt` (rung scheduled), `firstUnread` true, pt-BR; expected: one `deliverToOwner` with `agent: null` containing `chatgpt` and `de hora em hora`; `notify` returns `Woken`.~~ Note on 0 → 1 — input: `notify` for `chatgpt` (rung scheduled), reason `MessageWaiting`, pt-BR (`notify` is only ever called on a 0 to 1 arrival, R5); expected: one `deliverToOwner` with `agent: null` containing `chatgpt` and `de hora em hora`; `notify` returns `Woken`. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~No note on 1 → 2 — input: `firstUnread` false; expected: no note; returns `Woken`.~~ replaced by a `receive-owner-message.test.ts` case: input: `chatgpt` already holds one unread; expected: `notify` is not called, so no note (A9). — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Note in English for an en-US identity — input: `ownerLocale` en-US, `firstUnread` true; expected: note contains `every hour`.~~ Note in English for an en-US identity — input: `ownerLocale` en-US; expected: note contains `every hour`. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Note carries the last poll — input: last poll 3 h ago, `firstUnread` true; expected: note contains `há 3 h`.~~ Note carries the last poll — input: last poll 3 h ago; expected: note contains `há 3 h`. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Never polled note — input: `hasPolled` false, `firstUnread` true; expected: note contains `ainda não olhou a caixa`.~~ Never polled note — input: `hasPolled` false; expected: note contains `Ainda não olhou a caixa.` — evidence: PASS ad62d11 (retest-head.md)
- [x] No note for a standby reason — input: reason `StandbyFor`; expected: no note; returns `Woken`. — evidence: PASS ad62d11 (retest-head.md)

### B4 Inbox waker for stale scheduled (`inbox-agent-waker.test.ts`)

- [x] ~~Stale scheduled, 0 → 1 — input: stored mode scheduled, stale, `firstUnread` true, reason `MessageWaiting`/owner; expected: the note is sent first, then `notify` returns `Unreached` (core then sends the inbox notice; order asserted with the sender spy).~~ Stale scheduled, 0 → 1 — input: stored mode scheduled, stale, reason `MessageWaiting`; expected: the note is sent first, then `notify` returns `Unreached` (core then sends the inbox notice; order asserted with the sender spy). — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Stale scheduled, 1 → 2 — input: `firstUnread` false; expected: no note; returns `Unreached`.~~ dropped (R5). — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Non-scheduled connection — input: mode `none`, `firstUnread` true; expected: no note; returns `Unreached`.~~ Non-scheduled connection — input: mode `none`; expected: no note; returns `Unreached`. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Webhook connection on the inbox rung — input: mode `webhook` with no outbound target (Unreached): `firstUnread` true; expected: no note; returns `Unreached`.~~ Webhook connection on the inbox rung — input: mode `webhook` with no outbound target; expected: no note; returns `Unreached`. — evidence: PASS ad62d11 (retest-head.md)

### B5 Standby waker (`standby-agent-waker.test.ts`)

- [x] Copy written — input: owner message `m1` routed to `grok-web` (standby `grok-bot`, valid), `messageId` = `m1`; expected: `insertHandoff` called with a copy whose `messageId` is a new id (not `m1`), `originMessageId` = `m1`, `agent` = `grok-bot`, `readByAgent` false. — evidence: PASS ad62d11 (retest-head.md)
- [x] Primary copy read — input: as above; expected: `insertHandoff` called with `primaryAgent: 'grok-web'`, `handedTo: 'grok-bot'`, and the primary row (`m1`) read with `handedTo` = `grok-bot` after the call. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Standby woken on 0 → 1 — input: `grok-bot` unread count 0 before; expected: `dependencies.waker.notify` called once with `{agent: 'grok-bot', reason: 'standby_for', firstUnread: true}` and no pointer; returns the standby's outcome.~~ Standby woken on 0 → 1 — input: `grok-bot` unread count 0 before; expected: `dependencies.waker.notify` called once with `{agent: 'grok-bot', reason: 'standby_for'}` and no pointer; returns the standby's outcome. — evidence: PASS ad62d11 (retest-head.md)
- [x] Standby not woken on 1 → 2 — input: `grok-bot` unread count 1 before; expected: `notify` not called for `grok-bot`; returns `Woken`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Primary never woken — input: as the first case; expected: no `notify` call with `agent: 'grok-web'`. — evidence: PASS ad62d11 (retest-head.md)
- [ ] Standby outcome passes through — input: standby `notify` returns `Unreached`; expected: the waker returns `Unreached`, the copy stays unread (`countUnread('grok-bot')` = 1), so core sends the inbox notice. — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge
- [x] ~~No messageId throws — input: `notify` with `messageId` absent on the standby rung; expected: throws `InboxError` `InvalidInput` naming `messageId`; no copy.~~ No messageId throws — input: `notify` with `messageId` absent on the standby rung; expected: returns `Unreached`, no copy, no `notify` for `grok-bot` (R6). — evidence: PASS ad62d11 (retest-head.md)
- [x] Message not found throws — input: `messageId` of a message that does not exist; expected: throws `NotFound`; no copy. — evidence: PASS ad62d11 (retest-head.md)
- [ ] Routing-list assignment is not handed off (R6) — input: held messages assigned to a standby-mode `grok-web` by a routing-list tap; expected: `notify` without `messageId`, no `insertHandoff`, the owner gets the inbox notice. — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge
- [x] Answer is not handed off — input: an owner choice tap answering a question of `grok-web` (standby mode); expected: receive path calls `notify` without `messageId`; the standby waker is never reached with a copy (no `insertHandoff`). — evidence: PASS ad62d11 (retest-head.md)
- [x] Every owner kind hands off with its content — input: one each of text, location, contacts, reaction and choice, and each of the six media kinds, routed to a standby-mode primary; expected: a copy for each, the same `mediaId` for media kinds, `messageId` new in each case. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Standby wake carries no body — input: text `"segredo"` handed off; expected: the object passed to `notify` has only `agent`, `reason` and `firstUnread`, and `JSON.stringify` of it does not contain `segredo`.~~ Standby wake carries no body — input: text `"segredo"` handed off; expected: the object passed to `notify` has only `agent` and `reason`, and `JSON.stringify` of it does not contain `segredo`. — evidence: PASS ad62d11 (retest-head.md)

### B6 Dispatcher (`dispatching-agent-waker.test.ts`)

- [x] Routes by effective rung — input: four wakes, one per rung (scheduled fresh, scheduled stale, standby valid, none); expected: scheduled → `ScheduledAgentWaker`, stale → `InboxAgentWaker`, standby → `StandbyAgentWaker`, none → `InboxAgentWaker`; each spy called once. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Standby revoked at dispatch time — input: standby valid at set time, `revokedAt` set before the message; expected: `InboxAgentWaker` is chosen; no copy.~~ Standby revoked at dispatch time — input: standby valid at set time, its `agent_wake` row deleted before the message (the effect of `recordRevocation`); expected: `InboxAgentWaker` is chosen; no copy. — evidence: PASS ad62d11 (retest-head.md)

### B7 Poller alarm logic (`evaluate-pollers.test.ts`)

- [x] One notice per episode — input: one stale scheduled wake; expected: one stale notice with the agent name and elapsed text, `markStaleNotified` once. — evidence: PASS 22b8b4f (delta-head.md)
- [x] No duplicate — input: call again with no poll; expected: no second notice; `nextDueAt` null. — evidence: PASS 22b8b4f (delta-head.md)
- [x] New episode after a poll — input: a poll clears the flag, then the connection goes stale again; expected: a second notice. — evidence: PASS 22b8b4f (delta-head.md)
- [x] Next deadline — input: two scheduled, not stale, deadlines D1 < D2; expected: `nextDueAt` = D1. — evidence: PASS 22b8b4f (delta-head.md)
- [x] Notified ignored in the deadline — input: one notified, one not stale with D2; expected: `nextDueAt` = D2. — evidence: PASS 22b8b4f (delta-head.md)
- [x] Nothing scheduled — input: none; expected: `{nextDueAt: null}`, no notice. — evidence: PASS 22b8b4f (delta-head.md)
- [x] ~~Revoked scheduled excluded — input: scheduled, `revokedAt` set, stale; expected: no notice.~~ Revoked scheduled excluded — input: a scheduled wake whose row was deleted; expected: not listed by `listScheduledWakes`, no notice (R4). — evidence: PASS 22b8b4f (delta-head.md)
- [x] Non-scheduled ignored — input: `webhook` wake 10 h stale; expected: no notice. — evidence: PASS 22b8b4f (delta-head.md)
- [x] Locale of the wake — input: stale wake with `ownerLocale` en-US; expected: the notice equals the `staleNoticeCopy` en-US output. — evidence: PASS 22b8b4f (delta-head.md)
- [x] `nextPollerDeadline` (R9) — input: two scheduled wakes; expected: the earliest `pollerDeadline`, `null` with none, equal to `evaluatePollers`' `nextDueAt` after a no-op pass. — evidence: PASS 22b8b4f (delta-head.md)
- [x] Scheduled row without locale throws — input: scheduled wake with `ownerLocale` null; expected: throws naming `owner_locale`; no notice; `pollerStaleNotified` stays false. — evidence: PASS 22b8b4f (delta-head.md)

## C. Worker storage (`apps/api/test/integration/scheduled-wake-storage.test.ts`, real Durable Object SQLite)

- [ ] ~~Migration to `v3` from `v2` — input: an object at `v2` with two messages and two agents; expected: after start `v3` is recorded, both messages and agents remain, row counts equal.~~ Migration to `v3` from `v2` — input: an object that applied `v1` and `v2` with two messages and two agents; expected: after start `v3` is recorded, both messages and agents remain, row counts equal, `has_polled` 0 on both rows. A second case applies `v1` and `v3` without `v2`: the set-of-applied-versions runner applies `v3` alone (webhook-wake A28). — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge
- [x] Unique message ids — input: insert two rows with the same `id` and different `agent`; expected: the second insert fails with a unique error (copies must use new ids). — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~`findWake` unknown — input: `agent: 'nobody'`; expected: `null`.~~ `findWake` unknown — input: `agent: 'nobody'`; expected: `findWake` and `findPollState` both `null`. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~`saveWake` scheduled — input: scheduled 60 with `ownerLocale` pt-BR; expected: `interval_minutes` 60, `standby_agent` NULL, `owner_locale` `pt_BR`.~~ `saveWake` scheduled — input: scheduled 60 with `ownerLocale` pt-BR; expected: `interval_minutes` 60, `standby_agent` NULL, `owner_locale` `pt_BR`, and `last_polled_at`, `has_polled`, `poller_stale_notified` unchanged (R7). — evidence: PASS ad62d11 (retest-head.md)
- [x] `saveWake` standby — input: standby `grok-bot`; expected: `standby_agent` `grok-bot`, `interval_minutes` NULL. — evidence: PASS ad62d11 (retest-head.md)
- [x] `saveWake` none after scheduled — input: none; expected: `interval_minutes` NULL, `standby_agent` NULL. — evidence: PASS ad62d11 (retest-head.md)
- [x] Mapper throws on a broken row — input: raw row mode `scheduled`, `interval_minutes` NULL; expected: `findWake` throws naming the column; no default returned. — evidence: PASS ad62d11 (retest-head.md)
- [x] `recordPoll` — input: T, pt-BR; expected: `last_polled_at` T, `has_polled` 1, `owner_locale` `pt_BR`, `poller_stale_notified` 0. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~`recordRevocation` — input: revokedAt T; expected: `revoked_at` T; `listScheduledWakes` excludes the agent.~~ dropped (R4). — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~`listScheduledWakes` — input: two scheduled, one webhook, one scheduled revoked; expected: exactly the two non-revoked scheduled rows.~~ `listScheduledWakes` — input: two scheduled, one webhook, one scheduled whose row slice 3 deleted; expected: exactly the two scheduled rows, each with its `PollState`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `recordPoll` leaves the mode alone (R7) — input: a webhook row, `recordPoll`; expected: `mode`, `provider`, `sealed_target` unchanged. `saveWake` after `recordPoll`: `last_polled_at` unchanged. — evidence: PASS ad62d11 (retest-head.md)
- [x] `recordPoll` without a row — input: agent with no `agent_wake` row; expected: throws, no row created. — evidence: PASS ad62d11 (retest-head.md)
- [x] `markStaleNotified` survives restart — input: mark `chatgpt`, re-create the object over the same storage; expected: `poller_stale_notified` 1. — evidence: PASS 22b8b4f (delta-head.md)
- [x] `insertHandoff` is atomic — input: a spy makes the primary update fail; expected: the copy insert is rolled back too (no copy row). — evidence: PASS ad62d11 (retest-head.md)
- [x] `insertHandoff` marks the primary — input: `m1` for `grok-web`, copy `c1` for `grok-bot`; expected: `m1` row has `read_at` set and `handed_to` `grok-bot`; `c1` row exists with `agent` `grok-bot`, `origin_message_id` `m1`, `read_at` NULL. — evidence: PASS ad62d11 (retest-head.md)
- [x] `findMessage` by copy id — input: `findMessage({messageId: 'c1'})`; expected: the copy row (`agent` `grok-bot`). — evidence: PASS ad62d11 (retest-head.md)
- [x] `countUnread` uses the partial index — input: `EXPLAIN QUERY PLAN` of the count; expected: plan includes `inbox_messages_unread`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `countUnread` empty — input: no rows; expected: `0`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `countUnread` ignores read rows — input: three rows, two read; expected: `1`. — evidence: PASS ad62d11 (retest-head.md)

## D. Worker alarm, handoff, payload and revoke flow

### D1 Alarm and restart (`scheduled-wake-alarm.test.ts`)

- [x] Alarm sends one stale notice — input: scheduled `chatgpt` 60, clock advanced by `POST /dev/owner/:phone/clock` with `advance_ms` = 2 × HOUR_MS + MINUTE_MS, then `runDurableObjectAlarm`; expected: the simulator screen lists one stale notice. — evidence: PASS ad62d11 (retest-head.md)
- [x] Alarm does not repeat — input: `runDurableObjectAlarm` again; expected: still one stale notice. — evidence: PASS ad62d11 (retest-head.md)
- [ ] Alarm order — input: an expired queued message and a stale poller at the same alarm; expected: the expiry sweep runs first (message `Expired`), then the stale notice. — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge
- [ ] Alarm re-arms to the earliest deadline — input: poller deadline D and queue expiry E with D < E; expected: `ctx.storage.getAlarm()` equals D. — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge
- [ ] Re-arm after eviction — input: object re-created over the same storage; expected: alarm set to the stored deadline; `runDurableObjectAlarm` sends the notice. — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge
- [ ] `setWake` re-arms — input: `setWake` scheduled 60 through the RPC; expected: alarm equals `lastPolledAt + 2 × HOUR_MS`. — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge
- [ ] Note once, then the inbox notice — input: stale scheduled `chatgpt`, owner text; expected: screen shows the note, then the inbox notice, in that order. — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge

### D2 Standby handoff end to end (`standby-handoff.test.ts`)

- [x] Reply to the copy — input: standby `grok-bot` receives copy `c1` (origin `m1`) and sends `send_message` with `reply_to` = `c1`; expected: accepted; the reply's stored `replyToMessageId` resolves to the owner message `m1` (canonical id). — evidence: PASS ad62d11 (retest-head.md)
- [x] Reply to the origin id — input: the same reply with `reply_to` = `m1`; expected: accepted; resolves to `m1`; the stored reply is identical to the previous case. — evidence: PASS ad62d11 (retest-head.md)
- [x] Reply to an unknown id — input: `reply_to` = `zz9`; expected: tool error naming `reply_to`, nothing stored. — evidence: PASS ad62d11 (retest-head.md)
- [x] Primary cannot read the copy — input: `grok-web` calls `check_inbox` after the handoff; expected: `{status: 'empty', messages: []}`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Primary history shows the hand-off — input: `grok-web` calls `get_messages`; expected: `m1` appears in `history` with `handed_to: 'grok-bot'`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Standby poll returns the copy — input: `grok-bot` calls `check_inbox`; expected: `{status: 'new'}` with copy `c1`, `origin_message_id` `m1`, no content of another agent. — evidence: PASS ad62d11 (retest-head.md)


### D3 Revoke flow (`standby-revocation.test.ts`, needs accounts-and-keys merged)

- [x] ~~Revoke through the command — input: owner sends `revogar grok-bot` (pt-BR) through the simulator while `grok-web` is set to standby `grok-bot`; expected: the command reply `Revoked`; the account object's `recordRevocation` was called with `agent: 'grok-bot'` and `revokedAt` = clock now.~~ Revoke through the command — input: owner sends `revogar grok-bot` (pt-BR) through the simulator while `grok-web` is set to standby `grok-bot`; expected: the command reply `Revoked`; the `agent_wake` row of `grok-bot` is gone and `revoked_agents` lists it (slice 3's `recordRevocation({agent})`, DO schema `v6`). — evidence: PASS 22b8b4f (delta-head.md)
- [ ] No copy after revoke — input: owner text to `grok-web` after the revoke; expected: no copy row for `grok-bot`; `grok-web`'s inbox holds the message unread; the owner gets the inbox notice. — evidence: PASS 22b8b4f (delta-head.md) — retest after b63f7bb merge
- [x] ~~Set after revoke refused — input: `grok-web` calls `set_wake` standby `grok-bot` after the revoke; expected: tool error naming `standby_agent` and `revoked`; nothing saved.~~ Set after revoke refused — input: `grok-web` calls `set_wake` standby `grok-bot` after the revoke; expected: tool error naming `standby_agent` and `not connected to this account`; nothing saved. (R4) — evidence: PASS 22b8b4f (delta-head.md)
- [x] ~~Rotate does not revoke — input: owner sends `girar grok-bot`; expected: `recordRevocation` not called; a handoff still works afterwards.~~ Rotate does not revoke — input: owner sends `girar grok-bot`; expected: the `agent_wake` row of `grok-bot` and its wake mode survive; a handoff still works afterwards. — evidence: PASS 22b8b4f (delta-head.md)
- [x] Revoked secret — input: the revoked `grok-bot` secret calls `check_inbox`; expected: HTTP `401` with `{"error":"unauthorized"}`. — evidence: PASS 22b8b4f (delta-head.md)

## E. MCP over HTTP (`apps/api/test/integration/mcp-scheduled-wake.test.ts`)

- [x] `set_wake` scheduled — input: `{mode: "scheduled", interval_minutes: 60}`; expected: `{status: "saved", wake_mode: "scheduled", effective_rung: "scheduled"}`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `set_wake` standby — input: `{mode: "standby", standby_agent: "grok-bot"}` (same account, webhook); expected: `{status: "saved", wake_mode: "standby", effective_rung: "standby"}`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Pin: `set_wake` none — input: `{mode: "none"}`; expected: `effective_rung: "inbox"` (passes on arrival). — evidence: PASS ad62d11 (retest-head.md)
- [x] Pin: `set_wake` webhook still works — input: slice 4's webhook input; expected: slice 4's result unchanged (passes on arrival). — evidence: PASS ad62d11 (retest-head.md)
- [x] Interval 0 — input: `{mode: "scheduled", interval_minutes: 0}`; expected: tool error naming `interval_minutes` and `1`; nothing saved. — evidence: PASS ad62d11 (retest-head.md)
- [x] Interval 1441 — input: `{mode: "scheduled", interval_minutes: 1441}`; expected: tool error naming `interval_minutes` and `1440`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Interval as a string — input: `interval_minutes: "60"`; expected: tool error naming `interval_minutes`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Interval 60.5 — input: `interval_minutes: 60.5`; expected: tool error naming `interval_minutes`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Unknown field rejected — input: `{mode: "none", account_id: "x"}`; expected: tool error naming the field; nothing saved (R13: the strict object registration; this case is red before S4.2 if the SDK strips the key). — evidence: PASS ad62d11 (retest-head.md)
- [x] Agent name in input rejected — input: `{mode: "scheduled", interval_minutes: 60, agent: "other"}`; expected: tool error; nothing saved. — evidence: PASS ad62d11 (retest-head.md)
- [x] Standby of the caller rejected — input: `standby_agent` = caller's name; expected: tool error naming `standby_agent`. — evidence: PASS ad62d11 (retest-head.md)
- [x] Standby name malformed — input: `standby_agent: "Grok Bot!"`; expected: tool error naming `standby_agent` and the name pattern. — evidence: PASS ad62d11 (retest-head.md)
- [x] Standby of another account — input: a name that exists only in another account; expected: tool error naming `standby_agent`; no other account's data in the text. — evidence: PASS ad62d11 (retest-head.md)
- [x] Standby in standby mode — input: `standby_agent` naming a connection in mode `standby`; expected: tool error naming `standby_agent` and `one hop`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `check_inbox` empty — input: no unread; expected: `{status: "empty", messages: []}`. — evidence: PASS ad62d11 (retest-head.md)
- [x] `check_inbox` new — input: two unread; expected: `{status: "new"}` with two messages in slice 1's wire shape. — evidence: PASS ad62d11 (retest-head.md)

## F. E2E in the owner simulator (`apps/api/test/e2e/scheduled-wake.e2e.test.ts`, default gate, `wrangler dev`)

- [x] Scheduled poll with the note — input: `chatgpt` calls `set_wake` scheduled 60 and `check_inbox` at T; the owner (`POST /dev/owner/:phone/messages`) sends text at T + 10 min; expected: `GET /dev/owner/:phone/screen` lists the expected-delay note with `chatgpt` and `há 10 min`. — evidence: PASS ad62d11 (retest-head.md)
- [ ] Stale notice once, then held — input: `POST /dev/owner/:phone/clock` with `advance_ms` = 2 × HOUR_MS + MINUTE_MS; expected: the screen lists one stale notice naming `chatgpt`; the owner's next text gets the inbox notice; `get_messages` on `chatgpt` shows the message. — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge
- [x] Poll ends the episode — input: `chatgpt` calls `check_inbox` after the stale notice; expected: no new stale notice on the next clock advance without a new stale episode. — evidence: PASS ad62d11 (retest-head.md)
- [ ] Standby answers as itself — input: `grok-web` (standby `grok-bot`, a second SDK client); owner sends `"oi"`; `grok-bot` receives the wake, calls `check_inbox`, sends `send_message` with `reply_to` = its copy's id; expected: the screen lists the reply from `grok-bot`; `grok-web`'s next `check_inbox` returns no messages. — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge
- [x] Note in the owner's locale — input: an en-US owner identity (the account property set at creation); expected: the note text is the en-US text. — evidence: PASS ad62d11 (retest-head.md)

## G. Docs (`apps/docs`)

- [x] `mint broken-links` — input: docs package after S6.2; expected: exit 0. — evidence: PASS ad62d11 (retest-head.md)
- [x] No fake WhatsApp, no jargon on the main path (R15) — input: both wake-ladder pages and both `set-wake` reference pages; expected: no `simulator`, `fake` or `dev route`; the main path of the wake-ladder pages names no tool field. — evidence: PASS ad62d11 (retest-head.md)
- [x] Twin test — input: the shape gate with the new pages; expected: every new page has its `pt-br` twin and the test is green. — evidence: PASS ad62d11 (retest-head.md)
- [x] `set-wake` reference — input: both reference pages; expected: the `scheduled` and `standby` variants with `interval_minutes` 1 to 1440 (60 minimum noted for ChatGPT and claude.ai) and `standby_agent`. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Rung table — input: `apps/docs/concepts/wake-ladder.mdx`; expected: contains `scheduled`, `standby`, `inbox` in the rung table.~~ Rung table — input: `apps/docs/concepts/wake-ladder.mdx` and `apps/docs/pt-br/concepts/wake-ladder.mdx`; expected: both exist, both name the five rungs in plain words (no field names on the main path). — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~Both note forms — input: the page; expected: contains `de hora em hora` and `every hour`.~~ Both note forms — input: the English page and the pt-br page; expected: the English page contains `every hour` and no Portuguese example; the pt-br page contains `de hora em hora` and no English example. — evidence: PASS ad62d11 (retest-head.md)
- [x] ~~One-hop rule — input: the page; expected: contains `one hop` or `um salto`.~~ One-hop rule — input: each page; expected: the English page contains `one hop`, the pt-br page contains `um salto`. — evidence: PASS ad62d11 (retest-head.md)

## H. Security checks

- [x] Standby from another account — input: a standby name present only in another account; expected: refused, nothing saved, no row of the other account read. — evidence: PASS ad62d11 (retest-head.md)
- [x] Caller only — input: connection A's `set_wake` naming another connection in any field; expected: rejected; only A's wake row changes. — evidence: PASS ad62d11 (retest-head.md)
- [x] No secret in logs — input: the E2E run with logs captured; expected: no `zb_conn_` value in the output. — evidence: PASS 22b8b4f (delta-head.md)
- [x] No body in handoff logs or payloads — input: handoff of `"segredo"` with a logger spy; expected: `segredo` absent from every logged value and every webhook payload that is not the owner's delivery. — evidence: PASS 22b8b4f (delta-head.md)
- [x] The standby reads only its copy — input: the standby calls `get_messages` with `m1` (the owner id, not its own copy); expected: `not_found` or its own copy only, never the primary's row. — evidence: PASS ad62d11 (retest-head.md)
- [x] Notices go to the owner only — input: a stale notice and an expected-delay note; expected: both recorded for the account's own owner number. — evidence: PASS ad62d11 (retest-head.md)
- [x] Interval bounds before storage — input: `interval_minutes` 0 and 100000; expected: both refused, `interval_minutes` stays NULL. — evidence: PASS ad62d11 (retest-head.md)
- [x] Unknown field rejected even on `none` — input: `{mode: "none", extra: 1}`; expected: rejected. — evidence: PASS ad62d11 (retest-head.md)

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## I. Owner-run (outside the gate, real clients, recorded in the PR)

- [ ] Live claude.ai hourly safety net — input: API trigger for the connection (mode `webhook`) plus an hourly task calling `check_inbox` (`SAFETY_NET_CRON`); owner writes "teste" through WhatsApp; expected: claude.ai answers through `send_message` within 60 s, and the `check_inbox` log shows a poll each hour. — BLOCKED: owner-run (needs live clients)
- [ ] Live ChatGPT "Run on this computer", Hourly — input: Hourly task in one dedicated chat, Mac awake, app open, "Always allow" for `check_inbox` and `send_message`; owner writes "teste"; expected: the next run answers in that chat, and the first message of a batch gets the expected-delay note with the last-poll time. — BLOCKED: owner-run (needs live clients)
- [ ] Live stale notice — input: quit the ChatGPT app for two hours; expected: one stale notice on the owner's WhatsApp; the next run after reopening ends the episode silently. — BLOCKED: owner-run (needs live clients)

## Adversarial review

- [x] Claim 1: a connection that never polled goes stale exactly two intervals after creation — attack: create, never poll, advance 2 × interval − 1 ms and then 2 × interval; expected: no notice, then one notice; result: refuted | held. — evidence: PASS ad62d11 (retest-head.md)
- [ ] Claim 2: the standby never reads the primary's copy and the primary never reads the standby's copy as unread — attack: primary `check_inbox` and `get_messages` after a handoff; standby `reply_to` with both ids; expected: primary sees no unread copy; both `reply_to` ids resolve to one owner message; result: refuted | held. — evidence: PASS ad62d11 (retest-head.md) — retest after b63f7bb merge
- [x] Claim 3: the expected-delay note fires exactly when `notify` is called on a 0 to 1 arrival and a poll resets the cycle — attack: alternate owner text and `check_inbox` ten times on a scheduled connection; expected: exactly ten notes, none on 1 → 2; result: refuted | held. — evidence: PASS ad62d11 (retest-head.md)

## Coverage honesty

- Real Cloud API delivery of notices — the fake sender records them; template rules belong to slice 2. Risk accepted until the owner-run check.
- Real webhook targets (Grok Bot, claude.ai) — fake endpoints in tests; live behaviour is owner-run.
- ChatGPT client drift (minute saved as Hourly, 07:25 for 07:30) — client behaviour in ADR 0025, not reproducible here. A drift shows as a false stale notice that `set_wake` corrects.
- Answers to a standby-mode primary and held messages assigned by a routing-list tap are never handed off (A8, R6). Risk accepted: an owner answer to a primary in standby mode waits with that primary until it polls.
- A live waiter wins over the note and the handoff (A10). Risk accepted: no delay note while the agent is waiting, by design.
- Concurrency between two `check_inbox` calls of one connection — the Durable Object serialises calls; no race test. Risk accepted.
- Browser UI — none in this slice.

## Zapbip's own notices in a closed window (b63f7bb fix)

- [ ] Stale notice in a closed window — input: two stale scheduled connections, window closed; expected: one `Notice` template with sender `zapbip`, both notices `Queued`, no session send; after the owner writes, both notices are sent and the queue is empty — unit `evaluate-pollers-closed-window.test.ts`
- [ ] Rejected template for a zapbip notice — input: stale notice, window closed, template call 1 rejected; expected: no `NoticeFailed` log, episode marked notified, notice `Queued`, `notice_retry_at` = now + 5 min, the alarm retry sends the template — unit `evaluate-pollers-closed-window.test.ts`
- [ ] Queued stale notice and a flush that fails another notice — input: queued `alpha` message, window reopened, session reports the window closed, template rejected; expected: stale notice `Queued`, episode marked notified once, no `NoticeFailed` log — unit `evaluate-pollers-closed-window.test.ts`
- [ ] Expected-delay note that stays queued — input: delivery throws and the note is `Queued`; expected: no `NoticeFailed` log — unit `scheduled-agent-waker.test.ts`
- [ ] Inbox waker note failure — input: stale scheduled connection, delivery throws; expected: `notify` returns `Unreached` and logs `NoticeFailed` — unit `inbox-agent-waker.test.ts`
- [ ] DO upgrade from main's versions — input: object at versions 1, 2, 4 and 5 with an agent and a wake row; expected: 3 and 6 applied, rows kept, `interval_minutes`, `last_stale_notice_at`, `stale_notice_failures` and `account_facts` present — integration `scheduled-wake-storage.test.ts`

