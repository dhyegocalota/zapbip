# 0023. The local session is the newest one in the working directory

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: the wake probes of 2026-11-04 to 2026-11-06 (`claude -p --resume`, `codex exec resume`, "thread already has an active writer"), [ADR 0007](0007-a-durable-inbox-and-a-wake-ladder.md)

## Context

A local wake resumes an existing Claude Code or Codex session, so the agent keeps its context. The connector must know which session to resume. The owner works in a project directory, and the agent that talks to zapbip usually runs there.

## Decision

1. The connector resolves the session when it wakes, not when it starts. Its default is the most recently modified session whose working directory is the connector's `--cwd` (default: the directory the command ran in).
2. `--session <id>` pins one session and skips the lookup. The id must be a UUID.
3. Claude Code sessions are read from the project folder of the working directory under the Claude config directory. Codex sessions are read from the rollout files under the Codex home, matched by the working directory recorded in each file's first line.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Newest session in the working directory, pin with a flag (chosen) | zero setup; the newest session is usually the one the owner means; same rule for both clients | can pick a session the owner has open in a terminal | — |
| Explicit `--session` only | exact | the owner must copy an id for every session; breaks as soon as a new session starts | friction on every new session |
| A SessionStart hook records the id | exact, and follows the session the owner actually started | edits the owner's Claude and Codex settings; hooks differ per client; sessions from before install are unknown | too invasive for the first slice |

## Consequences

- A wake can append to a session that is open elsewhere. Both writers append to the same transcript. The risk is accepted and documented; `--session` avoids it.
- The lookup reads local transcript folders. It never reads message content except the first line of a Codex rollout.
- Codex app threads that hold an active writer are skipped by the fallback in the spec, not by this rule.

## Evidence

- `claude -p --resume <id>` resumed a session in about 7 s and kept its context (POC report).
- `codex exec resume <id>` resumed in about 6 s; it refused a thread the Codex app was using (POC report).

## Revisit when

- A client exposes a stable "current session" query that the connector can call.
- The owner reports wakes that land in the wrong session.
