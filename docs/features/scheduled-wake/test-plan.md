# Test plan: Scheduled wake and standby

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Time in core tests comes from the fake `Clock`. `MINUTE_MS` and `HOUR_MS` come from `libs/types`. "Interval 60" means `intervalMinutes: 60`. Owner locale comes from the connection identity: `ownerLocale: OwnerLocale.PortugueseBrazil` unless stated.

Test areas, for parallel tester sub-agents: **A** core rules (pure), **B** wakers and core use cases (in memory), **C** Worker storage, **D** Worker alarm, handoff, payload and revoke flow, **E** MCP over HTTP, **F** E2E in the owner simulator, **G** docs, **H** security, **I** owner-run.

## The failing test first

- [ ] `libs/core/src/wake/wake-rung.test.ts::table` — input: each row of the rung table; expected: each row fails with `wakeRungFor is not implemented` before S2.2.
- [ ] `apps/api/test/integration/mcp-scheduled-wake.test.ts::scheduled set_wake` — input: `tools/call set_wake` with `{mode: "scheduled", interval_minutes: 60}`; expected: a tool error whose text contains `assertWakeSetting is not implemented` before S4.2.
- [ ] `apps/api/test/integration/scheduled-wake-storage.test.ts::findWake round trip` — input: a stored scheduled row with interval 60; expected: `findWake` throws `not implemented` before S1.2.
- [ ] Confirmed it fails for the right reason: each red run's first failure is the named stub, not a compile error. The printed text goes into `tester-briefing.md`.

## A. Core rules (pure, `libs/core/src/wake/*.test.ts`)

### A1 Wake setting validation (`wake-setting.test.ts`)

- [ ] `assertWakeSetting` — input: scheduled, `intervalMinutes: 59`; expected: throws `InboxError` `InvalidInput` whose message contains `interval_minutes` and `60`.
- [ ] `assertWakeSetting` — input: scheduled, `intervalMinutes: 60`; expected: returns.
- [ ] `assertWakeSetting` — input: scheduled, `intervalMinutes: 1440`; expected: returns.
- [ ] `assertWakeSetting` — input: scheduled, `intervalMinutes: 1441`; expected: throws `InvalidInput` naming `interval_minutes` and `1440`.
- [ ] `assertWakeSetting` — input: scheduled, `intervalMinutes: 90.5`; expected: throws `InvalidInput` naming `interval_minutes` and `whole number`.
- [ ] Edge: negative interval — input: scheduled, `intervalMinutes: -60`; expected: throws `InvalidInput` naming `interval_minutes`.
- [ ] Edge: zero interval — input: scheduled, `intervalMinutes: 0`; expected: throws `InvalidInput` naming `interval_minutes`.
- [ ] Edge: scheduled with `intervalMinutes: null`; expected: throws `InvalidInput` naming `interval_minutes` (the mode requires it; null is never read as a default).
- [ ] `assertWakeSetting` — input: standby `grok-bot`, a stored standby record in mode `webhook`, not revoked; expected: returns.
- [ ] `assertWakeSetting` — input: standby, `standbyAgent` equal to the caller `grok-web`; expected: throws `InvalidInput` naming `standby_agent` and `itself`.
- [ ] `assertWakeSetting` — input: standby, standby record `null` (no connection of this account has that name); expected: throws `InvalidInput` naming `standby_agent` and `not connected to this account`.
- [ ] `assertWakeSetting` — input: standby, standby record in mode `standby`; expected: throws `InvalidInput` naming `standby_agent` and `one hop`.
- [ ] Write-time revoke check — input: standby, standby record with `revokedAt` set; expected: throws `InvalidInput` naming `standby_agent` and `revoked`.
- [ ] Edge: `standbyAgent: null` with mode standby; expected: throws `InvalidInput` naming `standby_agent`.
- [ ] `assertWakeSetting` — input: `none`, and `local`; expected: returns for both.
- [ ] Pin: `WakeMode` values — input: `Object.values(WakeMode)`; expected: includes `scheduled` and `standby` exactly once each — pin (passes on arrival after S0.1).

### A2 Poller staleness (`poller.test.ts`)

- [ ] `isPollerStale` — input: scheduled interval 60, `lastPolledAt` = now − (2 × HOUR_MS − 1); expected: `false`.
- [ ] `isPollerStale` — input: scheduled interval 60, `lastPolledAt` = now − 2 × HOUR_MS; expected: `true` (boundary is stale).
- [ ] `isPollerStale` — input: scheduled interval 120, `lastPolledAt` = now − 4 × HOUR_MS; expected: `true`.
- [ ] `isPollerStale` — input: scheduled interval 120, `lastPolledAt` = now − 3 × HOUR_MS; expected: `false`.
- [ ] Edge: never polled counts from creation — input: scheduled interval 60, `hasPolled: false`, `lastPolledAt` = creation, now = creation + 2 × HOUR_MS; expected: `true`.
- [ ] Edge: never polled, not yet stale — input: scheduled interval 60, `hasPolled: false`, now = creation + HOUR_MS; expected: `false`.
- [ ] `isPollerStale` — input: mode `webhook`, `lastPolledAt` = now − 10 × HOUR_MS; expected: `false`.
- [ ] `isPollerStale` — input: scheduled, `revokedAt` set, now − 10 × HOUR_MS; expected: `false`.
- [ ] `pollerDeadline` — input: scheduled interval 60, `lastPolledAt` = T, not notified; expected: `T + 2 × HOUR_MS`.
- [ ] `pollerDeadline` — input: scheduled, `pollerStaleNotified: true`; expected: `null`.
- [ ] `pollerDeadline` — input: mode `standby`; expected: `null`.

### A3 Effective rung (`wake-rung.test.ts`)

- [ ] Table, row `local` — input: mode `local`; expected: `WakeRung.Local`.
- [ ] Table, row `webhook` — input: mode `webhook`; expected: `WakeRung.Webhook`.
- [ ] Table, row `scheduled` not stale — input: mode `scheduled`, now = lastPolledAt + HOUR_MS; expected: `WakeRung.Scheduled`.
- [ ] Table, row `scheduled` stale — input: mode `scheduled`, now = lastPolledAt + 2 × HOUR_MS (interval 60); expected: `WakeRung.Inbox`, and the input object's `mode` is still `scheduled` afterwards (no mutation).
- [ ] Table, row `standby` valid — input: mode `standby`, standby record in mode `webhook`, not revoked; expected: `WakeRung.Standby`.
- [ ] Table, row `standby` missing — input: mode `standby`, standby `null`; expected: `WakeRung.Inbox`.
- [ ] Table, row `standby` in standby mode — input: standby record in mode `standby`; expected: `WakeRung.Inbox`.
- [ ] Table, row `standby` revoked — input: standby record with `revokedAt` set; expected: `WakeRung.Inbox`.
- [ ] Table, row `none` — input: mode `none`; expected: `WakeRung.Inbox`.
- [ ] Edge: a stale scheduled connection polls again — input: stale wake whose `lastPolledAt` is set to now; expected: `WakeRung.Scheduled`, no stored change.

### A4 Copy (`wake-copy.test.ts`)

- [ ] `WAKE_COPY[OwnerLocale.PortugueseBrazil].expectedDelayNote` — input: interval 60, elapsed 12 min; expected: contains `de hora em hora` and `há 12 min`.
- [ ] Cadence — input: interval 120; expected: contains `a cada 2 horas`.
- [ ] Cadence — input: interval 90; expected: contains `a cada 90 minutos`.
- [ ] Elapsed — input: elapsed 0; expected: contains `há 0 min`.
- [ ] Elapsed — input: elapsed 59 min; expected: contains `há 59 min`.
- [ ] Elapsed boundary — input: elapsed 60 min; expected: contains `há 1 h`.
- [ ] Elapsed rounding — input: elapsed 125 min; expected: contains `há 2 h` (not `há 3 h`).
- [ ] Never polled — input: `elapsedSinceLastPollMs: null`; expected: contains `ainda não olhou a caixa`.
- [ ] `WAKE_COPY[OwnerLocale.EnglishUs].expectedDelayNote` — input: interval 60, elapsed 12 min; expected: contains `every hour` and `12 min ago`.
- [ ] English never polled — input: `null`; expected: contains `has not checked the inbox yet`.
- [ ] `staleNotice` — input: agent `chatgpt`, elapsed 3 h, pt-BR; expected: contains `chatgpt` and `há 3 h`, and no message body text.
- [ ] Both locales present — input: `Object.keys(WAKE_COPY)`; expected: equals the two `OwnerLocale` values, no empty string.

### A5 Owner message id (`message.test.ts`)

- [ ] `ownerMessageIdOf` on a primary row — input: message with `messageId` `m1` and `originMessageId: null`; expected: `m1`.
- [ ] `ownerMessageIdOf` on a copy — input: message with `messageId` `c1` and `originMessageId` `m1`; expected: `m1`.

### A6 Constants (`constants.test.ts`; pin: the values are declared at Step 0, so these pass on arrival)

- [ ] `SCHEDULED_MIN_INTERVAL_MINUTES` — input: the constant; expected: `60`.
- [ ] `SCHEDULED_MAX_INTERVAL_MINUTES` — input: the constant; expected: `1440`.
- [ ] `STALE_POLL_INTERVAL_MULTIPLE` — input: the constant; expected: `2`.
- [ ] `SAFETY_NET_CRON` — input: the constant; expected: `0 * * * *`.

## B. Wakers and core use cases (in-memory repository, fake clock)

### B1 `setWake` (`set-wake.test.ts`)

- [ ] `setWake` scheduled — input: caller `chatgpt`, setting scheduled 60, identity `ownerLocale` pt-BR; expected: `{status: 'saved', wakeMode: 'scheduled', effectiveRung: 'scheduled', provider: null}`; saved row has `ownerLocale` pt-BR.
- [ ] `setWake` scheduled 59 — input: as above with 59; expected: `InvalidInput`; `saveWake` called zero times.
- [ ] `setWake` keeps the poll — input: `lastPolledAt` = T, `setWake` scheduled 60 at T + 30 min; expected: stored `lastPolledAt` still T.
- [ ] `setWake` standby — input: caller `grok-web`, standby `grok-bot` present in mode `webhook`; expected: `{wakeMode: 'standby', effectiveRung: 'standby'}`.
- [ ] `setWake` standby missing — input: standby name not in the repository; expected: `InvalidInput`, nothing saved.
- [ ] `setWake` standby revoked — input: standby with `revokedAt` set; expected: `InvalidInput` naming `standby_agent`, nothing saved.
- [ ] `setWake` `local` and `none` — input: each; expected: stored mode equals the input mode.

### B2 Polls (`poll-inbox.test.ts`)

- [ ] `pollInbox` on an empty box — input: agent `chatgpt`, no unread; expected: `{status: 'empty', messages: []}`, `recordPoll` called once with `polledAt` = now and `ownerLocale` = the identity's.
- [ ] `pollInbox` empty reads no bodies — input: as above, spy on `listUnread`; expected: `listUnread` called zero times, `countUnread` once.
- [ ] `pollInbox` with two unread — input: two unread messages; expected: `{status: 'new'}` with two messages, both marked read.
- [ ] `pollInbox` clears the stale flag — input: `pollerStaleNotified: true`; expected: after the call `pollerStaleNotified` false and `hasPolled` true.
- [ ] `getMessages` records no poll — input: `getMessages` for `chatgpt`; expected: `recordPoll` zero times (`getMessages` does not call `pollInbox`).
- [ ] `ask` records no poll — input: `ask` returning pending; expected: `recordPoll` zero times.
- [ ] `waitForReply` records no poll — input: `waitForReply` with no answer; expected: `recordPoll` zero times.

### B3 Scheduled waker (`scheduled-agent-waker.test.ts`)

- [ ] Note on 0 → 1 — input: owner message stored for `chatgpt` (rung scheduled), `firstUnread` true, pt-BR; expected: one `deliverToOwner` with `agent: null` containing `chatgpt` and `de hora em hora`; `notify` returns `Woken`.
- [ ] No note on 1 → 2 — input: `firstUnread` false; expected: no note; returns `Woken`.
- [ ] Note in English for an en-US identity — input: `ownerLocale` en-US, `firstUnread` true; expected: note contains `every hour`.
- [ ] Note carries the last poll — input: last poll 3 h ago, `firstUnread` true; expected: note contains `há 3 h`.
- [ ] Never polled note — input: `hasPolled` false, `firstUnread` true; expected: note contains `ainda não olhou a caixa`.
- [ ] No note for a standby reason — input: reason `StandbyFor`; expected: no note; returns `Woken`.

### B4 Inbox waker for stale scheduled (`inbox-agent-waker.test.ts`)

- [ ] Stale scheduled, 0 → 1 — input: stored mode scheduled, stale, `firstUnread` true, reason `MessageWaiting`/owner; expected: the note is sent first, then `notify` returns `Unreached` (core then sends the inbox notice; order asserted with the sender spy).
- [ ] Stale scheduled, 1 → 2 — input: `firstUnread` false; expected: no note; returns `Unreached`.
- [ ] Non-scheduled connection — input: mode `none`, `firstUnread` true; expected: no note; returns `Unreached`.
- [ ] Webhook connection on the inbox rung — input: mode `webhook` with no outbound target (Unreached): `firstUnread` true; expected: no note; returns `Unreached`.

### B5 Standby waker (`standby-agent-waker.test.ts`)

- [ ] Copy written — input: owner message `m1` routed to `grok-web` (standby `grok-bot`, valid), `messageId` = `m1`; expected: `insertHandoff` called with a copy whose `messageId` is a new id (not `m1`), `originMessageId` = `m1`, `agent` = `grok-bot`, `readByAgent` false.
- [ ] Primary copy read — input: as above; expected: `insertHandoff` called with `primaryAgent: 'grok-web'`, `handedTo: 'grok-bot'`, and the primary row (`m1`) read with `handedTo` = `grok-bot` after the call.
- [ ] Standby woken on 0 → 1 — input: `grok-bot` unread count 0 before; expected: `dependencies.waker.notify` called once with `{agent: 'grok-bot', reason: 'standby_for', firstUnread: true}` and no pointer; returns the standby's outcome.
- [ ] Standby not woken on 1 → 2 — input: `grok-bot` unread count 1 before; expected: `notify` not called for `grok-bot`; returns `Woken`.
- [ ] Primary never woken — input: as the first case; expected: no `notify` call with `agent: 'grok-web'`.
- [ ] Standby outcome passes through — input: standby `notify` returns `Unreached`; expected: the waker returns `Unreached`, the copy stays unread (`countUnread('grok-bot')` = 1), so core sends the inbox notice.
- [ ] No messageId throws — input: `notify` with `messageId` absent on the standby rung; expected: throws `InboxError` `InvalidInput` naming `messageId`; no copy.
- [ ] Message not found throws — input: `messageId` of a message that does not exist; expected: throws `NotFound`; no copy.
- [ ] Answer is not handed off — input: an owner choice tap answering a question of `grok-web` (standby mode); expected: receive path calls `notify` without `messageId`; the standby waker is never reached with a copy (no `insertHandoff`).
- [ ] Every owner kind hands off with its content — input: one each of text, location, contacts, reaction and choice, and each of the six media kinds, routed to a standby-mode primary; expected: a copy for each, the same `mediaId` for media kinds, `messageId` new in each case.
- [ ] Standby wake carries no body — input: text `"segredo"` handed off; expected: the object passed to `notify` has only `agent`, `reason` and `firstUnread`, and `JSON.stringify` of it does not contain `segredo`.

### B6 Dispatcher (`dispatching-agent-waker.test.ts`)

- [ ] Routes by effective rung — input: four wakes, one per rung (scheduled fresh, scheduled stale, standby valid, none); expected: scheduled → `ScheduledAgentWaker`, stale → `InboxAgentWaker`, standby → `StandbyAgentWaker`, none → `InboxAgentWaker`; each spy called once.
- [ ] Standby revoked at dispatch time — input: standby valid at set time, `revokedAt` set before the message; expected: `InboxAgentWaker` is chosen; no copy.

### B7 Poller alarm logic (`evaluate-pollers.test.ts`)

- [ ] One notice per episode — input: one stale scheduled wake; expected: one stale notice with the agent name and elapsed text, `markStaleNotified` once.
- [ ] No duplicate — input: call again with no poll; expected: no second notice; `nextDueAt` null.
- [ ] New episode after a poll — input: a poll clears the flag, then the connection goes stale again; expected: a second notice.
- [ ] Next deadline — input: two scheduled, not stale, deadlines D1 < D2; expected: `nextDueAt` = D1.
- [ ] Notified ignored in the deadline — input: one notified, one not stale with D2; expected: `nextDueAt` = D2.
- [ ] Nothing scheduled — input: none; expected: `{nextDueAt: null}`, no notice.
- [ ] Revoked scheduled excluded — input: scheduled, `revokedAt` set, stale; expected: no notice.
- [ ] Non-scheduled ignored — input: `webhook` wake 10 h stale; expected: no notice.
- [ ] Locale of the wake — input: stale wake with `ownerLocale` en-US; expected: the notice equals `WAKE_COPY[en-US].staleNotice` output.
- [ ] Scheduled row without locale throws — input: scheduled wake with `ownerLocale` null; expected: throws naming `owner_locale`; no notice; `pollerStaleNotified` stays false.

## C. Worker storage (`apps/api/test/integration/scheduled-wake-storage.test.ts`, real Durable Object SQLite)

- [ ] Migration to `v3` from `v2` — input: an object at `v2` with two messages and two agents; expected: after start `v3` is recorded, both messages and agents remain, row counts equal.
- [ ] Unique message ids — input: insert two rows with the same `id` and different `agent`; expected: the second insert fails with a unique error (copies must use new ids).
- [ ] `findWake` unknown — input: `agent: 'nobody'`; expected: `null`.
- [ ] `saveWake` scheduled — input: scheduled 60 with `ownerLocale` pt-BR; expected: `interval_minutes` 60, `standby_agent` NULL, `owner_locale` `pt_BR`.
- [ ] `saveWake` standby — input: standby `grok-bot`; expected: `standby_agent` `grok-bot`, `interval_minutes` NULL.
- [ ] `saveWake` none after scheduled — input: none; expected: `interval_minutes` NULL, `standby_agent` NULL.
- [ ] Mapper throws on a broken row — input: raw row mode `scheduled`, `interval_minutes` NULL; expected: `findWake` throws naming the column; no default returned.
- [ ] `recordPoll` — input: T, pt-BR; expected: `last_polled_at` T, `has_polled` 1, `owner_locale` `pt_BR`, `poller_stale_notified` 0.
- [ ] `recordRevocation` — input: revokedAt T; expected: `revoked_at` T; `listScheduledWakes` excludes the agent.
- [ ] `listScheduledWakes` — input: two scheduled, one webhook, one scheduled revoked; expected: exactly the two non-revoked scheduled rows.
- [ ] `markStaleNotified` survives restart — input: mark `chatgpt`, re-create the object over the same storage; expected: `poller_stale_notified` 1.
- [ ] `insertHandoff` is atomic — input: a spy makes the primary update fail; expected: the copy insert is rolled back too (no copy row).
- [ ] `insertHandoff` marks the primary — input: `m1` for `grok-web`, copy `c1` for `grok-bot`; expected: `m1` row has `read_at` set and `handed_to` `grok-bot`; `c1` row exists with `agent` `grok-bot`, `origin_message_id` `m1`, `read_at` NULL.
- [ ] `findMessage` by copy id — input: `findMessage({messageId: 'c1'})`; expected: the copy row (`agent` `grok-bot`).
- [ ] `countUnread` uses the partial index — input: `EXPLAIN QUERY PLAN` of the count; expected: plan includes `inbox_messages_unread`.
- [ ] `countUnread` empty — input: no rows; expected: `0`.
- [ ] `countUnread` ignores read rows — input: three rows, two read; expected: `1`.

## D. Worker alarm, handoff, payload and revoke flow

### D1 Alarm and restart (`scheduled-wake-alarm.test.ts`)

- [ ] Alarm sends one stale notice — input: scheduled `chatgpt` 60, clock advanced by `POST /dev/owner/:phone/clock` with `advance_ms` = 2 × HOUR_MS + MINUTE_MS, then `runDurableObjectAlarm`; expected: the simulator screen lists one stale notice.
- [ ] Alarm does not repeat — input: `runDurableObjectAlarm` again; expected: still one stale notice.
- [ ] Alarm order — input: an expired queued message and a stale poller at the same alarm; expected: the expiry sweep runs first (message `Expired`), then the stale notice.
- [ ] Alarm re-arms to the earliest deadline — input: poller deadline D and queue expiry E with D < E; expected: `ctx.storage.getAlarm()` equals D.
- [ ] Re-arm after eviction — input: object re-created over the same storage; expected: alarm set to the stored deadline; `runDurableObjectAlarm` sends the notice.
- [ ] `setWake` re-arms — input: `setWake` scheduled 60 through the RPC; expected: alarm equals `lastPolledAt + 2 × HOUR_MS`.
- [ ] Note once, then the inbox notice — input: stale scheduled `chatgpt`, owner text; expected: screen shows the note, then the inbox notice, in that order.

### D2 Standby handoff end to end (`standby-handoff.test.ts`)

- [ ] Reply to the copy — input: standby `grok-bot` receives copy `c1` (origin `m1`) and sends `send_message` with `reply_to` = `c1`; expected: accepted; the reply's stored `replyToMessageId` resolves to the owner message `m1` (canonical id).
- [ ] Reply to the origin id — input: the same reply with `reply_to` = `m1`; expected: accepted; resolves to `m1`; the stored reply is identical to the previous case.
- [ ] Reply to an unknown id — input: `reply_to` = `zz9`; expected: tool error naming `reply_to`, nothing stored.
- [ ] Primary cannot read the copy — input: `grok-web` calls `check_inbox` after the handoff; expected: `{status: 'empty', messages: []}`.
- [ ] Primary history shows the hand-off — input: `grok-web` calls `get_messages`; expected: `m1` appears in `history` with `handed_to: 'grok-bot'`.
- [ ] Standby poll returns the copy — input: `grok-bot` calls `check_inbox`; expected: `{status: 'new'}` with copy `c1`, `origin_message_id` `m1`, no content of another agent.


### D3 Revoke flow (`standby-revocation.test.ts`, needs accounts-and-keys merged)

- [ ] Revoke through the command — input: owner sends `revogar grok-bot` (pt-BR) through the simulator while `grok-web` is set to standby `grok-bot`; expected: the command reply `Revoked`; the account object's `recordRevocation` was called with `agent: 'grok-bot'` and `revokedAt` = clock now.
- [ ] No copy after revoke — input: owner text to `grok-web` after the revoke; expected: no copy row for `grok-bot`; `grok-web`'s inbox holds the message unread; the owner gets the inbox notice.
- [ ] Set after revoke refused — input: `grok-web` calls `set_wake` standby `grok-bot` after the revoke; expected: tool error naming `standby_agent` and `revoked`; nothing saved.
- [ ] Rotate does not revoke — input: owner sends `girar grok-bot`; expected: `recordRevocation` not called; a handoff still works afterwards.
- [ ] Revoked secret — input: the revoked `grok-bot` secret calls `check_inbox`; expected: HTTP `401` with `{"error":"unauthorized"}`.

## E. MCP over HTTP (`apps/api/test/integration/mcp-scheduled-wake.test.ts`)

- [ ] `set_wake` scheduled — input: `{mode: "scheduled", interval_minutes: 60}`; expected: `{status: "saved", wake_mode: "scheduled", effective_rung: "scheduled"}`.
- [ ] `set_wake` standby — input: `{mode: "standby", standby_agent: "grok-bot"}` (same account, webhook); expected: `{status: "saved", wake_mode: "standby", effective_rung: "standby"}`.
- [ ] Pin: `set_wake` none — input: `{mode: "none"}`; expected: `effective_rung: "inbox"` (passes on arrival).
- [ ] Pin: `set_wake` webhook still works — input: slice 4's webhook input; expected: slice 4's result unchanged (passes on arrival).
- [ ] Interval 59 — input: `{mode: "scheduled", interval_minutes: 59}`; expected: tool error naming `interval_minutes` and `60`; nothing saved.
- [ ] Interval 1441 — input: `{mode: "scheduled", interval_minutes: 1441}`; expected: tool error naming `interval_minutes` and `1440`.
- [ ] Interval as a string — input: `interval_minutes: "60"`; expected: tool error naming `interval_minutes`.
- [ ] Interval 60.5 — input: `interval_minutes: 60.5`; expected: tool error naming `interval_minutes`.
- [ ] Unknown field rejected — input: `{mode: "none", account_id: "x"}`; expected: tool error; nothing saved.
- [ ] Agent name in input rejected — input: `{mode: "scheduled", interval_minutes: 60, agent: "other"}`; expected: tool error; nothing saved.
- [ ] Standby of the caller rejected — input: `standby_agent` = caller's name; expected: tool error naming `standby_agent`.
- [ ] Standby name malformed — input: `standby_agent: "Grok Bot!"`; expected: tool error naming `standby_agent` and the name pattern.
- [ ] Standby of another account — input: a name that exists only in another account; expected: tool error naming `standby_agent`; no other account's data in the text.
- [ ] Standby in standby mode — input: `standby_agent` naming a connection in mode `standby`; expected: tool error naming `standby_agent` and `one hop`.
- [ ] `check_inbox` empty — input: no unread; expected: `{status: "empty", messages: []}`.
- [ ] `check_inbox` new — input: two unread; expected: `{status: "new"}` with two messages in slice 1's wire shape.

## F. E2E in the owner simulator (`apps/api/test/e2e/scheduled-wake.e2e.test.ts`, default gate, `wrangler dev`)

- [ ] Scheduled poll with the note — input: `chatgpt` calls `set_wake` scheduled 60 and `check_inbox` at T; the owner (`POST /dev/owner/:phone/messages`) sends text at T + 10 min; expected: `GET /dev/owner/:phone/screen` lists the expected-delay note with `chatgpt` and `há 10 min`.
- [ ] Stale notice once, then held — input: `POST /dev/owner/:phone/clock` with `advance_ms` = 2 × HOUR_MS + MINUTE_MS; expected: the screen lists one stale notice naming `chatgpt`; the owner's next text gets the inbox notice; `get_messages` on `chatgpt` shows the message.
- [ ] Poll ends the episode — input: `chatgpt` calls `check_inbox` after the stale notice; expected: no new stale notice on the next clock advance without a new stale episode.
- [ ] Standby answers as itself — input: `grok-web` (standby `grok-bot`, a second SDK client); owner sends `"oi"`; `grok-bot` receives the wake, calls `check_inbox`, sends `send_message` with `reply_to` = its copy's id; expected: the screen lists the reply from `grok-bot`; `grok-web`'s next `check_inbox` returns no messages.
- [ ] Note in the owner's locale — input: an en-US owner identity (the account property set at creation); expected: the note text is the en-US text.

## G. Docs (`apps/docs`)

- [ ] `mint broken-links` — input: docs package after S6.2; expected: exit 0.
- [ ] Rung table — input: `apps/docs/concepts/wake-ladder.mdx`; expected: contains `scheduled`, `standby`, `inbox` in the rung table.
- [ ] Both note forms — input: the page; expected: contains `de hora em hora` and `every hour`.
- [ ] One-hop rule — input: the page; expected: contains `one hop` or `um salto`.

## H. Security checks

- [ ] Standby from another account — input: a standby name present only in another account; expected: refused, nothing saved, no row of the other account read.
- [ ] Caller only — input: connection A's `set_wake` naming another connection in any field; expected: rejected; only A's wake row changes.
- [ ] No secret in logs — input: the E2E run with logs captured; expected: no `zb_conn_` value in the output.
- [ ] No body in handoff logs or payloads — input: handoff of `"segredo"` with a logger spy; expected: `segredo` absent from every logged value and every webhook payload that is not the owner's delivery.
- [ ] The standby reads only its copy — input: the standby calls `get_messages` with `m1` (the owner id, not its own copy); expected: `not_found` or its own copy only, never the primary's row.
- [ ] Notices go to the owner only — input: a stale notice and an expected-delay note; expected: both recorded for the account's own owner number.
- [ ] Interval bounds before storage — input: `interval_minutes` 0 and 100000; expected: both refused, `interval_minutes` stays NULL.
- [ ] Unknown field rejected even on `none` — input: `{mode: "none", extra: 1}`; expected: rejected.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## I. Owner-run (outside the gate, real clients, recorded in the PR)

- [ ] Live claude.ai hourly safety net — input: API trigger for the connection (mode `webhook`) plus an hourly task calling `check_inbox` (`SAFETY_NET_CRON`); owner writes "teste" through WhatsApp; expected: claude.ai answers through `send_message` within 60 s, and the `check_inbox` log shows a poll each hour.
- [ ] Live ChatGPT "Run on this computer", Hourly — input: Hourly task in one dedicated chat, Mac awake, app open, "Always allow" for `check_inbox` and `send_message`; owner writes "teste"; expected: the next run answers in that chat, and the first message of a batch gets the expected-delay note with the last-poll time.
- [ ] Live stale notice — input: quit the ChatGPT app for two hours; expected: one stale notice on the owner's WhatsApp; the next run after reopening ends the episode silently.

## Adversarial review

- [ ] Claim 1: a connection that never polled goes stale exactly two intervals after creation — attack: create, never poll, advance 2 × interval − 1 ms and then 2 × interval; expected: no notice, then one notice; result: refuted | held.
- [ ] Claim 2: the standby never reads the primary's copy and the primary never reads the standby's copy as unread — attack: primary `check_inbox` and `get_messages` after a handoff; standby `reply_to` with both ids; expected: primary sees no unread copy; both `reply_to` ids resolve to one owner message; result: refuted | held.
- [ ] Claim 3: the expected-delay note fires exactly when `firstUnread` is true and a poll resets the cycle — attack: alternate owner text and `check_inbox` ten times on a scheduled connection; expected: exactly ten notes, none on 1 → 2; result: refuted | held.

## Coverage honesty

- Real Cloud API delivery of notices — the fake sender records them; template rules belong to slice 2. Risk accepted until the owner-run check.
- Real webhook targets (Grok Bot, claude.ai) — fake endpoints in tests; live behaviour is owner-run.
- ChatGPT client drift (minute saved as Hourly, 07:25 for 07:30) — client behaviour in ADR 0025, not reproducible here. A drift shows as a false stale notice that `set_wake` corrects.
- Answers to a standby-mode primary are never handed off (A8). Risk accepted: an owner answer to a primary in standby mode waits with that primary until it polls.
- A live waiter wins over the note and the handoff (A10). Risk accepted: no delay note while the agent is waiting, by design.
- Concurrency between two `check_inbox` calls of one connection — the Durable Object serialises calls; no race test. Risk accepted.
- Browser UI — none in this slice.
