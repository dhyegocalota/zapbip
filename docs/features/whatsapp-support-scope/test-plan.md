# WhatsApp support scope: test plan

- [ ] Every `MessageKind` appears as a table row in the English page. Input: `apps/docs/features/supported-messages.mdx`. Expected: no missing kind.
- [ ] Every `MessageKind` appears as a table row in each of the nine translated pages. Expected: no missing kind in any language.
- [ ] A planted table without `choice` reports `choice` as missing. Expected: `[MessageKind.Choice]`.
- [ ] `docs-navigation.test.ts` passes: each of the ten pages is in its Features group and exists in its folder.
- [ ] `docs-experience.test.ts` passes: no developer link from a features page, no forbidden future or test-double word.
- [ ] `site-copy.test.ts` passes: each locale has the four new keys, none empty, no untranslated sentence, French spacing kept.
- [ ] `structured-data.test.ts` and `site-page.test.ts` pass with the two new FAQ items.
- [ ] `prose-leaks.test.ts` passes without growing the baseline.
- [ ] Browser walk: the Features page and the FAQ render in English and pt-BR at 1280 and 375 widths, with the tables readable and no horizontal page scroll (Playwright MCP, recorded for the PR).
