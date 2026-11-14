# Plan — sign-in polish

Every step is ticked only with evidence in the test plan.

- [x] 1. Remove `SignInLead` from the keys, `BACKOFFICE_COPY` (en_US, pt_BR) and the eight other `backoffice-copy-*` files; drop it from the sign-in views and unit tests.
- [x] 2. Backoffice sign-in: `hero-card` treatment and full-width button in `backoffice.css`, with the reduced-motion guard.
- [x] 3. Client-app continue page: `panel-hero` class and styles in `client-app.css`.
- [x] 4. Prefill: `value.replaceAll(' ', '+')` before `normalizeEmail` in `render-landing.tsx`; integration test for `maria+news@example.com`.
- [x] 5. Agent-facing copy: `%2B` sentence in `AgentsBody` for ten languages and in the `help_join` skill.
- [x] 6. Join form: wait for the Turnstile token on click (`passCheck`, `failCheck`, `TURNSTILE_WAIT_MS`), with an e2e test for the wait and one for the failure.

## Failure modes

| Step | What breaks | Signal | Back out |
|---|---|---|---|
| 1 | A language still renders the removed key | `backoffice-copy` unit test | restore the line in that language |
| 2, 3 | Card overflows at 375 px | screenshot at 375 px | revert the CSS block |
| 4 | A real `+` typed by a person becomes a space | integration test | revert `replaceAll` |
| 6 | Waiting never ends | e2e failure after the timer | the timer ends it; revert the submit branch |
