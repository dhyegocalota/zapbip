# 0050. An agent sets itself up from a one-line prompt that points to a generated setup page

- Status: Accepted
- Date: 2026-11-13
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: the owner's words of 2026-11-13 ("why would someone make the MCP changes by hand? isn't it better to ask the AI itself, with a one-line prompt, to set itself up?"); [ADR 0044](0044-an-agent-requests-access-without-the-captcha-under-weighted-limits.md) (the site already has an agent path); the install page the `new agent <name>` reply already hands out

## Context

The quick start on the home page shows a command per client that the person pastes in a terminal or a settings screen. The person still has to know where the command goes. The product already trusts the agent with the harder part: the install link that WhatsApp returns is read by the agent, which then writes its own configuration. The site did not offer that path before the link exists.

## Decision

1. **One line per tab.** Each quick start tab shows one line to paste into that AI, in the page language: set up zapbip for yourself, read `<setup url>` and follow it. The command of today moves into a collapsed "Prefer to do it by hand?" disclosure under it. The Copy button of the first window copies the line.
2. **One setup page per language.** `<language path>/setup.md` (`/setup.md`, `/pt-br/setup.md`, `/es/setup.md`, ...) is served as `text/markdown` and generated from the install registry and the site copy, like the Markdown twins and the llms files. The path decides the language, so the line and the page always agree.
3. **What the page says.** Two lines on what zapbip is; step 1, ask the human to send `new agent <your name>` to zapbip on WhatsApp through the start link, which answers with the personal install link; step 2, per client, how to add the MCP server with that link, from the registry's `quickStart` with a placeholder in place of the link; step 3, verify with the install self-test text; a safety paragraph (the link goes nowhere but the owner's own agent and WhatsApp).
4. **Linked from every agent surface.** The Markdown twins, `llms.txt`, the agent card and the `get_quick_start` answer (HTTP and WebMCP) carry the setup URL; `get_quick_start` also carries the one line.
5. **Official marks only from their owner.** An agent shows a vendor mark only when it comes from the vendor's own site or repository under terms that allow naming the product; otherwise it keeps its initials. Source, terms and date are recorded in `NOTICE.md`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| One language-neutral `/setup.md` | One file | The prompt language and the page language drift; the step texts are English for everyone | A page the person's agent reads should match the person's language |
| Keep only the manual command | No new surface | Asks a person to do what the agent can do | The owner asked for the prompt |
| Put the setup text in the docs site | One home for prose | A second copy of the registry's commands to keep in step | The registry already generates every other surface |

## Consequences

- A new agent in the registry appears in the setup page, the quick start, the Markdown twins and `get_quick_start` with no extra file.
- The setup page names the owner's WhatsApp commands in the owner language of the page (`OWNER_LOCALE_OF_WEB_LOCALE`): Portuguese pages use `novo agente`, the other seven `new agent`.
- A mark whose owner publishes it only behind a login or exact-download rule stays as initials until a lawful copy exists.

## Evidence

`apps/api/test/integration/site-setup.test.ts`, `apps/api/test/unit/site-logos.test.ts`.

## Revisit when

An agent's install link stops carrying its own instructions, or a vendor publishes a brand kit that is downloadable without an account.
