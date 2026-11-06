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
