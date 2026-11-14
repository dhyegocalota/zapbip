# Test plan: Wake providers and channel protocol in the agent folders

## Unit

- [x] Each wake facet accepts its example URL and refuses a short id or another path, and builds its headers — evidence: `wake.test.ts` of `claude-ai` and `grok-bot`
- [x] The leak scan reports a wake host, a provider id, a channel capability and method outside the folder, and accepts them inside it — evidence: `leak-scan.test.ts`
- [x] The connector takes the sole channel protocol and refuses none or two — evidence: `channel-protocol.test.ts`
- [x] The core wake suites pass on neutral providers — evidence: `libs/core` 1963 passed
- [x] The transport sends the headers of the provider the registry holds and treats an unknown one as retryable — evidence: `fetch-wake-transport.test.ts`

## Integration

- [x] The Worker integration suite passes on the registry's providers — evidence: 171 files, 2821 passed

## Edge cases

- [x] No scanned file outside the agent folders names an agent, a wake host, a provider id or a channel protocol — evidence: `agent-registry.test.ts` G4 and `pnpm agents:check` 0 violations
