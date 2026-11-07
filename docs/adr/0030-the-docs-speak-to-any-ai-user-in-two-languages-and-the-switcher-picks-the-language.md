# 0030. The docs speak to any AI user in two languages, and the switcher picks the language

- Status: Accepted (owner delegated 2026-11-06)
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: [ADR 0010](0010-public-docs-on-mintlify.md), `docs/features/docs-experience/spec.md`, the G8 spike recorded in `docs/features/docs-experience/tester-briefing.md`

## Context

The docs were written for a developer who reads the MCP reference first. The people zapbip is for use ChatGPT, Claude, Grok, Codex, Cursor or Gemini and want the AI to reach them on WhatsApp; they do not know what an MCP server is. The owner asked that the docs serve any AI user and that every page exist in en-US and pt-BR, the start language following the browser where possible.

A spike ran `mint@4.2.1207 dev` (client 0.0.4077) in an `en-US` and a `pt-BR` Playwright browser context. Both opened `/` in English; the `pt-BR` context was not redirected to `/pt-br/index`. The language switcher lists `English` and `Português (BR)`, and choosing Portuguese on `/features/whatsapp-commands` lands on `/pt-br/features/whatsapp-commands`.

## Decision

1. The audience is any AI user. Developer material is one group, `For developers`, and the other groups never depend on it. The order is Get started, Agents, Features, Help, For developers.
2. Every page exists in `en` (default, listed first) and `pt-BR`. The pt-BR twin of `a/b` is the file `pt-br/a/b.mdx`; the folder is lowercase `pt-br` in files, links and URLs; the code `pt-BR` appears only as the `docs.json` language name.
3. The language switcher is the rule for choosing a language. No redirect script is added to emulate browser-language selection.
4. A Playwright walk from the Overview to the WhatsApp step runs in the docs gate in both languages and at both widths.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Switcher only (chosen) | nothing to maintain; what Mintlify supports today; keeps the page when switching | a Portuguese reader may need one click | n/a |
| Custom redirect script on the browser language | Portuguese readers land in Portuguese | Mintlify custom scripts run on every page and fight its own routing; a script the docs gate cannot see can break; extra code for one click saved | adds fragile code for a small gain |
| One language with machine translation | half the pages | not native copy; the owner asked for pt-BR as a first-class language | rejected by the owner's brief |

## Consequences

- A pt-BR reader who arrives at `/` sees English first and uses the switcher once. Links shared in Portuguese carry `/pt-br/`.
- `language.spec.ts` asserts the switcher, not a redirect. If a later Mintlify release selects by browser language, the test changes with it and this record is revisited.
- The walk is part of the docs gate, so a dead end in either language fails the gate.

## Evidence

- `apps/docs/e2e/language.spec.ts` and `apps/docs/e2e/from-zero.spec.ts`.
- Spike result: `docs/features/docs-experience/tester-briefing.md`, section G8.
- The spike ran against `mint dev`; the hosted Mintlify site was not exercised.

## Revisit when

- Mintlify documents browser-language selection for `navigation.languages`.
- The hosted site is deployed and a pt-BR browser behaves differently from `mint dev`.
