# 0053. Arabic is the ninth language and the first that reads right to left

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner, delegated 2026-11-14); Claude (advisor)
- Inspired by: the owner's words of 2026-11-14 ("the Arabic translation was left out"); [ADR 0051](0051-whatsapp-speaks-eight-languages-and-the-template-of-a-language-is-chosen-by-a-table.md) (the single locale enum and the template table); [ADR 0048](0048-the-docs-speak-eight-languages-one-folder-per-language-and-the-page-language-is-a-type-of-its-own.md) (the docs languages); [visual-localization](../features/visual-localization/spec.md) (one demo and card per language)

## Context

Eight languages reach every surface, each as a row of a typed record. Arabic adds a direction: a page, a chat mock and a headline must mirror, while code, links and numbers stay left to right.

## Decision

1. **One more enum value, everywhere.** `OwnerLocale.Arabic = 'ar'`, `WebLanguageTag.Arabic = 'ar'` and `DocsPageLanguage.Arabic = 'ar'`; the path is `/ar`, the docs folder `ar`. The compiler lists every record that lacks its Arabic row.
2. **Direction comes from the locale profile.** `TextDirection` is a field of `LocaleProfile`; the site, the app and the backoffice write `dir` on `<html>`, the start-link page on each language section. No view branches on `ar`.
3. **Logical CSS.** The four stylesheets use `margin-inline`, `padding-inline`, `inset-inline`, `text-align: start` and logical radii; rules that exist only for right to left start with `html[dir='rtl']` (arrow glyphs, the disclosure marker). `pre`, `code`, `kbd`, `samp` and email inputs stay left to right; Arabic gets a system font stack and no letter spacing, because spacing breaks the joined letters. No web font loads.
4. **Digits stay Latin.** `formattingLocale` of Arabic is `ar-u-nu-latn`, so prices, counts and dates read `5`, not `٥`, in the page, the legal text and the docs matrix.
5. **The calling-code table.** Arab League members speak Arabic for a new owner: 20, 212, 213, 216, 218, 222, 249, 252, 253, 269, 961, 962, 963, 964, 965, 966, 967, 968, 970, 971, 973, 974. Israel (972) stays English: its first language is Hebrew, which we do not have, and the documented fallback is English; Palestine (970) is Arabic.
6. **Commands.** The words are `وكيل جديد`, `وكلائي`, `إبطال`, `تجديد`, `مساعدة` or `القائمة`, `دخول`, `حذف الحساب`, `حذف الحساب نهائيا` and `اللغة <code>` (the code list gains `ar`); the English and Portuguese words keep working. The collision tests of ADR 0051 cover them.
7. **Templates.** `ar` sends the English template until the Arabic pair is approved; the bodies are in code and in step 12 of the Meta runbook, and flipping the row is the whole switch.
8. **Media.** `TERMINAL_COPY` has an `ar` entry; the stage mirrors the phone and the card mirrors its composition under `dir="rtl"`; `record-landing-demo.ts --locale ar` and `render-open-graph-images.ts` produce the files.
9. **Docs.** `apps/docs/ar` holds the 45 pages and `libs/agents/supported/<agent>/page.ar.mdx` the agent pages; the glossary has an Arabic column.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A `dir` attribute set by a branch on the language | Two lines | A tenth language needs a second branch | The profile carries it like the flag and the font |
| Arabic-Indic digits through the default locale | The default of `ar` | Prices and counts differ from the commands and the code a person types | Latin digits are what the agents and the keyboards use |
| Mirror the terminal of the demo | Looks consistent | Terminals do not mirror; Arabic strings already read right to left inside a left to right line | The phone mirrors, the terminal does not |
| Send Israel to Arabic | Covers Arabic speakers there | Most numbers are Hebrew speakers | Hebrew is not a language we have |

## Consequences

A tenth right-to-left language (Hebrew, Persian) is a profile row and copy. The Chat component of the docs draws its inline styles with physical sides: the documentation mirrors through the platform's `dir` handling and the page CSS; a bubble that does not mirror is a defect to fix in `snippets/chat.jsx`.

## Evidence

`libs/core/src/accounts/{owner-locale,command-languages}.test.ts`, `apps/api/test/unit/{locale-profiles,site-assets,demo-copy,start-link-page}.test.ts`, `apps/api/e2e/landing/landing-arabic.spec.ts`, `tools/repository-shape/src/{agent-registry,docs-experience,docs-navigation}.test.ts`.

## Revisit when

Meta approves the Arabic templates, or the owner reports a command word that collides with ordinary Arabic talk.
