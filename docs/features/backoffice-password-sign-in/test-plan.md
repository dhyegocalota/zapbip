# Test plan: Backoffice password sign-in

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Gate for the whole plan: step 0 of [plan.md](plan.md) (the Workers plan and the measured CPU time) is ticked before any row below is run on a deployed Worker.

## The failing test first

- [ ] `apps/api/test/unit/backoffice-password-hash.test.ts::verifies a stored hash` — input: `hashPassword('correct horse 1')` then `verifyPassword` with the same string; expected: `true`, and a stored string with the format `pbkdf2-sha256$100000$<22 chars>$<43 chars>`
- [ ] Confirmed it fails for the right reason: the red run prints `hashPassword is not implemented` (the stub), not a typing or import error — evidence: (developer's commit hash and the printed line)
- [ ] `apps/api/test/integration/backoffice-auth-password.test.ts::a right password creates one pending row` — input: the test operator with `BACKOFFICE_TEST_PASSWORD`; expected: `attemptPasswordSignIn` returns `Accepted` with one token and `backoffice_pending_sign_ins` holds one row
- [ ] Confirmed it fails for the right reason: `attemptPasswordSignIn is not implemented` — evidence: (commit hash and printed line)

## Unit

- [ ] `backoffice-password-hash.test.ts::hash format` — input: `hashPassword('a 12 char pass')`; expected: the string matches `^pbkdf2-sha256\$100000\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$`
- [ ] `backoffice-password-hash.test.ts::salt is random` — input: the same password hashed twice; expected: the two strings differ
- [ ] `backoffice-password-hash.test.ts::verify refuses a case change` — input: hash of `Correct Horse 1`, verify `correct horse 1`; expected: `false`
- [ ] `backoffice-password-hash.test.ts::verify uses the stored count` — input: a stored string with `iterations = 1000` made by the same function with that count; expected: `verifyPassword` returns `true` (the count comes from the string, not the constant)
- [ ] Edge: a malformed stored string (missing part, `pbkdf2-sha1` tag, non-number count) — input: each as `storedHash`; expected: throws `Error` naming the stored hash as malformed, without echoing its content
- [ ] `backoffice-password-policy.test.ts::normalizePassword` — input: `ﬁ` (U+FB01) and `e` followed by U+0301 and `é` (U+00E9); expected: `fi` and the composed `é` in both cases
- [ ] Edge: the length boundary — input: 11 `a`, 12 `a`, 128 `a`, 129 `a`; expected: `false`, `true`, `true`, `false`
- [ ] Edge: the normalised length — input: six `ﬁ` (six code points, twelve after NFKC); expected: `isPasswordLengthAllowed` returns `true`, so the check ran after normalisation
- [ ] Edge: empty string — input: `''`; expected: `false` from the length rule, and no hash is computed for the enrollment flow
- [ ] `backoffice-copy.test.ts::sign-in copy` — input: every `BackofficeCopyKey` of the sign-in pages in `pt_BR` and `en_US`; expected: each renders a non-empty string; `SignInKeyLabel` and `SignInKeyHelp` are absent from the enum
- [ ] `backoffice-constants.test.ts::cookie` — input: `PENDING_SIGN_IN_COOKIE_NAME`; expected: `__Host-zb_bo_pending`, and the cookie options object is `{ secure: true, httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 300 }`
- [ ] `operator-enrollment-entry.test.ts::non-interactive` — input: `isInteractive: false`; expected: exit code `1`, the refusal message, no prompt, no shell call
- [ ] `operator-enrollment-entry.test.ts::bad email` — input: email `o'brien@x.com`, then `not-an-email`; expected: exit code `1` before any password prompt, nothing written
- [ ] `operator-enrollment-entry.test.ts::mismatched confirmation` — input: password `correct horse 1` then `correct horse 2`; expected: exit code `1`, the message names a mismatch, no shell call
- [ ] `operator-enrollment-entry.test.ts::short password` — input: password `short` twice; expected: exit code `1`, nothing written
- [ ] `operator-enrollment-entry.test.ts::wrong totp` — input: a valid email and password, then code `000000`; expected: exit code `1`, `The code was not accepted; nothing was written`, no shell call
- [ ] `operator-enrollment-entry.test.ts::right run on staging` — input: a valid email (`Owner@Example.com`), a valid password, the right code; expected: exit code `0`; one `wrangler secret put BACKOFFICE_TOTP_SECRET` call and no `BACKOFFICE_KEY_DIGEST`; one `d1 execute` whose `--command` contains `owner@example.com` lowercased and a `pbkdf2-sha256$` string, and whose text does not contain the password
- [ ] `operator-enrollment-entry.test.ts::password never printed` — input: the right run above; expected: the captured output and every shell argument contain no substring of the password
- [ ] `operator-enrollment-entry.test.ts::no password flag` — input: argument list `['--environment', 'staging', '--password', 'x']`; expected: the parser throws (unknown option), and `--email` is refused the same way
- [ ] Edge: the error path names its cause — input: a failing `d1 execute` exit code; expected: `The operator reset failed`, exit code `1`, and the secret put of step 4 is not repeated

## Integration (D1, the rate limiter and the migrations applied)

- [ ] `backoffice-password-migration.test.ts::existing row survives` — input: migrations `0001`..`0008`, the operator row with `last_totp_step = 42, failed_attempts = 3`, one session; then `0009`; expected: the session is gone, the operator row keeps `42` and `3`, `email` and `password_hash` are NULL
- [ ] `backoffice-password-migration.test.ts::email is unique` — input: two inserts with `Owner@x.com` then `owner@X.com` into the operator row; expected: the second is refused by `backoffice_operator_email`
- [ ] `backoffice-pending-sign-in.test.ts::consume once` — input: create, consume, consume; expected: `true`, then `false`
- [ ] `backoffice-pending-sign-in.test.ts::expiry` — input: create at `now`, consume at `now + 300000` (the boundary) and at `now + 300001`; expected: the first is `false` (expired at the boundary), the second is `false`, and the row is gone after the first call
- [ ] `backoffice-pending-sign-in.test.ts::live read does not consume` — input: create, `isPendingSignInLive` twice, then consume; expected: `true`, `true`, then `true`
- [ ] `backoffice-pending-sign-in.test.ts::second create replaces the first` — input: create A, create B, consume A, consume B; expected: `false` for A, `true` for B
- [ ] `backoffice-pending-sign-in.test.ts::prune keeps live rows` — input: one expired row and one live row, run the prune; expected: the expired row is removed and the live row stays
- [ ] `backoffice-auth-password.test.ts::one hash per attempt` — input: right password, wrong password, unknown email, email in another case with a wrong password; expected: `verifyPassword` is called exactly once in each attempt (spy)
- [ ] `backoffice-auth-password.test.ts::same audit for wrong password and unknown email` — input: a wrong password, then an unknown email; expected: two `sign_in.failed` rows, each with `outcome = failed`, `target_kind` NULL, and `failed_attempts` incremented by one each time
- [ ] `backoffice-auth-password.test.ts::tenth failure locks` — input: ten consecutive failures mixing wrong passwords, unknown emails and wrong codes; expected: the tenth writes `sign_in.locked` and sets `locked_until = now + 900000`
- [ ] `backoffice-auth-password.test.ts::locked operator still hashes` — input: a locked operator, the right password; expected: `Failed`, `verifyPassword` called once, no `failed_attempts` change, no pending row
- [ ] `backoffice-auth-password.test.ts::lock released after fifteen minutes` — input: the lock above, then `now + 900001` with the right password and a fresh code; expected: `Accepted` then a session, and `failed_attempts` back to `0` after the code succeeds
- [ ] `backoffice-auth-password.test.ts::right code creates a session` — input: a live pending token and the current code; expected: `Succeeded` with a session token, one `sign_in.succeeded` row, `last_totp_step` set to the step
- [ ] `backoffice-auth-password.test.ts::code replay` — input: the same code a second time with a new pending token; expected: `Failed` and one more `failed_attempts`
- [ ] `backoffice-auth-password.test.ts::missing pending token counts nothing` — input: a random token that was never created; expected: `Failed`, `failed_attempts` unchanged, no audit row
- [ ] `backoffice-auth-password.test.ts::expired pending token counts nothing` — input: a pending token consumed after expiry; expected: `Failed`, `failed_attempts` unchanged
- [ ] Edge: the operator has no email (after migration) — input: the right password for any email; expected: `Failed` after the dummy hash, `verifyPassword` called once against the dummy, no pending row
- [ ] `backoffice-auth-sign-in-steps.test.ts::enumeration` — input: `POST /sign-in` with a wrong password, with an unknown email, and with an unknown email in capitals; expected: all three answer `303`, `Location: /sign-in?notice=SignInFailed`, the same `Set-Cookie` set (none), and the same body after the redirect is followed
- [ ] `backoffice-auth-sign-in-steps.test.ts::right password redirect` — input: the right email in capitals and the right password; expected: `303` to `/sign-in/code`, `Set-Cookie: __Host-zb_bo_pending=…` and no session cookie
- [ ] `backoffice-auth-sign-in-steps.test.ts::code page needs a live pending cookie` — input: `GET /sign-in/code` with no cookie; expected: `303` to `/sign-in` and no notice in `Location`
- [ ] `backoffice-auth-sign-in-steps.test.ts::code page renders with a live cookie` — input: `GET /sign-in/code` with the pending cookie; expected: `200`, one `code` input with `autocomplete="one-time-code"`, one hidden `csrf` input, and a new `__Host-zb_bo_csrf` cookie
- [ ] `backoffice-auth-sign-in-steps.test.ts::code post clears the pending cookie on failure` — input: `POST /sign-in/code` with `000000`; expected: `303` to `/sign-in?notice=SignInFailed`, `Set-Cookie: __Host-zb_bo_pending=; Max-Age=0`, and the row is gone
- [ ] `backoffice-auth-sign-in-steps.test.ts::replayed pending cookie` — input: a successful code POST, then the same pending cookie again with a fresh code; expected: `303` to `/sign-in?notice=SignInFailed`, no session cookie
- [ ] `backoffice-auth-sign-in-steps.test.ts::pending cookie expires` — input: password step, then the code POST at `now + 300001` with the right code; expected: `303` to `/sign-in?notice=SignInFailed`, no session cookie
- [ ] `backoffice-auth-sign-in-steps.test.ts::cookie flags` — input: the `Set-Cookie` of the password step; expected: the attributes include `Path=/`, `Max-Age=300`, `HttpOnly`, `Secure`, `SameSite=Strict`, and no `Domain`; the name starts with `__Host-`
- [ ] `backoffice-auth-sign-in-steps.test.ts::session cookie unchanged` — input: the code step's success; expected: the session cookie has `Max-Age=28800`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`
- [ ] `backoffice-auth-sign-in-steps.test.ts::old key refused` — input: `POST /sign-in` with `email` set to the owner's email and `password` set to `zb_bo_` plus 43 characters; expected: `303` to `/sign-in?notice=SignInFailed`, one `failed_attempts`
- [ ] `backoffice-auth-sign-in-steps.test.ts::rate limit covers both steps` — input: six requests to `POST /sign-in` and then one to `POST /sign-in/code` from one address within a minute; expected: the sixth and the seventh answer `429` with `Retry-After: 60`, and neither checks the password nor the code
- [ ] `backoffice-auth-sign-in-steps.test.ts::missing field` — input: `POST /sign-in` without `password`; expected: `400`, no counter change
- [ ] `backoffice-auth-sign-in-steps.test.ts::step-up still TOTP only` — input: `POST` to a step-up route with the password in the code field; expected: refused, the step-up failure counter increments once, and the step-up path never calls `verifyPassword`
- [ ] `backoffice-switchers.test.ts::sign-in switches` — input: `POST /locale` with `en_US` from `/sign-in`, then `POST /theme` with `dark`; expected: each returns `303` to `/sign-in`, the cookie is set, and the page shows the English copy
- [ ] `backoffice-switchers.test.ts::code switches` — input: the same from `/sign-in/code` with a live pending cookie; expected: each returns `303` to `/sign-in/code`, the pending cookie is not cleared by the switch, and the code page shows the English copy
- [ ] Edge: a switch from a page with no pending cookie — input: `POST /locale` from `/sign-in/code` without the pending cookie; expected: `303` to `/sign-in/code`, then the code page redirects to `/sign-in`

## Security (the rows the reviewer and the security reviewer attack)

- [ ] Enumeration by response: wrong password, unknown email and unknown email in capitals — input: the three `POST /sign-in` bodies; expected: identical status, `Location`, `Set-Cookie` (none), and page body after the redirect
- [ ] Enumeration by work: the same three attempts — input: the spy from the integration test; expected: `verifyPassword` called once each, and the same `storedHash` argument shape (the dummy for the unknown email)
- [ ] Enumeration by counter: unknown email then wrong password — input: two attempts; expected: each adds one `failed_attempts` and one `sign_in.failed` row, identical in shape
- [ ] Lockout across both steps: ten failures mixing wrong passwords, unknown emails and wrong codes, then the right password and right code — input: the eleventh attempt; expected: `Failed` before any code is checked, and the lock message is the generic one
- [ ] Lockout cannot be reset by a password success — input: nine wrong codes, one right password (pending created), one wrong code; expected: the tenth failure locks, and the right password did not reset `failed_attempts`
- [ ] Lockout window — input: the lock set at T, then a right pair at `T + 899999` and at `T + 900000`; expected: refused at the first (the lock holds until `locked_until`), accepted at the second with a right pair and a fresh code
- [ ] Pending replay — input: a right pair, a right code, then the same cookie and a new right code; expected: the second code is refused, no second session
- [ ] Pending concurrency — input: two `POST /sign-in/code` requests with the same pending cookie and the right code, sent together; expected: exactly one `303` to `/` with a session cookie, one `303` to `/sign-in?notice=SignInFailed`, and one session row
- [ ] Pending expiry — input: the boundary at `expires_at` and one millisecond after; expected: refused at the boundary and after it
- [ ] Pending is per operator — input: a second `POST /sign-in` with a right pair while the first pending is live; expected: the first cookie is refused on `/sign-in/code`
- [ ] Cookie flags — input: the `Set-Cookie` of the pending cookie; expected: `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=300`, no `Domain`
- [ ] Cookie value is not the digest — input: the pending cookie value and the `token_digest` column; expected: the column is the SHA-256 hex of the cookie value, and the cookie value is not stored
- [ ] No password in a log — input: a full failed and successful sign-in with the password `correct horse 1` and the email; expected: the captured `logEvent` output and console contain neither string; only event names appear
- [ ] No password or email in a redirect — input: the `Location` of every response in the sign-in flow; expected: contains only the path and the notice name
- [ ] No password or email in the audit table — input: `SELECT * FROM backoffice_audit` after the flow; expected: no row contains the password, the email or the hash
- [ ] No password in a flash — input: the sign-in failure redirect; expected: no flash row is written by the sign-in path (only the notice query)
- [ ] Headers unchanged on both pages — input: `GET /sign-in` and `GET /sign-in/code`; expected: the strict `Content-Security-Policy`, `X-Frame-Options: DENY`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, and no `script` element in the body
- [ ] CSRF on the code step — input: `POST /sign-in/code` with a missing `Origin`, and with a wrong `csrf`; expected: refused, and no pending row is consumed
- [ ] Enrollment output and arguments carry no password — input: the right enrollment run on development; expected: the password appears in no output line and in no argument of the `d1 execute` call except the hash

### Mutation checks

Each mutation is applied in a throwaway branch, the named test must go red, then the change is restored.

- [ ] Remove the dummy-hash call on the unknown-email branch — expected: `backoffice-auth-password.test.ts::one hash per attempt` goes red
- [ ] Move the lock check before the hash — expected: `locked operator still hashes` goes red
- [ ] Count the missing-pending attempt — expected: `missing pending token counts nothing` goes red
- [ ] Make `/sign-in/code` not consume the pending row on a wrong code — expected: `code post clears the pending cookie on failure` goes red
- [ ] Drop `SameSite=Strict` from the pending cookie — expected: `cookie flags` goes red
- [ ] Put the password in the redirect query — expected: `No password or email in a redirect` goes red

## Playwright MCP walk (the user's view)

- [ ] Happy path, entry to exit: open `/`, redirected to `/sign-in`; type the owner's email and password; choose Continue; land on `/sign-in/code`; type the current six-digit code; choose Sign in; land on `/` showing the overview — expected: each page shows the matching copy and no key field exists anywhere
- [ ] Empty: submit `/sign-in` with both fields empty — expected: the browser shows the required-field prompt on the email field and no request reaches the server (both fields carry `required`)
- [ ] Single: a wrong password — expected: back on `/sign-in` with the notice `Não foi possível entrar.` and both fields empty, and the URL is `/sign-in?notice=SignInFailed`
- [ ] Many: ten wrong passwords then the right one — expected: the notice at each failure; the right pair after the tenth is refused with the same notice while locked
- [ ] Rejected input: the right password and a wrong code — expected: back on `/sign-in` with the notice; the URL does not contain the password or the code
- [ ] Browser Back mid-flow: on `/sign-in/code`, press Back — expected: `/sign-in` shows; pressing Forward does not sign in
- [ ] Reload mid-flow: reload `/sign-in/code` — expected: the page renders again with the same pending cookie
- [ ] Reload after the code is used: sign in, then Back to `/sign-in/code` and reload — expected: redirected to `/` (session) or to `/sign-in` (no pending), never a second session
- [ ] Two authors in two browser contexts at once: context A and context B both type the right password — expected: each gets its own pending cookie; only the later pending survives, so the earlier code page's submit redirects to `/sign-in?notice=SignInFailed`
- [ ] Switchers on `/sign-in`: choose English, then Dark — expected: the page reloads in English with the dark theme, and the URL is still `/sign-in`
- [ ] Switchers on `/sign-in/code`: choose English, then Light — expected: the page reloads in English with the light theme, and the URL is still `/sign-in/code` with the pending cookie intact
- [ ] Console and network clean: zero console errors, zero failed requests, other than the expected `401` or `303` responses
- [ ] Desktop width 1280: both pages — expected: the card is centred, both switchers visible in the header, no horizontal scroll
- [ ] Narrow width 375: both pages — expected: the card fills the width with a 16px gutter, the switchers wrap without overlap, no horizontal scroll
- [ ] Screenshots at `.pr-media/backoffice-password-sign-in/` and video at `.pr-media/backoffice-password-sign-in/walk.webm`

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: an unknown email takes the same work as a wrong password — attack: count the `crypto.subtle.deriveBits` calls and the stored-hash argument for both; result: refuted | held
- [ ] Claim 2: a missing or replayed pending state never moves the lock counter — attack: send a code POST with no cookie, with a replayed cookie and with an expired cookie, and read `failed_attempts`; result: refuted | held
- [ ] Claim 3: a password is never in a log, an argument, a redirect or the audit table — attack: grep the captured logs, the process arguments of the enrollment run and the audit table after a full flow; result: refuted | held

## Coverage honesty

What is not tested and why.

- The Workers CPU claim for 100000 iterations — not proven by any local test. Local Node measures 13 to 14 ms; the proof is step 0 of the plan, on a staging deploy, and the spec's blocking precondition stands until it is recorded.
- The real hidden-echo behaviour of a TTY — the enrollment test injects answers and checks the output for the password. The owner's own terminal is the proof: the runbook step 1 expects no echo of the password.
- D1 `RETURNING` atomicity under real concurrency — the concurrency row runs against the local D1 test harness, which serialises writes. The production behaviour rests on D1's single-writer semantics and is not separately tested.
- Migration on production data — tested on a copy of the migration history with one synthetic operator row. The owner runs `d1 migrations apply` on production and checks the row count, as deploy.md already asks.
- Password strength beyond the length rule — not checked. The owner chooses the password; the policy is length only, as the spec says.
- Lockout by guessing as a denial of service — accepted and tested only as a window; the ADR records it as the trade-off.
