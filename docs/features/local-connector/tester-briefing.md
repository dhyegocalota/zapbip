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

## Step L5 (docs)

### What changed

- `apps/docs/guides/local-connector.mdx` and `apps/docs/guides/background-running.mdx`, with twins under `apps/docs/pt-br/guides/`. Plain-language opening first, then the command, options, wake behaviour, safety and a problem table; the background page has the launchd plist and the systemd unit, both with a `600` file.
- `apps/docs/docs.json` now uses `navigation.languages` (`en`, `pt-BR`). English keeps its groups and gains `Guides` with the two pages; `pt-BR` has only a `Guias` group with the two pages. The merge with the docs-IA branch (`feat/agent-inbox-core-docs`) must keep that branch's full tree and place these pages in it.

### How to run

```bash
pnpm --filter @zapbip/docs exec mint broken-links
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `mint broken-links` (3316b57, red) | `found 2 broken links in 2 files`: `/guides/background-running` and `/pt-br/guides/background-running` | the background pages exist (8c19e93) |

### Hypotheses to attack

1. Hypothesis: neither page contains a real secret. Break it by: grep both languages for the secret used in tests.
2. Hypothesis: the plist and unit start the connector on a real macOS and Linux. Break it by: following the page on each, with `which npx` for the path. Not run by the developer.
3. Hypothesis: the pt-BR pages mirror the English ones. Break it by: comparing headings and code blocks.

### Known gaps

- The pages describe the command from the spec; they were not checked against the built connector (the connector lanes are separate).
- The connection link's host is a placeholder: the real host and the install flow belong to other slices.
- No repository-shape twin test exists on this branch; it lives on `feat/agent-inbox-core-docs`.
