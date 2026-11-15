# Locale everywhere

**Status:** Shipped 2026-11-14
**Tier:** 🔴 structural
**Owner approval:** approved 2026-11-14 (the owner's words: "every experience, including when the person has no account, must follow the customer's i18n language, even on WhatsApp; I don't want anything hardcoded")
**ADRs:** [0065](../../adr/0065-a-new-owner-speaks-the-language-they-write-then-the-calling-code-then-english.md) (new), [0051](../../adr/0051-whatsapp-speaks-eight-languages-and-the-template-of-a-language-is-chosen-by-a-table.md) (decision 2 partly superseded), [0057](../../adr/0057-hindi-is-the-tenth-language-and-india-keeps-english-for-a-new-owner.md)
**Not changing:** the Meta templates (still English for the six languages until Meta approves them, ADR 0051), the MCP tool names and schemas, the agent instructions inside install prompts and the agent rules (written for the agent, in English), the welcome and digest emails (digest stays pt-BR by design), existing accounts' stored language

## Problem

A person with no account who writes in Spanish from a US number gets English from the first message: the language came from the calling code only. A bare start link answered in Portuguese. A closed number read only the calling code. The reply to a list choice took a default language until the account locale overwrote it.

## Change

- One function picks the language of a number with no account: the written text, then the calling code, then English ([ADR 0065](../../adr/0065-a-new-owner-speaks-the-language-they-write-then-the-calling-code-then-english.md)).
- The first message, a message on a closed number and the start link without `lang` use that function.
- The command parser takes the account locale for list replies; the default language constant leaves the parser.
- The usage reply's name placeholders move to `account-copy.ts`.
- A repository test fails when a WhatsApp reply builder writes prose inline.

## Audit

Already in copy modules, all ten languages: WhatsApp replies (`whatsapp-copy.ts`, `account-copy.ts`, `inbox-copy.ts`, `wake-copy.ts`, `agent-approval-copy.ts`, `install-page-copy.ts`), the start link page, the emails (welcome in ten, digest in pt-BR by design), the site, the client app and the backoffice.

Left as English on purpose, read by agents or operators rather than owners: the agent rules and install prompt text (ADR 0021), the MCP tool descriptions, the WebMCP script of the site, `llms.txt`, the channel error texts returned to the agent, the deploy preflight messages and the operator tools.

## Failure handling

- Unknown code or no text: the calling code, then English. Nothing fails.
- A word two languages share (`menu`) does not pick a language.
- Han-only text does not pick a language, because Japanese writes Han too.

## Open questions

None for this change. Latin greetings without a command word (`hola`) still follow the calling code; the ADR records it as a revisit trigger.
