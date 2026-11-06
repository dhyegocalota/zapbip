# Accounts and keys

**Status:** Building
**Tier:** 🔴
**Owner approval:** approved 2026-11-06 (owner delegated)
**ADRs:** [0015](../../adr/0015-commands-are-bare-words-routed-before-agents.md), [0016](../../adr/0016-accounts-start-on-the-first-message-and-wait-on-a-list.md), [0017](../../adr/0017-connection-secrets-are-shown-once-and-stored-as-digests.md)
**Not changing:** the core's routing rules 1 to 6, the 24-hour window, the ten MCP tools and the message kinds of `agent-inbox-core`; the signed webhook and the Meta adapter of `whatsapp-cloud-channel`; the install page content of `install-skills`; the MCP route and its Bearer header. This slice adds one routing rule in front of the core's rules and replaces the development connection script.

## Problem

The owner's phone is the only identity zapbip needs. A message from it proves the phone, so there is no OTP and no web dashboard. Today the only way to create a connection is the development script of `agent-inbox-core`. This slice lets the owner run the whole account lifecycle from WhatsApp: create the account, create, list, revoke and rotate connections, and delete the account.

A shared public number also needs controls the single-owner core does not have: a waitlist before the sale, a per-phone rate limit, a blocklist, a limit on agents per account and a daily cap on new accounts.

## Goals

1. Accounts are created by the owner's first message, in state `waitlisted` or `active` as set by the `WAITLIST_ENABLED` variable ([ADR 0016](../../adr/0016-accounts-start-on-the-first-message-and-wait-on-a-list.md)).
2. Commands in pt-BR and en are recognised before routing and answered by zapbip ([ADR 0015](../../adr/0015-commands-are-bare-words-routed-before-agents.md)).
3. The connection lifecycle: create (the WhatsApp reply carries the install link, never the secret), list, revoke and rotate, one secret per connection ([ADR 0006](../../adr/0006-one-secret-per-connection-in-the-mcp-url.md)).
4. Secrets are `zb_conn_` followed by 32 random bytes, stored as SHA-256 digests, compared in constant time and never logged ([ADR 0017](../../adr/0017-connection-secrets-are-shown-once-and-stored-as-digests.md)).
5. The D1 schema and its first migration after `agent-inbox-core`.
6. Abuse controls on the shared number: a blocklist, a per-phone rate limit, a daily cap on new accounts, and a per-connection outbound limit.
7. Owner-initiated account deletion for LGPD, which removes the Durable Object, the media and the D1 rows.
8. The development connection script of `agent-inbox-core` is deleted. The owner simulator creates connections in development.
9. Docs pages `guides/commands`, `guides/agents-and-links` and `guides/account-deletion` in `apps/docs` ([ADR 0010](../../adr/0010-public-docs-on-mintlify.md)), in the navigation of agent-inbox-core → Docs.

## Non-goals

- Webhook signature checks and the Meta adapter. These belong to `whatsapp-cloud-channel`; this slice trusts the `from` number only because that slice verifies the signature.
- The install page per client and the choice of client at creation. These belong to `install-skills`. This slice's reply carries only the install link, so creation asks for no client.
- Wake rungs, wake URLs and tokens. These belong to `webhook-wake`, `local-connector` and `scheduled-wake`. Connections are created in wake mode `none`; no wake settings are set in this slice.
- Changing the owner's phone number or recovering a lost phone. A new phone starts a new account.
- A web dashboard, OAuth, billing, plans beyond the waitlist, per-agent permissions.
- Automatic blocking. The blocklist is managed by the operator.
- The privacy policy text and its legal review. They are the owner's.

## Design

### Account states

| State | Set by | Owner's messages | Agents |
|---|---|---|---|
| `waitlisted` | creation while `WAITLIST_ENABLED` is true | `ajuda`, `apagar conta` and the menu work; anything else gets the waitlist reply and is not stored | no connection can be created |
| `active` | creation while the flag is false, or the operator enables the account | every command and routing | MCP works |
| `suspended` | operator | one suspension reply; nothing reaches agents | MCP answers `401` |
| `deleting` | owner's `apagar conta definitivamente`, or operator | only a resumed deletion; other messages get no reply | `401` |

Transitions: creation to `waitlisted` or `active`; `waitlisted` to `active` (operator); `active` and `suspended` by the operator in both directions; any state to `deleting`; `deleting` to removed, meaning its rows are gone.

The operator runs `enable`, `suspend`, `resume`, `block`, `unblock` and `delete` against one E.164 phone, applied with `wrangler d1 execute` to `owner_identities` and `blocked_phones`, which key on `wa_id` as [ADR 0012](../../adr/0012-owner-identity-by-wa-id-on-the-shared-number.md) requires. `WAITLIST_ENABLED` is a `[vars]` entry in `wrangler`, `true` in production and `false` in development.

### Commands

Text is normalised before matching: trimmed, inner whitespace collapsed, lowercased. Matching is exact. Trailing punctuation does not match, so `agentes?` is a message for an agent.

| Command | pt-BR | en | Effect |
|---|---|---|---|
| create agent | `novo agente <nome>` | `new agent <name>` | creates a connection and replies with the install prompt |
| list | `agentes` | `agents` | active connections: name and creation date, never a secret |
| revoke | `revogar <nome>` | `revoke <name>` | revokes now; the link stops working |
| rotate | `girar <nome>` | `rotate <name>` | replaces the secret now and replies with the new prompt |
| help and menu | `ajuda` or `menu` | `help` or `menu` | text plus an interactive list of the commands |
| request deletion | `apagar conta` | `delete account` | states the consequences and the phrase to confirm |
| confirm deletion | `apagar conta definitivamente` | `delete account permanently` | deletes the account |

Rules:

- **Language of replies.** The keyword used decides the language of the reply. The owner's `locale` in `owner_identities` is set to that language by the last command and is used for replies that are not commands, such as the rule 6 question. `DEFAULT_LOCALE` is pt-BR and applies to a new owner.
- **Agent names.** A name is normalised: decomposed (NFD), combining marks removed, lowercased, every run of characters outside `a-z0-9` replaced by one `-`, leading and trailing `-` trimmed. `Claude Code` becomes `claude-code`. The result must match the core's pattern `^[a-z0-9][a-z0-9-]{0,31}$`. The reply echoes the normalised name.
- **Reserved names.** The first word of every command in both locales is reserved (`novo`, `new`, `agentes`, `agents`, `revogar`, `revoke`, `girar`, `rotate`, `ajuda`, `help`, `menu`, `apagar`, `delete`). An agent cannot take one.
- **Missing name.** `novo agente` or `revogar` without a name replies with the usage line.
- **Limit.** Active connections per account are capped by `AGENTS_PER_ACCOUNT_LIMIT` (8). Revoked connections do not count.
- **Names are unique among active connections.** A revoked name can be created again, as a new connection.
- **Menu.** `ajuda` replies with text and an interactive list. Its rows have ids `zapbip:<command>`. `agentes` and `apagar conta` run at once. The rows for `novo agente`, `revogar` and `girar` reply with their usage line, because they need a name.
- **Secret display.** The secret appears in no WhatsApp message and in no log. The create and rotate replies carry the install link only; the install page turns it into the connection URL for 30 minutes (ADR 0020).

Replies (intents; the copy lives in `libs/core/src/accounts/account-copy.ts`, with `pt_BR` and `en_US` entries, agent-inbox-core → Language):

| Intent | Reply |
|---|---|
| waitlisted | the account is on the waitlist; send `ajuda` when access opens |
| suspended | the account is suspended |
| created | the agent name and the one or two install lines (see Install prompt hook), followed by the warning that the install link works once and how to rotate it |
| invalid or reserved name | the reason, and the rule |
| name taken | the name already exists |
| limit reached | the limit, and `revogar <nome>` as the way out |
| not found | no active agent has that name |
| revoked, rotated | the outcome; rotate also sends the new prompt |
| list | the active names and dates, or "no agents yet" |
| deletion request | the consequences, and the exact phrase |
| deletion done | the account is deleted; the next message starts a new account on the waitlist |
| unknown | a pointer to `ajuda` |

### Routing change

The complete routing order of zapbip is this table. Rules 1 to 6 are defined by agent-inbox-core and are not changed here; rule 0 is added in front of them by this slice. First match wins.

| # | Rule | Defined in |
|---|---|---|
| 0 | Account command: the text is an exact command word, or a list reply whose id starts with `zapbip:`. Never a reply quoting an agent's message, never a reaction. It never opens or answers a question and never changes rule 5. | this slice |
| 1 | Button or list reply: `<question_id>:<index>` answers that question; `route:<message_id>:<agent>` is the owner's choice from rule 6. | agent-inbox-core |
| 2 | Quoted reply or reaction: the agent that sent the quoted or reacted message; a reaction to a question message answers it. | agent-inbox-core |
| 3 | Text starting `@<agent> `: that agent, prefix removed. It is also the escape for a command word meant for an agent, for example `@<agent> ajuda`. | agent-inbox-core |
| 4 | One agent with an open question: that agent; several: the newest question. | agent-inbox-core |
| 5 | The last agent that wrote to the owner within the window. | agent-inbox-core |
| 6 | No agent: the owner chooses from the account's 10 most recently seen agents, and the message waits for the choice; with no agents the owner gets one text notice and the message is held. | agent-inbox-core |

Question ids are `q_` followed by random characters, so an option id of the form `<question_id>:<index>` never starts with `zapbip:`.

### Inbound path for an owner message

1. **Sender guard.** A blocked phone is dropped silently. A phone over `OWNER_MESSAGES_PER_MINUTE` is dropped silently. Both are logged and neither opens the window. The guard runs before any account lookup, so a blocked phone costs one D1 read.
2. **Account lookup.** `AccountDirectory.findOrCreateByWaId` runs an `INSERT ... ON CONFLICT(wa_id) DO NOTHING` on `owner_identities` and `accounts`, then reads the row. Two first messages from the same phone resolve to one account. The insert is conditional on the daily cap: when `NEW_ACCOUNTS_PER_DAY_LIMIT` new accounts exist in the last `NEW_ACCOUNTS_WINDOW_MS`, the message is dropped silently and logged.
3. **Account inbox.** The Worker passes `{ownerPhone, state, message}` to the account's Durable Object. The DO opens the window, flushes queued messages in order, then applies the state matrix, then runs rule 0 or rules 1 to 6.

A command reply is always a session message, because the owner wrote first and the window is open. Queued messages are flushed before the reply, so the order is the owner's.

Duplicate deliveries of the same inbound WhatsApp message id are ignored by the DO, which `agent-inbox-core` must store. A retry therefore never creates a second agent.

### Connection lifecycle

| Action | Command | D1 write | Reply |
|---|---|---|---|
| create | `novo agente <nome>` | conditional insert of the secret digest, the install code digest and the sealed secret | install lines with the install link |
| list | `agentes` | select active rows of the account | names and dates |
| revoke | `revogar <nome>` | set `revoked_at` | confirmation |
| rotate | `girar <nome>` | compare-and-set of `secret_digest`, `rotated_at` and the install code columns | new install lines with the new install link |

Creation order: generate the secret and the install code, insert the digests and the sealed secret, send the reply. If the send fails, the just-inserted row is revoked again (compensation), the secret never left the process, and the owner gets a retry message when the reply can be sent.

Rotation order: compare-and-set the digest and the install code columns from the old to the new, send the reply. If the send fails, compare-and-set back from the new digest to the old. The owner never ends up with a rotated link they did not receive.

Revoke and rotate take effect at once and cannot be undone. The explicit agent name is their confirmation. Deletion has its own phrase, below.

Concurrency:

- The limit is enforced in the same statement as the insert, so two creates racing for the last slot cannot exceed `AGENTS_PER_ACCOUNT_LIMIT`.
- The partial unique index on `(account_id, agent) WHERE revoked_at IS NULL` decides a name race; the loser gets "name taken".
- The rotate compare-and-set makes a second rotation fail rather than overwrite.

### Secrets and digests

- **Issue.** `zb_conn_` followed by base64url (no padding) of 32 bytes from `RandomSource`, which is 43 characters. The secret is returned once and never stored in plain text. The install code (`zb_inst_` followed by base64url of 16 random bytes, 128 bits) is the only other secret: its digest is stored, and the connection secret is stored sealed under a key derived from the code, for 30 minutes at most, cleared on the first MCP call or by the daily sweep (ADR 0020).
- **Digest.** SHA-256 hex of the full secret string, prefix included. Stored in `connections.secret_digest`.
- **Resolve.** A value without the `zb_conn_` prefix returns `401` without a D1 read. Otherwise the digest is looked up in D1 and joined with `accounts`. The candidate's stored digest is then compared with the computed digest by constant-time compare, `crypto.subtle.timingSafeEqual` in the adapter. A mismatch, a missing row, a revoked connection or an account that is not `active` returns `401` with the same body in every case.
- **Owner number.** The owner's `wa_id` (the digits of the phone, from Meta's `from`) is stored in plain text in `owner_identities` and `blocked_phones`, as [ADR 0012](../../adr/0012-owner-identity-by-wa-id-on-the-shared-number.md) requires, because the channel must send replies to it. Access is limited to the Worker and the operator, and LGPD deletion removes the row.
- **Logs.** Logs carry event names, ids and kinds. They never carry secrets, digests, phones, agent names or message text. The request path is logged as its route template (`/c/:secret/mcp`, `/i/:installCode`), never the raw path, because the secret and the install code are in the path.

### Install prompt hook

The reply to `novo agente` and `girar` is one or two lines in the owner's locale, each in its own `*-copy.ts` entry, with the install link `PUBLIC_ORIGIN + /i/ + installCode`:

- pt_BR: "Conecte-se ao meu WhatsApp pelo zapbip: leia {install_link} e siga as instruções." then "Este link vale 30 minutos e funciona uma vez. Não o compartilhe."
- en_US: "Connect yourself to my WhatsApp with zapbip: read {install_link} and follow the instructions." then "This link works once for 30 minutes. Do not share it."

The lines are copy, not a port: no `InstallPromptRenderer`, no generic renderer and no `splitInstallPrompt`. The `/i/` page and the client sections belong to `install-skills` (ADR 0020), which reads the install code through `InstallCodeDirectory`. The lines carry no secret. A test asserts that both locales produce exactly two lines, each under `WHATSAPP_TEXT_MAX_CHARS`, with the link and without `zb_conn_`.

### Data model

The D1 schema is in Drizzle (`apps/api/src/adapters/d1/schema.ts`). The migration is generated with `drizzle-kit` into `apps/api/migrations` and applied with `wrangler d1 migrations apply`. Applied migrations are never edited.

Migration `0002_accounts_and_keys.sql` (`0001_core` is agent-inbox-core's, see its Storage and migrations):

```sql
DROP TABLE IF EXISTS owner_identities;
DROP TABLE IF EXISTS connections;
DROP TABLE IF EXISTS accounts;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('waitlisted', 'active', 'suspended', 'deleting')),
  created_at INTEGER NOT NULL
);

CREATE INDEX accounts_created_at ON accounts (created_at);

CREATE TABLE owner_identities (
  wa_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id),
  from_user_id TEXT,
  locale TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id),
  agent TEXT NOT NULL,
  secret_digest TEXT NOT NULL UNIQUE,
  client_name TEXT,
  install_code_digest TEXT UNIQUE,
  install_code_sealed_secret TEXT,
  install_code_expires_at INTEGER,
  first_call_at INTEGER,
  created_at INTEGER NOT NULL,
  rotated_at INTEGER,
  revoked_at INTEGER
);

CREATE UNIQUE INDEX connections_active_agent ON connections (account_id, agent) WHERE revoked_at IS NULL;

CREATE TABLE blocked_phones (
  wa_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

- Timestamps are epoch milliseconds.
- The rebuild drops development rows only. Nothing is deployed before `0001` applies, so no production data needs keeping; from the first deploy on, migrations are forward-only (`deploy-readiness`).
- `connections.client_name` is written by the MCP route from the first `initialize` (install-skills); it is null until then.
- `connections.install_code_*` hold the install code digest, the connection secret sealed under the code, and the code's expiry. Create and rotate write them; revoke and the first MCP call clear the sealed secret; the daily sweep clears it after expiry (ADR 0020).
- `connections.first_call_at` is written once, by the MCP route, on the connection's first successful MCP call (install-skills).
- `owner_identities` is read by whatsapp-cloud-channel (ADR 0012); `from_user_id` stays null until Meta provides it.
- The deletion batch removes `owner_identities` and `connections` before `accounts`, because the foreign keys have no cascade.
- Per-account state (messages, wake settings, polls) lives in the Durable Object. This slice's D1 tables are the directory and the blocklist.

### Interfaces

Ports in `libs/core`. Signatures are indicative; the plan fixes them and every method takes named parameters.

| Port | Change | Responsibility | Adapter |
|---|---|---|---|
| `AccountDirectory` | promoted from the adapter of whatsapp-cloud-channel | `findByWaId`, `findOrCreateByWaId`, `setState`, `remove` | D1 |
| `ConnectionDirectory` | extended | `resolveSecretDigest` (null unless the account is `active`), `register` (conditional), `revoke`, `rotate` (compare-and-set), `listActive` | D1 |
| `Digests` | new | `secretDigest(secret)` (SHA-256) | WebCrypto |
| `ConnectionSecrets` | new | `issue()` returns `{secret, digest}` | WebCrypto plus `RandomSource` |
| `RandomSource` | new | random bytes for ids and secrets | `crypto.getRandomValues` |
| `SenderGuard` | new | `admit({waId, now})` returns `SenderVerdict` (`admitted`, `blocked`, `rate_limited`) | Rate Limiting binding and the D1 blocklist |
| `OutboundGuard` | new | `admit({connectionId})` | Rate Limiting binding |
| `InstallCodeVault` | new | `issue()` returns `{installCode, digest}`; `seal({installCode, secret})` and `open({installCode, sealed})` | WebCrypto: SHA-256, HKDF-SHA-256, AES-256-GCM |
| `InstallCodeDirectory` | new | `resolve({installCode, now})` returns `InstallCodeStatus` with the connection link on `Ready`; `recordFirstCall({connectionId, calledAt})` | D1 |
| `MediaStore` | extended | `deletePrefix({prefix})` for deletion | R2 |
| `AccountInbox` (DO) | extended | `purge()` that clears SQLite storage and alarms | Durable Object |

Constants in `libs/core` (named, never inline):

| Constant | Value |
|---|---|
| `AGENTS_PER_ACCOUNT_LIMIT` | 8 |
| `SECRET_PREFIX` | `zb_conn_` |
| `SECRET_RANDOM_BYTES` | 32 |
| `OWNER_MESSAGES_PER_MINUTE` | 20 |
| `OUTBOUND_MESSAGES_PER_MINUTE` | 30 |
| `RATE_LIMIT_PERIOD_MS` | 60 000 (converted to seconds at the binding) |
| `NEW_ACCOUNTS_PER_DAY_LIMIT` | 50 |
| `NEW_ACCOUNTS_WINDOW_MS` | 24 h |
| `WHATSAPP_TEXT_MAX_CHARS` | 4 096 (agent-inbox-core) |
| `DEFAULT_LOCALE` | pt-BR |
| `RESERVED_AGENT_NAMES` | the first word of every command, both locales |

Enums in `libs/core`: `AccountState`, `CommandKind`, `SenderVerdict`. `OwnerLocale` is in `libs/types`, defined by whatsapp-cloud-channel.

Worker variable: `WAITLIST_ENABLED`, a `wrangler` var: `true` in production, `false` in staging and development. The two signing keys come from agent-inbox-core (`MEDIA_LINK_SIGNING_KEY`, `UPLOAD_LINK_SIGNING_KEY`); no new secret is added.

HTTP: no new route. The MCP route is unchanged. Development keeps `POST /dev/c/:secret/owner/messages`, which now sends commands like any owner message.

### Abuse controls

| Control | Enforced by | Rule | Over the limit |
|---|---|---|---|
| Blocklist | `blocked_phones` by `wa_id`, read first | operator adds and removes entries | silent drop; no account change; window not opened |
| Per-phone rate limit | Rate Limiting binding, key = `wa_id` | `OWNER_MESSAGES_PER_MINUTE` | silent drop; logged |
| Daily cap on new accounts | conditional insert over `accounts.created_at` | `NEW_ACCOUNTS_PER_DAY_LIMIT` | silent drop; logged; the operator raises the cap |
| Agent limit | conditional insert | `AGENTS_PER_ACCOUNT_LIMIT` | reply with the limit |
| Outbound per connection | Rate Limiting binding, key = connection id | `OUTBOUND_MESSAGES_PER_MINUTE` | MCP tool error `rate_limited` |

The blocklist is manual. Automatic blocking after repeated limit trips is out of scope.

### Account deletion (LGPD)

1. `apagar conta` replies with the consequences and the phrase `apagar conta definitivamente`. The phrase is the confirmation; no pending state is stored.
2. The phrase sends the confirmation reply first, while the window is open.
3. D1 sets the account to `deleting`. Connections stop resolving at once.
4. The Durable Object's `purge()` clears its SQLite storage and alarms.
5. `MediaStore.deletePrefix` removes `accounts/<account_id>/`, listing in pages of 1 000.
6. A D1 batch deletes the account's `owner_identities` and `connections`, then the `accounts` row.

Every step is idempotent. A failure leaves the account in `deleting`; the owner's next message, or the operator's `resume`, runs the remaining steps. A message from the same phone after deletion creates a new account on the waitlist, as in any first message.

The owner is told that Meta keeps the WhatsApp history on its side, and that Cloudflare's point-in-time copies of D1 and the Durable Object persist for their own retention period. Deletion does not touch the blocklist.

### Development

The development connection script of `agent-inbox-core` is deleted in this slice. Connections are created in development through the owner simulator: send `novo agente <nome>` through `POST /dev/c/:secret/owner/messages` and read the reply on `GET /dev/c/:secret/owner/screen`, and the install lines appear there. The simulator's owner phone is a fixed fake number in development configuration. Tests of `agent-inbox-core` that used the script switch to the simulator's helper.

### Logging

Events: `account.created`, `account.state_changed`, `command.received` (kind and locale), `connection.created`, `connection.revoked`, `connection.rotated`, `sender.blocked`, `sender.rate_limited`, `account.daily_cap`, `account.deleted`, `connection.auth_failed`. Each carries ids and kinds, never secrets, digests, phones, agent names or message text.

### Failure handling

| Failure | Behaviour |
|---|---|
| Blocked phone or over the owner rate limit | silent drop; logged; no account change |
| Daily cap reached | silent drop; logged; operator raises the cap |
| D1 unavailable on an inbound message | the Worker answers `5xx`, so the channel retries; no secret is issued and no reply is sent |
| Install prompt send fails on create | the new row is revoked again; the owner is asked to retry |
| Send fails on rotate | the digest is compare-and-set back to the old one |
| Name taken, invalid or reserved | the reply gives the reason; nothing changes |
| Limit reached | the reply gives the limit; nothing changes |
| Two creates race for one name or the last slot | the unique index and the conditional insert decide; the loser gets the reply for its case |
| Two first messages race for one `wa_id` | `ON CONFLICT DO NOTHING` and a read; one account results |
| Deletion interrupted | the account stays `deleting`; the next owner message or the operator's `resume` finishes it |
| Value without the `zb_conn_` prefix | `401` with no D1 read |
| First message is a photo or other media | the account is created and gets the same reply; the content is not stored |
| Owner message to a suspended account | one suspension reply; nothing is routed |

### Security

- A request's account comes from the secret only. No route takes an account id from the request.
- The Durable Object id derives from the account id, so one account's inbox cannot be reached with another's id.
- The secret never appears in a log, a D1 row, a Durable Object row or a test fixture file.
- Revocation, rotation and suspension take effect on the next request, because resolution reads D1 on every call and nothing is cached.
- WhatsApp shows the install link in chat history and in lock-screen previews. The link works once for 30 minutes, and the rotate command is the remedy.

### Risks

- The install link travels through Meta and sits in the owner's chat history. The connection secret does not.
- Meta and Cloudflare keep copies after deletion for their own retention periods.
- Command words such as `ajuda` can collide with an owner's own messages. Exact matching and the `@<agent>` escape limit the damage.
- The rate limit is approximate per Cloudflare location.
- The phone is the identity. A lost phone means a lost account, and the only recovery is a new account.
- The owner's number sits in D1 in plain text, which ADR 0012 requires; a breach of D1 exposes it.
- The daily cap drops messages silently, so a real owner can be missed on a busy day until the operator raises it.
- The LGPD texts and the privacy policy are the owner's to review.
- This spec assumes `agent-inbox-core` stores inbound message ids for deduplication and that slice 1's table is named `connections`.

## Rollback

- Before the first deploy: revert the branch. Migration `0002` is unapplied, so no production data exists.
- After the first deploy: migrations are immutable. Roll the Worker back with `wrangler rollback` to the previous version. Migration `0002` stays applied; the previous version reads `accounts` and `owner_identities` and ignores the new columns.
- Kill switch for new accounts: set `WAITLIST_ENABLED` to `'true'` in `env.production` and redeploy. Active accounts keep working.
- Abusive phone: `operator-account.sh block <wa_id>`, then `suspend <wa_id>`. Both reverse with `unblock` and `resume`.
- A deletion cannot be reversed; `apagar conta` tells the owner so. The daily sweep finishes any interrupted deletion.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Does the first message create the account, or does a confirmation? | first message · confirmation reply | first message, no confirmation ([ADR 0016](../../adr/0016-accounts-start-on-the-first-message-and-wait-on-a-list.md)) | 2026-11-06 |
| How are commands told apart from messages for agents? | reserved prefix · bare words with reserved names · menu only · natural language | bare words, reserved agent names, rule 0 before the core's rules, `ajuda` menu ([ADR 0015](../../adr/0015-commands-are-bare-words-routed-before-agents.md)) | 2026-11-06 |
| Is a waitlist flag wanted before the sale? | yes · no | yes; accounts start `waitlisted` when `WAITLIST_ENABLED` is true | 2026-11-06 |
| Do revoke and rotate need a second confirmation? | yes · no | no; the explicit name is the confirmation; deletion uses a phrase | 2026-11-06 |
| Agent limit per account | 5 · 8 · 10 | 8 | 2026-11-06 |
| Per-phone rate limit and blocklist | automatic · manual | 20 messages per minute, silent drop; blocklist managed by the operator | 2026-11-06 |
| Daily cap on new accounts | none · cap | cap of 50 per rolling 24 h | 2026-11-06 |
| How does an owner delete the account? | operator only · command · both | command with a phrase, plus the operator's `delete` | 2026-11-06 |
| What replaces slice 1's development script? | keep it · simulator | the owner simulator; the script is deleted | 2026-11-06 |
| Does creation choose the client? | yes now · no | no; `install-skills` renders one prompt with every client's section (ADR 0020) | owner delegated 2026-11-06 |
| In which language are replies sent? | account setting · keyword language | the language of the keyword used; `DEFAULT_LOCALE` pt-BR for new accounts | 2026-11-06 |
| Can the owner change phone? | yes · no | no; a new phone is a new account | 2026-11-06 |
| Where is the routing order written? | one place per slice · one table | one table in Routing change; agent-inbox-core keeps rules 1 to 6 | owner delegated 2026-11-06 |
| Can the install prompt exceed one WhatsApp message? | shorten it · send parts | no parts: one or two lines; the long text is the install page of `install-skills`; `splitInstallPrompt` is removed (owner order 2026-11-06) | owner delegated 2026-11-06 |
| Which owner-directory lookup is the port? | adapter · core port | core port `AccountDirectory`, promoted from the adapter of whatsapp-cloud-channel | owner delegated 2026-11-06 |
| Owner locale | a keyword's language · account property | account property set at creation: `pt_BR` for `55` numbers, `en_US` otherwise; commands do not change it (the keyword's language is used for that command's reply) | owner delegated 2026-11-06 |
| Shared time constants | per slice · `libs/types` | `SECOND_MS`, `MINUTE_MS`, `DAY_MS` from `libs/types` | owner delegated 2026-11-06 |
| Connection link field | `mcpUrl` · `connectionLink` | `connectionLink`, built per request from the secret; the WhatsApp reply carries the install link instead | owner delegated 2026-11-06 |
| R2 media key | `media/<mediaId>` · per account | `accounts/<accountId>/media/<mediaId>`, so deletion is one prefix delete | owner delegated 2026-11-06 |
| Build order | sequential · parallel | built in parallel with `whatsapp-cloud-channel`, from `main` once `agent-inbox-core` is merged | owner delegated 2026-11-06 |
| Revoke and rotate | both revoke · rotate keeps the wake setting | revoke calls `recordRevocation` (clears wake state, cancels waiters, marks revoked); rotate calls `cancelWaiters` only | owner delegated 2026-11-06 |
| Deletion request | phrase only · stored request with a 10-minute window | `deletion_requested_at` in the account object; the phrase works only inside 10 minutes; `confirm_deletion` is allowed in `waitlisted` and `active` | owner delegated 2026-11-06 |
| Failed reply send | ignore · compensate | the reply is one message; on a failed send the compensation runs (revoke, or compare-and-set back) and the owner gets `SendFailed` | owner delegated 2026-11-06 |
| Waitlist flag check | at module load · per request in the Worker | per request in the Worker's fetch path; the Durable Object does not read it | owner delegated 2026-11-06 |
| First message detection | in-memory flag · durable | the account object's `first_message_id`, stored with the reply | owner delegated 2026-11-06 |
| Who stores the install code? | `install-skills` · `accounts-and-keys` | `accounts-and-keys`: the code is minted, rotated and revoked with the connection, and its columns are in this slice's migration `0002`; `install-skills` reads it through `InstallCodeDirectory` | owner delegated 2026-11-06 |
| Is the connection secret stored? | never · sealed for the code's life | sealed under a key derived from the install code, for 30 minutes at most, cleared on the first MCP call or by the daily sweep (ADR 0020, an amendment of ADR 0017) | owner delegated 2026-11-06 |
| Free agent names in commands | reserved syntax · free name with the `@<agent>` escape | free name; `@<agent> girar a imagem` is the escape (rule 3); recorded in ADR 0015 and the commands guide | owner delegated 2026-11-06 |

## Test strategy summary

- **`libs/core` unit (Vitest, fake clock, in-memory ports):**
  - every row of the command table in both locales, with case, whitespace, accent and punctuation variants;
  - quoted and reaction messages are not commands;
  - reserved names and name normalisation;
  - rule 0 against rules 1 to 6, and that commands leave rule 5 unchanged;
  - the zero-agent rule 6 edge;
  - the state matrix for each state;
  - the agent limit and the revoked-does-not-count rule;
  - the rotate and create compensations;
  - the deletion steps and their idempotent resume;
  - every copy key exists in `pt_BR` and `en_US`;
  - the install lines are two lines in both locales, carry the install link and never `zb_conn_`;
  - the install code: 128 bits, stored as a digest only; the sealed secret opens only with the code; cleared on the first MCP call and by the sweep.
- **`apps/api` adapter unit:**
  - secret format: prefix, 43 characters, base64url alphabet;
  - digest determinism;
  - the constant-time compare is the one used in resolution;
  - the period is converted from milliseconds to seconds at the binding.
- **`apps/api` integration (`@cloudflare/vitest-pool-workers`, D1, R2 and Durable Objects):**
  - migration `0002` applies on an empty database and the partial unique index holds;
  - twenty concurrent creates yield exactly `AGENTS_PER_ACCOUNT_LIMIT`;
  - rotation makes the old link return `401` at once;
  - revoke and suspend return `401`;
  - account isolation: one account's secret never resolves to another account;
  - two first messages from one phone yield one account;
  - blocklist, phone rate limit and daily cap each drop silently;
  - deletion removes the Durable Object storage, the R2 prefix and the D1 rows, and resumes after a forced failure;
  - a Durable Object restart keeps state;
  - logs captured during the whole flow contain no secret, digest, install code, phone or agent name;
  - a D1 table dump contains no `zb_conn_` value; the owner's `wa_id` appears only in `owner_identities` and `blocked_phones`.
- **E2E:** the owner simulator in both locales walks create, the install link (the page shows the connection URL), a real MCP call with that URL, the second use of the install link (`410`), rotate (old link `401`), revoke (`401`), and deletion (D1 empty). The walk is recorded with Playwright MCP at 1 280 and 375 wide for the PR.
- **Docs:** `mint broken-links` is green for the three new pages.
