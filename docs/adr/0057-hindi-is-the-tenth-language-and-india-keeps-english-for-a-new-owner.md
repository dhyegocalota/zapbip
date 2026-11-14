# 0057. Hindi is the tenth language, and India keeps English for a new owner

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's words of 2026-11-14 ("Indian was left out, fix it"); [ADR 0051](0051-whatsapp-speaks-eight-languages-and-the-template-of-a-language-is-chosen-by-a-table.md) (the single locale enum, the calling-code table and the template table); [ADR 0053](0053-arabic-is-the-ninth-language-and-the-first-that-reads-right-to-left.md) (how the ninth language was added); [ADR 0056](0056-templates-are-submitted-and-rechecked-automatically-for-every-number.md) (templates submitted by the checklist)

## Context

Nine languages reach every surface, each as a row of a typed record. Hindi is the language the owner named; it is written in Devanagari, left to right, and Indian developers write it with the English loanwords of their trade. India's developers mostly work in English, and Hindi is not the first language across the country, so a phone number from India says little about the language its owner wants.

## Decision

1. **One more enum value, everywhere.** `OwnerLocale.Hindi`, `WebLanguageTag.Hindi`, `DocsPageLanguage.Hindi` and `WhatsAppLanguageCode.Hindi` are `hi`; the path is `/hi`, the docs folder `hi` (Mintlify lists `hi` among its navigation languages). The compiler names every record that lacks its Hindi row.
2. **Left to right, system Devanagari.** The locale profile is left to right with the formatting locale `hi`, whose digits are already Latin; the shell gives `:lang(hi)` a Devanagari system font stack (Kohinoor Devanagari, Nirmala UI, Noto Sans Devanagari) and no letter spacing, which would break the headline stroke. No web font loads.
3. **Register.** Natural spoken Hindi addressed with आप, keeping the loanwords Indian developers use (एजेंट, लिंक, prompt, WhatsApp, API key, MCP), never coined Sanskritized terms. The product never speaks in a gendered first person: zapbip asks with the subjunctive ("भेजूँ?") or the passive. Legal pages use a formal register.
4. **India keeps English.** Calling code 91 has no row in `OWNER_LOCALE_BY_CALLING_CODE`, so a new owner from India gets English, as an owner from Israel (972) does under ADR 0053. Hindi is chosen with the language command, the site menu or `Accept-Language`.
5. **Commands.** The words are `नया एजेंट`, `मेरे एजेंट`, `एजेंट हटाएँ`, `लिंक बदलें`, `मदद` or `मेनू`, `लॉगिन`, `अकाउंट डिलीट करें`, `अकाउंट हमेशा के लिए डिलीट करें` and `भाषा बदलें <code>`; the code list gains `hi`, and English and Portuguese keep working. Command folding maps chandrabindu to anusvara, so `हटाएँ` and `हटाएं` match. The collision tests of ADR 0051 cover the words and ordinary Hindi chat.
6. **Templates.** The Hindi bodies, quick replies and samples of `zapbip_agent_notice` and `zapbip_agent_question` are in code and in the Meta runbook; the checklist of ADR 0056 submits them, and `hi` sends the English template until its row is flipped.
7. **Media and docs.** `TERMINAL_COPY` has a `hi` entry; `record-landing-demo.ts --locale hi` produces the demo, posters and card; `apps/docs/hi` holds every page and `libs/agents/supported/<agent>/page.hi.mdx` the agent pages.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Map +91 to Hindi | Hindi speakers get Hindi at once | Most Indian developers expect English; Tamil, Bengali or Marathi speakers would get a language that is not theirs | English is the safer default; one command switches |
| Sanskritized product words (अभिकर्ता, कड़ी) | Purist | Nobody types or reads them in developer tools | The loanwords are what Indian products write |
| Devanagari digits (`hi-u-nu-deva`) | Traditional | Prices, counts and the commands people type use Latin digits in India | Latin digits, the default of `hi` |
| A Devanagari web font | Uniform look | A font load the CSP and the speed budget refuse | System fonts cover Devanagari on every platform |
| Romanized Hindi command words | Matches some chat habits | Collide with English and with ordinary Hinglish chat | Devanagari words, English kept as the Latin option |

## Consequences

A further Indian language (Bengali, Tamil, Marathi) is a profile row, copy and a decision on whether its calling code stays English. The demo, card and docs tables accept a tenth row without code changes.

## Evidence

`libs/core/src/accounts/{owner-locale,command-folding,command-languages,account-copy}.test.ts`, `libs/types/src/docs-page-language.test.ts`, `apps/api/test/unit/{hindi-copy,locale-profiles,whatsapp-templates,copy-literal-translation-traps,site-assets}.test.ts`, `apps/api/e2e/landing/landing-hindi.spec.ts`, `tools/repository-shape/src/{agent-registry,docs-experience,whatsapp-docs}.test.ts`.

## Revisit when

Meta approves the Hindi templates, owners from India ask for Hindi by default, or a command word collides with ordinary Hindi chat.
