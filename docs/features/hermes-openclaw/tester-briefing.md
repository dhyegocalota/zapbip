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
