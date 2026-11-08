# Run the local stack

For contributors. The product runs on the WhatsApp numbers its operator registers in the backoffice. Locally, a test double stands in for WhatsApp: the development simulator answers as the owner's phone. It exists only for tests and this walkthrough, and the production build does not contain it.

You need Node 24, pnpm and [Claude Code](https://claude.com/claude-code).

## 1. Install and configure

From the repository root:

```bash
pnpm install
printf 'MEDIA_LINK_SIGNING_KEY=%s\nUPLOAD_LINK_SIGNING_KEY=%s\nNUMBER_REGISTRY_KEY=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -base64 32)" > apps/api/.dev.vars
pnpm --filter @zapbip/api exec wrangler d1 migrations apply CONNECTIONS --env development --local
```

If you ran the stack before the v1 schema changed, wipe the local data saved under the old v1 schema (the `.wrangler` state of `apps/api`) and apply the migrations again, because `v1.sql` is edited in place until the first deploy.

## 2. Start the Worker

```bash
pnpm --filter @zapbip/api dev
curl http://localhost:8787/health
```

The health call answers `{"ok":true}`.

## 3. Seed an owner and two agents

```bash
pnpm --silent --filter @zapbip/api dev:seed --phone 5511999990000 --agents alpha,beta
```

The Worker must be running: the seed goes through it so each agent's key is also recorded in its account object. It prints one line per agent, `alpha <secret>` and `beta <secret>`. The secret is shown once. Seeding the same phone twice fails.

## 4. Connect Claude Code

```bash
claude mcp add --transport http alpha http://localhost:8787/c/<alpha-secret>/mcp
claude mcp list
```

`alpha` shows as connected. The tools appear as `mcp__alpha__send_message`, `mcp__alpha__ask` and so on.

## 5. Open the window

WhatsApp lets zapbip write freely only after the owner writes, so start with a message to `alpha`:

```bash
curl -X POST http://localhost:8787/dev/owner/5511999990000/messages \
  -H 'Content-Type: application/json' \
  -d '{"kind":"text","text":"@alpha hello"}'
```

## 6. Send a message from the agent

In `claude`, write:

```text
Use the alpha MCP server to send me "zapbip works" and ask me "Deploy v2?" with the options Yes and No.
```

## 7. See it on the phone screen

```bash
curl http://localhost:8787/dev/owner/5511999990000/screen
```

The entries hold `zapbip works` and the question with its options.

## 8. Answer

```bash
curl -X POST http://localhost:8787/dev/owner/5511999990000/messages \
  -H 'Content-Type: application/json' \
  -d '{"kind":"text","text":"Yes"}'
```

The waiting call in Claude Code returns the answer.

## Close the window

Move the simulator clock forward a day and the next agent message is queued:

```bash
curl -X POST http://localhost:8787/dev/owner/5511999990000/clock \
  -H 'Content-Type: application/json' \
  -d '{"advance_ms":86400000}'
```

## Troubleshooting

- `401 unauthorized`: the secret is wrong or from another stack. Copy it again from the seed output.
- Nothing on the screen: use the seeded phone digits in `/dev/owner/<phone>/screen`. A `404` means that phone has no owner.
- `delivery: "queued"`: the window is closed. Send `@alpha hello` again.
