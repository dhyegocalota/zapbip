# Test plan: Meta onboarding

One tester pass, by the owner's order ("não faça tantos gates e verificações"). Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/integration/migration-0008.test.ts::copies a fixed-app number and drops meta_apps`. Input: `0001` to `0007` applied, one `meta_apps` row `714836811568009` and one number. Expected: the number row stays without `meta_app_ref`, and `meta_apps` is gone.
- [ ] `apps/api/test/integration/backoffice-meta-onboarding.test.ts::stores a pending number from the signup code`. Input: a granted session, and a post with `signupCode=c`, `phoneNumberId=1000000000000001`, `wabaId=3000000000000003`, `label=Main`, `pin=123456`. Expected: one `pending` row, and its token opens to `fake-business-token`.
- [ ] Confirmed both fail for the right reason. Record the red output: the missing migration file, and `404` on `/numbers/connect/meta`, not a broken fixture.

## Integration (Workers pool, FakeGraph)

- [ ] Migration with a foreign app. Input: a `meta_apps` row `999`. Expected: the migration throws on the guard's `CHECK`, and `meta_apps`, `whatsapp_numbers` and `meta_app_ref` are unchanged.
- [ ] Migration grant column. Expected: `backoffice_sessions.onboarding_grant_until` exists, is nullable, and `whatsapp_numbers_waba` exists.
- [ ] Webhook with the fixed secret. Input: a known phone number ID, signed with `META_APP_SECRET`. Expected: `200`. The same body signed with another secret: `401` with `UNAUTHORIZED_BODY`.
- [ ] Unattributed webhook. Input: an unknown ID. Expected: `401`, and one placeholder check, as today.
- [ ] Onboarding happy path, requests in order. Expected FakeGraph log:
  1. `POST /v24.0/oauth/access_token`, form body `client_id=714836811568009&client_secret=<META_APP_SECRET>&code=c`, no `Authorization` header;
  2. `POST /v24.0/3000000000000003/subscribed_apps`, body `override_callback_uri=<PUBLIC_ORIGIN>/webhooks/whatsapp` and `verify_token=<WHATSAPP_VERIFY_TOKEN>`, `Bearer fake-business-token`;
  3. `POST /v24.0/1000000000000001/register`, body `{ messaging_product: 'whatsapp', pin: '123456' }`;
  4. `GET /v24.0/3000000000000003/phone_numbers`.
- [ ] Each step fails. Input: FakeGraph `401` queued on step 1, then 2, 3 and 4, in four runs. Expected: a `303` to `/numbers/connect`, then a `502` page naming that step and `auth`; zero numbers stored; one `backoffice.onboarding_failed` operator line with the step and kind only.
- [ ] Network failure on the exchange. Input: FakeGraph closed. Expected: step `exchange`, kind `network`.
- [ ] Phone number ID not in the WABA list. Expected: step `read`, kind `not_found`, nothing stored.
- [ ] Grant is single use. Input: the happy post twice. Expected: the second post answers `303` to `/numbers/connect` with the `401` flash, and FakeGraph records no fifth request.
- [ ] No grant. Input: a post with valid fields and a session that never stepped up. Expected: `303` to `/numbers/connect`, zero Graph requests.
- [ ] Expired grant. Input: `onboarding_grant_until` one millisecond in the past. Expected: as no grant.
- [ ] Rejected fields. Input: PIN `12345`, then `abcdef`, then a label of 61 characters, then `wabaId=12a`. Expected: a `422` flash with that field's error, zero Graph requests.
- [ ] Duplicate. Input: the phone number ID already registered. Expected: a `409` flash with the duplicate error on the phone number ID, zero Graph requests.
- [ ] Step-up. Input: `POST /numbers/connect` with a used code. Expected: the `401` flash with "Code not accepted", and no grant set. Six posts in a minute: `429` with `Retry-After`.
- [ ] CSRF. Input: `POST /numbers/connect/meta` without `Origin`, or with a wrong token. Expected: `403`, and the grant is not consumed.
- [ ] Nothing secret escapes. Input: the happy path and each failure above. Expected: no captured log line, flash row, response body or `Location` header contains `c`, `123456`, `fake-business-token` or `META_APP_SECRET`'s value (grep of the captured output, count 0).
- [ ] Removed routes. Expected: `GET /numbers/new` answers `404`, and so does `POST /meta-apps/app_1/app-secret`.
- [ ] Headers. Expected:
  - `GET /numbers/connect/meta` with a grant answers the ADR 0037 policy exactly, and `Cross-Origin-Opener-Policy: same-origin-allow-popups`;
  - `/numbers/connect`, `/numbers`, `/numbers/<id>`, `/sign-in`, a `404` and a `500` answer `CONTENT_SECURITY_POLICY` and `same-origin` byte for byte.

## Unit

- [ ] The onboarding form parse. Input: valid fields, then each invalid field alone. Expected: a valid request, then exactly that field's copy key.
- [ ] The page policy record. Expected: `Strict` equals today's `STATIC_SECURITY_HEADERS`; `EmbeddedSignup` differs only in `Content-Security-Policy` and `Cross-Origin-Opener-Policy`.
- [ ] The display number from Graph. Input: `+55 11 90000-0001`. Expected: `+5511900000001`. Input: `abc`. Expected: `OnboardingError(Read, Upstream)`.

## E2E (Playwright, backoffice, SDK stubbed)

- [ ] `meta-onboarding.spec.ts::connects a number`. Steps: sign in; Numbers; Connect a WhatsApp number; type a code; Continue; type label `Main` and PIN `123456`; Connect. Expected: the number page shows Pending, `+5511900000001`, "Number registered. Verify it before activating.", and no token or PIN anywhere on the page.
- [ ] `::cancel stays on the page`. Steps: the stub posts `CANCEL`. Expected: the cancel status line, no navigation, no post in the network log.
- [ ] `::ignores a foreign origin`. Steps: a frame from `https://evil.example` posts `FINISH`, and the callback carries a code. Expected: no post.
- [ ] `::no grant`. Steps: open `/numbers/connect/meta` directly after sign-in. Expected: lands on `/numbers/connect`.
- [ ] `::console clean`. Expected: zero console errors and zero `securitypolicyviolation` events on the happy path.

## Prove it for real — Playwright MCP

- [ ] Happy path at 1280 wide, with the stub of step 7 installed through `browser_run_code_unsafe`. Expected: as the first E2E case, and the verify → active flow still works on the new number.
- [ ] Narrow width, 375. Expected: the label and PIN fields and the Connect button fit with no horizontal scroll.
- [ ] Reload `/numbers/connect/meta` mid-flow before Connect. Expected: the page reloads with the grant still live, and the label and PIN are empty.
- [ ] Browser Back after the number page. Expected: `/numbers/connect/meta` redirects to `/numbers/connect`, because the grant is spent.
- [ ] Screenshots at `.pr-media/meta-onboarding/`; video of the happy path.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: the token, the code and the PIN never leave the Worker. Attack: read every `logEvent`/`logOperatorEvent` call, flash write and error message on the path. Result: <refuted | held>
- [ ] Claim 2: every page but `/numbers/connect/meta` keeps the strict policy. Attack: find a response path (error handler, `notFound`, asset route, redirect) that skips the default kind. Result: <refuted | held>
- [ ] Claim 3: migration `0008` is safe on any data. Attack: run it on a copy holding a foreign app, a fixed-app number with bound accounts, and `activity_daily` rows. Result: <refuted | held>

## Coverage honesty

- The real Facebook SDK, the popup and Meta's Graph calls are not exercised by any automated test. The owner's first connect on staging proves the allowlist, the form `POST` exchange, the override handshake and the register call. Its result is recorded here.
- The per-WABA webhook override is asserted only as a request body. That Meta routes a staging WABA to staging is proven by the owner's first staging message.
- Token expiry depends on the configuration's "Never" setting, which no test reads.
