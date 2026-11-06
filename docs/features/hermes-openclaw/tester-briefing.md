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

- `adapter.py` carries `# type: ignore[import-not-found]` and `[misc]` pragmas because `gateway.*` is absent under `mypy`. A `[[tool.mypy.overrides]]` for `gateway.*` in `pyproject.toml` (C0's file) would remove them; asked of the lead.
- A message handed off whose `done` was written to a dead socket is skipped on the next reconnect (it sits in the seen set) and is never acknowledged until the server forgets it. Plan Step 10 does not re-send `done` for a seen id; not added.
- A refused probe ends the socket task and marks the adapter disconnected, but nothing tells the owner; the gateway log carries `connector_closed` with the status.
- The install must set `ZAPBIP_ALLOWED_USERS=owner` (the user id the plugin gives every message), or Hermes' allowlist refuses the owner; that is `install-skills`' text.
- `env_enablement_fn` returns `{"configured": True}`; whether Hermes needs other seeded keys to auto-enable the platform is unverified against the real gateway.
- No test starts the real gateway; the Docker E2E belongs to V.
