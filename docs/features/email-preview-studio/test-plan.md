# Test plan: Email preview studio

## Unit

- [x] Every `welcome-*` preview renders the same HTML as `WELCOME_EMAILS` of its locale, one per `OwnerLocale` — evidence: `email-previews.test.ts` 2 passed (a pin: the previews landed with their test)
- [x] The digest preview renders the generated shell — evidence: same file

## Manual

- [x] `pnpm emails:preview` serves `http://localhost:3100/preview/subscriber-digest` with status 200 — evidence: `curl` printed 200
- [x] The Arabic welcome opens right to left in the studio — evidence: the preview frame reported `dir="rtl"` and Arabic text
