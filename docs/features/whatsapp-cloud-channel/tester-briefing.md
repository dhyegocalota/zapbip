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

## Lane W4 (inbound)

### What changed

- `apps/api/src/adapters/whatsapp/{signature,challenge,inbound-parser,status-parser,media-download}.ts` and `apps/api/src/routes/whatsapp.ts`: bodies.
- `apps/api/test/fixtures/whatsapp/{inbound,status}/**`: Meta-shaped JSON messages and statuses, plus `inbound/notification.ts` (notification builders) and `inbound/signed-webhook.ts` (HMAC computed at runtime).
- `apps/api/test/unit/whatsapp-{signature,challenge,inbound-parser,status-parser,media-download}.test.ts` (78 cases) and `apps/api/test/integration/whatsapp-{webhook,status}.test.ts` (20 cases).
- Contract deviations, all inside W4 files (the lead should copy them into the contract text):
  - `parseWebhookNotification` is async, because the media id is a SHA-256 of the wamid and Web Crypto is async.
  - `ParsedChange.phoneNumberId` is `string | null`; a change with an unhandled `field` is returned with no entries so the route can skip it.
  - `ParsedEntry.entry` is `ParsedInboundEntry`: it has no `noticeText` (the route adds the owner copy by locale); an unsupported entry carries `unsupportedType`; a media entry carries `UnavailableOwnerMedia` content plus a download request.
  - `MediaDownloadRequest` has no `sizeBytes` (the webhook does not carry it); `downloadInboundMedia` returns `{stored: true, sizeBytes}` or `{stored: false}` and throws `RetriableMediaError` for a `5xx`, a download that fails to answer, or a Graph timeout.
  - `verifyWebhookSignature` and the token check use `node:crypto` `timingSafeEqual` over digests (works in Workers with `nodejs_compat` and in the node unit run), not `crypto.subtle.timingSafeEqual`.
  - The media id is derived inside `inbound-parser.ts` with `crypto.subtle`; after W3 merges, swap it for `sha256Hex`.

### How to run

```bash
pnpm --filter @zapbip/api exec vitest run --config vitest.unit.config.mts test/unit/whatsapp-
pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts test/integration/whatsapp-webhook.test.ts test/integration/whatsapp-status.test.ts
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| signature, challenge, inbound-parser, status-parser unit (55) | `3785271`: 55 failed, `<name> is not implemented` | `04d7efe` |
| media-download unit (23 including `it.each` rows) | `eba15a7`: 23 failed, `downloadInboundMedia is not implemented` | `62aefb4`: all unit files 78 passed |
| webhook and status integration (20) | `33c454f`: 20 failed, `whatsapp webhook route is not implemented` / `whatsapp challenge route is not implemented`, responses `500` | `4372271`: only the cases that do not need W1, W2 and W3 can go green on this branch (see gaps) |

### Hypotheses to attack

1. Hypothesis: one bad message, change or status never fails the batch (missing `from`, invalid timestamp, malformed payload, unknown type, foreign number, unhandled field). Break it by posting a batch mixing them with one good text and counting stored messages.
2. Hypothesis: no bearer token reaches a host outside `fbcdn.net`, `fbsbx.com`, `whatsapp.net`, and no redirect is followed. Break it with userinfo, path, suffix-without-dot and `http` URLs; also read `graph-client.ts` (W2) for the same guard.
3. Hypothesis: a body over `WEBHOOK_MAX_BYTES` (3,000,000) is `413` before any parse, with or without `Content-Length`, and exactly the cap is accepted. Break it by chunked bodies one byte over and at the cap.
4. Hypothesis: the signature is checked over raw bytes (multibyte bodies included) before JSON is read. Break it with re-serialised, trailing-newline and uppercase-hex headers.
5. Hypothesis: an unindexed status younger than 10 minutes returns `503`, older returns `200`. Break it at 9:59 and 10:01.
6. Hypothesis: a media `5xx` or timeout returns `500` and leaves no receipt; the retry stores once.

### Known gaps

- Integration cases cannot be run green here: every route path reads `readWhatsAppEnvironment` and `logOperatorEvent` (W2 stubs), stored-message assertions need W1 and W3 bodies. Waiting on lanes W1, W2 and W3.
- Not written, because they need hooks owned elsewhere: DO commit failure `500` (WI-33), R2 failure `500` (WI-34), media over HTTP (WI-35 to WI-43; the allowed hosts are real `https` hosts and the fake Graph is `http://127.0.0.1`, so the integration pool needs an outbound mock), and the indexed status cases (WI-52 to WI-55, WI-57), which need a sent message with a channel id. Review focus 4 is covered at unit level (`whatsapp-media-download.test.ts`).
- `notification.ignored_field` is not logged: `OperatorEvent` has no such member (`whatsapp-enums.ts`, W0 file). Needed: `NotificationIgnoredField = 'notification.ignored_field'`.
- Statuses that fail to parse are dropped without a log (`parseStatusItems` returns only parsed items); a malformed change is dropped the same way.
- `HttpStatus` has no `InternalServerError` or `ServiceUnavailable`; the route relies on Hono's default `500` and on `WEBHOOK_BATCH_UNINDEXED_STATUS` for `503`.
- The `Content-Type` of the `GET` answer is set for the refusal too.
- Test plan AU-62 reads as a metadata `404`; implemented per A25 (download URL `404` re-requests metadata once).
