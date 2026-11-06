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

## Lane W2 (outbound)

### What changed

- `apps/api/src/adapters/whatsapp/{outbound-builders,outbound-limits,template-sanitiser,channel-error-mapping,graph-client,read-whatsapp-env,operator-log,cloud-api-message-sender}.ts`: bodies. `whatsapp-templates.ts` gains `TEMPLATE_NAME_BY_KIND`.
- `apps/api/test/support/fake-graph.ts`: the server (`startFakeGraph`, now also returns its `port`), the send route, one-shot registered responses, request recording, control routes under `/__fake`.
- `apps/api/test/fixtures/whatsapp/outbound/*.json` and eleven test files: `whatsapp-{copy,templates,outbound-builders,outbound-limits,template-sanitiser,channel-error-mapping,graph-client,read-whatsapp-env,operator-log,cloud-api-message-sender,fake-graph}.test.ts` (unit) and `integration/whatsapp-outbound.test.ts`.
- Contract deviations, all inside W2-owned files: `buildSessionPayload` takes `locale` (the list copy needs the owner locale); `outbound-limits.ts` also exports `assertTextBody`, `assertReactionTarget`, `REACTION_TARGET_FIELD`; `graph-client.ts` also exports `GraphRequestError` (status, Graph code, title) and `GRAPH_NO_RESPONSE_STATUS` (0: timeout or network failure); the sender's `messageIndex` is `Pick<D1MessageIndex, 'record'>`; the `message` field of `mapGraphErrorToChannelError` is the subject the agent reads (`image image/jpeg`, `reaction.message_id`, the kind).

### How to run

```bash
pnpm --filter @zapbip/api typecheck
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts whatsapp-outbound
```

The integration file needs W3's bodies and the fake Graph listening on port 4012 (see the gaps).

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `whatsapp-copy.test.ts`, `whatsapp-templates.test.ts` | pin: green on arrival (fb03bb2) | |
| `whatsapp-outbound-builders`, `-outbound-limits`, `-template-sanitiser`, `-channel-error-mapping` (7f0481f) | 87 failed: `buildSessionPayload is not implemented`, `buildTemplatePayload is not implemented`, `assert* is not implemented`, `sanitiseTemplateParameter is not implemented`, `mapGraphErrorToChannelError is not implemented` | 6c1bef0: 96 passed |
| `whatsapp-graph-client`, `-read-whatsapp-env`, `-operator-log`, `-cloud-api-message-sender`, `-fake-graph` (1e7aebf) | `createGraphClient is not implemented`, `readWhatsAppEnvironment is not implemented`, `logOperatorEvent is not implemented`, `createCloudApiMessageSender is not implemented`, `startFakeGraph is not implemented` | dc62dba and 4aeace4: 14 unit files, 168 passed |
| `whatsapp-outbound.test.ts` (integration) | the file fails to load: `readWhatsAppEnvironment is not implemented` (no tests collected) | needs W3 and the Graph global setup; run in a throwaway merge of W3 with `startFakeGraph({port: 4012})` as a global setup: 14 passed |

### Hypotheses to attack

1. Hypothesis: no bearer token reaches a host outside `fbcdn.net`, `fbsbx.com`, `whatsapp.net`. Break it by: `download` with `https://lookaside.fbsbx.com@evil.com/x`, `https://evil.com/.fbsbx.com/x`, `https://evilfbsbx.com/x`, `http://` and a 302 to a foreign host; the fetcher must not be called, or be called once without following.
2. Hypothesis: a restricted account never reaches Graph. Break it by: make the fake return `131048` once, send twice, read `fakeGraph.requests()` (one send request); then record a row older than 24 h and send again (one more request).
3. Hypothesis: an empty or whitespace template preview never reaches Meta empty. Break it by: a `template` call with `['alpha', '   ']`, `['alpha', '']`, a 200 character value, a value cut inside an emoji.
4. Hypothesis: a limit change fails loudly. Break it by: a 21 character button title, a fourth button, an eleventh list row, a 4,097 character text: each throws naming the Graph field path.
5. Hypothesis: the operator log never carries a token, phone number or body. Break it by: provoke `190`, `131048`, a timeout and a rejected template, and read every `console.error` line.
6. Hypothesis: a session send and a template send map the same code differently only where the plan says. Break it by: `131048` on a template (must stay `Restricted`), `132000` on a template (`TemplateRejected`) and on a session (`Unknown`).

### Known gaps

- Finding for the lead: the registered body of `zapbip_agent_question` (both languages) starts with `{{1}}`. Meta's template review rejects a body that starts or ends with a parameter; `assertTemplateBodyHasFixedWords` exists and refuses it, but is not wired to the registered bodies because the spec fixes their text. Decide the wording before the owner registers the templates (owner-run probe).
- `whatsapp-outbound.test.ts` cannot be green on this branch: `findOwnerByAccountId` and `D1ChannelRestrictions` are W3 stubs, and nothing starts the fake Graph on port 4012 for the integration pool. The lead needs a `globalSetup` entry in `vitest.integration.config.mts` (W0-owned) that calls `startFakeGraph({port: 4012})`. W3's `D1ChannelRestrictions` constructor takes `phoneNumberId`; the test will need that argument after the merge.
- Deferred to W3 and W6 (DO paths): WI-58 through the tool, WI-59 queueing, WI-62 and WI-66 failure state on the stored message, WI-60 as a tool error. The integration file proves the sender against D1, R2 and the fake Graph only.
- Inbound media download, metadata and `404` refresh routes are not in the fake Graph; `respondWith` serves any method and path once, which W4's tests can use.
- Stored media of an unknown MIME type or size passes `assertOutboundMedia` (A11); animated stickers are not detected (A12).
