# Deleting the account does not cancel the subscription

**Status:** Building
**Tier:** 🟢 light
**Owner approval:** approved 2026-11-14 (owner asked in pt-BR: say that deleting the account does not cancel the zapbip Cloud subscription, that cancelling is done by hand through a message, and say so in the docs)
**ADRs:** none; no billing exists in the code yet, so there is no cancellation to automate
**Not changing:** the deletion flow itself (the two WhatsApp messages, the 10-minute window, what is removed); no billing code

## Problem

An owner who deletes the account over WhatsApp is told that everything is removed, and nothing says that a zapbip Cloud subscription keeps running. The terms, the privacy policy, the client app and the docs say how to delete, not what deleting leaves behind.

## Goals

- Every place that describes or confirms deletion says the subscription is not cancelled and names the support address `COMPANY.contactEmail`: the WhatsApp request and the final reply, the client app hint, the terms, the privacy policy, the site FAQ, the docs delete page (with its chat example) and the docs FAQ.
- The copy is in all ten languages of each surface.
- Tests pin the notice in every language on every surface.

## Non-goals

- No billing integration, cancellation, refund or proration. Cancelling stays a manual message to support.
- No change to what deletion removes.

## Ground truth (code)

- Deletion: `libs/core/src/accounts/use-cases/request-account-deletion.ts` and `confirm-account-deletion.ts` send `DeletionRequest` and `DeletionDone` from `libs/core/src/accounts/account-copy.ts`.
- Client app hint: `apps/api/src/client-app/client-app-copy*.ts` (`DeleteAccountHint`), rendered in `apps/api/src/client-app/views/home-page.tsx`.
- Terms and privacy: `apps/api/src/site/legal-copy.ts` and `legal-copy-<language>.ts`; `{contactEmail}` is filled at render.
- Site FAQ: `apps/api/src/site/site-copy*.ts` keys `FaqDeleteQuestion` and `FaqDeleteAnswer`, listed in `apps/api/src/site/faq-items.ts`.
- Docs: `apps/docs/<folder>/help/delete-your-account.mdx` and `apps/docs/<folder>/help/faq.mdx`, ten folders.
- Support contact: `COMPANY.contactEmail` in `libs/types/src/constants.ts`. No WhatsApp support channel exists in the repository.

## Acceptance

- Each surface above carries the notice in all ten languages, and the tests in the test plan pass.
- The notice names the subscription as "zapbip Cloud" and the support address, never a dead link.
- The docs delete page has a "subscription" section and its chat example says the same.
