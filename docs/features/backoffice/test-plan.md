# Test plan: Backoffice

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `apps/api/test/unit/backoffice-totp.test.ts::accepts the RFC 6238 code at time 59` — input: secret ASCII `12345678901234567890`, time 59 s; expected: `287082` — evidence: 31f4b2d red (16 failed: `totpCodeAt/encodeBase32/matchTotpStep is not implemented`), green at 2dfaf2da; tester-a.md
- [x] `apps/api/test/integration/backoffice-host.test.ts::the MCP host does not serve the sign-in page` — input: `GET http://localhost/sign-in`; expected: `404` — evidence: pin, green when it landed; red state needs pre-feature code and is not reproducible; tester-b.md
- [x] `apps/api/test/integration/whatsapp-webhook-numbers.test.ts::a delivery signed with another number's app secret is refused` — input: metadata of A, signed with B's secret; expected: `401 { "error": "unauthorized" }` — evidence: pin, green when it landed; red state needs the pre-feature single-secret path; tester-b.md (10/10)
- [x] Confirmed each fails for the right reason: the recorded failure text is `createBackofficeApp is not implemented`, `expected 200 to be 404` (or the actual text printed), and `expected 200 to be 401` from the unchanged single-secret path. The texts actually printed go in `tester-briefing.md`. — evidence: 31f4b2d, 50f9ff8, 8f7887f3 reproduced in tester-a.md; texts in `tester-briefing.md`

## Unit

TOTP (`backoffice-totp.test.ts`), RFC 6238 Appendix B SHA-1 vectors truncated to the last 6 digits:
- [x] T = 59 → `287082` — evidence: `backoffice-totp` 6/6, tester-a.md
- [x] T = 1111111109 → `081804` — evidence: `backoffice-totp` 6/6, tester-a.md
- [x] T = 1111111111 → `050471` — evidence: `backoffice-totp` 6/6, tester-a.md
- [x] T = 1234567890 → `005924` — evidence: `backoffice-totp` 6/6, tester-a.md
- [x] T = 2000000000 → `279037` — evidence: `backoffice-totp` 6/6, tester-a.md
- [x] T = 20000000000 → `353130` — evidence: `backoffice-totp` 6/6, tester-a.md
- [x] Edge: code for step `current - 1` → accepted, returns `current - 1`; step `current + 1` → accepted; step `current - 2` → `null` — evidence: `backoffice-totp`, tester-a.md
- [x] Edge: step equal to `lastStep` → `null`; step below `lastStep` → `null` — evidence: `backoffice-totp`, tester-a.md
- [x] Edge: `"12345"`, `"1234567"`, `"12a456"`, `""` → `null`, with no exception — evidence: `backoffice-totp`, tester-a.md

Auth helpers:
- [x] Key compare: the right key → `true`; the right key plus one trailing character → `false`; an empty string → `false`; the compare runs over equal-length digests (the test asserts both sides are 32 bytes) — evidence: `backoffice-auth-helpers` 7/7, tester-a.md
- [x] CSRF token: the same session token → the same value; another session token → a different value; a token of one session refused by another session's check — evidence: `backoffice-auth-helpers` 7/7, tester-a.md

Security headers:
- [x] `security-headers` attaches the exact ten headers of the spec; the CSP string equals the spec byte for byte — evidence: `backoffice-headers` 10/10, tester-a.md

Routing peek (`webhook-routing-peek.test.ts`):
- [x] Every file in `apps/api/test/fixtures/whatsapp/inbound/*.json` and `apps/api/test/fixtures/whatsapp/status/*.json` is a bare message or status object, so each is wrapped first with `notificationWith({ messages: [fixture] })` or `notificationWith({ statuses: [fixture] })` (`test/fixtures/whatsapp/inbound/notification.ts`, `entry.id` `3000000000000003`) → `{ phoneNumberIds: ["1000000000000001"], wabaIds: [] }` — evidence: `webhook-routing-peek` 33/33, tester-a.md
- [x] A template-status payload with `entry[0].id = "WABA_A"` and no metadata → `{ phoneNumberIds: [], wabaIds: ["WABA_A"] }` — evidence: `webhook-routing-peek` 33/33, tester-a.md
- [x] Edge: `"{"` → `null`; `{}` → `null`; `{ "entry": [] }` → `null` — evidence: `webhook-routing-peek` 33/33, tester-a.md
- [x] Edge: a 2-change payload for two numbers → both IDs, deduplicated — evidence: `webhook-routing-peek` 33/33, tester-a.md

Number states (`number-state.test.ts`):
- [x] Every allowed transition passes; every other pair throws `transition <from> → <to> is not allowed` — evidence: `number-state` 17/17, tester-a.md
- [x] `pending → active` with `verifiedAt: null` throws `number is not verified` — evidence: `number-state` 17/17, tester-a.md

Secret box (`aes-gcm-secret-box.test.ts`):
- [x] Round trip opens to the plaintext; associated data `whatsapp_numbers:A:access_token` sealed and opened with `whatsapp_numbers:B:access_token` → `null` — evidence: `aes-gcm-secret-box` 4/4, tester-a.md
- [x] Version byte `2` → `null`; a 31-byte key with `keyName` `NUMBER_REGISTRY_KEY` → error `NUMBER_REGISTRY_KEY must be 32 bytes encoded in base64` — evidence: `aes-gcm-secret-box` 4/4, tester-a.md
- [x] The same 31-byte key through the wake box (`keyName` `WAKE_SECRET_KEY`) → the error names `WAKE_SECRET_KEY` — evidence: `aes-gcm-secret-box` 4/4, tester-a.md
- [x] Pin: `aes-gcm-wake-secret-box.test.ts` unchanged and green after the extraction, still expecting `WAKE_SECRET_KEY` — evidence: `aes-gcm-wake-secret-box` 10/10 untouched, tester-a.md

Graph error kinds (`graph-request-error-kind.test.ts`):
- [x] Status `401` → `auth`; `403` → `auth`; `404` → `not_found`; `0` → `network`; `400`, `429`, `500`, `502` → `upstream` — evidence: graph error kinds 8/8, tester-a.md

Terminal QR (`operator-enrollment-qr.test.ts`):
- [x] `renderTerminalQr` of an `otpauth://` URI → multi-line text, every line the same width, three finder patterns; `uqr` is in `apps/api/package.json` `devDependencies` with an exact version and `pnpm install --frozen-lockfile` is green — evidence: qr 4/4, uqr 0.1.3, frozen-lockfile green, tester-a.md

Enrollment script (`operator-enrollment-entry.test.ts`, fake shell and prompt):
- [x] stdin not a TTY → exit 1, message `backoffice:enroll needs an interactive terminal`, zero shell calls — evidence: `operator-enrollment-entry` 8/8, tester-a.md
- [x] Production, the owner types `prod` (not `production`) → exit 1, zero shell calls — evidence: `operator-enrollment-entry` 8/8, tester-a.md
- [x] The owner types a wrong code → exit 1, zero `secret put`, zero `d1 execute` — evidence: `operator-enrollment-entry` 8/8, tester-a.md
- [x] Success → exactly two `wrangler secret put` calls (`BACKOFFICE_KEY_DIGEST`, `BACKOFFICE_TOTP_SECRET`) whose argv has no value, with the values on stdin; one `d1 execute --remote` whose statement equals the fixed reset statement — evidence: `operator-enrollment-entry` 8/8, tester-a.md
- [x] Output contains the key exactly once and the `otpauth://` URI once, never the digest; after Enter the output ends with `\x1b[2J\x1b[3J\x1b[H` — evidence: `operator-enrollment-entry` 8/8, tester-a.md
- [x] Development prints `BACKOFFICE_KEY_DIGEST=` and `BACKOFFICE_TOTP_SECRET=` lines and calls `d1 execute --local`, never `secret put` — evidence: `operator-enrollment-entry` 8/8, tester-a.md

Hooks (`.agents/hooks/hooks.test.sh`):
- [x] `pnpm backoffice:enroll:production` → blocked, exit 2; `pnpm backoffice:enroll:development` → blocked (colon form) — evidence: `hooks.test.sh` all checks passed, tester-a.md
- [x] `node --import tsx apps/api/scripts/backoffice-enroll.ts` → blocked (hyphen form), matched by `backoffice[:-]enroll` in `guard-deploy.sh` — evidence: `hooks.test.sh` all checks passed, tester-a.md; the glob form `backoffice-en?oll.ts` red 268cdcfa → green 49873caa
- [x] The sample secret in the blocked-forms list is `NUMBER_REGISTRY_KEY`, not a removed name — evidence: `hooks.test.sh` all checks passed, tester-a.md

Copy:
- [x] `BACKOFFICE_COPY` has every `BackofficeCopyKey` in `pt_BR` and `en_US`, none empty; `WHATSAPP_COPY` has `AccountOnOtherNumber` and `NumberClosedToNewAccounts` in both locales — evidence: `backoffice-copy` 15/15, tester-a.md
- [x] A source scan finds no string-literal JSX child under `apps/api/src/backoffice/**/*.tsx` — evidence: `backoffice-copy` 15/15, tester-a.md

Design rules (`backoffice-design-rules.test.ts`):
- [x] A source scan finds no `style=` attribute and no `<style>` or `<script>` in any view — evidence: `backoffice-design-rules` 13/13, tester-a.md
- [x] Every rendered page has exactly one `h1`, a skip link as the first focusable element, and a label for every input — evidence: `backoffice-design-rules` 13/13, tester-a.md
- [x] `backoffice.css` has no raw colour outside the `:root` token blocks — evidence: `backoffice-design-rules` 13/13, tester-a.md
- [x] Every text token pair of `design.md` §2.1 has contrast at least 4.5:1 and every non-text pair at least 3:1, in light and dark — evidence: `backoffice-design-rules` 13/13, tester-a.md

Repository shape (`tools/repository-shape`):
- [x] The isolation test: no file under `apps/api/src/mcp`, `routes`, `account-inbox`, `apps/connector` or `libs/` imports `apps/api/src/backoffice` or names a `backoffice_` table; `index.ts`, `index.dev.ts` and `scripts/backoffice-enroll.ts` are not scanned — evidence: repository-shape isolation 5/5, tester-a.md, tester-b.md
- [x] `runbooks.test.ts`: `GO_LIVE_ORDER` places secrets before migrate, migrate before enroll, enroll before deploy, deploy before register number, and smoke last; `docs/runbooks/README.md` stays at 20 lines or fewer — evidence: runbooks README 14 lines, tester-a.md
- [x] `git grep -nwE "META_APP_SECRET|WHATSAPP_ACCESS_TOKEN|WHATSAPP_PHONE_NUMBER_ID" apps libs .agents scripts tools` lists nothing — evidence: no matches, tester-a.md

## Integration (Workers pool: workerd, D1, Durable Objects)

Host isolation (`backoffice-host.test.ts`):
- [x] The backoffice host: `GET /c/<valid secret>/mcp` → `404`; `POST /webhooks/whatsapp` (validly signed) → `404`; `GET /health` → `404`; `GET /i/<code>` → `404` — evidence: `backoffice-host` 24/24, tester-b.md
- [x] The MCP host: `GET /sign-in`, `GET /numbers`, `GET /metrics`, `GET /assets/backoffice.css` → `404` — evidence: `backoffice-host` 24/24, tester-b.md
- [x] Host `BACKOFFICE.LOCALHOST:8787` → served as the backoffice (hosts are case-insensitive); host `backoffice.localhost:8788` → the MCP app (`404` on `/sign-in`) — evidence: `backoffice-host` 24/24, tester-b.md
- [x] Host `backoffice.localhost.:8787` (trailing dot) → `404` on `/sign-in` and on `/health`, with the backoffice headers — evidence: `backoffice-host` 24/24, tester-b.md; mutation 3 caught

Headers (`backoffice-headers.test.ts`):
- [x] All ten headers present on `GET /sign-in` (200), `POST /sign-in` success (303), failure (303 to `/sign-in?notice=SignInFailed`), CSRF failure (403), `GET /nope` (404), the rate limit (429), and a route forced to throw (500) — evidence: `backoffice-auth-headers` 3/3 and unit headers 10/10, tester-b.md, tester-a.md
- [x] The 500 body is the generic copy; the log line is `{"event":"backoffice.error","errorCode":"Error"}` with no message or stack — evidence: `backoffice-auth-headers` 3/3, tester-b.md

Sign-in (`backoffice-auth.test.ts`):
- [x] The right key and code → `303 Location: /`; `Set-Cookie` holds `__Host-zb_bo_session=`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` and no `Domain`; one `backoffice_sessions` row whose `token_digest` ≠ the cookie value — evidence: `backoffice-auth` 9/9 at c2ad76c4, tester-b.md, tester-delta.md
- [x] The wrong key with the right code, the right key with the wrong code, and both wrong → each `303` to `/sign-in?notice=SignInFailed`, the bodies identical byte for byte, `failed_attempts` 1 (only the right key with a wrong code counts; see step 41) — evidence: `backoffice-auth` at c2ad76c4, red 760841ef → green cb96679e (redirect) and de8dfe61 → 82f0a321 (count); tester-delta.md
- [x] The same valid code twice in one step → the first `303` to `/`, the second `303` to `/sign-in?notice=SignInFailed` — evidence: `backoffice-auth`, tester-b.md
- [x] Two concurrent POSTs with one valid code → exactly one `303` to `/` — evidence: `backoffice-auth`, tester-b.md
- [x] 9 failures of the right key with a wrong code → `locked_until` `NULL`; the 10th failure → `locked_until = now + 15 min` exactly, one audit row `sign_in.locked` — evidence: `backoffice-auth-lockout` 7/7 at c2ad76c4 (literals 9 and 10 pin 64d80c38), tester-b.md
- [x] The 11th attempt with correct factors → `303` to `/sign-in?notice=SignInFailed`, `failed_attempts` unchanged, still one `sign_in.locked` row — evidence: `backoffice-auth-lockout`, tester-b.md
- [x] The fake clock +15 min + 1 s: a wrong attempt → `failed_attempts` 1; a correct attempt → `303` and `failed_attempts` 0 — evidence: `backoffice-auth-lockout`, tester-b.md
- [x] 5 failures then a success → `failed_attempts` 0 — evidence: `backoffice-auth-lockout`, tester-b.md
- [x] 5 concurrent failures → `failed_attempts` 5 — evidence: `backoffice-auth-lockout`, tester-b.md
- [x] The rate limiter refuses → `429`, `Retry-After: 60`, zero D1 writes (row counts unchanged) — evidence: `backoffice-auth-rate-limit` 3/3, tester-b.md
- [x] `BACKOFFICE_TOTP_SECRET` unset in a test env → `GET /sign-in` `503`, no exception leaks — evidence: `backoffice-auth-error-pages` 8/8, tester-b.md

CSRF (`backoffice-csrf.test.ts`):
- [x] `POST /sign-out` without `Origin` → `403`, session still valid — evidence: `backoffice-auth-csrf` 6/6; mutation 1 caught, tester-b.md
- [x] `POST /numbers/new` with `Origin: https://evil.example` and a valid token → `403`, no row — evidence: `backoffice-auth-csrf` 6/6, tester-b.md
- [x] A valid `Origin` and session A, with session B's `csrf` → `403` — evidence: `backoffice-auth-csrf` 6/6, tester-b.md
- [x] `POST /sign-in` whose `csrf` field differs from the `__Host-zb_bo_csrf` cookie → `403`, `failed_attempts` unchanged — evidence: `backoffice-auth-csrf` 6/6, tester-b.md

Sessions:
- [x] Idle 31 min → `GET /numbers` → `303 /sign-in`; age 8 h 1 min with activity every 10 min → `303 /sign-in` — evidence: `backoffice-auth-sessions` 6/6, tester-b.md
- [x] Sign-out → the row is gone; replaying the old cookie → `303 /sign-in` — evidence: `backoffice-auth-sessions` 6/6, tester-b.md
- [x] Ten requests within one minute → `last_seen_at` written once — evidence: `backoffice-auth-sessions` 6/6, tester-b.md

Step-up:
- [x] `POST /numbers/:id/state` with a valid session and CSRF but no `code` → `401`, state unchanged; with a code already used at sign-in → `401` — evidence: `backoffice-auth-step-up` 6/6 and `backoffice-numbers` 28/28, tester-b.md
- [x] A wrong step-up code → `401`, `failed_attempts` + 1, one audit row `step_up.failed` — evidence: `backoffice-auth-step-up` 6/6; mutation 4 caught, tester-b.md
- [x] 10 wrong step-up codes → `locked_until` set, one `sign_in.locked`; then a correct step-up code → `401` and not consumed; a sign-in with correct factors → `303` to `/sign-in?notice=SignInFailed` — evidence: `backoffice-auth-step-up` 6/6, tester-b.md
- [x] A successful step-up → `failed_attempts` 0 — evidence: `backoffice-auth-step-up` 6/6, tester-b.md
- [x] The rate limiter refusing the `step-up:` key → `429`, `Retry-After: 60`, the code not consumed, zero D1 writes — evidence: `backoffice-auth-step-up` 6/6, tester-b.md

Audit page and stylesheet:
- [x] 250 audit rows seeded → `GET /audit` shows exactly 200, newest first; without a session → `303 /sign-in` — evidence: `backoffice-auth-audit-page` 4/4, tester-b.md
- [x] `GET /assets/backoffice.css` without a session → `200`, `text/css; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`, the other nine headers present; no `@import`, no `url(` to another origin, no `data:`; the page links it with `?v=<hash>` — evidence: `backoffice-auth-assets` 10/10 at c2ad76c4, tester-b.md

Open redirect:
- [x] `POST /locale` `returnTo` `/numbers`, `/metrics`, `/audit` → `303` to the same path; `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)`, `/numbers/../x`, empty → `303 /` — evidence: `backoffice-auth-redirects` 14/14, tester-b.md
- [x] `?notice=SignedOut` renders its notice; `?notice=<script>alert(1)</script>` and an unknown value render nothing and reflect nothing — evidence: `backoffice-auth-redirects` 14/14, tester-b.md

Audit and prune:
- [x] Each `BackofficeAuditAction` produces exactly one row; no row column contains the test key, code, access token or app secret (a substring search over every column) — evidence: `backoffice-auth-audit` 4/4, tester-b.md
- [x] The scheduled tick deletes sessions past `expires_at` and audit rows older than 365 days; younger ones remain — evidence: `backoffice-auth-audit` 4/4 (scheduled prune), tester-b.md

Registry and channel (`number-registry.test.ts`, `whatsapp-webhook-numbers.test.ts`, `whatsapp-outbound.test.ts`):
- [x] Register app X (secret `sx`) and number A (token `ta`): the D1 columns contain neither `sx` nor `ta`; `openForInbound` returns `ta` — evidence: `number-registry` 5/5, tester-b.md
- [x] Copy A's `sealed_access_token` into number B's row → `openForInbound(B)` throws an error containing B's internal ID and not the token — evidence: `number-registry` 5/5; sealed-value swap gives 500, tester-b.md, tester-c.md
- [x] Webhook signed with X's secret for A → `200`; the owner message lands in A's account inbox — evidence: `whatsapp-webhook-numbers` 12/12 at c2ad76c4, tester-b.md
- [x] Metadata of A signed with Y's secret → `401` — evidence: `whatsapp-webhook-numbers`, tester-b.md
- [x] Unknown `phone_number_id` → `401`, body identical to the bad-signature body; operator event `inbound.unattributed`; this changes the existing `FOREIGN_PHONE_NUMBER_ID` tests in `whatsapp-webhook.test.ts` from `200` to `401`, listed in the briefing — evidence: `whatsapp-webhook-numbers`, tester-b.md; no known ID still `401` after step 41, tester-delta.md
- [x] Changes for A (app X) and B (app Y) in one delivery → `401` — evidence: `whatsapp-webhook-numbers`, tester-b.md; tester-delta.md
- [x] Template-status change by WABA of A, signed with X → `200`, `notification.ignored_field` — evidence: `whatsapp-webhook-numbers`, tester-b.md
- [x] Invalid JSON → `401` (was `400`; the changed expectation in `whatsapp-webhook.test.ts` is listed in the briefing) — evidence: `whatsapp-webhook-numbers`, tester-b.md
- [x] Number `pending` → `200`, nothing stored, `inbound.number_pending`; `disabled` → `200`, `inbound.number_disabled` — evidence: `whatsapp-webhook-number-states` 3/3, tester-b.md
- [x] `closed` + new wa_id → no `accounts` row; the fake Graph receives one text with `NumberClosedToNewAccounts` in the sender's locale, from `/<A phone_number_id>/messages` — evidence: `whatsapp-webhook-number-states` 3/3 and `number-registry-state`, tester-b.md
- [x] New wa_id on active A → `accounts.number_id = A`; killing the directory write in the same batch → no account row — evidence: `whatsapp-webhook-account-binding` 5/5 at c2ad76c4, tester-b.md
- [x] Owner of an account on A writes to B → no message in any inbox; the fake Graph receives `AccountOnOtherNumber` with A's display number from `/<B phone_number_id>/messages` — evidence: `whatsapp-webhook-account-binding`, tester-b.md
- [x] Account on A sends text → the fake Graph sees path `/<A phone_number_id>/messages` and `Authorization: Bearer ta` — evidence: `number-outbound` 6/6, tester-b.md
- [x] Rotate A's token to `ta2` between two sends → the second request carries `Bearer ta2` — evidence: `number-outbound` 6/6, tester-b.md
- [x] A `disabled` → the agent's `send_text` returns the restricted-channel error; log `channel.number_unavailable` — evidence: `number-outbound` 6/6, tester-b.md
- [x] Graph error `131048` on A → the `channel_restrictions` row keyed by A's `phone_number_id`; B still sends — evidence: `whatsapp-outbound` 19/19, tester-b.md
- [x] Inbound image on B → the media download request carries B's token — evidence: `whatsapp-webhook-media-number` 1/1, tester-b.md
- [x] Two accounts with `number_id NULL`, register the first number → both bound; register a second → nothing changes — evidence: `number-registry-backfill` 2/2, tester-b.md

Backoffice numbers pages (`backoffice-numbers.test.ts`):
- [x] `/numbers` empty → the empty-state copy and a register link; one number → one row; three → three rows sorted by label — evidence: `backoffice-numbers` 28/28, tester-b.md
- [x] Register → `303` to `/numbers/:id`; the page and every response body contain neither the token nor the app secret — evidence: `backoffice-numbers` 28/28, tester-b.md
- [x] Verify with the fake Graph returning the matching display number → `POST /numbers/:id/verify` answers `303` to `/numbers/:id/verification`; the GET `200` shows the four template rows with their statuses; `verified_at` set — evidence: `backoffice-numbers-verify` 11/11, tester-b.md
- [x] `whatsapp-webhook-numbers.test.ts` (pin): a `NUMBER_REGISTRY_KEY` that does not open the sealed values, or a missing one → the webhook answers `500` and stores nothing — evidence: `whatsapp-webhook-numbers`, tester-b.md
- [x] `number-credentials-changed.test.ts`: `credentials_changed_at` equals the registration time, does not move on a state change (only `updated_at` does) and moves when the access token is replaced — evidence: `number-credentials-changed` 3/3, tester-b.md
- [x] `backoffice-numbers.test.ts`: a wrong step-up code on the state form → `303` to `/numbers/:id`, whose GET answers `401` with the chosen radio still checked — evidence: `backoffice-numbers` 28/28 at c2ad76c4 (follows the redirect), tester-b.md; red 760841ef → green cb96679e
- [x] Reloading `/numbers/:id/verification` → `200` with the same body (no POST repeated) — evidence: `backoffice-numbers-verify` 11/11, tester-b.md
- [x] Verify with a mismatched display number → copy `display_number_mismatch`, `verified_at` null — evidence: `backoffice-numbers-verify` 11/11, tester-b.md
- [x] Verify with fake Graph `401` → copy for kind `auth`; `404` → `not_found`; `500` → `upstream`; with a closed port → kind `network` — evidence: `backoffice-numbers-verify` 11/11, tester-b.md

Metrics (PR B: `activity-in-object.test.ts`, `activity-flush.test.ts`, `backoffice-metrics.test.ts`):
- [ ] Each `ActivityMetric` increments by exactly one on its event; a duplicate inbound adds zero — open, PR B (G4)
- [ ] Flush after 1 h → the `activity_daily` row equals the meter, with `number_id` equal to the account's number; a second flush leaves the same count — open, PR B (G4)
- [ ] Seeded data → every figure equals its definition (accounts 2/3/1/1 by state, agents active 4, connected 3, revoked 2, budget 79 % without the warning class, 81 % with it) — open, PR B (G4)
- [ ] An empty database → the zero state on every tile, no error — open, PR B (G4)
- [ ] Each metrics page makes exactly one `batch` call — open, PR B (G4)
- [ ] Every statement prepared by a metrics page begins with `SELECT`; `POST`, `PUT`, `PATCH` and `DELETE` on `/metrics` → `404` — open, PR B (G4)

Logs (`backoffice-logs-redaction.test.ts`):
- [x] Across a full run (enroll values, sign-in success and failure, register, verify, rotate, webhook for A and B, sends), the captured `console.log` output contains none of: the test key, its digest, the TOTP secret, any code typed, `ta`, `ta2`, `sx`, the display numbers, the phone number IDs, the WABA IDs, any client address — evidence: `backoffice-numbers-logs` 1/1; DB, audit and wrangler log grep clean, tester-b.md, tester-c.md

## E2E (Playwright specs, `apps/api/e2e/backoffice/`)

- [x] `sign-in.spec.ts::signs in and out` — steps: open `/`, redirected to `/sign-in`, type the test key and the code computed from the test secret, submit, see the home heading, sign out; expected: back on `/sign-in` with the signed-out copy — evidence: sign-in.spec.ts:13, desktop and mobile, walk 32/32 at c2ad76c4; tester-c.md, tester-b.md
- [x] `error-pages.spec.ts::shows the unauthorized page for a post without a session` — steps: sign in, remove the session row, press sign out; expected: `401 Sua sessão terminou` page. The 500 page stays covered by integration (`backoffice-headers.test.ts`), not by the walk — evidence: error-pages.spec.ts:44, walk 32/32; tester-c.md
- [x] `sign-in.spec.ts::wrong code` — expected: the generic failure copy, the key field empty, on `/sign-in?notice=SignInFailed` — evidence: sign-in.spec.ts:22, walk 32/32; tester-c.md
- [x] `numbers.spec.ts::registers, verifies and activates a number` — steps: register app and number, verify, activate with a code; expected: the state badge `active`, template rows visible, no credential text anywhere in the DOM — evidence: numbers.spec.ts:41, walk 32/32; tester-c.md
- [x] `numbers.spec.ts::rotates the access token` — expected: "last changed" updates; the token is never shown — evidence: numbers.spec.ts:74, walk 32/32; tester-c.md
- [ ] `metrics.spec.ts::shows seeded metrics and filters by number` (PR B) — expected: the figures match the seed; the filter narrows to one number — open, PR B (G4)
- [x] Existing `whatsapp-channel.e2e.test.ts`, `whatsapp-bundle.e2e.test.ts` and `owner-flow.e2e.test.ts` pass with a seeded registry row — evidence: `pnpm verify all` e2e gate green at c2ad76c4 (`scratchpad/verify-backoffice-fix2.log`), after tester-c.md did not run it

## Prove it for real — Playwright MCP

- [x] Happy path, entry to exit: `http://backoffice.localhost:<port>/` → sign-in → home → numbers (empty) → register app and number → verify → activate → metrics → audit (rows for each act) → sign out; expected: the copy from `design.md` at each step, `pt_BR` by default — evidence: metrics step skipped, PR B; every other step PASS, tester-c.md
- [x] Empty: no numbers, no accounts; expected: the empty states on numbers and metrics — evidence: numbers-empty-1280-en.png; metrics tile PR B, tester-c.md
- [x] Single: one number, one account; expected: one row, metrics with one number in the filter — evidence: numbers-one-1280-ptbr.png, tester-c.md
- [x] Many: 3 numbers, 40 accounts, 120 agents seeded; expected: the tables fit, charts render, no horizontal scroll at 1280 — evidence: tester-scale at df9b7623: 3 numbers registered, verified and activated; 40 accounts and 120 connections spread 14/13/13; list and detail pages show the counts at 1280 and 375 with no horizontal scroll on /numbers, the details, /audit and /; pages 6–9 ms locally; each number's webhook reaches only its accounts and one send per number goes out from that number; console and Worker log clean. The charts part belongs to the G4 metrics rows (PR B).
- [x] Rejected input: register with display number `abc`; expected: field error copy, nothing saved; a wrong code on step-up → error, state unchanged — evidence: 422 field error, wrong code 401, nothing saved, tester-c.md
- [x] Browser Back mid-flow: after submitting register, press Back; expected: the form re-renders empty (no-store), no duplicate number on resubmit (`409` copy for the duplicate phone number ID) — evidence: failed first (tester-c.md); red 760841ef → green cb96679e, Back and Forward re-checked with exactly 1 POST, tester-delta.md and `numbers.spec.ts:107`
- [x] Reload mid-flow: reload after a failed sign-in; expected: no resubmission prompt (POST, redirect, GET), still on `/sign-in` — evidence: failed first (tester-c.md); red 760841ef → green cb96679e, `sign-in.spec.ts:30` and tester-delta.md (failed_attempts unchanged)
- [x] Two browsers (`playwright` and `playwright-second`): the operator signed in on both; sign out on one; expected: the other stays signed in (independent sessions); re-enrollment drops both — evidence: tester-scale at df9b7623 with two Playwright contexts: signing in on B keeps A (two session rows); A's used step-up code refused in B; A's CSRF token refused in B (403); signing out on A leaves B signed in and A's old cookie gets 401; re-enrollment drops both sessions.
- [x] Locale switch to `en_US`; expected: all copy English, persisted across pages — evidence: PASS, tester-c.md
- [x] Console and network clean: zero console errors, zero script requests (the CSP forbids them), zero failed requests other than the deliberate 401s — evidence: failed first on `/favicon.ico` 404 (tester-c.md); red 7b059ceb → green 2a5fe2dc, walk fixture fails any console error and 32/32 pass
- [x] Desktop width 1280×800; expected: the layout from `design.md` — evidence: contrast and focus checked, tester-c.md
- [x] Narrow width 375×812; expected: the tables stack, forms usable, no clipped buttons — evidence: failed first on `/audit` scrollWidth 400 (tester-c.md); red f879b997 → green ee1be832, walk checks `/audit` at 375 (numbers.spec.ts:60)
- [x] Screenshots and video of the walk — evidence: the recorder at 2e3ef0dd uploaded backoffice-walkthrough-1280.mp4, backoffice-walkthrough-375.mp4, backoffice-walkthrough.gif and 8 screenshots to the `pr-media-backoffice` release

## Security tests (explicit list)

- [x] Cookie flags, the `__Host-` prefix, no `Domain` (integration) — evidence: `backoffice-auth` and explicit Secure pin 64d80c38, tester-c.md, tester-b.md
- [x] CSRF: missing or foreign Origin, cross-session token (integration) — evidence: `backoffice-auth-csrf` 6/6, live curl, tester-c.md
- [x] Clickjacking: `frame-ancestors 'none'` and `X-Frame-Options: DENY` on every status (integration) — evidence: `backoffice-auth-headers` 3/3, tester-c.md
- [x] Enumeration: the sign-in failure body is identical for every wrong factor; the webhook body is identical for an unknown number and a bad signature (integration) — evidence: `backoffice-auth`, live webhook bodies identical, tester-c.md
- [x] Replay: the TOTP step and concurrent use (integration) — evidence: `backoffice-auth` concurrent, TOTP replay 401, tester-c.md
- [x] Brute force: the rate limit plus lockout, on sign-in and on step-up (integration) — evidence: lockout, rate-limit, step-up, tester-c.md; wrong keys no longer count, tester-delta.md
- [x] Credential exposure: no token or app secret in any response body, log line or audit row (integration) — evidence: `backoffice-numbers` 28/28, `backoffice-numbers-logs`, DB/audit/log grep, tester-c.md
- [x] Sealed-value swap across rows (integration) — evidence: `number-registry` 5/5, tester-c.md
- [x] Open redirect: `returnTo` and `?notice=` allow-lists (integration) — evidence: `backoffice-auth-redirects` 14/14, tester-c.md
- [x] Host confusion: `Host` and `X-Forwarded-Host` spoofing; the dispatch uses the request URL host only, so `X-Forwarded-Host: backoffice.zapbip.com` on the MCP host → the MCP app (integration) — evidence: failed first (tester-c.md: no test mentioned X-Forwarded-Host); pin b674e1d1, live held
- [x] Agents: the isolation test (repository shape) and the MCP host 404s (integration) — evidence: repository-shape 5/5, `backoffice-host` 24/24, tester-c.md
- [x] Enrollment: argv carries no value, TTY required, the hook blocks agents (unit, hooks) — evidence: `operator-enrollment-entry` 8/8, `hooks.test.sh`, tester-c.md
- [x] HTML injection: a number label `<script>alert(1)</script>` renders escaped (integration on `/numbers`) — evidence: `backoffice-numbers` 28/28, live label rendered escaped, tester-c.md

## Tester findings fixed (steps 40 and 41)

- [x] Step 40: a failed sign-in is POST, `303` to `/sign-in?notice=SignInFailed`, GET; reloading that GET leaves `failed_attempts` unchanged — evidence: `backoffice-auth` and `sign-in.spec.ts:30`; red 760841ef → green cb96679e; delta 2
- [x] Step 40: a rejected numbers form (invalid field, wrong step-up code, duplicate) is `303` to its own page, and the GET shows the status (`422`, `401`, `409`), the error copy and only the non-secret values — evidence: `backoffice-numbers` 28/28 and `backoffice-flash` 5/5; red 760841ef → green cb96679e
- [x] Step 40: the flash is shown once (a second GET is the clean form), is gone after one minute, belongs to the session that was rejected, and its D1 column holds no key, code, token or secret — evidence: `backoffice-flash` 5/5; delta 5 (flash rows hold only field values, errors, path, timestamp; mutation 'flash survives two reads' caught)
- [x] Step 40: after a rejected register, a reload and Back/Forward send exactly one POST and Chrome shows no resubmission prompt — evidence: `numbers.spec.ts:107`; delta 2
- [x] Step 40: a duplicate phone number ID, display number or Meta app ID answers `409` with the field error and keeps one row — evidence: `backoffice-numbers`; red e3bdb700 → green edf0c43c
- [x] Step 40: `/assets/favicon.svg` and `/favicon.ico` answer `200` `image/svg+xml`, cacheable, with the other nine headers; every page links `<link rel="icon">`; a POST is `404`; no page logs a console error — evidence: `backoffice-auth-assets` and `backoffice-layout`; red 7b059ceb → green 2a5fe2dc; walk 32/32
- [x] Step 40: `/audit` at 375 has no horizontal scroll (`.data-table .mono` wraps with `overflow-wrap: anywhere`) — evidence: `backoffice-numbers-styles` and `numbers.spec.ts:60`; red f879b997 → green ee1be832; walk 32/32
- [x] Step 40: `X-Forwarded-Host` and `X-Forwarded-Proto` never steer host dispatch on either host (MCP host stays `404` on `/sign-in`, backoffice host stays the backoffice) — evidence: `backoffice-host` 28/28; pin b674e1d1
- [x] Step 40: the lockout asserts the literals 9 (still open) and 10 (locks), and the session cookie carries `Secure` as its own assertion — evidence: `backoffice-auth-lockout`, `backoffice-auth`; pin 64d80c38
- [x] Step 40: the audit row `step_up.failed` reads `Código de confirmação recusado` (`Step-up code rejected`), not the sign-in label — evidence: `backoffice-auth-audit-page`; red 266137f9 → green fa771a68
- [x] S1: 20 wrong keys → `failed_attempts` 0, 20 `sign_in.failed` audit rows, no lockout, and the owner still signs in; 10 wrong codes under the right key → locked, one `sign_in.locked` — evidence: `backoffice-auth-lockout` 7/7; red de8dfe61 → green 82f0a321; delta 1
- [x] S2: a delivery with an unknown `phone_number_id` runs exactly one signature check against a placeholder secret before the `401`, so known and unknown numbers cost the same — evidence: `whatsapp-webhook-numbers`; red c34496e6 → green ffbe9d7e; delta 3 (median 2.21 ms known with a bad signature, 2.16 ms unknown)
- [x] S3: `guard-deploy.sh` blocks `node --import tsx apps/api/scripts/backoffice-en?oll.ts` (the `scripts/backoffice` pattern) — evidence: `.agents/hooks/hooks.test.sh`; red 268cdcfa → green 49873caa
- [x] R1: smoke check 4 posts a zero-signed and a placeholder-signed body whose `metadata.phone_number_id` is `SMOKE_PHONE_NUMBER_ID`, both must be refused, and production now requires that input — evidence: `smoke-checks` 27/27 and `smoke-inputs`; red 5764d13c → green ad1f5c00; delta 4 (live PASS; with `verifyWebhookSignature` mutated to accept anything it prints `FAIL 200 signature rejected`)
- [x] R2: a delivery with a known and an unknown `phone_number_id` → `200`, the known change stored, the unknown skipped with `inbound.foreign_number` — evidence: `whatsapp-webhook` WI-31 and `whatsapp-webhook-numbers`; red c34496e6 → green ffbe9d7e; delta 3
- [x] R2: a delivery with no known ID → `401` (`inbound.unattributed`); known IDs spanning two apps → `401`; a mixed delivery signed with another app's secret → `401` — evidence: `whatsapp-webhook` WI-27 and `whatsapp-webhook-numbers`; red c34496e6 → green ffbe9d7e; delta 3 (mutation 'unknown IDs 401 the delivery' caught)
- [x] R3: an account with no home number is dropped with `inbound.account_without_number`, no throw; an account being deleted is not told about another number — evidence: `whatsapp-webhook-account-binding` 5/5; red 4206adc6 → green 91a957c5; delta re-ran the file green

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [x] Claim 1: an unauthenticated webhook cannot learn which phone number IDs are registered — attack: time the `401` for unknown vs known-with-bad-signature (an app secret is opened only for known IDs); result: held — evidence: held: unknown vs known-bad-signature 3.4-4.7 ms vs 3.4-3.6 ms (tester-c.md); re-measured after the dummy HMAC 2.16 ms vs 2.21 ms (tester-delta.md)
- [x] Claim 2: a stolen session cookie cannot change the registry — attack: replay the cookie with a CSRF token scraped from a page, without a code; try the sign-in code within its step; result: <refuted | held> — evidence: held: scraped csrf with no code gives 422 and no row; sign-in's own code gives 401 (tester-c.md)
- [x] Claim 3: no backoffice code path is reachable from the MCP host — attack: path normalisation (`//sign-in`, `/%73ign-in`), a `Host` header with a trailing dot (`backoffice.zapbip.com.`), and an absolute-URI request line; result: <refuted | held> — evidence: held: `//sign-in`, `/%73ign-in`, trailing dot, X-Forwarded-Host, absolute-URI all 404 or the MCP app (tester-c.md)

## Coverage honesty

What is not tested and why.

- Real Meta deliveries with several apps and WABAs — only the staging smoke test and the owner's go-live hit Meta; the fixtures are Meta's documented shapes. Risk: an undocumented shape is refused with `401` (Meta retries, nothing lost).
- Cloudflare custom-domain routing of `backoffice.zapbip.com` — verified by the owner's `dig` and smoke after deploy, never by agents (ADR 0027).
- Real-time phishing relay against TOTP — accepted residual risk, recorded in ADR 0031.
- Workers rate-limiter behaviour across locations — not reproducible locally; the D1 lockout is the tested bound.
- Free-plan CPU for the per-send AES open plus the D1 read — measured only on staging.
- Analytics Engine `WAKE_METRICS` reads — phase 2.
