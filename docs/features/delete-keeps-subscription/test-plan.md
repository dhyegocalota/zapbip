# Test plan: deleting the account does not cancel the subscription

- [row 439] Unit, `libs/core/src/accounts/account-copy.test.ts`: the request and the done reply, in each of the ten locales, contain `COMPANY.contactEmail`.
- [row 439] Unit, `apps/api/test/unit/client-app-copy.test.ts`: the delete hint, in each of the ten locales, contains `COMPANY.contactEmail` once `contactEmail` is filled.
- [row 439] Unit, `apps/api/test/unit/legal-copy.test.ts`: in each locale, the terms and the privacy policy each carry a paragraph with `{contactEmail}` that names "zapbip Cloud".
- [row 439] Unit, `apps/api/test/unit/site-copy.test.ts`: the FAQ answer, in each locale, carries `{contactEmail}` and names "zapbip Cloud".
- [row 439] Shape, `tools/repository-shape/src/account-docs.test.ts`: in each docs language, the delete page and the FAQ state that deleting does not cancel the subscription and contain `COMPANY.contactEmail`.
- Existing: the legal section-shape test, the copy placeholder and translation tests and the WhatsApp text limit still pass.
- Gate: scoped `pnpm verify` through the heavy wrapper after merging `origin/main`.
