# Test plan: Backoffice

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/unit/backoffice-totp.test.ts::accepts the RFC 6238 code at time 59` — input: secret ASCII `12345678901234567890`, time 59 s; expected: `287082`
- [ ] `apps/api/test/integration/backoffice-host.test.ts::the MCP host does not serve the sign-in page` — input: `GET http://localhost/sign-in`; expected: `404`
- [ ] `apps/api/test/integration/whatsapp-webhook-numbers.test.ts::a delivery signed with another number's app secret is refused` — input: metadata of A, signed with B's secret; expected: `401 { "error": "unauthorized" }`
- [ ] Confirmed each fails for the right reason: the recorded failure text is `createBackofficeApp is not implemented`, `expected 200 to be 404` (or the actual text printed), and `expected 200 to be 401` from the unchanged single-secret path. The texts actually printed go in `tester-briefing.md`.

## Unit

TOTP (`backoffice-totp.test.ts`), RFC 6238 Appendix B SHA-1 vectors truncated to the last 6 digits:
- [ ] T = 59 → `287082`
- [ ] T = 1111111109 → `081804`
- [ ] T = 1111111111 → `050471`
- [ ] T = 1234567890 → `005924`
- [ ] T = 2000000000 → `279037`
- [ ] T = 20000000000 → `353130`
- [ ] Edge: code for step `current - 1` → accepted, returns `current - 1`; step `current + 1` → accepted; step `current - 2` → `null`
- [ ] Edge: step equal to `lastStep` → `null`; step below `lastStep` → `null`
- [ ] Edge: `"12345"`, `"1234567"`, `"12a456"`, `""` → `null`, with no exception

Auth helpers:
- [ ] Key compare: the right key → `true`; the right key plus one trailing character → `false`; an empty string → `false`; the compare runs over equal-length digests (the test asserts both sides are 32 bytes)
- [ ] CSRF token: the same session token → the same value; another session token → a different value; a token of one session refused by another session's check

Security headers:
- [ ] `security-headers` attaches the exact ten headers of the spec; the CSP string equals the spec byte for byte

Routing peek (`webhook-routing-peek.test.ts`):
- [ ] Every file in `apps/api/test/fixtures/whatsapp/inbound/*.json` and `apps/api/test/fixtures/whatsapp/status/*.json` is a bare message or status object, so each is wrapped first with `notificationWith({ messages: [fixture] })` or `notificationWith({ statuses: [fixture] })` (`test/fixtures/whatsapp/inbound/notification.ts`, `entry.id` `3000000000000003`) → `{ phoneNumberIds: ["1000000000000001"], wabaIds: [] }`
- [ ] A template-status payload with `entry[0].id = "WABA_A"` and no metadata → `{ phoneNumberIds: [], wabaIds: ["WABA_A"] }`
- [ ] Edge: `"{"` → `null`; `{}` → `null`; `{ "entry": [] }` → `null`
- [ ] Edge: a 2-change payload for two numbers → both IDs, deduplicated

Number states (`number-state.test.ts`):
- [ ] Every allowed transition passes; every other pair throws `transition <from> → <to> is not allowed`
- [ ] `pending → active` with `verifiedAt: null` throws `number is not verified`

Secret box (`aes-gcm-secret-box.test.ts`):
- [ ] Round trip opens to the plaintext; associated data `whatsapp_numbers:A:access_token` sealed and opened with `whatsapp_numbers:B:access_token` → `null`
- [ ] Version byte `2` → `null`; a 31-byte key with `keyName` `NUMBER_REGISTRY_KEY` → error `NUMBER_REGISTRY_KEY must be 32 bytes encoded in base64`
- [ ] The same 31-byte key through the wake box (`keyName` `WAKE_SECRET_KEY`) → the error names `WAKE_SECRET_KEY`
- [ ] Pin: `aes-gcm-wake-secret-box.test.ts` unchanged and green after the extraction, still expecting `WAKE_SECRET_KEY`

Graph error kinds (`graph-request-error-kind.test.ts`):
- [ ] Status `401` → `auth`; `403` → `auth`; `404` → `not_found`; `0` → `network`; `400`, `429`, `500`, `502` → `upstream`

Terminal QR (`operator-enrollment-qr.test.ts`):
- [ ] `renderTerminalQr` of an `otpauth://` URI → multi-line text, every line the same width, three finder patterns; `uqr` is in `apps/api/package.json` `devDependencies` with an exact version and `pnpm install --frozen-lockfile` is green

Enrollment script (`operator-enrollment-entry.test.ts`, fake shell and prompt):
- [ ] stdin not a TTY → exit 1, message `backoffice:enroll needs an interactive terminal`, zero shell calls
- [ ] Production, the owner types `prod` (not `production`) → exit 1, zero shell calls
- [ ] The owner types a wrong code → exit 1, zero `secret put`, zero `d1 execute`
- [ ] Success → exactly two `wrangler secret put` calls (`BACKOFFICE_KEY_DIGEST`, `BACKOFFICE_TOTP_SECRET`) whose argv has no value, with the values on stdin; one `d1 execute --remote` whose statement equals the fixed reset statement
- [ ] Output contains the key exactly once and the `otpauth://` URI once, never the digest; after Enter the output ends with `\x1b[2J\x1b[3J\x1b[H`
- [ ] Development prints `BACKOFFICE_KEY_DIGEST=` and `BACKOFFICE_TOTP_SECRET=` lines and calls `d1 execute --local`, never `secret put`

Hooks (`.agents/hooks/hooks.test.sh`):
- [ ] `pnpm backoffice:enroll:production` → blocked, exit 2; `pnpm backoffice:enroll:development` → blocked (colon form)
- [ ] `node --import tsx apps/api/scripts/backoffice-enroll.ts` → blocked (hyphen form), matched by `backoffice[:-]enroll` in `guard-deploy.sh`
- [ ] The sample secret in the blocked-forms list is `NUMBER_REGISTRY_KEY`, not a removed name

Copy:
- [ ] `BACKOFFICE_COPY` has every `BackofficeCopyKey` in `pt_BR` and `en_US`, none empty; `WHATSAPP_COPY` has `AccountOnOtherNumber` and `NumberClosedToNewAccounts` in both locales
- [ ] A source scan finds no string-literal JSX child under `apps/api/src/backoffice/**/*.tsx`

Design rules (`backoffice-design-rules.test.ts`):
- [ ] A source scan finds no `style=` attribute and no `<style>` or `<script>` in any view
- [ ] Every rendered page has exactly one `h1`, a skip link as the first focusable element, and a label for every input
- [ ] `backoffice.css` has no raw colour outside the `:root` token blocks
- [ ] Every text token pair of `design.md` §2.1 has contrast at least 4.5:1 and every non-text pair at least 3:1, in light and dark

Repository shape (`tools/repository-shape`):
- [ ] The isolation test: no file under `apps/api/src/mcp`, `routes`, `account-inbox`, `apps/connector` or `libs/` imports `apps/api/src/backoffice` or names a `backoffice_` table; `index.ts`, `index.dev.ts` and `scripts/backoffice-enroll.ts` are not scanned
- [ ] `runbooks.test.ts`: `GO_LIVE_ORDER` places secrets before migrate, migrate before enroll, enroll before deploy, deploy before register number, and smoke last; `docs/runbooks/README.md` stays at 20 lines or fewer
- [ ] `git grep -nwE "META_APP_SECRET|WHATSAPP_ACCESS_TOKEN|WHATSAPP_PHONE_NUMBER_ID" apps libs .agents scripts tools` lists nothing

## Integration (Workers pool: workerd, D1, Durable Objects)

Host isolation (`backoffice-host.test.ts`):
- [ ] The backoffice host: `GET /c/<valid secret>/mcp` → `404`; `POST /webhooks/whatsapp` (validly signed) → `404`; `GET /health` → `404`; `GET /i/<code>` → `404`
- [ ] The MCP host: `GET /sign-in`, `GET /numbers`, `GET /metrics`, `GET /assets/backoffice.css` → `404`
- [ ] Host `BACKOFFICE.LOCALHOST:8787` → served as the backoffice (hosts are case-insensitive); host `backoffice.localhost:8788` → the MCP app (`404` on `/sign-in`)
- [ ] Host `backoffice.localhost.:8787` (trailing dot) → `404` on `/sign-in` and on `/health`, with the backoffice headers

Headers (`backoffice-headers.test.ts`):
- [ ] All ten headers present on `GET /sign-in` (200), `POST /sign-in` success (303), failure (401), CSRF failure (403), `GET /nope` (404), the rate limit (429), and a route forced to throw (500)
- [ ] The 500 body is the generic copy; the log line is `{"event":"backoffice.error","errorCode":"Error"}` with no message or stack

Sign-in (`backoffice-auth.test.ts`):
- [ ] The right key and code → `303 Location: /`; `Set-Cookie` holds `__Host-zb_bo_session=`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` and no `Domain`; one `backoffice_sessions` row whose `token_digest` ≠ the cookie value
- [ ] The wrong key with the right code, the right key with the wrong code, and both wrong → each `401`, the bodies identical byte for byte, `failed_attempts` 1, 2, 3
- [ ] The same valid code twice in one step → the first `303`, the second `401`
- [ ] Two concurrent POSTs with one valid code → exactly one `303`
- [ ] 9 failures → `locked_until` `NULL`; the 10th failure → `locked_until = now + 15 min` exactly, one audit row `sign_in.locked`
- [ ] The 11th attempt with correct factors → `401`, `failed_attempts` unchanged, still one `sign_in.locked` row
- [ ] The fake clock +15 min + 1 s: a wrong attempt → `failed_attempts` 1; a correct attempt → `303` and `failed_attempts` 0
- [ ] 5 failures then a success → `failed_attempts` 0
- [ ] 5 concurrent failures → `failed_attempts` 5
- [ ] The rate limiter refuses → `429`, `Retry-After: 60`, zero D1 writes (row counts unchanged)
- [ ] `BACKOFFICE_TOTP_SECRET` unset in a test env → `GET /sign-in` `503`, no exception leaks

CSRF (`backoffice-csrf.test.ts`):
- [ ] `POST /sign-out` without `Origin` → `403`, session still valid
- [ ] `POST /numbers/new` with `Origin: https://evil.example` and a valid token → `403`, no row
- [ ] A valid `Origin` and session A, with session B's `csrf` → `403`
- [ ] `POST /sign-in` whose `csrf` field differs from the `__Host-zb_bo_csrf` cookie → `403`, `failed_attempts` unchanged

Sessions:
- [ ] Idle 31 min → `GET /numbers` → `303 /sign-in`; age 8 h 1 min with activity every 10 min → `303 /sign-in`
- [ ] Sign-out → the row is gone; replaying the old cookie → `303 /sign-in`
- [ ] Ten requests within one minute → `last_seen_at` written once

Step-up:
- [ ] `POST /numbers/:id/state` with a valid session and CSRF but no `code` → `401`, state unchanged; with a code already used at sign-in → `401`
- [ ] A wrong step-up code → `401`, `failed_attempts` + 1, one audit row `step_up.failed`
- [ ] 10 wrong step-up codes → `locked_until` set, one `sign_in.locked`; then a correct step-up code → `401` and not consumed; a sign-in with correct factors → `401`
- [ ] A successful step-up → `failed_attempts` 0
- [ ] The rate limiter refusing the `step-up:` key → `429`, `Retry-After: 60`, the code not consumed, zero D1 writes

Audit page and stylesheet:
- [ ] 250 audit rows seeded → `GET /audit` shows exactly 200, newest first; without a session → `303 /sign-in`
- [ ] `GET /assets/backoffice.css` without a session → `200`, `text/css; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`, the other nine headers present; no `@import`, no `url(` to another origin, no `data:`; the page links it with `?v=<hash>`

Open redirect:
- [ ] `POST /locale` `returnTo` `/numbers`, `/metrics`, `/audit` → `303` to the same path; `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)`, `/numbers/../x`, empty → `303 /`
- [ ] `?notice=SignedOut` renders its notice; `?notice=<script>alert(1)</script>` and an unknown value render nothing and reflect nothing

Audit and prune:
- [ ] Each `BackofficeAuditAction` produces exactly one row; no row column contains the test key, code, access token or app secret (a substring search over every column)
- [ ] The scheduled tick deletes sessions past `expires_at` and audit rows older than 365 days; younger ones remain

Registry and channel (`number-registry.test.ts`, `whatsapp-webhook-numbers.test.ts`, `whatsapp-outbound.test.ts`):
- [ ] Register app X (secret `sx`) and number A (token `ta`): the D1 columns contain neither `sx` nor `ta`; `openForInbound` returns `ta`
- [ ] Copy A's `sealed_access_token` into number B's row → `openForInbound(B)` throws an error containing B's internal ID and not the token
- [ ] Webhook signed with X's secret for A → `200`; the owner message lands in A's account inbox
- [ ] Metadata of A signed with Y's secret → `401`
- [ ] Unknown `phone_number_id` → `401`, body identical to the bad-signature body; operator event `inbound.unattributed`; this changes the existing `FOREIGN_PHONE_NUMBER_ID` tests in `whatsapp-webhook.test.ts` from `200` to `401`, listed in the briefing
- [ ] Changes for A (app X) and B (app Y) in one delivery → `401`
- [ ] Template-status change by WABA of A, signed with X → `200`, `notification.ignored_field`
- [ ] Invalid JSON → `401` (was `400`; the changed expectation in `whatsapp-webhook.test.ts` is listed in the briefing)
- [ ] Number `pending` → `200`, nothing stored, `inbound.number_pending`; `disabled` → `200`, `inbound.number_disabled`
- [ ] `closed` + new wa_id → no `accounts` row; the fake Graph receives one text with `NumberClosedToNewAccounts` in the sender's locale, from `/<A phone_number_id>/messages`
- [ ] New wa_id on active A → `accounts.number_id = A`; killing the directory write in the same batch → no account row
- [ ] Owner of an account on A writes to B → no message in any inbox; the fake Graph receives `AccountOnOtherNumber` with A's display number from `/<B phone_number_id>/messages`
- [ ] Account on A sends text → the fake Graph sees path `/<A phone_number_id>/messages` and `Authorization: Bearer ta`
- [ ] Rotate A's token to `ta2` between two sends → the second request carries `Bearer ta2`
- [ ] A `disabled` → the agent's `send_text` returns the restricted-channel error; log `channel.number_unavailable`
- [ ] Graph error `131048` on A → the `channel_restrictions` row keyed by A's `phone_number_id`; B still sends
- [ ] Inbound image on B → the media download request carries B's token
- [ ] Two accounts with `number_id NULL`, register the first number → both bound; register a second → nothing changes

Backoffice numbers pages (`backoffice-numbers.test.ts`):
- [ ] `/numbers` empty → the empty-state copy and a register link; one number → one row; three → three rows sorted by label
- [ ] Register → `303` to `/numbers/:id`; the page and every response body contain neither the token nor the app secret
- [ ] Verify with the fake Graph returning the matching display number → `POST /numbers/:id/verify` answers `303` to `/numbers/:id/verification`; the GET `200` shows the four template rows with their statuses; `verified_at` set
- [ ] `whatsapp-webhook-numbers.test.ts` (pin): a `NUMBER_REGISTRY_KEY` that does not open the sealed values, or a missing one → the webhook answers `500` and stores nothing
- [ ] `number-credentials-changed.test.ts`: `credentials_changed_at` equals the registration time, does not move on a state change (only `updated_at` does) and moves when the access token is replaced
- [ ] `backoffice-numbers.test.ts`: a wrong step-up code on the state form → `401` and the chosen radio is still checked
- [ ] Reloading `/numbers/:id/verification` → `200` with the same body (no POST repeated)
- [ ] Verify with a mismatched display number → copy `display_number_mismatch`, `verified_at` null
- [ ] Verify with fake Graph `401` → copy for kind `auth`; `404` → `not_found`; `500` → `upstream`; with a closed port → kind `network`

Metrics (PR B: `activity-in-object.test.ts`, `activity-flush.test.ts`, `backoffice-metrics.test.ts`):
- [ ] Each `ActivityMetric` increments by exactly one on its event; a duplicate inbound adds zero
- [ ] Flush after 1 h → the `activity_daily` row equals the meter, with `number_id` equal to the account's number; a second flush leaves the same count
- [ ] Seeded data → every figure equals its definition (accounts 2/3/1/1 by state, agents active 4, connected 3, revoked 2, budget 79 % without the warning class, 81 % with it)
- [ ] An empty database → the zero state on every tile, no error
- [ ] Each metrics page makes exactly one `batch` call
- [ ] Every statement prepared by a metrics page begins with `SELECT`; `POST`, `PUT`, `PATCH` and `DELETE` on `/metrics` → `404`

Logs (`backoffice-logs-redaction.test.ts`):
- [ ] Across a full run (enroll values, sign-in success and failure, register, verify, rotate, webhook for A and B, sends), the captured `console.log` output contains none of: the test key, its digest, the TOTP secret, any code typed, `ta`, `ta2`, `sx`, the display numbers, the phone number IDs, the WABA IDs, any client address

## E2E (Playwright specs, `apps/api/e2e/backoffice/`)

- [ ] `sign-in.spec.ts::signs in and out` — steps: open `/`, redirected to `/sign-in`, type the test key and the code computed from the test secret, submit, see the home heading, sign out; expected: back on `/sign-in` with the signed-out copy
- [ ] `error-pages.spec.ts::shows the unauthorized page for a post without a session` — steps: sign in, remove the session row, press sign out; expected: `401 Sua sessão terminou` page. The 500 page stays covered by integration (`backoffice-headers.test.ts`), not by the walk
- [ ] `sign-in.spec.ts::wrong code` — expected: the generic failure copy, the key field empty, still on `/sign-in`
- [ ] `numbers.spec.ts::registers, verifies and activates a number` — steps: register app and number, verify, activate with a code; expected: the state badge `active`, template rows visible, no credential text anywhere in the DOM
- [ ] `numbers.spec.ts::rotates the access token` — expected: "last changed" updates; the token is never shown
- [ ] `metrics.spec.ts::shows seeded metrics and filters by number` (PR B) — expected: the figures match the seed; the filter narrows to one number
- [ ] Existing `whatsapp-channel.e2e.test.ts`, `whatsapp-bundle.e2e.test.ts` and `owner-flow.e2e.test.ts` pass with a seeded registry row

## Prove it for real — Playwright MCP

- [ ] Happy path, entry to exit: `http://backoffice.localhost:<port>/` → sign-in → home → numbers (empty) → register app and number → verify → activate → metrics → audit (rows for each act) → sign out; expected: the copy from `design.md` at each step, `pt_BR` by default
- [ ] Empty: no numbers, no accounts; expected: the empty states on numbers and metrics
- [ ] Single: one number, one account; expected: one row, metrics with one number in the filter
- [ ] Many: 3 numbers, 40 accounts, 120 agents seeded; expected: the tables fit, charts render, no horizontal scroll at 1280
- [ ] Rejected input: register with display number `abc`; expected: field error copy, nothing saved; a wrong code on step-up → error, state unchanged
- [ ] Browser Back mid-flow: after submitting register, press Back; expected: the form re-renders empty (no-store), no duplicate number on resubmit (`409` copy for the duplicate phone number ID)
- [ ] Reload mid-flow: reload after a failed sign-in; expected: no resubmission prompt (POST, redirect, GET), still on `/sign-in`
- [ ] Two browsers (`playwright` and `playwright-second`): the operator signed in on both; sign out on one; expected: the other stays signed in (independent sessions); re-enrollment drops both
- [ ] Locale switch to `en_US`; expected: all copy English, persisted across pages
- [ ] Console and network clean: zero console errors, zero script requests (the CSP forbids them), zero failed requests other than the deliberate 401s
- [ ] Desktop width 1280×800; expected: the layout from `design.md`
- [ ] Narrow width 375×812; expected: the tables stack, forms usable, no clipped buttons
- [ ] Screenshots at `.pr-media/backoffice/`; video at `.pr-media/backoffice/walk.mp4`

## Security tests (explicit list)

- [ ] Cookie flags, the `__Host-` prefix, no `Domain` (integration)
- [ ] CSRF: missing or foreign Origin, cross-session token (integration)
- [ ] Clickjacking: `frame-ancestors 'none'` and `X-Frame-Options: DENY` on every status (integration)
- [ ] Enumeration: the sign-in failure body is identical for every wrong factor; the webhook body is identical for an unknown number and a bad signature (integration)
- [ ] Replay: the TOTP step and concurrent use (integration)
- [ ] Brute force: the rate limit plus lockout, on sign-in and on step-up (integration)
- [ ] Credential exposure: no token or app secret in any response body, log line or audit row (integration)
- [ ] Sealed-value swap across rows (integration)
- [ ] Open redirect: `returnTo` and `?notice=` allow-lists (integration)
- [ ] Host confusion: `Host` and `X-Forwarded-Host` spoofing; the dispatch uses the request URL host only, so `X-Forwarded-Host: backoffice.zapbip.com` on the MCP host → the MCP app (integration)
- [ ] Agents: the isolation test (repository shape) and the MCP host 404s (integration)
- [ ] Enrollment: argv carries no value, TTY required, the hook blocks agents (unit, hooks)
- [ ] HTML injection: a number label `<script>alert(1)</script>` renders escaped (integration on `/numbers`)

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: an unauthenticated webhook cannot learn which phone number IDs are registered — attack: time the `401` for unknown vs known-with-bad-signature (an app secret is opened only for known IDs); result: <refuted | held>
- [ ] Claim 2: a stolen session cookie cannot change the registry — attack: replay the cookie with a CSRF token scraped from a page, without a code; try the sign-in code within its step; result: <refuted | held>
- [ ] Claim 3: no backoffice code path is reachable from the MCP host — attack: path normalisation (`//sign-in`, `/%73ign-in`), a `Host` header with a trailing dot (`backoffice.zapbip.com.`), and an absolute-URI request line; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- Real Meta deliveries with several apps and WABAs — only the staging smoke test and the owner's go-live hit Meta; the fixtures are Meta's documented shapes. Risk: an undocumented shape is refused with `401` (Meta retries, nothing lost).
- Cloudflare custom-domain routing of `backoffice.zapbip.com` — verified by the owner's `dig` and smoke after deploy, never by agents (ADR 0027).
- Real-time phishing relay against TOTP — accepted residual risk, recorded in ADR 0031.
- Workers rate-limiter behaviour across locations — not reproducible locally; the D1 lockout is the tested bound.
- Free-plan CPU for the per-send AES open plus the D1 read — measured only on staging.
- Analytics Engine `WAKE_METRICS` reads — phase 2.
