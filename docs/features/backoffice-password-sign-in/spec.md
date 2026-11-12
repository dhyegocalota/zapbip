# Backoffice password sign-in

**Status:** Building
**Tier:** 🔴 structural
**Owner approval:** approved 2026-11-11 (owner delegated)
**ADRs:** [0038](../../adr/0038-the-backoffice-signs-in-with-a-password-and-then-a-code-held-in-a-server-side-second-step.md); amends [0031](../../adr/0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md) decisions 1 and 3
**Not changing:** the step-up flow (TOTP on every registry change, sharing the failure counter), the lockout values (10 consecutive failures, 15 minutes), the sessions (30 minutes idle, 8 hours absolute, digests in D1), the `__Host-` session cookie, host dispatch, CSRF, the strict policy and the Embedded Signup page, the sealed registry and number states, the audit table and its 365-day retention, the TOTP secret `BACKOFFICE_TOTP_SECRET` and its enrollment, `NUMBER_REGISTRY_KEY`, the start link

## Problem

The backoffice signs in with a generated key (`zb_bo_…`) and a TOTP code, both typed on one screen. The owner wrote on 2026-11-11: "I should sign in with a login and password, not a backoffice key and code. Typing a key is strange. 2FA should ask for the code only after the login and password."

The key is a 43-character secret that the owner must copy from the enrollment terminal into a password manager and paste on every sign-in. The owner wants the usual shape: an email and a password, then a second factor that appears only after the first one passes.

Facts found in the code that shape the design:

- The operator is the singleton row `backoffice_operator` (`id = 1`, from migration `0005`). It holds the TOTP step, the failure counter and the lock. There is no operators table.
- The key digest is the Worker secret `BACKOFFICE_KEY_DIGEST`, not a D1 column. The TOTP secret is the Worker secret `BACKOFFICE_TOTP_SECRET`.
- `POST /sign-in` checks the rate limit (`BACKOFFICE_RATE_LIMITER`, key `clientRateKey`, scope `''`), reads the key and the code, and calls `attemptSignIn`. A wrong key is rate limited and audited but never counted. A valid key with a wrong code is counted.
- The enrollment CLI `apps/api/scripts/backoffice-enroll.ts` prints the key, sets both Worker secrets through `wrangler secret put`, and resets the operator row with `wrangler d1 execute`.

## Goals

- `/sign-in` takes an email and a password. A correct pair creates a pending second-factor state, which is a row in D1 bound to a `__Host-` cookie. It lasts 5 minutes and is single-use.
- `/sign-in/code` takes the TOTP code. Only a correct code against a live, unused pending state creates a session.
- The backoffice key, its input field, its digest secret and its copy go away.
- Passwords are hashed with PBKDF2-SHA256 through WebCrypto at 20000 iterations over a pepper digest, with a 16-byte salt, stored as one self-describing string. The comparison is constant time.
- A password is 12 to 128 characters after Unicode normalisation. The length check runs on the normalised value, so a string that normalises to a valid length is accepted.
- An unknown email and a wrong password look the same to the caller: one status, one redirect, one notice, one audit action, the same number of hash operations.
- The existing lockout counter and rate limit apply to both steps. The rate limit keeps its key and scope. The wrong-code counter keeps its global operator row and its values; wrong passwords and unknown emails use a second counter and lock on the same row (`password_failed_attempts`, `password_locked_until`) that gates only `POST /sign-in`, so a password-step flood never blocks the code step or step-up.
- The enrollment CLI asks for the email and the password with hidden input and a confirmation. It keeps the TOTP enrollment exactly as it is. The owner runs it in his own terminal.
- Migration `0009` adds the email and the password hash to `backoffice_operator`, and creates the pending-state table. Existing operators cannot sign in until they re-enroll.
- Copy for both sign-in pages in pt_BR and en_US, in `backoffice-copy.ts`. The language and theme switchers keep working on both pages.

## Non-goals

- Password change and password reset in the UI. Re-enrolling through the CLI is the reset path.
- Email verification. The email is an identifier for the one operator, not a verified channel.
- Passkeys. [ADR 0031](../../adr/0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md) keeps them as a later extra factor.
- A second operator. The schema keeps one row, as now.
- Recovery codes. None exist, and none are added.
- Any change to the step-up flow.

## Design

### Decisions taken from the owner's delegation (2026-11-11)

| Question | Decision | Why |
|----------|----------|-----|
| Where does the password hash live? | Columns `email` and `password_hash` on `backoffice_operator` | The operator is already the singleton row. A new table would hold one row for nothing. |
| Which counter does a wrong password use? | Its own global counter and lock, with the same threshold and window, gating only the password step; wrong codes and step-up keep the existing counter | The owner asked for the same lockout on both steps. A per-address counter is not possible, because the lock is global today. |
| Does an unknown email count? | Yes, exactly as a wrong password does | A counted failure that looks the same from outside leaks nothing. Not counting it would reveal the difference. |
| Does a wrong code use up the pending state? | Yes. Any submit to `/sign-in/code` consumes it | Single-use, as ordered. The cost is that a typo means signing in again. |
| What does a missing or expired pending state count as? | Nothing: no counter, no audit row, only the rate limit | No password was proven, so the counter does not move. This stops a cookie-less client from locking the owner out. |
| Is a locked operator checked before or after the hash? | After. The password hash always runs before the lock check | Otherwise a locked response would be faster than a wrong one and would reveal the lock. |

### The Workers Free plan and the pepper

The Worker stays on the Workers Free plan, which allows 10 ms of CPU per request ([ADR 0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md), [ADR 0031](../../adr/0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md)). A local measurement on 2026-11-11 (Node 24, WebCrypto PBKDF2-SHA256, 100000 iterations) took 13 to 14 ms, which does not fit. The owner delegated the decision to the orchestrator, who chose a server-side pepper and a lower iteration count ([ADR 0038](../../adr/0038-the-backoffice-signs-in-with-a-password-and-then-a-code-held-in-a-server-side-second-step.md)):

- The input to PBKDF2 is `HMAC-SHA256(key = BACKOFFICE_PASSWORD_PEPPER, message = NFKC(password))`, so a copy of D1 alone gives nothing to crack offline: the pepper is a Worker secret that never reaches D1.
- PBKDF2-SHA256 runs over that digest with a 16-byte salt at `PASSWORD_HASH_ITERATIONS = 20_000`, about 2.7 ms in Node.
- The stored string stays self-describing (algorithm, iterations, salt, hash), so the count can be raised later.
- `BACKOFFICE_PASSWORD_PEPPER` is a new generated Worker secret, written by the enrollment CLI on remote environments and required by `requireConfigured`.
- A unit test pins one hash under a CPU budget, with a generous threshold, to guard against regression.

### Data flow

```
POST /sign-in  (email, password, csrf)
  -> rate limit (scope '', key clientRateKey)              429 + Retry-After when over
  -> releaseExpiredLock; read operator
  -> normalise email (trim, lowercase); normalise password (NFKC, no trim)
  -> hash the password once: the stored hash when the email matches, the dummy hash otherwise
  -> locked?  -> failure (no counter)
  -> password matches the stored hash and the email matched?
       no  -> registerFailure (audit sign_in.failed, counter, lock at 10)  -> 303 /sign-in?notice=SignInFailed
       yes -> delete all pending rows; insert one (digest of a random token, expires in 5 min)
              -> Set-Cookie __Host-zb_bo_pending  -> 303 /sign-in/code

GET /sign-in/code
  -> session present? -> 303 /
  -> pending cookie digest row present and unexpired? no -> 303 /sign-in
  -> Set-Cookie __Host-zb_bo_csrf -> 200 code page

POST /sign-in/code  (code, csrf)
  -> rate limit (same scope '')
  -> consume the pending row: DELETE ... WHERE token_digest = ? AND expires_at > ? RETURNING   (always clears the cookie)
       none -> 303 /sign-in?notice=SignInFailed  (no counter)
  -> releaseExpiredLock; locked? -> 303 /sign-in?notice=SignInFailed (no counter, as today)
  -> matchTotpStep(lastStep); recordSuccess claims the step
       claimed     -> createSession; Set-Cookie session; audit sign_in.succeeded; 303 /
       not claimed -> registerFailure (audit sign_in.failed, counter); 303 /sign-in?notice=SignInFailed
```

The notice on every failure is `SignInFailed`. The redirect carries no password, no email and no code.

### Interfaces

- `apps/api/src/backoffice/auth/password-hash.ts`
  - `hashPassword(input: { password: string; pepper: string }): Promise<string>` returns `pbkdf2-sha256$20000$<salt base64url>$<hash base64url>`.
  - `verifyPassword(input: { password: string; pepper: string; storedHash: string }): Promise<boolean>` reads the iteration count and salt from the stored string and compares with `constantTimeEqual`. A malformed stored string throws, because the row is ours and a malformed one means a bug.
- `apps/api/src/backoffice/auth/password-policy.ts`
  - `normalizePassword(input: { value: string }): string` applies NFKC and nothing else.
  - `isPasswordLengthAllowed(input: { password: string }): boolean` checks the normalised value against 12 and 128 code points.
- `apps/api/src/backoffice/auth/pending-sign-in.ts`
  - `createPendingSignIn(input: { database; now }): Promise<string>` deletes every existing pending row, then inserts a digest of a new random token.
  - `consumePendingSignIn(input: { database; token; now }): Promise<boolean>` deletes the row and reports whether one matched and was unexpired.
  - `isPendingSignInLive(input: { database; token; now }): Promise<boolean>` reads without deleting, for the GET page.
- `apps/api/src/backoffice/auth/sign-in.ts`
  - `attemptPasswordSignIn(input: { env; email; password; now; clientAddress }): Promise<PasswordSignInResult>` returns `Accepted` with the pending token, or `Failed`.
  - `attemptCodeSignIn(input: { env; pendingToken; code; now; clientAddress }): Promise<SignInResult>`.
  - `isBackofficeKey` is removed.
- `apps/api/src/backoffice/routes/sign-in-routes.tsx` gains `GET` and `POST` on `BackofficePath.SignInCode = '/sign-in/code'`.
- Constants in `apps/api/src/contract/constants.ts`: `BACKOFFICE_PENDING_SIGN_IN_MS = 5 * MINUTE_MS`, `PASSWORD_HASH_ITERATIONS = 20_000`, `PASSWORD_SALT_BYTES = 16`, `PASSWORD_MIN_LENGTH = 12`, `PASSWORD_MAX_LENGTH = 128`, and the dummy hash string.
- Cookies in `backoffice-constants.ts`: `PENDING_SIGN_IN_COOKIE_NAME = '__Host-zb_bo_pending'`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=300`, with no `Domain`. The session and CSRF cookies are unchanged.
- Environment: `BACKOFFICE_KEY_DIGEST` leaves `Bindings`, `WorkerSecret` and `requireConfigured`; `BACKOFFICE_PASSWORD_PEPPER` joins them. `requireConfigured` then checks `BACKOFFICE_TOTP_SECRET` and `BACKOFFICE_PASSWORD_PEPPER`.
- `return-target.ts` allows `/sign-in/code` as a backoffice page, so the language and theme switchers on the code page return to it.

### Migration `0009_backoffice_password_sign_in.sql`

```sql
ALTER TABLE backoffice_operator ADD COLUMN email TEXT;
ALTER TABLE backoffice_operator ADD COLUMN password_hash TEXT;
CREATE UNIQUE INDEX backoffice_operator_email ON backoffice_operator (email);
CREATE TABLE backoffice_pending_sign_ins (
  token_digest TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
DELETE FROM backoffice_sessions;
```

- There are no key columns in D1 to drop. The key was never a column. The migration is additive, so the previous Worker version still runs on the new schema, which is what makes the backout work.
- `DELETE FROM backoffice_sessions` ends every session the moment the migration runs.
- After the migration, `email` and `password_hash` are `NULL`. Every sign-in fails until the owner re-enrolls. This is the intended state, and the runbook says so.
- Email case folding is enforced in the write path (the CLI lowercases before the statement) and in the read path (sign-in lowercases before comparing). The unique index is on the stored, already lowercased value. The CLI rejects any email that is not ASCII with a single `@` and no quote characters.

### Enrollment CLI

`pnpm backoffice:enroll:<environment>` keeps its flags (`--environment` only), its TTY requirement, its production confirmation, its TOTP QR, its code check before any write, and its Worker-secret write for `BACKOFFICE_TOTP_SECRET` on remote environments. It changes in these ways:

1. Ask for the email. It must match the rule above, or the run stops with nothing written.
2. Ask for the password with echo off, then ask for it again. A mismatch stops the run. The password must be 12 to 128 code points after NFKC. The run generates a fresh pepper and hashes the password with it.
3. Show the TOTP QR and text secret, then check the typed code, as now. Nothing is written before the code matches.
4. Put `BACKOFFICE_TOTP_SECRET` and `BACKOFFICE_PASSWORD_PEPPER` (remote) or print them (development, for `apps/api/.dev.vars`). `BACKOFFICE_KEY_DIGEST` is no longer written.
5. Run one D1 statement that sets `email` and `password_hash` on `backoffice_operator`, resets the step, the counter and the lock, deletes all sessions and all pending rows, and writes the `operator.enrolled` audit row.
6. Clear the screen. There is no "store the key" pause any more.

The password never appears in an argument, an environment variable, a file, the output or a log. The CLI's argument parser accepts only `--environment`, so `--password` is an error. The password prompt mutes the echo. The D1 statement carries the hash, not the password, and it is passed on the command line the way the current reset SQL already is. The hash is salted and slow, so a local user reading the process list gets nothing usable. This is the one place a value crosses an argument, and it is recorded in the ADR.

### Copy

Copy keys are added and removed in `backoffice-copy.ts` (`BackofficeCopyKey`, `BACKOFFICE_COPY` for both `pt_BR` and `en_US`). Removed: `SignInKeyLabel`, `SignInKeyHelp`. Rewritten: `SignInLead`, `SignInSubmit`. Added:

| Key | pt_BR | en_US |
|-----|-------|-------|
| `SignInLead` (rewritten) | Seu e-mail e sua senha. Depois, o código do seu autenticador. | Your email and password first, then the code from your authenticator app. |
| `SignInEmailLabel` | E-mail | Email |
| `SignInPasswordLabel` | Senha | Password |
| `SignInSubmit` (rewritten) | Continuar | Continue |
| `SignInCodeLead` | Digite o código de 6 dígitos do seu app autenticador. Esta etapa expira em 5 minutos. | Enter the 6-digit code from your authenticator app. This step expires in 5 minutes. |
| `SignInCodeSubmit` | Entrar | Sign in |

The existing `SignInCodeLabel`, `SignInCodeHelp`, `SignInTitle`, `SignInEyebrow` and `SignInFailed` are reused. The failure copy does not change, and it names no cause.

### Failure handling

- A missing form field returns `400`, as it does today. The field is not an account fact, so the response reveals nothing about an email.
- A rate-limited request returns `429` with `Retry-After`, as today, on both steps.
- A wrong password, an unknown email and a wrong code all return the same redirect to `/sign-in?notice=SignInFailed`, and each adds one counter increment and one `sign_in.failed` audit row. A locked operator, a missing or expired pending state and a rate-limited request return the same redirect or the `429`, and add neither.
- A malformed stored password hash throws. It is a bug in our own row, and a thrown error is the honest answer.
- The dummy hash is a constant of the same format and iteration count. Verifying against it always fails.

### Sign-in throttling and CPU

The hash runs on every `POST /sign-in`, including the unknown-email path and the locked path. The rate limit (5 per minute per address, shared by both steps) bounds the CPU a single address can spend. The Free plan's 10 ms CPU limit is why the iteration count is 20000 behind a pepper.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which Workers plan runs the backoffice? | Free (10 ms CPU, measured PBKDF2 at 100000 is 13 to 14 ms locally) or Paid | Free stays. The orchestrator, with the owner's delegation, chose a pepper plus 20000 iterations | 2026-11-11 |
| Does a wrong password count toward the lockout? | Yes, global lock as today; or no, per-address rate limit only | Yes, delegated to the orchestrator as "apply them to both steps"; the lock-out-by-guessing trade-off is in the ADR | 2026-11-11 |
| Does a wrong code consume the pending state? | Yes; or allow a few tries | Yes, single-use, delegated | 2026-11-11 |
| Is an unknown email counted? | Yes, same as a wrong password; or not | Yes, so the counter does not reveal the email | 2026-11-11 |
| Which iteration count? | 100000 (does not fit Free); or a lower count behind a server-side pepper | 20000 behind `BACKOFFICE_PASSWORD_PEPPER`, delegated. The OWASP recommendation for PBKDF2-SHA256 is far higher; the ADR records that gap and why the pepper and the second factor make up for it | 2026-11-11 |

## Test strategy summary

Unit tests cover the hash format, verify, the dummy hash, the normalisation and the length rule, the enrollment CLI, the copy keys and the cookie options. Integration tests run the two routes on the Worker test harness with D1, the rate limiter and the migrations applied, and cover the enumeration, lockout, replay, expiry, cookie and redirect rows. The Playwright walk covers both pages at 1280 and 375, with the switchers, Back and reload. A unit test pins one hash under a generous CPU budget; the Workers CPU time itself is measured by the owner on staging. The full list is in [test-plan.md](test-plan.md).
