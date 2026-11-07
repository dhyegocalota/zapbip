# 0020. One install link per connection, the AI reads the instructions

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's order of 2026-11-06 that the install prompt be one or two lines and that the person does nothing beyond pasting it, the AI reading the instructions online; the client probes of 2026-11-04 to 2026-11-06, where each client exposed a different config path, timeout and wake rung

## Context

Creating a connection (`novo agente`, or `girar` for a new link) replies on WhatsApp. The first design put every client's steps into one long prompt, sent in parts, with the connection URL inside it. That makes the owner paste a long text, and it puts the connection secret into the WhatsApp chat, where Meta and the chat history see it (ADR 0006).

The AI that receives the paste can fetch a URL. So the WhatsApp message can carry a short link to instructions, and the instructions can be written for the AI. The steps for each client can then change without a new WhatsApp message.

Two facts still limit the design. Clients expose different names before the install (ADR 0020 of the probes: Grok Bot reports `Cursor/1.0.0`), so the AI detects its product itself. And the connection secret is shown once and stored only as a digest (ADR 0017), so a page served later can embed the connection URL only if the secret is kept somewhere for that time.

## Decision

1. The WhatsApp reply to `novo agente` and `girar` carries one or two localized lines with `https://<public-host>/i/<install-code>`. The lines never contain the connection secret.
2. `GET /i/<install-code>` serves Markdown for the AI, in English, with every sentence for the owner in the owner's locale. The AI detects its product and follows only that section. Every section ends with the same self-test, `send_message` of the localized `✅ instalado` or `✅ installed`.
3. The page embeds the connection URL only while its install code is valid: 30 minutes, one connection, and only until the connection's first successful MCP call.
4. The install code is stored as a digest. The connection secret is kept sealed under a key derived from the install code (AES-256-GCM, the key from HKDF-SHA-256 of the code), in the same row, and cleared at the first MCP call or by a daily sweep after expiry. The code is not stored, so the sealed secret opens only with the code.
5. The install code store belongs to `accounts-and-keys`, because the code is minted, rotated and revoked with the connection, and its columns live in that slice's migration.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Long prompt with every client's steps, sent in parts (the first design) | no server page; works offline | the owner pastes a long text; the parts split a message; the secret travels in the chat; a rule change needs a new message | fails the one-or-two-lines order |
| One short prompt with a link to a page for the AI, the page holds the sections (chosen) | the owner pastes two lines; the AI reads the current steps; the page can change without a message | the page needs a secret store for 30 minutes; the link is a credential in chat history | — |
| The owner picks the client in a web page before the paste | short prompt; no detection risk | an extra step before the paste; a wrong pick is silent until the self-test fails | the owner should do nothing |
| The connection secret in the WhatsApp message, as before | no store | the secret stays in chat history forever; the prompt grows | the owner's order: the install link only |

## Consequences

- The sealed secret is an exception to ADR 0017 ("never stored") for at most 30 minutes, and it is cleared on first use. ADR 0017 gets a dated amendment in the same change that ships the install code.
- A link used once or expired shows `410` with a message that asks the owner to send `girar <nome>`. The owner has one step to recover, and no connection is lost.
- The page is the one place where the AI learns the steps, so its text is snapshot-tested per client and locale.
- A misdetection is caught by the self-test: no `✅` reaches the owner. The connection records the client name from the first `initialize`, so the owner can see what the agent claimed to be.
- Each section names its product in a way the AI can recognise from its own environment.
- Every page response carries `Cache-Control: no-store` and `X-Robots-Tag: noindex`, and the route is rate-limited per client IP.

## Evidence

- The probes showed different `clientInfo` values per client (Claude Code, Codex app, Grok Bot as `Cursor/1.0.0`), so the names are not a reliable pre-install key.
- Grok Bot accepted an MCP server added by asking the bot, so each section can be an instruction the AI follows.
- The owner's order of 2026-11-06 fixes the two-line prompt.

## Revisit when

- A client exposes its own name to the paste flow before the AI runs, which would let the page render a single section.
- Misdetections happen in the install runs recorded for the PRs.
- A client cannot fetch a URL from a pasted message. Then the page content moves into the paste for that client only.
- The connection secret can be stored at rest in a form the owner accepts, which would remove the sealed copy.
