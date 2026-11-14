# WhatsApp support scope: plan

Steps are ticked only with evidence.

- [ ] **Step 1:** the shape test `tools/repository-shape/src/supported-messages.test.ts` (red first: the page does not exist yet), committed alone.
- [ ] **Step 2:** the English page `apps/docs/features/supported-messages.mdx`, its nine translations, the Features group entries in `apps/docs/docs.json` for all ten languages, and the FAQ accordions in all ten `help/faq.mdx`.
- [ ] **Step 3:** the four FAQ keys in `apps/api/src/site/site-copy-keys.ts`, the two items in `apps/api/src/site/faq-items.ts`, and the copy in all ten locale files.
- [ ] **Step 4:** the index row in `docs/features/README.md` moved to `Shipped` with the PR link, written on the branch right before the merge.

| Step | What breaks | Signal | Back out |
|---|---|---|---|
| 1 | the test passes before the page exists | red run prints `missing` for every kind | none needed; it is red |
| 2 | a translation drops a kind row | shape test names the language and the kind | add the row |
| 3 | an untranslated or blank copy | `site-copy.test.ts` | add the copy |
| 4 | the row says Shipped before the merge | `feature-status.test.ts` | fix the row |
