# Sign-in polish

**Status:** Shipped 2026-11-14
**Tier:** 🟢 small
**Owner approval:** the owner's order in pt-BR, 2026-11-14: remove the "password first, then code" sentence from the backoffice sign-in, make the backoffice and client-app sign-in pages look better, make `/?email=a+b@gmail.com` prefill, and make the first click on the landing join form work while Turnstile loads.
**ADRs:** none; no decision here changes an interface, a dependency, the backoffice CSP or the site CSP.
**Not changing:** routes, forms, POST, 303, GET flows, fonts, the backoffice password, the credentials file, the deploy, the site FAQ copy.

## Problem

1. The backoffice sign-in carries a sentence that explains the two steps ("password first, then code"). The owner wants it gone in every language.
2. The backoffice sign-in card and the client-app continue card read as a default form. They should match the site's tokens and the existing hero treatment.
3. `/?email=a+b@gmail.com` loses the `+`: a literal `+` in a query string arrives as a space, so the form prefills an invalid address.
4. The first click on the landing join form shows the captcha error while Turnstile is still loading.

## Change

- Copy: `SignInLead` is removed from the keys and from all ten `backoffice-copy-*` languages. No other key changes.
- Label spacing: every backoffice label (`.field label`) and the client-app connect label (`.connect-form label`) leave a `space-2` gap above its input, pinned by unit tests.
- Backoffice sign-in: the card takes the existing `hero-card` treatment with a larger padding, a full-width primary button and a tap-height input, animated only under `prefers-reduced-motion: no-preference`.
- Client app continue page: the card takes `panel-hero` (a centred, gradient-bordered panel with a full-width button), animated the same way.
- Prefill: a space in the `email` query value is read as `+`, so `a+b@gmail.com` arrives intact. Agent-facing text (the home twin, `llms` copy in every language and the `help_join` skill) tells agents to write a plus sign as `%2B`.
- Join form: a click without a token starts waiting, shows the busy state and sends the form by itself when the check passes. A failed check, or no check within 15 seconds, shows the captcha notice.

## Non-goals

- New copy keys, new routes, a new Turnstile mode, a change to the join API.

## Data flow

Click → the submit handler sees no token → busy state, timer → Turnstile callback `zapbipCheckPassed` → `requestSubmit` → the normal submit path. Failure callback `zapbipCheckFailed` or the timer → captcha notice.

## Failure handling

- Second click while waiting: ignored (`preventDefault`).
- Turnstile never loads: the timer shows the notice after `TURNSTILE_WAIT_MS`.
- Email with a real space after decoding: `normalizeEmail` still refuses it and the field stays empty.
