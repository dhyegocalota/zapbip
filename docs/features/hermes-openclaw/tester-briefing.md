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

### Forwarded messages (follow-up)
- `CHANNEL_FORWARDED_PREFIX` (`[forwarded — not written by the owner]`, agent-facing English like the other handoff sentences; plugins do not know the owner locale) lives in `libs/types/src/channel-plugin.ts`; Hermes reads it through the parity test. A message with `forwarded: true` is handed off as `prefix\ntext` in both plugins; OpenClaw also dispatches it with `commandAuthorized: false`. Hermes `MessageEvent` has no untrusted flag in the host API used here.
- Red: 2 commits back (OpenClaw `expected 'transfer money' to be 'undefined\ntransfer money'`; Hermes `ImportError cannot import name CHANNEL_FORWARDED_PREFIX`). Hypothesis: a forwarded message never reaches either agent without the prefix. Gap: no real host run.

## Lane V (verification, real gateways in Docker)

### What changed

- `apps/api/test/e2e/hermes-openclaw.e2e.test.ts`: opt-in (`ZAPBIP_E2E_CLIENTS=1`, run with `pnpm test:e2e:clients`). It boots the isolated development stack (wrangler dev, `--env development`), a fake OpenAI-compatible model, a self-signed HTTPS front on `host.docker.internal`, then starts real containers: the OpenClaw gateway `2026.10.10` (`node:24-slim`, plugin installed from an `npm pack` archive with `openclaw plugins install --force --accept-capabilities`) and the Hermes gateway `nousresearch/hermes-agent:v0.22.7` (plugin folder mounted into `plugins/`, `ZAPBIP_CONNECTION_LINK` and `ZAPBIP_ALLOWED_USERS=owner` as environment only).
- `scripts/e2e/clients/`: `fake-model.ts`, `tls-front.ts`, `container.ts`, `openclaw-client.ts` with `openclaw/Dockerfile`, `hermes-client.ts`, `free-port.ts`, `constants.ts`. Keys are fake; nothing real is used.
- Lane V also fixed two product defects it found: Hermes `zapbip_platform` now uses relative imports (the plugins folder alone loads; red was the install-layout case, `No module named 'zapbip_platform'`), and the OpenClaw handoff puts the forwarded prefix on the same line as the text and passes `commandBody` without the text, because OpenClaw drops a turn whose text holds a slash command when `commandAuthorized` is false (red: unit `handoff.test.ts`, then the real-gateway forwarded slash case).
- Cases: E1, E2, E3, E4, E5, E6, E7, E9, E10, E11 (both products), forwarded prefix and forwarded slash command (both products), X1 with X2, X3, X4 with X5, X6, X7, install layout. E8 (no `zb_conn_` in container logs) is asserted inside E1 and E2.

### How to run

```bash
pnpm install --frozen-lockfile
ZAPBIP_E2E_CLIENTS=1 pnpm --filter @zapbip/api exec vitest run --config vitest.e2e.config.mts test/e2e/hermes-openclaw.e2e.test.ts
```

Needs Docker, `openssl` and network for the two images. Runtime is about 12 minutes. The OpenClaw image is built native (arm64 on Apple silicon); the Hermes image `nousresearch/hermes-agent:v0.22.7` exists only as `linux/amd64`, so it runs emulated and accounts for most of the time.

### Findings (each seen in a run)

1. Hermes `env_enablement_fn` `{"configured": True}` auto-enables the platform: `Connecting to zapbip`, `Gateway running with 2 platform(s)`, no `platforms:` block in `config.yaml`. `ZAPBIP_ALLOWED_USERS=owner` lets the owner through; any other value is refused with no model call (E7).
2. On a fresh single-agent account an owner message without `@<agent>` was never pushed to the attached plugin; the fixtures prefix `@grok`.
3. `scheduled` is still an unavailable `set_wake` mode on this branch (scheduled-wake not merged). E5 and E6 therefore poll `check_inbox` from the fixture with the plugin down, and X4 and X5 use a stored `webhook` mode as the previous mode (the mechanism is the same: hello carries `previousWakeMode`, detach restores it). Re-point them to `scheduled` when scheduled-wake lands.
4. X3 follows the decided rule (a live waiter wins; the plugin socket is not pushed a message the waiter consumed), carried by `local-connector` 31dde90; the e2e asserts it.
5. `openclaw plugins install <archive>` needs `--force --accept-capabilities`; the config key is `zapbip` although the package is `@zapbip/openclaw-plugin`; OpenClaw warns `provenance-invalid` for an archive install.
6. Hermes runs the gateway under s6; plugin log lines land in `/opt/data/logs/gateway.log`, not `docker logs`. `/opt/data` cannot be a macOS bind mount (control socket `Errno 22`), so the fixture uses an anonymous volume and mounts only the config and the plugin folder.

### Hypotheses to attack

1. Hypothesis: after `connector_connected`, an owner message is handed off within seconds for both products. Break it by: posting in the same millisecond as the attach, many times.
2. Hypothesis: one reply per owner message across a restart (E3) and a replacement (E4). Break it by: stopping the container mid-handoff, before `done`.
3. Hypothesis: no `zb_conn_` string in any container log. Break it by: running both gateways with `DEBUG` logging.

### Gaps

- The model is fake and makes no tool calls: replies travel through the plugin's own `send_message`. A real model run stays owner-run (V3).
- The TLS certificate is self-signed, trusted through `NODE_EXTRA_CA_CERTS` and `SSL_CERT_FILE` in the containers only.

## Fix round 1 (security S1 to S6, reviewer R1 to R9, unit-tester F1 and F2, e2e-tester a to d), at 892fac1

Owner delegated 2026-11-06. Commit f010684 (`test(plugins): forwarded messages ... (red)`) printed its Hermes red as an `ImportError` instead of the assertion text the plan records; accepted by the owner's delegation, not redone.

### What changed

- S1 `package.json` and `pnpm-lock.yaml`: `pnpm.onlyBuiltDependencies: ["esbuild", "workerd"]` replaces `neverBuiltDependencies`; `openclaw` is not listed, so it is still not built. Checked with a clean `pnpm install --frozen-lockfile`.
- S2 OpenClaw `src/frames.ts`: frame parsers are looked up with `Object.hasOwn`; `__proto__`, `constructor`, `toString`, `hasOwnProperty`, `valueOf` are `unknown_type`. The handler record is reached only after parsing, so it needs no second guard.
- S3 transport frame cap: Hermes `connect(..., max_size=CONNECTOR_FRAME_MAX_BYTES)`; OpenClaw uses `ws` (already pinned `8.22.1`, bundled into `dist/index.js`) with `maxPayload: CONNECTOR_FRAME_MAX_BYTES`, and the build adds a `createRequire` banner because the bundled CommonJS code asks for Node modules. An oversize frame now closes the socket (close code 1009 on the wire, seen as 1006 by `ws`) and the plugin reconnects; the parse-time size check stays as a second line.
- S4 Hermes `log.py`: the secret path is redacted in `exc_text` and `stack_info`; the `httpx2` logger (Hermes's own MCP client) is redacted too, found by the new MCP e2e case (the secret URL was in the Hermes log once the documented `mcp_servers` block was configured).
- S5 Hermes dependencies: `pyproject.toml` has `[build-system]` (setuptools pinned), pinned runtime `dependencies` (httpx, websockets), a `dev` extra (pytest, mypy, pytest-timeout, all pinned) and the `hermes_agent.plugins` entry point; `requirements.txt` (runtime) and `requirements-dev.txt` are `uv pip compile --universal --generate-hashes` locks; CI and the doctor's fix line install with `--require-hashes -r apps/hermes-plugin/requirements-dev.txt`. `requires-python` is now `>=3.11,<3.15` because the pinned Hermes image runs Python 3.14.9. pytest has `timeout = 10`.
- S6 `scripts/e2e/clients`: the fake model and the TLS front bind to `container-host.ts` (loopback on macOS Docker Desktop, the bridge gateway on Linux); `free-port` probes loopback; the Hermes image is pinned `v0.22.7@sha256:e6d81ae5...` and is built into `zapbip-e2e-hermes` from the packaged wheel (`pip install --no-deps`).
- R1/R2/R6 docs (`apps/docs/agents/{hermes,openclaw}.mdx`, en and pt-br): replies go through the plugin's own outbound; MCP is for starting a conversation, asking and the polling fallback; install commands as run (`openclaw plugins install @zapbip/openclaw-plugin@0.1.0 --force --accept-capabilities`, `plugins.entries.zapbip.enabled`, `channels.zapbip.connectionLink`; `pip install zapbip-platform==0.1.0` and the environment variables); a "How it listens" section; "ask the agent to send `✅ instalado`"; troubleshooting rows fixed.
- R3 both plugins: close code 4003 (`REVOKED_CLOSE_CODE`) exits with failure; an attempt that never opened re-probes (a 401 exits with failure, 426 retries).
- R5 OpenClaw: a failed reply delivery logs `plugin_reply_failed` (new `ConnectorLogEvent.PluginReplyFailed`), is not retried, and is documented.
- R7 `plan.md` and `spec.md`: stale install-page lines fixed; the "Install path" box is ticked with evidence.
- R8 Hermes: the forwarded prefix shares a line with the text (space), `CHANNEL_HANDOFF_NO_TEXT_BY_KIND` is keyed by `MessageKind`.
- R9 OpenClaw `package.json`: `prepublishOnly: pnpm run build`.
- F1/F2 and kind validation (both plugins): a messages frame whose message has no known `kind` is `malformed` at parse time; the duplicate-while-pending test now reads the duplicate before the handoff resolves; the null `previousWakeMode` hello case is pinned.
- e2e (b): the fake model can call a tool; the new case `MCP <product>` configures the documented MCP block (`mcp.servers` / `mcp_servers`), the model calls `tool_search` (both products defer MCP tools) and the result naming `check_inbox` returns to the model.

### Red then green (failure text the red runs printed)

| Area | Red commit message says | Green |
|---|---|---|
| S2 | `TypeError: parseFrame is not a function`; `expected { ok: true } to equal { ok: false, reason: 'unknown_type' }` | `fix(openclaw): look frame parsers up by own property` |
| R3, S3 OpenClaw | 4 failed (timeouts, `expected 1 to be 2`) | `feat(openclaw): stop on a revoke ...` |
| R3, S3 Hermes | 5 failed (TimeoutError, `assert 1 == 2`) | `feat(hermes): stop on a revoke ...` |
| bundle | `expected -1 to be greater than or equal to 0` | same feat commit |
| S4 | 2 failed (traceback, stack_info); httpx2 1 failed | `fix(hermes): redact ...` |
| R5 | `promise rejected "Error: segredo-da-resposta" instead of resolving` | `feat(openclaw): log a failed reply delivery ...` |
| R8 | 12 failed (`KeyError: <MessageKind.IMAGE: 'image'>`, newline vs space) | `fix(hermes): one forwarded-prefix shape ...` |
| kind validation | 5 OpenClaw and 6 Hermes cases | `fix(plugins): reject a messages frame ...` |
| S5, S6 | shape tests: workflow without `--require-hashes`; `0.0.0.0`; Hermes image tag only | the packaging and e2e commits |

Pins (green on arrival): the project and lock shape cases, the null `previousWakeMode` hello, the duplicate-while-pending test, `docs-agent-install`, the prepublish check, the `message`-case of the log redaction.

### How to run

`pnpm verify all` with the Python 3.13 venv active. Docker: `ZAPBIP_E2E_CLIENTS=1 pnpm test:e2e:clients` (about 15 minutes; the first run pulls the pinned Hermes image by digest when the local copy has no digest).

### Hypotheses to attack

1. Hypothesis: after a revoke (4003) both plugins stop and stay stopped. Break it by: closing with 4003 right after a reconnect, and with 4003 during the backoff.
2. Hypothesis: a never-opened attempt followed by 401 stops both plugins, and one followed by 426 reconnects. Break it by: flipping the probe between attempts.
3. Hypothesis: no `zb_conn_` reaches any Hermes or OpenClaw log with the MCP block configured. Break it by: running with `DEBUG` logging and a failing tool call.
4. Hypothesis: the wheel installs into a clean Python 3.13 venv and into the Hermes image, and Hermes lists it as an entry-point plugin.
5. Hypothesis: `ws` bundled into `dist/index.js` works under OpenClaw's loader. Break it by: the Docker suite (E1, E3, E4).

### Gaps

- The documented 1-minute `check_inbox` fallback job is not covered by the suite (no product scheduler is run); it stays an owner-run check, listed in `plan.md` Owner-run.
- The registry command `openclaw plugins install @zapbip/openclaw-plugin@0.1.0` cannot be run until the package is published; the suite installs the packed archive with the same flags.
- The fake model drives `tool_search` for the MCP case, not a real tool call to `check_inbox`; a real model run stays owner-run (V3).
- `requires-python` allows 3.14 for the Hermes image, while the doctor and CI keep the development toolchain on 3.11 to 3.13.
- The E4 flake seen at 892fac1 is fixed in fix round 2 below.

## Fix round 2 (E4 double answer, review re-checks)

### Root cause of the E4 double answer

Seen in a Docker run (container logs of the failing E4): the server closes the older socket with `4001`; the OpenClaw plugin logged `connector_replaced` and `startAccount` returned cleanly, so OpenClaw logged `channel exited without an error` and `auto-restart attempt 1/10 in 5s`. Five seconds later the old container reconnected, which replaced the newer one (`connector_replaced` in the second container too) and received the owner message again (`messages_received count 1`) while the first handoff had not been acknowledged yet. Two model calls and two replies, and the two gateways kept replacing each other every 5 s. Deduplication by message id cannot help: the two listeners are two processes. Hermes does not restart on replacement: its adapter only marks itself disconnected, and the gateway reconnect watcher acts on fatal errors only (pinned by `test_replaced_socket_ends_without_a_second_run`).

### What changed

- OpenClaw `startAccount` reports a replaced socket (new `REPLACED_EXIT_CODE`) with `setStatus({lifecycle: "blocked", terminalDisconnect: true})` and returns; OpenClaw then logs `auto-restart skipped, terminal disconnect`. A revoke still throws, an abort still ends cleanly.
- Hermes `redact_root_handlers` puts `SecretPathRedaction` on every root handler at import and at `connect()`.
- Review re-checks: the MCP e2e cases search for `inbox` (the old query `check_inbox` was echoed back by both gateways, even in a validation error, so the case proved nothing); the fake model builds the `tool_search` arguments from the declared schema; Hermes runs at DEBUG in every case plus a refused-link case with the MCP block; `hasMcpServer` is required; nameless tool declarations are dropped; `bridgeGatewayHostOf` throws unless the host is IPv4; the Hermes wheel is built with `--no-build-isolation` from hashed setuptools; the OpenClaw base image is pinned by digest; Hermes `dependencies` are compatible ranges (`httpx>=0.28,<0.29`, `websockets>=15,<16`, the versions the pinned Hermes image ships), exact hashes stay in the locks; spec rungs name the published packages; test-plan section F added.

### Red then green

| Case | Red text | Red commit | Green commit |
|---|---|---|---|
| OpenClaw replaced account ends terminal | `promise rejected "Error: the zapbip connector stopped with …" instead of resolving` | ec10946 | ebb3948 |
| OpenClaw 4001 exit code | `expected +0 to be 2` | ec10946 | ebb3948 |
| Root-handler redaction (4 cases) | `NotImplementedError: redact_root_handlers is not implemented` | 3a25198 | 5e6757f |
| Bounded Hermes dependencies | `expected false to be true` | c1a92f8 | 5a13e9b |
| IPv4 bridge host (5 cases) | `Error: bridgeGatewayHostOf is not implemented` | 9973338 | 3f9f195 |

Pins: Hermes replaced socket (f3e229b), OpenClaw digest, `onlyBuiltDependencies`, hashed build requirement, handoff test text.

### Hypotheses to attack

1. Hypothesis: after a replacement the older OpenClaw never reconnects and the newer one answers once. Break it by: replacing three times in a row, and replacing while a handoff is in flight.
2. Hypothesis: a revoke (`4003`) after this change still ends the account with an error and OpenClaw backs off, not terminal.
3. Hypothesis: with Hermes at DEBUG, no `zb_conn_` is in `gateway.log` with a working or a refused link.

### Gaps

- The refused-link case uses an unknown secret, not a revoked one: the development stack has no revoke route.
- Docker needs about 12 GB free in the Docker VM; a full disk surfaces as `Errno 28` inside the Hermes container and a missing `connector_connected`.
