# Plan: Hermes and OpenClaw

**Spec:** spec.md (decisions below are recorded in its "Open questions → answers" table, `owner delegated 2026-11-06`)
**Tier:** 🟡
**Seam:** the connector socket `GET /c/<secret>/connector` (WebSocket, `local-connector`) carries owner messages to the plugins; outbound replies go through the MCP tool `send_message` on the connection's MCP URL; the install prompts of `install-skills` consume `CHANNEL_PLUGIN_PACKAGE_NAME`.
**Depends on (merged before V):** `agent-inbox-core` (MCP tools, `AgentWaker`; on this branch at a527d63), `local-connector` (socket, `LocalConnectorWaker`, `acknowledgeDelivery`, the `listen` delta LN1 to LN5; the socket route is not on this branch yet), `webhook-wake` (`set_wake`; not on this branch), `scheduled-wake` (`scheduled` mode with the revised floor, see Decisions; not on this branch), `install-skills` (the two sections). Gap list: Plan refresh below.

**Assumptions (decided, owner can override):**
- A1. The plugins speak the real connector protocol: WebSocket, frames `hello`, `messages`, `done`, text `ping`/`pong`. The POC's SSE endpoints (`/agents/:name/events`, `/agents/:name/send`) do not exist in zapbip and are not ported.
- A2. Outbound is the MCP tool `send_message`, called as JSON-RPC over the connection's stateless MCP route (`initialize`, `notifications/initialized`, `tools/call`). No MCP client SDK is added.
- A3. A plugin sends `done` after the product accepts the handoff. Listen keeps the notifier rule (no `done`).
- A4. Hermes plugin: Python 3.11 to 3.13 (`requires-python >=3.11,<3.14`, CI runs 3.13). OpenClaw plugin: TypeScript, bundled with esbuild, `openclaw` external, runtime dependencies none.
- A5. Versions under test: OpenClaw `2026.10.10` (the POC's version, in Docker); Hermes image `nousresearch/hermes-agent:v0.22.7` (the POC's image, run as `linux/amd64`, the image crashes under arm64 emulation). PyPI `hermes-agent` latest is `0.19.0`, a different build; the install path is `(verify)`.
- A6. Names are free on 2026-11-06 (`npm view` and PyPI both 404): npm `@zapbip/openclaw-plugin`, PyPI `zapbip-platform`. Claiming them is a publish step, outside this slice.
- A7. The Python app lives in `apps/hermes-plugin` with a `package.json` whose scripts call `python3 -m pytest` and `python3 -m mypy`, so the existing `apps/*` gate rows cover it without a new root entry. No root file is added (no `.python-version`).
- A8. Pinned versions, checked with `npm view` / PyPI on 2026-11-06 (age of two weeks is checked again at build): npm `esbuild@0.28.2`, `vitest@5.0.5`, `ws@8.22.1`, `@types/ws@8.18.2`, `@types/node@24.19.2` (the same pins `apps/connector` uses), `typescript` from the root; PyPI `websockets==15.0.1` (the pin Hermes ships for Python 3.14), `httpx==0.28.1` (Hermes core pin), `pytest==9.2.0`, `mypy==2.4.1`. Install nothing at plan time.
- A9. A plugin retries a network error on the probe with backoff, where `connect` exits. A gateway can start before the network is up, so exiting would leave the owner without a wake. Refusals (`401`, `404`, any status other than `426`) still stop the plugin, as `connect` does.
- A10. (refresh) Python gates run from an activated 3.13 venv. The local `python3` here is 3.14.7 and out of range; `/usr/local/bin/python3.13` exists on the owner's machine (Python 3.13.9). `doctor.sh` reports the mismatch and never installs (ADR 0004).
- A11. (refresh) Pin ages on 2026-11-06, from the registries: `openclaw@2026.10.10` published 2026-11-03 (3 days; kept, it is the tested version); `ws@8.22.1` 2026-10-31 (6 days; kept, the same pin `apps/connector` uses); `pytest==9.2.0` 2026-10-27 (10 days) and `mypy==2.4.1` 2026-10-28 (9 days) exist and are kept. The owner decides whether to wait for the two-week age.

## Decisions taken in this plan (recorded in spec.md)

| # | Decision | Rejected alternative | Why |
|---|---|---|---|
| D1 | Plugins use the WebSocket connector protocol | the POC's SSE shape | the real connector is WebSocket with hibernation (ADR 0022) |
| D2 | Outbound by raw JSON-RPC to `send_message` | an MCP client SDK per language | no new runtime dependency; the route is stateless |
| D3 | Plugin acknowledges with `done` after the handoff | notifier only (spec draft) | without an ack a reconnect re-sends every unread message, and an agent that answers without `check_inbox` gets each message again |
| D4 | Scheduled floor drops from 60 to 1 minute, in `scheduled-wake` | keep 60 and drop the scheduled fallback | the fallback polls every minute; cloud clients keep 60 through their own install prompts |
| D5 | Fallback = `zapbip listen` watcher (`stream` / `watch_patterns`) plus a cron calling `check_inbox` each minute | cron only | the cron is the guarantee; the watcher gives a mid-run turn, and OR-13 and OR-14 decide whether it stays |
| D6 | Hermes in Python, OpenClaw in TypeScript | one language | each product's plugin API decides it |
| D7 | Two ADRs: 0028 (plugin as rung 1) and 0029 (handoff ack) | none | real alternatives exist; both written `Proposed` in C0, accepted after V3 |

**Toolchain impact (Python).** The harness has no Python today. This plan adds: `actions/setup-python` (3.13) to `.github/workflows/verify.yml`; a `python3` and `pytest`/`mypy` report in `.agents/hooks/doctor.sh` (reports, never installs, ADR 0004); a `package.json` wrapper per Python app. Dependencies live in `apps/hermes-plugin/pyproject.toml`, not in `pnpm-lock.yaml`. The Hermes end-to-end tests need Docker and are opt-in.

## Plan refresh (2026-11-06, against a527d63)

Checked against slice 1's code on this branch and against `origin/feat/local-connector-listen`. Lines changed in place carry a `(refresh)` note. The plan had no `(contract: confirm at build)` mark; the gaps below take its place.

| Item | What the code has | Resolution |
|---|---|---|
| Connector constants and enums | `libs/types/src/connector.ts`: `ConnectorFrameType`, `FrameRejectionReason`, `ConnectorLogEvent`, `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_TIMEOUT_MS`, `RECONNECT_BASE_MS`, `RECONNECT_MAX_MS`, `REPLACED_CLOSE_CODE` (4001), `UPGRADE_REQUIRED_STATUS` (426), `UNAUTHORIZED_STATUS` (401), `CONNECTOR_PING_TEXT`, `CONNECTOR_PONG_TEXT`, `CONNECTOR_FRAME_MAX_BYTES` | no new TypeScript for these; `channel-plugin.ts` adds only the product enum, package names, handoff texts and self-test text. Python mirrors the values |
| Probe statuses | `426` and `401` have constants; `404` and `500` do not | the plugin stops on any status other than 426 (A9), so no constant is added for 404 |
| `Message` (`libs/core/src/inbox/message.ts`) | envelope with `messageId`, `at` (epoch ms), `direction`, `agent`, `readByAgent`; content with `text`, media `caption`, `choice` `selected: {title}` or `null` | the handoff tests use these names and no others |
| Text limit | `WHATSAPP_TEXT_MAX_CHARS` = 4096 in `libs/core/src/inbox/constants.ts` | tests use 4096 and 4097 as literals; the plugin does not import core at runtime |
| Tool names | `send_message`, `ask`, `wait_for_reply`, `check_inbox` in `apps/api/src/contract/tool-definitions.ts` | as written |
| `set_wake` | absent (webhook-wake) | external: E5, E6 and I-3 wait for it |
| `WakeMode` | `none` and `local` only; `scheduled` comes with scheduled-wake | the Python `hello` parse requires a string and does not enumerate modes |
| Socket route `/c/:secret/connector` | absent from `apps/api/src/routes`; `acceptConnectorSocket`, `sendFrameToAgent`, `parseDoneFrame` exist in `apps/api/src/account-inbox/connector-sockets.ts` | the route and attach and detach (X4 to X6) belong to local-connector; V's X and E cases wait for them |
| `done` acknowledgement | `acknowledgeDelivery` exists in `libs/core/src/inbox/use-cases/acknowledge-delivery.ts`: marks read only the agent's own owner messages, no-op for unknown ids | the socket's `done` handler is local-connector's |
| `zapbip listen` | `apps/connector/src/listen.ts` and its CLI command exist | used by the install section only |
| Link copy | `connectionLink is required` has no shared copy in `libs/types` | a plugin-local error text; the test asserts that it names `connectionLink` |
| Link derivation | `deriveConnectorLinks` in `apps/connector/src/connect.ts` | O re-derives the socket link (suffix swap and protocol map). The reviewer at O decides whether to move it to a shared lib |
| E2E stack | `apps/api/test/e2e/claude-code-stack.ts` | V reuses its pattern |
| Python on this machine | `python3` 3.14.7; `/usr/local/bin/python3.13` present | A10 |
| ADRs 0028 and 0029 | in neither the repo nor the stash | written in C0 with their index rows |
| Verify gates | `scripts/verify-gates.tsv` has `apps/*` rows (typecheck, unit) | no gate row change |
| Hermes plugin directory | spec says `~/.hermes/plugins/zapbip`; the POC used `poc/hermes/plugin/zapbip/` | ~~`plugin.yaml` in `apps/hermes-plugin/plugin.yaml`~~ `plugin.yaml` sits in `zapbip_platform/` (H, Step 12); H confirms against the POC the directory name Hermes loads |

## File map

| Group | Paths owned | Developer sub-agent | Runs |
|---|---|---|---|
| C0 Contract (shared files, one owner) | `docs/adr/0028-*.md`, `docs/adr/0029-*.md`, `docs/adr/README.md`, `libs/types/src/channel-plugin.ts`, `libs/types/src/index.ts`, `apps/openclaw-plugin/{package.json,tsconfig.json,vitest.config.mts,README.md}`, `apps/openclaw-plugin/src/{connector-socket,handoff,send-message}.ts` (stubs), `apps/hermes-plugin/{package.json,pyproject.toml,requirements.txt,README.md}`, `apps/hermes-plugin/zapbip_platform/{__init__,constants,frames,handoff,connector_socket,mcp_outbound}.py` (`constants.py` real, the rest stubs), `apps/hermes-plugin/tests/unit/test_constants.py`, `pnpm-lock.yaml`, root `package.json` (script `test:e2e:clients`), `.github/workflows/verify.yml`, `.agents/hooks/doctor.sh` | `developer-c0` | first, alone |
| H Hermes plugin | `apps/hermes-plugin/zapbip_platform/**` (bodies replace the C0 stubs; `plugin.yaml` and `register` live here), `apps/hermes-plugin/tests/unit/**` (except `test_constants.py`), `apps/hermes-plugin/tests/support/**` | `developer-h` | after C0 |
| O OpenClaw plugin | `apps/openclaw-plugin/src/**` (bodies replace the C0 stubs; `channel.ts` is new), `apps/openclaw-plugin/index.ts`, `apps/openclaw-plugin/openclaw.plugin.json`, `apps/openclaw-plugin/test/unit/**`, `apps/openclaw-plugin/test/support/**` | `developer-o` | after C0, parallel with H |
| V Verification | `apps/api/test/e2e/hermes-openclaw.e2e.test.ts`, `scripts/e2e/clients/**` (Dockerfiles, compose, fake model copied from `SCRATCH/poc/fake-model.ts`) | `developer-v` | after H, O and the external merges |

Shared files are owned only by C0. H and O never edit a file outside their list; a needed change to `libs/types` is a new C0 commit that both merge.

## Contract (Step 0, verbatim)

C0 lands these signatures in one commit. H and O build against them; a later change is a new C0 commit that every lane merges. (refresh) The stubs are C0's too: each throws `<name> is not implemented`, so the red runs fail on the stub, as the Expected red text below says.

```ts
// libs/types/src/channel-plugin.ts
export enum ChannelPluginProduct {
  OpenClaw = 'openclaw',
  Hermes = 'hermes',
}

export const CHANNEL_PLUGIN_PACKAGE_NAME: Record<ChannelPluginProduct, string> = {
  [ChannelPluginProduct.OpenClaw]: '@zapbip/openclaw-plugin',
  [ChannelPluginProduct.Hermes]: 'zapbip-platform',
};

export const CHANNEL_HANDOFF_NO_TEXT_BY_KIND: Record<MessageKind, string> = { /* one English sentence per kind, written in C0 */ };
export const CHANNEL_PLUGIN_SELF_TEST_TEXT = '✅ instalado';
```

```ts
// apps/openclaw-plugin/src/connector-socket.ts
export function runConnectorSocket(input: {
  socketLink: string;
  signal: AbortSignal;
  handOff: (input: { message: Message }) => Promise<void>;
}): Promise<number>;

// apps/openclaw-plugin/src/handoff.ts
export function handoffTextOf(input: { message: Message }): string;
export function handOffToAgent(input: { cfg: OpenClawConfig; account: ZapbipAccount; message: Message }): Promise<void>;

// apps/openclaw-plugin/src/send-message.ts
export function sendOwnerText(input: { mcpLink: string; text: string }): Promise<void>;
```

```python
# apps/hermes-plugin/zapbip_platform/constants.py  (mirrors libs/types; O pins parity in a TS test)
# apps/hermes-plugin/zapbip_platform/frames.py
class ServerFrameParse: ok: bool; frame: dict | None; reason: FrameRejectionReason | None
def parse_server_frame(*, text: str, is_binary: bool) -> ServerFrameParse: ...

# apps/hermes-plugin/zapbip_platform/handoff.py
def handoff_text_of(*, message: dict) -> str: ...

# apps/hermes-plugin/zapbip_platform/connector_socket.py
async def run_connector_socket(*, socket_link: str, stop: asyncio.Event, hand_off: Callable[..., Awaitable[None]]) -> int: ...

# apps/hermes-plugin/zapbip_platform/mcp_outbound.py
async def send_owner_text(*, mcp_link: str, text: str) -> None: ...
```

Every function takes named parameters. Enums are used for frame types, reasons and outcomes; the Python side uses `enum.Enum` with the same string values as `libs/types`.

## Steps

Author this list with every box empty. Red commits come before the green commit of the same behaviour. Commit messages are Conventional Commits.

### C0: contract (first, one developer)

- [x] **Step 1 (C0):** (4587e0d) write `docs/adr/0028-*.md` (rung 1 is the native plugin; alternative: a `stream` or `watch_patterns` listener) and `0029-*.md` (the plugin acknowledges a handoff; alternative: notifier only) as `Proposed`, from D7 (`docs(adr): ...`).
- [x] **Step 2 (C0):** (3e54d23) add `libs/types/src/channel-plugin.ts` with the contract above; export it from `libs/types/src/index.ts`; `pnpm typecheck` green (`feat(types): name the channel plugins and their handoff text`).
- [x] **Step 3 (C0):** (07b15c8) write `apps/openclaw-plugin/package.json` (name `@zapbip/openclaw-plugin`, the value of `CHANNEL_PLUGIN_PACKAGE_NAME[openclaw]`; scripts `build`: esbuild bundle to `dist/index.js`, `openclaw` external; `typecheck`: `tsc --noEmit`; `test:unit`: `vitest run --passWithNoTests --config vitest.config.mts`; devDependencies `esbuild@0.28.2`, `vitest@5.0.5`, `ws@8.22.1`, `@types/ws@8.18.2`, `@types/node@24.19.2`, `@zapbip/types` and `@zapbip/core` as `workspace:*`, `openclaw@2026.10.10` as devDependency for types). (refresh) Also `tsconfig.json` and `vitest.config.mts`, so `typecheck` and `test:unit` run before any test exists, and the three `src` stubs. The stub's `OpenClawConfig` import path is `(verify at build)` against `openclaw@2026.10.10`'s exports. Regenerate `pnpm-lock.yaml` (`chore(plugins): add the OpenClaw plugin package`).
- [x] **Step 4 (C0):** (11bce25) write `apps/hermes-plugin/package.json` (name `@zapbip/hermes-plugin`, private; scripts `typecheck`: `python3 -m mypy zapbip_platform`; `test:unit`: `python3 -m pytest tests/unit`; no pnpm dependencies) and both purpose-only READMEs (`chore(plugins): add the Hermes plugin package shell`). (refresh) Also `pyproject.toml` (`requires-python >=3.11,<3.14`, pytest `pythonpath`, mypy `strict`), `requirements.txt` (the pins of A8: `websockets==15.0.1`, `httpx==0.28.1`, `pytest==9.2.0`, `mypy==2.4.1`; CI and developers install it with `python3 -m pip install -r`, so no build backend is needed), an empty `zapbip_platform/__init__.py`, the stubs and `tests/unit/test_constants.py`. Pytest exits 5 when it collects nothing, so the shell needs one passing test to keep `pnpm verify` green.
- [x] **Step 5 (C0):** (d17fedf) `.github/workflows/verify.yml` gets `actions/setup-python` pinned to 3.13 before the verify step (refresh: by full commit SHA with a `# v<major>` comment, as the file's other actions are pinned; `checks` installs `requirements.txt` before `pnpm typecheck`, and the `unit` matrix gains a `hermes-plugin` row with the same setup); `.agents/hooks/doctor.sh` reports `python3` between 3.11 and 3.13 and whether `pytest` and `mypy` import, and never installs (`ci(harness): run the Python plugin gates`). Check: `scripts/verify.test.sh` and `tools/repository-shape` stay green.
- [x] **Step 6 (C0):** (07b15c8) root `package.json` gets `pnpm.neverBuiltDependencies: ["openclaw"]` (refresh: `openclaw@2026.10.10`'s preinstall refuses Node below 24.16, while the owner's Node is 24.7 and `.nvmrc` says 24; the plugin needs only its types, so the package's install scripts are skipped. The owner decides whether to raise `.nvmrc`), and `test:e2e:clients` (`pnpm --filter @zapbip/api exec vitest run --config vitest.e2e.config.mts test/e2e/hermes-openclaw.e2e.test.ts` with `ZAPBIP_E2E_CLIENTS=1`; refresh: the config and `test/` live in `apps/api`, so the command runs through the package, not `apps/api/vitest.e2e.config.mts` from the root); the E2E is not in `pnpm verify`.

### H: Hermes plugin (after Step 6)

- [ ] **Step 7 (H, red):** `tests/unit/test_frames.py` and `tests/unit/test_handoff.py`. (refresh: the stubs come from C0, so this step adds only the tests; the stubs raise `NotImplementedError('<name> is not implemented')`.) Cases are in the test plan, area H-1 and H-2. Commit `test(hermes): pin the frame and handoff rules`. Expected red text: `NotImplementedError: parse_server_frame is not implemented`.
- [ ] **Step 8 (H, green):** `constants.py`, `frames.py`, `handoff.py`. Commit `feat(hermes): parse connector frames and hand owner messages to the agent`.
- [ ] **Step 9 (H, red):** `tests/unit/test_connector_socket.py` against `tests/support/fake_connector.py` (a `websockets` server on `127.0.0.1` with an ephemeral port). Commit `test(hermes): pin the connector socket`.
- [ ] **Step 10 (H, green):** `connector_socket.py`: probe with `httpx` (expects `426`), `hello`, `messages`, `ping` every `HEARTBEAT_INTERVAL_MS`, pong timeout, reconnect backoff, `4001` stops the plugin, `401` and `404` stop it, `done` after `hand_off` returns. Commit `feat(hermes): keep the connector socket open and acknowledge handoffs`.
- [ ] **Step 11 (H, red):** `tests/unit/test_adapter.py` and `tests/unit/test_mcp_outbound.py`, with `tests/support/gateway_stub/` standing in for `gateway.platforms.base` (`BasePlatformAdapter`, `SendResult`, `MessageEvent`, `MessageType`, `Platform`). Commit `test(hermes): pin the platform adapter and the outbound send`.
- [ ] **Step 12 (H, green):** `adapter.py` (`ZapbipAdapter(BasePlatformAdapter)`: `connect`, `disconnect`, `send`, `get_chat_info`), `mcp_outbound.py`, `__init__.py` (`register(ctx)`), `plugin.yaml` (`kind: platform`, `name: zapbip-platform`, `requires_env` names only the connection link variable). Commit `feat(hermes): the zapbip platform adapter`.
- [ ] **Step 13 (H, red→green):** `tests/unit/test_logging.py`: a captured run never logs the secret, the URL or the owner text (Security S1 to S3). Red first, then the logging call sites fixed. Commits `test(hermes): keep secrets and text out of the logs` and `fix(hermes): ...` if the red run finds a leak.
- [ ] **Step 14 (H):** `mypy --strict zapbip_platform` and `pytest tests/unit` green; the H briefing `docs/features/hermes-openclaw/tester-briefing.md` lists red-now and green-after, every "it works" as a hypothesis (developer's job, in the lane's worktree).

### O: OpenClaw plugin (after Step 6, parallel with H)

- [ ] **Step 15 (O, red):** `test/unit/connector-socket.test.ts` against `test/support/fake-connector.ts` (`ws` server on `127.0.0.1`, ephemeral port). Same cases as Step 9. Commit `test(openclaw): pin the connector socket`.
- [ ] **Step 16 (O, green):** `src/connector-socket.ts` using Node 24's global `WebSocket` and `fetch`; uses `@zapbip/types` connector constants (bundled). Commit `feat(openclaw): keep the connector socket open and acknowledge handoffs`.
- [ ] **Step 17 (O, red):** `test/unit/handoff.test.ts` (`dispatchInboundDirectDm` replaced by a spy), `test/unit/send-message.test.ts` (fake MCP route). Commit `test(openclaw): pin the handoff and the outbound send`.
- [ ] **Step 18 (O, green):** `src/handoff.ts`, `src/send-message.ts`. Commit `feat(openclaw): hand owner messages to dispatchInboundDirectDm`.
- [ ] **Step 19 (O, red):** `test/unit/channel.test.ts`: the plugin entry (`channels: ['zapbip']`, config requires only the connection link, `startAccount` opens the socket and stops on abort, a missing link throws). Commit `test(openclaw): pin the channel entry`.
- [ ] **Step 20 (O, green):** `index.ts` (`defineChannelPluginEntry`), `src/channel.ts` (`createChatChannelPlugin`, `outbound.attachedResults.sendText` = `sendOwnerText`), `openclaw.plugin.json` (`channels`, `configSchema` with `connectionLink` only). Commit `feat(openclaw): the zapbip channel entry`.
- [ ] **Step 21 (O, red→green):** `test/unit/python-constants-parity.test.ts` reads `apps/hermes-plugin/zapbip_platform/constants.py` and asserts each mirrored value equals `@zapbip/types`. Commits `test(openclaw): pin the Hermes constants to the shared ones` and `fix(hermes): ...` for any drift found.
- [ ] **Step 22 (O):** `pnpm --filter <openclaw package> build` produces `dist/index.js` with `openclaw/plugin-sdk/*` imports left external and no secret literal; a unit test reads the bundle (Security S4). Commit `test(openclaw): the bundle keeps the SDK external`.

### V: verification (after H, O and the external merges)

- [ ] **Step 23 (V, red):** `apps/api/test/e2e/hermes-openclaw.e2e.test.ts` gated by `ZAPBIP_E2E_CLIENTS=1`, skipped otherwise. Fixtures in `scripts/e2e/clients/`: the POC fake model on `:4200`, the zapbip stack on its own ports, the Hermes image and the OpenClaw image (`--platform linux/amd64`). Cases E1 to E6 in the test plan. Commit `test(e2e): pin the Hermes and OpenClaw paths with a fake model`.
- [ ] **Step 24 (V, green):** the fixtures and the Docker runners until E1 to E6 pass. Commit `test(e2e): run the client plugins in Docker`.
- [ ] **Step 25 (V):** X1, the connector contract across the real socket, `local` wake and `done` semantics (test plan area X). Commit `test(e2e): the plugin socket receives the local wake`.
- [ ] **Step 26 (V, owner-run, outside the gate):** a real-model run per product (OR-13, OR-14, OR-15 in the spec, plus V3 in the test plan). Records go in the PR. Accepting ADR 0028 and ADR 0029 waits for these records.

## Owner-run (outside the gate)

Not part of `pnpm verify` or `test:e2e:clients`. An agent never starts these; the owner runs them and the PR records the result.

- [ ] **V3 real model, OpenClaw:** one owner message reaches the agent through the channel plugin and the reply arrives on WhatsApp; a real hosted model (the prompt is about 48k tokens, so a small local model is not enough).
- [ ] **V3 real model, Hermes:** the same with a model of at least 64k context.
- [ ] **OR-13:** an OpenClaw `stream` watcher on `zapbip listen` survives a Gateway restart, or the section falls back to the cron only.
- [ ] **OR-14:** Hermes `watch_patterns` fires in a session with no delivery target, or the section drops the watcher.
- [ ] **OR-15:** the idle token cost of a Claude Code Monitor on `zapbip listen` is recorded in the PR (figures from the product, not estimates).
- [ ] **Install path:** the owner runs `openclaw plugins install <package>` and the Hermes plugin install command, both marked `(verify)` in the spec, and records the commands that work.

## Merge order

1. C0 (Steps 1 to 6) to the feature branch.
2. `local-connector` (LN1 to LN5 and L2 to L5), `webhook-wake`, `scheduled-wake` with the floor change (D4). These are external; this slice does not start V before they merge.
3. H and O, merged into the feature branch with `merge`, never rebase (the red-first hashes must survive). H and O are independent, so either may land first.
4. V.
5. `install-skills` consumes `CHANNEL_PLUGIN_PACKAGE_NAME` and the two sections; it merges after C0 and is checked against V's E1 fixtures.
6. ADR 0028 and 0029 move to `Accepted` after V3 is recorded.

The shared `libs/types/src/index.ts` conflicts with `local-connector` (one export line). Resolve it in C0's merge, never by hand-editing a sibling's export.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a sibling slice imports a name that is not exported | `pnpm typecheck` fails in `libs/types` consumers | revert the commit; re-land with the export |
| 3, 4 | the workspace `pnpm install` changes unrelated lock entries | `git diff pnpm-lock.yaml` shows packages outside the two new ones | revert the lock, regenerate with `--filter` |
| 5 | CI runs Python before `pnpm` and the matrix breaks | the verify workflow fails at setup-python | revert the workflow commit; the Python gates run locally until fixed |
| 8 | a frame is accepted that the connector never sends | `test_frames` case for `unknown_type` turns green on the wrong reason | the reject list in `frames.py` is pinned by the parity test |
| 10 | the plugin reconnects after `4001` and the two sockets fight | `test_connector_socket` replaced case shows more than one `hello` | the `4001` branch is the only stop; revert to the last green commit |
| 10 | `done` sent before `hand_off` returns | test: `done` ordering after a slow `hand_off` | move the send after the await |
| 12 | the registry name is `zapbip` in one file and `zapbip-platform` in another | `plugin.yaml` name test and `register` test disagree | the constant in `constants.py` is the only source |
| 13 | the secret reaches stdout through a `httpx` error message | S1 log scan finds `zb_conn_` | wrap the exception with the status only |
| 16 | Node's WebSocket hides the upgrade status, so a `401` looks like a drop and the plugin loops | connector test expects a stop after the probe, the loop runs more than once | keep the probe step before the socket, as `connect.ts` does |
| 18 | `dispatchInboundDirectDm` shape changes between OpenClaw versions | the handoff test fails on the pinned version and passes on the next | pin the version (A5); bump only with a new red test |
| 20 | the plugin registers `baseUrl`/`apiKey` from the POC config | `channel.test` config schema case | remove the keys; the schema takes `connectionLink` only |
| 23 | the E2E stack and the fake model share a port with a running dev server | E2E fails on `EADDRINUSE`; the runner picks ports from the config | the runner takes ports as parameters, never defaults |
| 24 | Hermes crashes under arm64 emulation | the container exits with `Illegal instruction` | run `--platform linux/amd64`, as the POC did |
| 25 | the plugin's `done` marks the message read before the agent saw it | X1 check: the agent's `check_inbox` returns empty while no reply was sent | revert D3 to notifier and re-plan ADR 0029 |
| 26 | a real-model run spends money without an owner's OK | a run that starts without the owner's go | not started by an agent; the owner runs it |

**Steps with no backout:** Step 26 (a real model run spends money and cannot be undone) and any `done` already sent to a live owner account in V (the messages stay read). Neither is run by an agent.

## Z. Prove and ship

- [ ] **Tester briefing:** the developers wrote `docs/features/hermes-openclaw/tester-briefing.md` (H, O, V sections).
- [ ] **Tester run:** a fresh `tester` executed `test-plan.md` and ticked each box with evidence (commit hash, log path, counts).
- [ ] **Reviewer:** a fresh `reviewer` returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** not applicable; this slice changes no UI (the install sections belong to `install-skills`).
- [ ] **Mintlify:** this slice adds no pages; the two install pages are `install-skills`' files and are checked there with `mint broken-links`.
- [ ] **/open-pr:** gates passed, ADR 0028 and 0029 accepted with the V3 records, the owner-run records (OR-13, OR-14, OR-15) attached to the PR, PR opened.
