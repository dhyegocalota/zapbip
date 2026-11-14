# 0048. The docs speak eight languages, one folder per language, and the page language is a type of its own

- Status: Accepted
- Date: 2026-11-13
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: the owner's order of 2026-11-13, "translate everything to Spanish, Chinese, German, French, Japanese and Korean" (phase B of three); [ADR 0030](0030-the-docs-speak-to-any-ai-user-in-two-languages-and-the-switcher-picks-the-language.md); [ADR 0047](0047-the-web-surfaces-speak-eight-languages-through-a-web-locale-while-whatsapp-copy-stays-in-two.md)

## Context

[ADR 0030](0030-the-docs-speak-to-any-ai-user-in-two-languages-and-the-switcher-picks-the-language.md) fixed two languages and the `pt-br` twin folder. `DocsLanguage` (`en`, `pt-BR`) is also the `lang` parameter of the start link, which the API reads to choose the language of the owner's first WhatsApp message; that copy exists in two languages until phase C. The documentation needs six more languages without touching the API.

## Decision

1. **`DocsPageLanguage`.** A new enum in `libs/types` with eight values: `en`, `pt-BR`, `es`, `de`, `fr`, `ja`, `ko`, `zh`. These are the codes `docs.json` accepts in `navigation.languages` (checked against the Mintlify schema on 2026-11-13). `DocsLanguage` keeps its two values and stays the start link parameter. Everything that describes a documentation page (`libs/agents`, the docs shape tests, the Playwright specs) is typed on `DocsPageLanguage`, so a ninth language is a type error until every table has a row.
2. **One folder per language.** `DOCS_LANGUAGE_FOLDERS` maps each language to its folder (`''`, `pt-br`, `es`, `de`, `fr`, `ja`, `ko`, `zh`); the twin of `a/b` is `<folder>/a/b.mdx` and the snippets live in `snippets/<folder>/`. `twinPathOf`, `snippetPathOf` and `languageOfPage` in `libs/agents/src/docs.ts` are the only code that knows this layout.
3. **Owner words stay in two.** `DOCS_OWNER_LOCALES` maps each documentation language to the owner language its WhatsApp examples are written in: Portuguese to Portuguese, the other seven to English. A translated page shows WhatsApp commands (`new agent`, `revoke`), notices and the self-test text in English, and says so where it shows a command; phase C replaces these rows. `DOCS_START_LINK_LANGUAGES` does the same for the `lang` parameter of the start link.
4. **Agent pages.** Each agent folder holds `page.<code>.mdx` for every language (`page.en.mdx` and `page.pt-br.mdx` keep their names). The generator copies them to `apps/docs/<folder>/agents/`, the matrices are generated per language and the navigation group is found by the language entry first and the group name second, because several languages share the name `AI`. Page rules (headings, listen tokens, one-listener sentence, self-test text) are tables over the eight languages.
5. **Voice.** ADR 0030's voice carries over: say AI to people (`IA`, `KI`, `AI`), keep code, commands, tool and product names untranslated.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Add the six languages to `DocsLanguage` | One enum | The start link route, the site language map and their tests change in the same PR, and the start link would accept six languages whose owner copy does not exist | That is phase C and touches `apps/api` |
| Translate only the pages people open first | Less to review | A language that stops at the Overview sends readers to English mid-flow, and the twin tests would need exceptions | The owner asked for everything |
| One generated page per language from the English one | No translator | Not native copy | The owner asked for native-quality writing |

## Consequences

- A tenth language is one enum value and a compile error per table.
- `DocsLanguage` and `DocsPageLanguage` share two values; the first is the API's, the second the docs'.
- The language switcher shows the six native names Mintlify gives its codes; the Playwright walk asserts them.

## Evidence

- `tools/repository-shape/src/docs-navigation.test.ts`, `docs-experience.test.ts`, `agent-registry.test.ts`, `libs/agents/generate/*.test.ts`.
