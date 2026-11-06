# Tester briefing: Local connector

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

### Step 0 (contract, no behaviour)

- `libs/types/src/connector.ts` — connector enums (`ConnectorClient`, `ConnectorFrameType`, `ConnectorWakeOutcome`, `ConnectorSessionSource`, `ConnectorLogEvent`, `FrameRejectionReason`) and constants; exported from `libs/types/src/index.ts`.
- `libs/types/src/enums.ts` — `WakeMode.Local` and `WakeRung.Local`.
- `libs/core/src/inbox/connector-frames.ts` — `HelloFrame`, `MessagesFrame`, `DoneFrame`, `ServerFrame`.
- `libs/core/src/inbox/use-cases/acknowledge-delivery.ts` — stub, throws `acknowledgeDelivery is not implemented`.
- `apps/api/src/account-inbox/connector-sockets.ts`, `apps/api/src/adapters/wake/local-connector-waker.ts` — stubs.
- `apps/connector` — package `zapbip` (private until deploy-readiness), three Vitest configs, one stub per module of the contract; `pnpm-lock.yaml` gained the `apps/connector` importer (esbuild 0.28.2, ws 8.22.1, @types/ws 8.18.2) and the vite peer variants that esbuild adds.
- Not done, by design: the wake-side contract (`WakeRepository` restore methods, `libs/core/src/wake/local-connector.ts`, `WakerByRung` entry) waits for `feat/webhook-wake` to merge (plan step S0.2, `(contract: confirm at merge)`).

## How to run

```bash
<commands to start the stack and open the feature>
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

## Known gaps

- <what the developer knows is missing or untested>


## L3a, L4a, L6 (sockets and waker, acknowledge, verify gate)

### What changed

- `apps/api/src/account-inbox/connector-sockets.ts`: the four contract functions, plus `parseDoneFrame({data})` returning `{ok: true, frame} | {ok: false, reason: FrameRejectionReason}`. A non-string payload is `binary_frame`; a text payload over `CONNECTOR_FRAME_MAX_BYTES` UTF-8 bytes is `frame_too_large`, checked before `JSON.parse`; a non-object or a `done` without a string `messageId` is `malformed`; any other `type` is `unknown_type`. L3b's `webSocketMessage` is expected to call it and ignore a rejection.
- `apps/api/src/adapters/wake/local-connector-waker.ts`: `notify` lists up to `CONNECTOR_INBOX_LIMIT` unread messages and sends one `messages` frame; `Woken` only when a socket received it.
- `libs/core/src/inbox/use-cases/acknowledge-delivery.ts`: marks read only an existing owner message of the given agent.
- `scripts/verify-gates.tsv`, `scripts/verify.sh`, `scripts/verify.test.sh`, `AGENTS.md`: connector row `typecheck unit e2e` above `apps/*`; `gate_e2e` also runs `pnpm --filter zapbip test:e2e` then `test:packaging`.

### How to run

`pnpm --filter @zapbip/api test:unit`, `pnpm --filter @zapbip/core test:unit`, `pnpm test:verify`.

### Red then green

| Test | Red before | Green after |
|------|------------|-------------|
| `apps/api/test/unit/local-connector-waker.test.ts` (20 cases, `ee87f26`) | `createLocalConnectorWaker`, `connectorAgentOf`, `remainingSocketCount`, `acceptConnectorSocket`, `parseDoneFrame is not implemented` | `8127931` |
| `libs/core/src/inbox/use-cases/acknowledge-delivery.test.ts` (6 cases, `0bcd490`) | `acknowledgeDelivery is not implemented` | `2b39869` |
| `scripts/verify.test.sh` connector cases (`030f1e9`) | 3 checks failed: row fell through to `apps/*`, no connector e2e or packaging call | `4438217` |

### Hypotheses to attack

1. The waker never sends to a socket of another agent. Break it by: two agents with sockets, owner message for one.
2. A frame of exactly `CONNECTOR_FRAME_MAX_BYTES` bytes is accepted and one byte more is rejected, including multibyte text. Break it by: boundary payloads in `é`-style characters.
3. `acknowledgeDelivery` never marks an agent's own outbound message or another agent's message. Break it by: `done` for such ids through a real socket (L3b).
4. A connector-only change runs the connector e2e and packaging suites and not the API integration suite.

### Known gaps

- `acceptConnectorSocket` is unit tested with a stubbed `WebSocketPair` global; the real pair is covered only by L3b's integration tests.
- The connector gate runs its e2e suite for every API-side e2e run too (`gate_e2e` is not split by package).
- `parseDoneFrame` is an addition to the contract, used by L3b.
