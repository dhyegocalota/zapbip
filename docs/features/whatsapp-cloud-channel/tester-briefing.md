# Tester briefing: WhatsApp Cloud channel

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (contract, W-1 and W0)

### What changed

- `docs/features/whatsapp-cloud-channel/{spec,plan,test-plan}.md`, ADRs 0012 to 0014 and both indexes — imported (5521e87).
- `plan.md`, `test-plan.md`, `spec.md` — refreshed against slice 1's Step 0 tree and its lane tip; 30 differences listed in the plan's "Plan refresh (W-1.1)" table (59d0adc).
- `libs/types/src/enums.ts`, `constants.ts` — `DeliveryState.Delivered|Read|Sending`, `MediaSourceKind.Unavailable`, nine `ChannelErrorKind` members, `ChannelInboundKind`, `BYTES_PER_KILOBYTE` (659e505).
- `libs/core/src/inbox/{errors,message,inbox-records,ports,index}.ts`, `use-cases/types.ts` — `ChannelError extends InboxError`, the `Unavailable` source, `closedAt`, `ChannelStatusDetail`, seven new `InboxRepository` methods, the widened `MessageSender.session`, the channel types.
- `libs/core/src/inbox/use-cases/{receive-channel-message,open-window,close-window,apply-status,status-rule,claim-queued}.ts` — stubs throwing `<name> is not implemented`.
- `apps/api/src/adapters/whatsapp/*` — constants, enums, copy and templates as real constants; every other module a stub.
- `apps/api/src/adapters/d1/{d1-owner-directory,d1-channel-restrictions}.ts`, `adapters/platform/hash.ts` — new stub functions and the `D1ChannelRestrictions` stub class.
- `apps/api/src/contract/{env,account-inbox-rpc,constants}.ts`, `account-inbox/account-inbox.ts`, `routes/whatsapp.ts`, `app.ts` — optional WhatsApp bindings, two RPC stubs, the webhook path, the stub route mounted.
- `apps/api/wrangler.jsonc`, `vitest.integration.config.mts`, `test/support/fake-graph.ts` — the development Graph URL var, the test bindings, the stub fake Graph.

### How to run

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:unit
pnpm --filter @zapbip/repository-shape test:unit
```

### Red today, green after

No test exists yet in Step 0. Every red test arrives with its lane (W1 to W6); each red run must print `<name> is not implemented` (or the stub route's `not implemented` for W4.5).

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| (none in Step 0) | | |

### Hypotheses to attack

1. Hypothesis: the contract typechecks and nothing at runtime changed. Break it by: `git diff 59d0adc..659e505 --stat` and `pnpm typecheck`; start `wrangler dev` and `GET /health` still answers `{ok: true}` (the stub webhook route only throws when its own path is called).
2. Hypothesis: no value hides behind a default. Break it by: grep the diff for `??` and `?:` defaults; the five WhatsApp bindings are optional only in the type.
3. Hypothesis: `ChannelError` flows through slice 1's tool error path unchanged. Break it by: after W1, throw one from a fake sender in a send test and read the MCP error; `code` must be the kind.

### Known gaps

- `pnpm verify` stops at the `secrets` gate in this repository: gitleaks finds `LOG_SECRET_FILENAME` in `apps/api/test/integration/account-inbox.test.ts` in commit `eb984a0`, which sits on slice 1's lane branches that share this object store. The allowlist that silences it (`79eb7b4`) is on `feat/agent-inbox-core` locally but not in this branch's base. Typecheck, unit, shape, format and audit gates were run by hand and are green. The lead merges the allowlist (a one-line `.gitleaks.toml` change this lane does not own).
- W0b is not done: it needs slice 1's lanes merged (in-memory ports, the SQLite repository, the fake sender, `session` call sites, `ERROR_STATUS`, the seed signatures). The plan gained that step (reported).
- The signature of `parseStatusItems` (`status-parser.ts`) is this developer's choice; the plan named the file but no function. W4 may change it before its red test.
- The `status-parser.ts` choice, the fake Graph as an HTTP server (R30) and the sender seam (R15) change the plan's earlier text; the owner-delegated rows are in the spec's answers table.
- Slice 1's lane bodies for `deliver-to-owner.ts` and `flush-queue.ts` call `session({message})`; they stop typechecking when merged until W0b adds the new fields.

## Lane W5 (docs)

### What changed

- `apps/docs/concepts/whatsapp-channel.mdx` and `apps/docs/concepts/owner-notices.mdx`, listed in the `Concepts` group of `apps/docs/docs.json`.
- `tools/repository-shape/src/whatsapp-docs.test.ts`: both pages exist, are in the `Concepts` group, and state each limit and notice term it names.
- Merging `origin/feat/agent-inbox-core` conflicted in `apps/api/src/app.ts` and `apps/api/src/adapters/d1/d1-owner-directory.ts` (files this lane does not own). Resolved by keeping both sides: `whatsappRoutes` plus slice 1's `extraRoutes`, and slice 1's `findOwnerByPhone` body beside the `OwnerRecipient` type and the `findOwnerByAccountId` stub. The lead should expect the same conflicts when merging W0b.

### How to run

```bash
pnpm --filter @zapbip/repository-shape exec vitest run src/whatsapp-docs.test.ts
pnpm --filter @zapbip/docs exec mint broken-links
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `whatsapp-docs.test.ts` (22 cases) | `c74ef84`: 22 failed; `ENOENT ... apps/docs/concepts/whatsapp-channel.mdx` and the pages absent from the Concepts group | the pages and the navigation entries exist |

### Hypotheses to attack

1. Hypothesis: every limit on the channel page equals the constant the adapter uses (4,096 text, 1,024 button body, 3 buttons, 20 title, 10 rows, 24 row title, 72 description, 5/16/16/100 MB, 100 KB sticker, 30 days reaction age, 24 hours restriction). Break it by diffing each against `apps/api/src/adapters/whatsapp` constants once W2 lands.
2. Hypothesis: the page text matches the spec's tables. Break it by reading the page against the spec's inbound and outbound mapping.
3. Hypothesis: `mint broken-links` passes. Break it by running it.

### Known gaps

- The shape test checks substrings, not that a number sits beside the right kind.
