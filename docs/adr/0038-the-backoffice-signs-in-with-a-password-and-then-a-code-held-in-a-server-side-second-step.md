# 0038. The backoffice signs in with a password, then a code held in a server-side second step

- Status: Accepted
- Date: 2026-11-11
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's order of 2026-11-11 ("eu deveria entrar com login e senha, não com chave e código ... o 2FA só pede o código depois do login e senha") and its delegation of the design; [ADR 0031](0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md) decisions 1 and 3, which this amends; the Cloudflare Workers limits for WebCrypto PBKDF2 (100000 iterations); OWASP Password Storage Cheat Sheet (PBKDF2-HMAC-SHA256 guidance); the orchestrator's decision of 2026-11-11 to keep the Free plan and add a pepper; RFC 6238; the local measurement of 2026-11-11 (13 to 14 ms for PBKDF2 at 100000 iterations on Node 24)

## Context

ADR 0031 signs the operator in with a generated key and a TOTP code, both typed together. The owner finds typing the key strange, and wants the usual shape: an email and a password, and then the second factor on its own page. The owner delegated the design on 2026-11-11.

The constraints:

- The Worker runs on WebCrypto. Workers has native PBKDF2-SHA256 with at most 100000 iterations. Argon2id, bcrypt and scrypt are not in WebCrypto, so any of them would be a JavaScript or WebAssembly implementation that spends CPU in the request.
- ADR 0031 and ADR 0009 place the Worker on the Workers Free plan, whose 10 ms CPU budget per request rejected slow hashes before. One PBKDF2 at 100000 iterations takes 13 to 14 ms on a laptop, so it does not fit. The Worker stays on Free (decided 2026-11-11 by the orchestrator with the owner's delegation).
- The operator is one row (`backoffice_operator`). The lockout (10 consecutive failures, 15 minutes) and the per-address rate limit (5 per minute) already exist and are reused.
- The second factor must not show that an email exists, and a wrong password must look the same as an unknown email.

## Decision

1. **Two steps, one operator.**
   - `POST /sign-in` takes an email and a password. A correct pair creates a pending second-factor state: a digest of a random token, stored in `backoffice_pending_sign_ins` for 5 minutes, bound to the `__Host-zb_bo_pending` cookie. A correct password deletes any earlier pending rows before it stores its own.
   - `POST /sign-in/code` consumes the pending state with one atomic `DELETE ... RETURNING` before it checks the TOTP code. Any submit consumes it, a right code or a wrong one. Only a right code against a live row creates a session.
   - A missing, expired or already-used pending state counts nothing: it is refused, and the rate limit still applies.
2. **Passwords** are hashed in two layers through WebCrypto. First `HMAC-SHA256(key = BACKOFFICE_PASSWORD_PEPPER, message = NFKC(password))`, then PBKDF2-SHA256 over that digest with a 16-byte random salt, a 32-byte output and 20000 iterations (about 2.7 ms in Node, inside the Free plan's 10 ms). The stored string is `pbkdf2-sha256$<iterations>$<salt base64url>$<hash base64url>`, so the iteration count is recorded with each hash and can be raised later. The comparison is constant time.
   - `BACKOFFICE_PASSWORD_PEPPER` is a generated Worker secret written by the enrollment CLI. It never reaches D1, so a leak of D1 alone gives nothing to crack offline.
   - A password is normalised with NFKC, not trimmed, and is 12 to 128 code points after normalisation. The length check runs on the normalised value. The 12-character minimum makes up part of the gap left by the lower iteration count.
3. **No enumeration.** An unknown email hashes the password against a dummy hash of the same format and iteration count. The unknown email, the wrong password and the locked operator run the same hash before their branches. They receive the same redirect and the same notice, and the first two add the same counter increment and audit row.
4. **Two locks, one rate limit.** Wrong passwords and unknown emails count on their own global counter and lock (`password_failed_attempts`, `password_locked_until`: 10 consecutive failures, 15 minutes), which gates only `POST /sign-in`. Wrong codes and step-up keep the existing counter and lock (`failed_attempts`, `locked_until`), which gates the code step, step-up and also the password step. Both password-step causes count identically. The existing per-address rate limit keeps its key and scope and covers both routes.
5. **Enrollment stays in the owner's terminal.** `pnpm backoffice:enroll:<environment>` asks for the email and the password with hidden input and a confirmation, generates a fresh pepper on every run, hashes the password with it and writes it as a Worker secret on remote environments, and keeps the TOTP enrollment as ADR 0031 wrote it. The password is never an argument, a variable, a file or a log line. `BACKOFFICE_KEY_DIGEST` is no longer written or read.
6. **Re-enrollment is the only reset**, as it was for the key. Existing operators cannot sign in after migration `0009` until they re-enroll, and the migration ends every session.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Argon2id in WebAssembly | the current OWASP first choice; memory-hard | a WebAssembly build of the algorithm adds a dependency and a bundle, and its CPU cost lands in the same request budget | not in WebCrypto, so a new runtime dependency with its own supply-chain review; the Free plan budget is the same question |
| bcrypt in JavaScript | familiar | not in WebCrypto; a JavaScript implementation is slower than the native PBKDF2 and has a 72-byte input limit | the same CPU question and a worse fit |
| scrypt | memory-hard | not in WebCrypto; needs a compatibility module | the same CPU question as Argon2 |
| PBKDF2 at the OWASP count of 600000 | matches the OWASP guidance for PBKDF2-SHA256 | the Workers cap is 100000; a higher count fails on the platform | the platform does not allow it. The gap is recorded under Consequences |
| PBKDF2 at 100000 with no pepper, on Workers Paid | the platform's maximum | costs a paid plan for one operator; the owner did not choose it | the Worker stays on Free |
| PBKDF2 at 20000 with no pepper | simplest | a D1 leak would give an offline-crackable hash | the pepper keeps the hash useless without the Worker secret |
| Keep the key and add a password | more than one factor at sign-in | the owner asked for the key to go | the owner's order |
| A cookie-only second step (no D1 row) | no table | a signed cookie cannot be made single-use without storage, so a replayed cookie would pass | single-use is ordered |
| Passkeys | phishing-resistant | registration needs a browser on the backoffice origin, and the bootstrap goes through the terminal (ADR 0031) | a later extra factor, as ADR 0031 already says |
| Per-address lockout for passwords | a stranger cannot lock the owner out | an attacker on many addresses keeps guessing; the lock is the only global bound | the owner asked for the same lockout on both steps |

## Consequences

- **Plan.** The Worker stays on Workers Free. A unit test pins one hash and one verify under a generous CPU budget so a regression in the iteration count or the construction is caught before a deploy.
- **Pepper.** `BACKOFFICE_PASSWORD_PEPPER` is a new Worker secret. `requireConfigured` refuses the backoffice without it. Losing it makes every stored hash unverifiable, and the owner re-enrolls, as for any other reset. Rotating it is a re-enrollment, and every run of the enrollment rotates it.
- **Strength gap.** 20000 iterations of PBKDF2-SHA256 is far below the 600000 that OWASP recommends for that algorithm. The gap is accepted because the Free plan's CPU limit caps the count, because the pepper means an attacker needs both D1 and the Worker secret to start an offline attack, because the password is at least 12 characters, and because the second factor (TOTP), the lock, the rate limit and the server-side pending state limit online guessing. The stored iteration count lets a future migration raise the cost on a runtime that allows it. The migration itself does not rehash old values, because each stored hash carries its own count.
- **Lockout by guessing.** Anyone, with no knowledge of the email, can keep the password step locked for 15 minutes by repeating wrong passwords at about one request every 90 seconds. The lock never grants access, so the cost is availability, and it is limited to the password step: because that counter is separate, the flood never blocks the code step or the step-up of an owner who is signed in or who already passed the password. The owner can wait or, with the terminal, re-enroll, and a Cloudflare WAF or rate-limiting rule on `POST /sign-in` is the answer to a sustained flood ([backoffice runbook](../runbooks/backoffice.md), step 6). Ten wrong codes after a right password (the attacker already holds the password) lock everything, as before.
- **Enumeration.** An unknown email and a wrong password take the same work and get the same answer. A locked operator also gets the same answer, after the same hash.
- **Passwords cross one argument.** The enrollment CLI passes the hash on the `wrangler d1 execute --command` line, as its reset statement already passed the key digest. A salted slow hash in a process listing is not a usable secret.
- **Re-enrollment.** Migration `0009` leaves the operator with no email and no hash, so the owner must run the enrollment once per environment. The old `BACKOFFICE_KEY_DIGEST` secret is deleted by the owner after the new version works.
- **Isolation unchanged.** The MCP host, the routes under `apps/api/src/routes` and the account inbox do not import the backoffice, and no table named for the operator is read outside it.

## Evidence

- Node 24, WebCrypto PBKDF2-SHA256, 100000 iterations, 16-byte salt, 32-byte output, the development Mac on 2026-11-11: 13 ms and 14 ms in two runs. At 20000 iterations the same primitive took about 2.7 ms.
- The Workers PBKDF2 cap of 100000 iterations is the platform's documented limit for WebCrypto in Workers.

## Revisit when

- The Worker's CPU measurement on a staging deploy is over the Free plan's budget, or the Worker moves to Workers Paid, which allows a higher count.
- The platform raises the PBKDF2 cap, or a memory-hard algorithm fits the budget in WebCrypto or on the plan the Worker runs on.
- The operator count rises above one, which needs a per-operator lock and a real operators table.
- A passkey is added as the extra factor ADR 0031 reserves.
