# Tester briefing: Hermes and OpenClaw

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (C0 contract)

### What changed

- `docs/adr/0028-*.md`, `docs/adr/0029-*.md` and their rows in `docs/adr/README.md` (4587e0d): both `Proposed`.
- `libs/types/src/channel-plugin.ts`, exported from `libs/types/src/index.ts` (3e54d23): `ChannelPluginProduct`, `CHANNEL_PLUGIN_PACKAGE_NAME`, `CHANNEL_HANDOFF_NO_TEXT_BY_KIND` (one text per `MessageKind`), `CHANNEL_PLUGIN_SELF_TEST_TEXT`.
- `apps/openclaw-plugin` shell (07b15c8): `package.json`, `tsconfig.json`, `vitest.config.mts`, README, stubs `src/{connector-socket,handoff,send-message}.ts` and `src/account.ts`; `pnpm-lock.yaml`; root `package.json` gets `pnpm.neverBuiltDependencies: ["openclaw"]` and `test:e2e:clients`.
- `apps/hermes-plugin` shell (11bce25): `package.json`, `pyproject.toml`, `requirements.txt`, README, `zapbip_platform/` (`constants.py` real, `frames`, `handoff`, `connector_socket`, `mcp_outbound` stubs), `tests/unit/test_constants.py`.
- `.github/workflows/verify.yml` (Python 3.13 setup, requirements install, `hermes-plugin` unit row), `.agents/hooks/doctor.sh` and `hooks.test.sh` (d17fedf).

### How to run

```bash
python3.13 -m venv <outside the repo> && . <venv>/bin/activate
python3 -m pip install -r apps/hermes-plugin/requirements.txt
pnpm install --frozen-lockfile && pnpm typecheck && pnpm verify
```

### Red today, green after

No red tests in Step 0. `apps/hermes-plugin/tests/unit/test_constants.py` is a pin (green when it landed); it keeps pytest from exiting 5 on an empty collection. Stubs throw `<name> is not implemented`.

### Hypotheses to attack

1. Hypothesis: `doctor.sh` reports `python` as missing when `python3` is outside 3.11-3.13 or `pytest`/`mypy` do not import, and never installs. Break it by: running it under 3.14 and under a venv without the requirements.
2. Hypothesis: the Hermes constants equal the `libs/types` values. Break it by: changing one text in `channel-plugin.ts` and checking whether any test notices (none compares the two sides yet).
3. Hypothesis: `neverBuiltDependencies` lets `pnpm install --frozen-lockfile` pass on Node 24.7. Break it by: installing on a clean clone.

### Known gaps

- Node 24.7 is below `openclaw@2026.10.10`'s preinstall floor (24.16); `.nvmrc` says 24. The owner decides whether to raise it.
- Pins younger than two weeks: `openclaw@2026.10.10`, `ws@8.22.1`, `pytest==9.2.0`, `mypy==2.4.1` (plan A11).
- No test ties the Python constants to `libs/types`; H and V own that.
- The `OpenClawConfig` import path in the stub is unverified against the installed package.

## Lane H (Hermes plugin)

### What changed

- `apps/hermes-plugin/zapbip_platform/`: `frames.py` (parse), `handoff.py` (text and UTC timestamp), `message_delivery.py` (serial handoff queue, pending set, 1 024-id seen set, `done` after the handoff), `connector_socket.py` (probe, heartbeat, reconnect backoff, `4001` stop), `connection_link.py` (`.../mcp` to `wss://.../connector`), `mcp_outbound.py` (raw JSON-RPC `initialize`, `notifications/initialized`, `tools/call send_message`), `adapter.py` (`ZapbipAdapter`), `__init__.py` (`register`), `plugin.yaml`, `log.py` (JSON log lines, secret-path redaction on the `httpx` and `websockets.client` loggers), `constants.py` (more names).
- `apps/hermes-plugin/tests/unit/`: `test_frames`, `test_handoff`, `test_connector_socket`, `test_connection_link`, `test_mcp_outbound`, `test_adapter`, `test_logging`, `test_constants_parity`, `conftest.py`.
- `apps/hermes-plugin/tests/support/`: `fake_connector.py` (a `websockets` server on `127.0.0.1`, answers the plain-HTTP probe), `socket_harness.py`, `frame_builders.py`, `typescript_constants.py`, `gateway_stub/gateway/**` (stand-in for `gateway.config`, `gateway.platforms.base`, `gateway.platforms.event`).
- Step 21's parity idea for Hermes is done here, in Python, per the lane brief (`test_constants_parity.py` reads `libs/types`, `libs/core` and `apps/api` sources at test time). Lane O's TS-side `python-constants-parity.test.ts` (plan Step 21) is then a duplicate; the lead decides.

### How to run

```bash
. <venv with apps/hermes-plugin/requirements.txt>/bin/activate
cd apps/hermes-plugin && python3 -m pytest tests/unit && python3 -m mypy zapbip_platform
```

### Red today, green after (commit: failure text the red run printed)

| Red commit | Failure text | Green commit |
|---|---|---|
| d06a3cc | 30 failed, 2 passed; `NotImplementedError: parse_server_frame is not implemented`, `NotImplementedError: handoff_text_of is not implemented` | f6d3d4c |
| 7b4ca40 | 22 failed; `NotImplementedError: run_connector_socket is not implemented` (backoff: `reconnect_delay_ms is not implemented`) | a08516f |
| da691af | 27 failed, 54 passed; `NotImplementedError: ZapbipAdapter is not implemented`, `send_owner_text is not implemented`, `socket_link_of is not implemented`, `FileNotFoundError` for `plugin.yaml` | cff209f |
| d150e85 | 3 failed, 3 passed; real leak: `'zb_conn_bbb...' is contained here: HTTP Request: POST https://zapbip.example/c/zb_conn_bbb.../mcp "HTTP/1.1 200 OK"` | c866ff4 |

Pins (green when they landed): `test_constants_parity.py` (0e3fabc), and in `test_logging.py` the oversize-frame (S6), `done` keys (S10) and markup-text (S7) tests.

### Hypotheses to attack

1. Hypothesis: the plugin never logs the secret, the socket or MCP link, or owner text, at any log level of the plugin side. Break it by: running a Hermes gateway with `DEBUG` logging and grepping for `zb_conn_`; check `httpcore` DEBUG lines and a `websockets` handshake failure message.
2. Hypothesis: `done` is sent only after `handle_message` returns, and a `handle_message` that raises sends none. Break it by: a gateway whose `handle_message` hangs, then a reconnect.
3. Hypothesis: a second plugin on the same connection stops the older one (`4001`) without a retry loop. Break it by: attaching two plugins to the real socket route.
4. Hypothesis: the stop on `401`/`404`/`500` of the probe exits the socket task and the adapter reports disconnected. Break it by: a wrong secret in a real Hermes gateway; check `gateway status`.
5. Hypothesis: the bounded seen set (1 024 ids) does not drop an unread message. Break it by: more than 1 024 unread messages queued while the agent is slow.
6. Hypothesis: the stub of `gateway.*` matches the real Hermes `v0.22.7` signatures (`build_source`, `MessageEvent`, `SendResult`, `register_platform` kwargs). Break it by: loading the plugin in the Docker image (V's E1).

### Known gaps

- Lane V must verify that `env_enablement_fn` returning `{"configured": True}` auto-enables the platform in a real Hermes gateway (unverified).
- A redelivered message that was already acknowledged is not handed off again and gets `done` again (commits for this are after 2cbfdf5).
- A refused probe ends the socket task and marks the adapter disconnected, but nothing tells the owner; the gateway log carries `connector_closed` with the status.
- The install must set `ZAPBIP_ALLOWED_USERS=owner` (the user id the plugin gives every message), or Hermes' allowlist refuses the owner; that is `install-skills`' text.
- No test starts the real gateway; the Docker E2E belongs to V.

## Lane O: OpenClaw plugin

### What changed

All under `apps/openclaw-plugin`: `src/{connector-socket,frames,handoff-queue,handoff,send-message,connection-link,channel,log,constants}.ts`, `index.ts`, `openclaw.plugin.json`, tests in `test/unit/` and fakes in `test/support/{fake-connector,fake-mcp-route}.ts`. The `OpenClawConfig` import path (`openclaw/plugin-sdk/config-contracts`) is verified against the installed `openclaw@2026.10.10` (typecheck passes, the type is exported there).

### How to run

`pnpm --filter @zapbip/openclaw-plugin typecheck` and `pnpm --filter @zapbip/openclaw-plugin test:unit` (the bundle test runs `build` itself).

### Red then green (failure text the red runs printed)

- `connector-socket.test.ts` (3f073d9): `Error: runConnectorSocket is not implemented`, `Error: reconnectDelayMs is not implemented`; green 175225c.
- `handoff.test.ts`, `send-message.test.ts` (2a5c3f5): `Error: handoffTextOf is not implemented`, `handOffToAgent`, `sendOwnerText` likewise; green 0c20cc7.
- message id of the send (0519b34): `AssertionError: expected undefined to be 'wamid.fake-1'`; green 0b38a72.
- `channel.test.ts`, `connection-link.test.ts` (1e86ced): `Error: createZapbipPlugin is not implemented`, `deriveSocketLink is not implemented`; green 5972267.
- `bundle.test.ts`: pin (green when it landed).

### Deviations and decisions

- `sendOwnerText` returns `Promise<string | null>` (the tool's `message_id`, `null` when the text is empty), not `void`: the SDK's `attachedResults.sendText` requires a `messageId`.
- Handoff failures log `wake_finished` with outcome `failed` and the message id only (no `ConnectorLogEvent` exists for it and `libs/types` is C0's).
- `SEEN_MESSAGE_LIMIT` (1 024) is plugin-local in `src/constants.ts`; a shared constant would be a C0 change.
- A 4001 replacement resolves `0` (plan), unlike `zapbip listen`. `startAccount` throws on any non-zero exit (refused probe), so the host sees the failure.
- The manifest puts `connectionLink` in `channelConfigs.zapbip.schema` (which validates `channels.zapbip`), the top-level `configSchema` stays empty.
- Step 21 struck: lane H owns the Python-to-TypeScript parity test.
- Timing and waiting are injectable (`wait`, `heartbeatIntervalMs`, `heartbeatTimeoutMs`, `log`) with the shared constants as defaults.

### Needs from C0 (not done by lane O)

`apps/openclaw-plugin/package.json` has no `openclaw` block (`extensions: ["./dist/index.js"]`, `channel: {id: "zapbip", label, blurb}`, `compat`), no `version`, and is `private: true`; `openclaw plugins install` needs the block and publish needs the rest.

### Hypotheses to attack

1. The plugin sends `done` only after `dispatchInboundDirectDm` resolves; killing the process between the two re-delivers the message after reconnect. Break it by: killing mid-handoff against a real connector.
2. No secret, link or owner text reaches stderr on any path (probe refusal, rejected handoff, dispatch error, rejected frame). Break it by: grepping a long run with a recognisable secret.
3. A second plugin on one connection stops the first without retry (close 4001, exit 0).
4. `commandAuthorized` and `inboundAccessAuthorized` are true only for the owner's direct message built in `handOffToAgent`.
5. The real OpenClaw gateway accepts the bundle (`dist/index.js`) and the manifest, and `startAccount` rejecting on a non-zero exit does not cause a restart storm. Unverified: only the SDK helpers were exercised for real; the gateway was not.

### Known gaps

- No run inside a real OpenClaw gateway or with a model (E and V3 cover it).
- Probe is made once at start; after the first success a revoked secret surfaces as reconnect close codes, not a probe.
- Reconnect after a close does not re-probe (same as `zapbip listen`).

## Integration (h + o + local-connector)

### What changed
- Merged `feat/hermes-openclaw-h`, `-o` (briefing sections kept as a union) and `origin/feat/local-connector` (head f17fb37). Conflicts: `wakeAgent` lives in `wake-agent.ts` here, so the connector's push-every-message rule (`pushesEveryMessage`, `hasFailedWake`) was ported there; `AccountInbox` registers the expiry, routing-list and wake providers; e2e global setup keeps `--env development` with the connector's wake-account seeding; `pnpm-lock.yaml` regenerated.
- OpenClaw test fixtures carry `forwarded: false` (the envelope now requires it).
- `apps/openclaw-plugin/package.json`: version `0.1.0`, no `private`, `files: [dist, openclaw.plugin.json]`, `openclaw` block (`extensions: ["./dist/index.js"]`, `channel`, `compat.pluginApi >=2026.10.10`), `peerDependencies.openclaw`. Hermes: `pyproject.toml`, `plugin.yaml` and `PLUGIN_VERSION` at `0.1.0`.
- `tools/repository-shape/src/plugin-versions.test.ts` ties both plugins to `ZAPBIP_NPM_VERSION`.
- `SEEN_MESSAGE_LIMIT` moved to `libs/types/src/constants.ts`; `ConnectorLogEvent.PluginHandoffFailed` (`plugin_handoff_failed`) added. There is no `LogEvent` enum in `libs/types`; `ConnectorLogEvent` is the shared log enum. OpenClaw logs it on a failed or errored handoff (it used `WakeFinished` with a failed outcome); Hermes `PluginLogEvent.HANDOFF_FAILED` now carries the same value. The Hermes parity test evaluates product expressions such as `25 * SECOND_MS`.

### Red then green
- 071c76c (red): Hermes parity `constant SEEN_MESSAGE_LIMIT not found`, `KeyError: 'PluginHandoffFailed'`; OpenClaw handoff queue `expected ... event: undefined`; repository-shape `expected undefined to be '0.1.0'`. Green in the next commit.

### Owner publish steps (for the deploy-readiness runbook)
1. Create or own the npm scope `@zapbip`, then `pnpm --filter @zapbip/openclaw-plugin build` and `npm publish --access public` from `apps/openclaw-plugin` at `0.1.0`.
2. Publish `zapbip-platform` `0.1.0` from `apps/hermes-plugin` to PyPI (`python -m build`, `twine upload`), or distribute the Hermes plugin folder as documented.
3. Confirm `npm view @zapbip/openclaw-plugin@0.1.0` resolves before the docs deploy.

### Gaps
- Plugins do not yet treat `verified=false` (forwarded) messages differently when handing off; the connector channel trust rule is not mirrored here.
- No publish was run; `compat.pluginApi` was chosen as the installed `2026.10.10` floor.
