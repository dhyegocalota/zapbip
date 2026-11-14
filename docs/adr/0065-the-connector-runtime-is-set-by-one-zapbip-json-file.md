# 0065. The connector runtime is set by one zapbip.json file

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [ADR 0064](0064-a-wake-provider-and-a-channel-protocol-belong-to-the-agent-folder.md), which keeps agent facts in the agent folder; the owner's words of 2026-11-14: the owner runs `ccs` instead of `claude` for Claude Code, and anyone may need other arguments, so the runtime the connector launches must be changeable with one generic JSON file that every AI reads the same way

## Context

`connect` launched the binary named in each agent folder (`claude`, `codex`) with the arguments that folder builds. Someone who starts Claude Code through a wrapper such as `ccs`, or who needs another flag, could only change that by editing code.

## Decision

1. One file, `zapbip.json`, holds the overrides. Its schema is generic: the keys are the connector client ids from the agent registry, and each entry takes `command`, `args`, `environment` and `timeoutMilliseconds`. No key names an agent's own flag.
2. The file is found in this order, and the first source that exists wins: the `--config <file>` flag of `connect`, the `ZAPBIP_CONNECTOR_CONFIG` variable, then `zapbip.json` in the working directory of `connect`, the folder where the AI wakes. With none of them the built-in defaults of the agent folder apply.
3. `args` are placed before the arguments the connector builds for the session. The connector's own arguments (resume, the safety and isolation arguments, the prompt on standard input) are never replaced, so a wrapper's flags come first and the session still resumes.
4. The connector reads the file once, when `connect` starts. A change takes effect on the next start.
5. The connection link is never passed to the child, even when an entry sets it in `environment`.
6. The schema is generated from the validator (zod 4, `z.toJSONSchema`) into `apps/docs/schemas/connector-config.json`, served by the docs site, and referenced from the file by `$schema`. A unit test fails when the committed file differs from the generated one.
7. `listen` and `channel` do not start a runtime, so they take no `--config`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Replace the whole argument list per agent | Full control | Resume, safety and isolation arguments would have to be rebuilt by every owner | The connector must keep its own arguments |
| Override the working directory for the child | Simple | Claude Code and Codex find a session by the folder it started in, so resume would fail | Session lookup depends on the folder |
| Flags and variables only, no file | No file to manage | An owner must repeat them in every shell and every service | The owner asked for a file in the wake folder |
| A file per agent folder in the repository | Versioned with the code | Changing the command needs a code change and a release | The owner must change the runtime without a release |
| TOML or YAML | Comments | No editor completes them from a `$schema` line as widely as JSON | JSON with a published schema gives completion |

## Consequences

A `zapbip.json` in a folder is code the owner's machine runs, with the owner's permissions, when a message arrives. A folder that someone else put on the machine can carry one, so the owner trusts a folder before running `connect` in it, as with `.mcp.json`. The documentation says so. The schema has to be regenerated with `pnpm connector:schema` when the validator changes; the unit test names the command when it fails.

## Evidence

`apps/connector/test/unit/connector-config.test.ts` (resolution order, validation errors, merge with the agent defaults, the committed schema), `apps/connector/test/unit/cli.test.ts` (the `--config` flag), and `apps/connector/test/integration/connector-config.test.ts` (a fake `ccs` binary is the one that runs, with its arguments before the runtime arguments and its environment set).

## Revisit when

A second connector client needs a launch shape that a leading argument list cannot express, or the owner asks for the file to be reloaded while `connect` runs.
