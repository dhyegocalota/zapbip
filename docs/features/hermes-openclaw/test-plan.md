# Test plan: Hermes and OpenClaw

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Areas run by separate tester sub-agents in parallel: **H** (Hermes unit), **O** (OpenClaw unit), **S** (security, cross-cutting), **X** (connector contract on the real socket), **E** (Docker end to end, opt-in), **I** (install sections, checked in `install-skills`), **V3** (owner-run, outside the gate).

Setup for every area: no real credentials, no network to third parties. The connector is a fake WebSocket server and the model is the POC fake model. Timing constants are injected as parameters with the `libs/types` values as defaults, so tests do not wait 25 s.

## The failing test first

- [ ] `apps/hermes-plugin/tests/unit/test_frames.py::test_parses_hello` — input: `{"type":"hello","agent":"alpha","previousWakeMode":"none"}`; expected: `ok` true, frame type `hello`. Red: `NotImplementedError: parse_server_frame is not implemented`.
- [ ] `apps/openclaw-plugin/test/unit/connector-socket.test.ts::hands off a messages frame` — input: a `messages` frame with one text message; expected: `handOff` called once with that message. Red: `Error: runConnectorSocket is not implemented`.
- [ ] Confirmed each red run fails on the named assertion or stub, not on a broken import: the captured failure text is pasted into `tester-briefing.md`.

## H-1 Hermes frames (`tests/unit/test_frames.py`)

- [ ] `test_parses_hello` — input: `{"type":"hello","agent":"alpha","previousWakeMode":"none"}`; expected: ok, frame type `hello`.
- [ ] `test_hello_without_agent` — input: `{"type":"hello","previousWakeMode":"none"}`; expected: not ok, reason `malformed`.
- [ ] `test_hello_with_null_wake_mode` — input: `{"type":"hello","agent":"alpha","previousWakeMode":null}`; expected: not ok, reason `malformed`.
- [ ] `test_parses_messages` — input: a `messages` frame with one `{messageId:"msg_1", kind:"text", text:"oi", at:1700000000000}`; expected: ok, `messages[0].messageId == "msg_1"`.
- [ ] `test_empty_messages_is_valid` — input: `{"type":"messages","messages":[]}`; expected: ok, zero messages, no handoff later.
- [ ] `test_message_without_id` — input: `{"type":"messages","messages":[{"kind":"text","text":"oi"}]}`; expected: not ok, reason `malformed`.
- [ ] `test_server_never_sends_done` — input: `{"type":"done","messageId":"msg_1"}`; expected: not ok, reason `unknown_type`.
- [ ] `test_type_is_case_sensitive` — input: `{"type":"HELLO","agent":"alpha","previousWakeMode":"none"}`; expected: not ok, reason `unknown_type`.
- [ ] `test_pong_is_ignored_without_log` — input: text `{"type":"pong"}`, the exact pong text from `libs/types`; expected: returns the pong marker and no rejection is logged.
- [ ] `test_binary_frame` — input: bytes `b"\x00\x01"`, `is_binary` true; expected: not ok, reason `binary_frame`.
- [ ] Edge: boundary size — input: a valid `messages` frame of exactly 65 536 bytes; expected: ok.
- [ ] Edge: over the limit — input: a frame of 65 537 bytes; expected: not ok, reason `frame_too_large`, no body in the log.
- [ ] Edge: not JSON — input: `not json`; expected: not ok, reason `malformed`.
- [ ] Edge: JSON array — input: `[]`; expected: not ok, reason `malformed`.
- [ ] Edge: JSON `null` — input: `null`; expected: not ok, reason `malformed`.
- [ ] Edge: unicode text — input: messages frame with text `"✅ oi 😉 çã"`; expected: ok, text byte-identical.

## H-2 Hermes handoff (`tests/unit/test_handoff.py`)

- [ ] `test_text_is_the_text` — input: `{kind:"text", text:"oi"}`; expected: `"oi"`.
- [ ] `test_image_with_caption` — input: `{kind:"image", caption:"foto"}`; expected: `"foto"`.
- [ ] `test_image_without_caption` — input: `{kind:"image", caption:null}`; expected: `CHANNEL_HANDOFF_NO_TEXT_BY_KIND["image"]` exactly.
- [ ] `test_each_kind_without_text` — input: one message per kind among `video`, `audio`, `document`, `sticker`, `location`, `contacts`, `reaction`; expected: each returns its `CHANNEL_HANDOFF_NO_TEXT_BY_KIND` entry, one assertion per kind.
- [ ] `test_choice_uses_selected_title` — input: `{kind:"choice", selected:{title:"Sim"}}`; expected: `"Sim"`.
- [ ] `test_choice_without_selection` — input: `{kind:"choice", selected:null}`; expected: `CHANNEL_HANDOFF_NO_TEXT_BY_KIND["choice"]`.
- [ ] Edge: empty text — input: `{kind:"text", text:""}`; expected: `""` is handed off as is (the agent decides), not replaced.
- [ ] Edge: timestamp — input: `at: 1700000000000`; expected: a timezone-aware UTC `2023-11-14T22:13:20+00:00`.
- [ ] Edge: source id — input: `messageId:"msg_9"`; expected: the platform `MessageEvent.message_id == "msg_9"`.

## H-3 Hermes connector socket (`tests/unit/test_connector_socket.py`)

- [ ] `probe_426_proceeds` — input: probe answers `426`; expected: one WebSocket opened.
- [ ] `probe_401_stops` — input: probe answers `401`; expected: no WebSocket opened, returns exit code `1`, one probe call only.
- [ ] `probe_404_stops` — input: probe answers `404`; expected: no WebSocket, exit `1`, one probe call.
- [ ] `probe_500_stops` — input: probe answers `500`; expected: no WebSocket, exit `1`, one probe call.
- [ ] `probe_network_error_retries` — input: probe raises a connection error twice, then `426`; expected: waits `1000` ms then `2000` ms (injected), then opens the socket; exit not reached.
- [ ] `open_sends_nothing_before_hello` — input: fake server accepts and sends `hello`; expected: plugin sends no text frame before `hello` is received.
- [ ] `messages_are_handed_off_in_order` — input: one `messages` frame with `msg_1`, `msg_2`; expected: `hand_off` called with `msg_1` then `msg_2`.
- [ ] `done_follows_each_handoff` — input: as above; expected: the client sends `{"type":"done","messageId":"msg_1"}` after the first handoff returns, then `msg_2`.
- [ ] `handoff_failure_sends_no_done` — input: `hand_off` raises for `msg_1`; expected: no `done` for `msg_1`; `msg_2` still handed off; after a reconnect `msg_1` is handed off again.
- [ ] `duplicate_while_running_is_handed_once` — input: a second `messages` frame carries `msg_1` while its handoff is still pending; expected: `hand_off` called once for `msg_1`.
- [ ] `duplicate_after_done_is_skipped` — input: `msg_1` re-sent in a later frame after its `done`; expected: not handed off again.
- [ ] Edge: bounded seen set — input: 1 025 distinct ids in order, then `msg_0` again; expected: `msg_0` is handed off again (the set holds 1 024), and the 1 024 newest ids are not.
- [ ] `heartbeat_sends_ping` — input: heartbeat interval injected at 50 ms; expected: text `ping` sent about every 50 ms, checked over 3 intervals with a tolerance of one interval.
- [ ] `no_frame_in_timeout_reconnects` — input: the server stops answering `ping` for longer than the injected timeout; expected: the client closes and a new socket opens.
- [ ] `any_frame_is_proof_of_life` — input: a `messages` frame arrives 10 ms before the timeout expires; expected: the timeout does not fire.
- [ ] `replaced_4001_stops_without_retry` — input: close code `4001`; expected: no reconnect, the function returns exit `0`, a `connector_replaced` log line with no text.
- [ ] `abnormal_close_reconnects_and_rereads` — input: close code `1006`; expected: wait `1000` ms, new socket, `hello` then the unread `messages` again.
- [ ] `backoff_sequence_is_capped` — input: attempts `0..6`; expected: delays `1000, 2000, 4000, 8000, 16000, 30000, 30000`.
- [ ] `successful_open_resets_attempts` — input: two failed opens, then one open that succeeds, then a close; expected: the next delay is `1000`.
- [ ] `stop_during_backoff_returns_promptly` — input: stop event set during the wait of 30 000 ms; expected: returns before 100 ms, no further socket.
- [ ] `hello_wake_mode_is_logged_not_applied` — input: `previousWakeMode: "scheduled"`; expected: a `connector_connected` line with that value and no call to any `set_wake` tool.
- [ ] Edge: hello then close before any messages — input: close after hello; expected: reconnect, no handoff, no error.

## H-4 Hermes adapter and outbound (`tests/unit/test_adapter.py`, `tests/unit/test_mcp_outbound.py`)

- [ ] `connect_returns_true` — input: `await adapter.connect()`; expected: `True`, one socket task running.
- [ ] Edge: connect twice — input: two calls to `connect()`; expected: both return `True`, one socket task only.
- [ ] `disconnect_cancels_socket` — input: `connect()` then `disconnect()`; expected: no pending tasks from the adapter, the socket is closed.
- [ ] `handle_message_gets_handoff_text` — input: one owner `text` message `"oi"`; expected: `handle_message` called once, `event.text == "oi"`, `event.source.chat_id == "owner"`.
- [ ] `handle_message_raises_sends_no_done` — input: `handle_message` raises; expected: no `done`, the error is logged without the text.
- [ ] `send_posts_send_message` — input: `send(chat_id="owner", content="olá")`; expected: an MCP call with tool `send_message` and arguments `{text:"olá"}`; `SendResult.success` true.
- [ ] `send_refuses_other_chat` — input: `send(chat_id="someone-else", content="x")`; expected: `SendResult.success` false, no HTTP call.
- [ ] `send_surfaces_tool_error` — input: the MCP route returns a tool result with `isError: true`; expected: `SendResult.success` false, the error text carries the tool message and no secret.
- [ ] `initialize_before_call` — input: `send_owner_text` with a fake MCP route; expected: request order `initialize`, `notifications/initialized`, `tools/call`.
- [ ] `empty_text_makes_no_call` — input: `send_owner_text(text="")`; expected: no HTTP request, returns without error.
- [ ] Edge: text at the limit — input: 4 096 characters; expected: sent unchanged.
- [ ] Edge: text over the limit — input: 4 097 characters; expected: the route's error is returned as a failed `SendResult`, the plugin does not truncate.
- [ ] Edge: HTTP 401 on send — input: route answers `401`; expected: `SendResult.success` false, no retry.
- [ ] Edge: network error on send — input: connection refused; expected: `SendResult.success` false, one attempt only.
- [ ] `allow_all_is_not_set` — input: `register(ctx)` with a fake context; expected: the registered `allow_all_env` is absent or empty, `allowed_users_env` is set.
- [ ] `plugin_yaml_matches_register` — input: `plugin.yaml` and the `register` name; expected: both `zapbip-platform` and `zapbip` as declared.
- [ ] `required_env_lists_only_the_link` — input: `plugin.yaml` `requires_env`; expected: exactly one variable, the connection link variable, `password: true`.

## O-1 OpenClaw connector socket (`test/unit/connector-socket.test.ts`)

- [ ] `probe_426_proceeds` — input: probe answers `426`; expected: one WebSocket opened.
- [ ] `probe_401_stops` — input: probe answers `401`; expected: no socket, promise resolves `1`, one probe.
- [ ] `probe_404_stops` — input: probe answers `404`; expected: promise resolves `1`, one probe.
- [ ] `probe_network_error_retries` — input: probe rejects twice, then `426`; expected: waits `1000` then `2000` ms (fake timers), then opens.
- [ ] `messages_are_handed_off_in_order` — input: `messages` frame with `msg_1`, `msg_2`; expected: `handOff` called with `msg_1` then `msg_2`.
- [ ] `done_follows_each_handoff` — input: as above; expected: `done` frames for `msg_1` then `msg_2`, each after its `handOff` promise resolves.
- [ ] `handoff_rejection_sends_no_done` — input: `handOff` rejects for `msg_1`; expected: no `done` for `msg_1`; the error is logged with no text; `msg_2` still handed off.
- [ ] `duplicate_while_running_is_handed_once` — input: second frame with `msg_1` while pending; expected: one `handOff` call.
- [ ] Edge: bounded seen set — input: 1 025 ids then `msg_0`; expected: `msg_0` handed off again.
- [ ] `heartbeat_sends_ping` — input: fake timers advance by `HEARTBEAT_INTERVAL_MS` three times; expected: three `ping` text frames.
- [ ] `no_frame_in_timeout_reconnects` — input: no pong after the ping, advance by `HEARTBEAT_TIMEOUT_MS`; expected: socket closed, a new socket opened.
- [ ] `replaced_4001_stops_without_retry` — input: close `4001`; expected: no reconnect, resolves `0`, `connector_replaced` logged.
- [ ] `abnormal_close_reconnects` — input: close `1006`; expected: wait `RECONNECT_BASE_MS`, reopen, `hello` then unread `messages` again.
- [ ] `backoff_sequence_is_capped` — input: attempts `0..6`; expected: `1000, 2000, 4000, 8000, 16000, 30000, 30000` (the function from `libs/types` values).
- [ ] `abort_during_backoff_returns` — input: abort signal during a 30 000 ms wait; expected: resolves before 100 ms of real time, no new socket.
- [ ] Edge: a frame with an unknown type — input: `{"type":"zzz"}`; expected: dropped, a `frame_rejected` line with `reason: "unknown_type"` and no body.
- [ ] Edge: a frame over 65 536 bytes — input: 65 537 bytes; expected: dropped, `frame_rejected` with `frame_too_large`.

## O-2 OpenClaw handoff (`test/unit/handoff.test.ts`)

- [ ] `dispatches_text_as_raw_body` — input: text message `"oi"` with `messageId "msg_1"`; expected: `dispatchInboundDirectDm` called with `rawBody "oi"`, `messageId "msg_1"`, `channel "zapbip"`.
- [ ] `peer_is_the_owner_direct_message` — input: the same; expected: `peer.kind === "direct"`, `senderId` and `senderAddress` are the owner id from the account, never the agent name.
- [ ] `commands_authorized_only_for_the_owner_dm` — input: the same; expected: `commandAuthorized` and `inboundAccessAuthorized` true for this call only; no other path sets them.
- [ ] `timestamp_is_epoch_ms` — input: `at: 1700000000000`; expected: `timestamp === 1700000000000`.
- [ ] `image_with_caption` — input: image with caption `"foto"`; expected: `rawBody "foto"`.
- [ ] `image_without_caption` — input: caption null; expected: `rawBody` equals `CHANNEL_HANDOFF_NO_TEXT_BY_KIND.image`.
- [ ] `choice_uses_selected_title` — input: choice with `selected.title "Sim"`; expected: `rawBody "Sim"`.
- [ ] Edge: `deliver` ignores empty payload — input: the SDK calls `deliver({text: ""})`; expected: no outbound call.
- [ ] Edge: dispatch throws — input: `dispatchInboundDirectDm` rejects; expected: `handOff` rejects, the socket layer logs it and sends no `done`.
- [ ] `handoff_text_of_every_kind` — input: one message per `MessageKind`; expected: a non-empty string for each, no `undefined` in output.

## O-3 OpenClaw outbound (`test/unit/send-message.test.ts`)

- [ ] `sends_send_message_tool_call` — input: `sendOwnerText({mcpLink, text:"olá"})` against a fake MCP route; expected: `tools/call` with name `send_message` and arguments `{text:"olá"}`.
- [ ] `initialize_before_call` — input: as above; expected: order `initialize`, `notifications/initialized`, `tools/call`.
- [ ] `empty_text_makes_no_call` — input: `text: ""`; expected: resolves, zero HTTP requests.
- [ ] `tool_error_rejects_without_secret` — input: `isError: true`; expected: rejects with the tool message, the message contains no `zb_conn_`.
- [ ] `http_401_rejects_once` — input: route answers `401`; expected: rejects, one request.
- [ ] `network_error_rejects_once` — input: connection refused; expected: rejects, one attempt.
- [ ] Edge: text at the limit — input: 4 096 characters; expected: sent unchanged.
- [ ] Edge: text over the limit — input: 4 097 characters; expected: the route's error reaches the caller, nothing truncated locally.
- [ ] `url_in_text_is_text_only` — input: text `"see http://evil.example/x"`; expected: the request goes only to the configured `mcpLink`, the URL is in the arguments.

## O-4 OpenClaw channel entry (`test/unit/channel.test.ts`)

- [ ] `entry_declares_zapbip_channel` — input: `openclaw.plugin.json`; expected: `channels` is `["zapbip"]`, `id` is `zapbip`.
- [ ] `config_takes_only_the_link` — input: `configSchema`; expected: `connectionLink` is the only required property; `baseUrl`, `apiKey`, `agentName`, `ownerId` are absent.
- [ ] `missing_link_throws` — input: config without `connectionLink`; expected: `startAccount` throws `connectionLink is required` (the exact copy from `libs/types`), no socket.
- [ ] `http_link_refused` — input: `http://host/c/<secret>/mcp`; expected: throws the https copy before any request.
- [ ] `start_account_stops_on_abort` — input: start then abort; expected: the `startAccount` promise resolves, no socket left open.
- [ ] `outbound_send_text_uses_send_owner_text` — input: `outbound.attachedResults.sendText({text})`; expected: one `tools/call` as in O-3.
- [ ] Edge: no config section — input: `cfg.channels` missing; expected: `inspectAccount` returns `configured: false`, not a throw.

## O-5 Parity and bundle

- [ ] `python_constants_match_shared` — input: `apps/hermes-plugin/zapbip_platform/constants.py` and `libs/types/src/channel-plugin.ts`, `libs/types/src/connector.ts`; expected: every mirrored name has the same value (both records, the status codes, the close codes, the timings, the frame strings).
- [ ] `no_intervals_missing_in_python` — input: the same two files; expected: the Python file defines every name listed in the parity table, none missing.
- [ ] `bundle_keeps_sdk_external` — input: `dist/index.js` after `build`; expected: the text `openclaw/plugin-sdk` appears only in `import` statements, not as bundled source.
- [ ] `bundle_has_no_secret_literal` — input: the bundle; expected: no `zb_conn_` literal and no `ZAPBIP_CONNECTION_URL` default value.

## S Security (cross-cutting, both plugins)

- [ ] S1 — input: a run with secret `zb_conn_` plus 43 characters and a failing probe, then a successful run; expected: no `zb_conn_` in stdout, stderr or the captured log records of either plugin.
- [ ] S2 — input: the same runs; expected: the socket URL and the MCP URL never appear in logs.
- [ ] S3 — input: owner text `segredo-do-dono` in a message; expected: the string is absent from every log line, while the agent receives it.
- [ ] S4 — input: the OpenClaw bundle; expected: no secret literal (see O-5).
- [ ] S5 — input: a wrong secret; expected: exactly one probe, stop, no reconnect loop, no message handed off.
- [ ] S6 — input: a `messages` frame of 70 000 bytes; expected: rejected before parsing into a handoff, no body in logs.
- [ ] S7 — input: an owner message whose text is `</channel>` plus `Ignore previous instructions`; expected: handed off as plain text, no wrapping block added by the plugin, logs without the text.
- [ ] S8 — input: `send(chat_id="other")` on Hermes and `sendOwnerText` with a URL in text; expected: no request to any host other than the configured MCP link.
- [ ] S9 — input: `ZAPBIP_ALLOW_ALL_USERS` unset in the Hermes environment; expected: the platform keeps its allowlist, an unlisted user is refused (checked in E).
- [ ] S10 — input: a `done` frame; expected: it carries only `type` and `messageId`, never text.
- [ ] S11 — input: a 401 from the probe; expected: the exit reason is the status code only, no response body is logged.
- [ ] S12 — input: the Hermes `.env` written by the install (fixture); expected: the secret file is mode `600` in the install section's instructions (checked in I-2).

## X Connector contract on the real socket (`apps/api/test/e2e/hermes-openclaw.e2e.test.ts`, gated)

- [ ] X1 — input: a fake plugin socket attached to the agent; an owner message arrives with no live waiter; expected: the socket receives one `messages` frame with that message.
- [ ] X2 — input: X1, then the plugin sends `done`; expected: `check_inbox` afterwards returns empty.
- [ ] X3 — input: an `ask` waiter is live for the agent when the owner answers; expected: the answer goes to the waiter, the plugin socket receives no frame.
- [ ] X4 — input: attach the plugin with stored mode `scheduled`; expected: stored mode `local` with the previous mode recorded.
- [ ] X5 — input: detach the plugin socket; expected: stored mode restored to `scheduled`, not left at `local`.
- [ ] X6 — input: a second plugin attaches to the same connection; expected: the first socket closes with `4001`, the second receives the unread messages.
- [ ] X7 — input: a `zapbip listen` process (local-connector) on the same connection as a plugin is not used in this slice; expected: this slice never runs both on one connection (documented in the install section, checked in I-2).

## E End to end, Docker, fake model (opt-in: `ZAPBIP_E2E_CLIENTS=1`)

Setup: the zapbip stack runs over HTTPS with a local self-signed certificate; the containers trust it through `NODE_EXTRA_CA_CERTS` (OpenClaw) and `SSL_CERT_FILE` (Hermes), both test-only. Images: `openclaw@2026.10.10` on `node:24-slim`; `nousresearch/hermes-agent:v0.22.7`; both run `--platform linux/amd64`.

- [ ] E1 OpenClaw happy path — input: the owner simulator posts `"oi"`; expected: within 30 s the fake WhatsApp sender receives the fake model's reply, and the MCP route logs one `tools/call` `send_message` from the plugin.
- [ ] E2 Hermes happy path — input: as E1 against the Hermes container; expected: the same, reply within 30 s, one `send_message` call.
- [ ] E3 Restart while idle — input: stop the OpenClaw container, the owner posts `"um"`, start the container; expected: `"um"` is handed off once after the reconnect and the owner gets exactly one reply.
- [ ] E4 Replacement — input: a second plugin container on the same connection; expected: the first logs `connector_replaced` and exits `0`; the second gets the unread messages; one reply per message.
- [ ] E5 Fallback, plugin down — input: stop the plugin container, set `scheduled` with `interval_minutes: 1`, the runner calls `check_inbox` every 60 s (compressed to 2 s in the fixture); owner posts `"dois"`; expected: `check_inbox` returns `"dois"` within one tick, the agent's reply reaches the fake sender.
- [ ] E6 Fallback restored after reattach — input: restart the plugin after E5; expected: stored mode goes `local`, the next owner message is handed off by the plugin, not by the poll.
- [ ] E7 Owner not in allowlist (Hermes) — input: a second sender with the same connection path, not the owner; expected: refused by the platform allowlist, no model call.
- [ ] E8 No secret in container logs — input: `docker logs` of both containers after E1 to E6; expected: no `zb_conn_` string.
- [ ] E9 Media without caption — input: owner posts an image without caption; expected: the agent receives `CHANNEL_HANDOFF_NO_TEXT_BY_KIND.image` text and replies once.
- [ ] E10 Choice reply — input: owner taps a button of an `ask` that already timed out (no live waiter); expected: the agent receives the selected title as text, once.
- [ ] E11 Clean shutdown — input: SIGTERM to each container; expected: exit `0` within 5 s, the socket closed, no `done` for an unhandled message.

## I Install sections (checked in `install-skills` tests, against this slice's facts)

- [ ] I-1 — input: the Hermes section; expected: names `CHANNEL_PLUGIN_PACKAGE_NAME[hermes]` and no OpenClaw name; ends with the self-test `✅ instalado`.
- [ ] I-2 — input: the OpenClaw section; expected: names `CHANNEL_PLUGIN_PACKAGE_NAME[openclaw]`, `transport: "streamable-http"`, the Bearer header; ends with the self-test.
- [ ] I-3 — input: fallback text in both sections; expected: `set_wake({mode: "scheduled", interval_minutes: 1})` appears only after the plugin fails to attach, never before.
- [ ] I-4 — input: both sections; expected: `set_wake({mode: "local"})` is not called before the socket is attached (X4 makes the attach itself save `local`).
- [ ] I-5 — input: both sections; expected: no `zapbip listen` on the same connection as the plugin.
- [ ] I-6 — input: both sections in pt-BR and en_US; expected: the same facts, the owner's sentences in the owner's locale, tags and identifiers in English.

## V3 Owner-run, outside the gate

- [ ] V3-OC — input: owner's real OpenClaw and hosted model; one owner message; expected: reply on WhatsApp, recorded with the timestamps in the PR.
- [ ] V3-HM — input: owner's real Hermes and a model of at least 64k context; expected: reply on WhatsApp, recorded.
- [ ] OR-13 — input: OpenClaw `stream` watcher on `zapbip listen`, Gateway restarted; expected: the watcher restarts, or the section drops it and the cron alone runs; recorded.
- [ ] OR-14 — input: Hermes `watch_patterns` in a session with no delivery target; expected: fires, or the section drops the watcher; recorded.
- [ ] OR-15 — input: a Claude Code Monitor on `zapbip listen` idle for one hour; expected: the token figure in the PR, from the product.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: the plugin loses no message if the process dies between `handOff` and `done` — attack: kill the process after `handOff` resolves and before `done`; result: `refuted` if the message is lost (no re-send after reconnect), `held` if it is re-sent and the owner gets one reply per message or a documented duplicate.
- [ ] Claim 2: `listen` never acknowledges, so `check_inbox` still returns the message after a `zapbip listen` line — attack: run `listen` with a pushed message, then `check_inbox`; result: refuted if empty.
- [ ] Claim 3: a `4001` stop leaves no second reconnecting plugin — attack: two plugins started in the same second on one connection; result: refuted if both keep reconnecting after the replacement.

## Coverage honesty

What is not tested and why.

- Real model behaviour in OpenClaw and Hermes — the E2E uses the fake model; V3 covers it, owner-run, because a real model costs money and the harness forbids agents from spending it. Risk: the agent may not answer well; the plugin path is still proven.
- OpenClaw `stream` watcher after a Gateway restart and Hermes `watch_patterns` without a delivery target — OR-13 and OR-14. Risk: the watcher fallback is dropped from the section if they fail; the cron stays.
- Idle token cost of a Claude Code Monitor — OR-15, owner-run; the figure is reported, not estimated.
- Other OpenClaw versions than `2026.10.10` and other Hermes builds than `v0.22.7` (PyPI `0.19.0` is a different build) — the pins are the tested versions. Risk: the plugin may break after an upgrade; the section names the pin.
- arm64 Hermes — the image crashes under emulation (POC); the E2E runs `linux/amd64` only.
- Publishing: the npm and PyPI names are free today; the publish path and the registry install commands are `(verify)` and owner-run.
- Model-side prompt injection after a handoff — outside the plugin; the plugin passes text verbatim and sets `commandAuthorized` only for the owner's DM. Risk accepted; the owner's own agent is the reader.
- Hermes and OpenClaw sessions that are not the install's session (multiple sessions per agent) — no test; the plugin hands off to the default session of the product.
- Browser walk (Playwright MCP): not applicable; this slice has no UI.
