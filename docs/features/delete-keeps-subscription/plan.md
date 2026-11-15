# Plan: deleting the account does not cancel the subscription

Copy and docs only; no behaviour changes.

1. `libs/core/src/accounts/account-copy.ts`: `DeletionRequest` and `DeletionDone` in ten languages carry the notice, with `COMPANY.contactEmail` as a template value.
2. `apps/api/src/client-app/client-app-copy*.ts`: `DeleteAccountHint` carries the notice with a `{contactEmail}` value; `home-page.tsx` passes `COMPANY.contactEmail`.
3. `apps/api/src/site/legal-copy*.ts`: one paragraph added to the terms section "Ending your account" and to the privacy section "Your rights", in ten languages, using `{contactEmail}`.
4. `apps/api/src/site/site-copy-keys.ts`, `site-copy*.ts`, `faq-items.ts`: `FaqDeleteQuestion` and `FaqDeleteAnswer` in ten languages, listed after the price question.
5. `apps/docs/<folder>/help/delete-your-account.mdx`: the chat example carries the notice, and a "subscription" section closes the page; ten folders.
6. `apps/docs/<folder>/help/faq.mdx`: one accordion for the question; ten folders.
7. Tests: `account-copy.test.ts`, `client-app-copy.test.ts`, `legal-copy.test.ts`, `site-copy.test.ts` (apps/api unit), `account-docs.test.ts` (repository shape), each marked `[row 439]`.
8. This folder, and its row in `docs/features/README.md`.
