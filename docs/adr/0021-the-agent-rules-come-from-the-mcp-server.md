# 0021. The agent rules come from the MCP server

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the install page of 0020 (every client reads it once, then forgets it); the probes, where Claude Code and Codex loaded MCP tools in one session and the web chats did not keep local files

## Context

Every agent needs the same rules: call `check_inbox` at task start, use `ask` for decisions, answer in short WhatsApp-style messages. Clients differ in where they keep instructions. Claude Code and Codex read skill and config files on disk. claude.ai, ChatGPT and Grok cannot write a file on the owner's machine, so the rules must reach them through the protocol.

## Decision

1. The rules are one constant in `libs/core`.
2. The MCP server returns them as `instructions` in its `initialize` result and as the prompt `zapbip-rules`.
3. The Claude Code section of the install page also writes a skill file rendered from the same constant. The install page carries the same text in its rules section, so every client that reads the page keeps the rules for the install. No other client receives a file.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Rules served by the MCP server, a skill file for Claude Code (chosen) | one source; reaches every client that reads protocol instructions; the skill adds a second channel where files work | the protocol channel is advisory and unmeasured on claude.ai and ChatGPT | — |
| A skill or instruction file written by every install section | native to each client | no file on the web chats; copies drift when the rules change | fails for claude.ai, ChatGPT and Grok |
| Tool descriptions only | no extra MCP surface | too little room for the full rule set; clients may show descriptions only when choosing a tool | too weak for "check the inbox at task start" |
| The rules written into the WhatsApp reply | works in every client | goes stale after install; the reply grows for every client | the owner would have to read and paste them |

## Consequences

- Rule text changes in one place. The Claude Code skill copy updates when the AI re-runs the install page; the page always shows the current text.
- Whether claude.ai and ChatGPT inject server `instructions` into the model is not measured yet. The scripted install run and the manual checks in the PR must confirm it, and the tool descriptions carry the key rule (`check_inbox`) as a fallback.

## Evidence

- Not measured yet for the instructions channel. The POC measured only tool calls, not how the models used the server's `instructions`.

## Revisit when

- A client is measured ignoring server `instructions`. Then the rule moves into tool descriptions or the install section for that client.
- A client gains a shared rules store that the server can write to.
