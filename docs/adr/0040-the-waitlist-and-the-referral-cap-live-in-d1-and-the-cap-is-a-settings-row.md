# 0040. The waitlist and the referral cap live in D1, and the cap is a settings row

- Status: Accepted
- Date: 2026-11-12
- Deciders: Dhyego Calota (owner, delegated 2026-11-12); Claude (advisor)
- Inspired by: the owner's order of 2026-11-12 ("limita a 5 por pessoa no início e eu preciso conseguir mudar esse número fácil depois"); the directory in D1 used by the account rows ([ADR 0009](0009-cloudflare-workers-with-one-durable-object-per-account.md)); [ADR 0031](0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md) (backoffice writes behind CSRF and a step-up code)

## Context

Two things must be stored: the waitlist (one row per email, with its referral code and the referrer) and the number of referrals each person may get credited. The owner must change the referral number without a deploy. The waitlist is not an account, is not per owner and has no agent behind it, so the Durable Object per account ([ADR 0009](0009-cloudflare-workers-with-one-durable-object-per-account.md)) does not fit.

D1 is already the shared directory, the backoffice reads and writes it, and its migrations run in the deploy.

## Decision

1. Table `landing_waitlist` in D1, migration `0010_landing_waitlist.sql`: `email` (normalised, unique), `locale`, `referral_code` (unique, random, 12 characters), `referred_by` (a referral code or null), `credited` (0 or 1), `created_at`. The unique keys are the database's guarantee against duplicates under concurrency.
2. Table `site_settings` in the same migration: `key` (primary key), `value`, `updated_at`. The migration seeds the row `waitlist_referral_cap` with `5`. The application reads the row and treats a missing row as an error. It never falls back to a literal, because a silent default is what the owner forbids in the code.
3. The number is a constant `DEFAULT_WAITLIST_REFERRAL_CAP = 5` in `libs/types/src/constants.ts`. It is the value the migration seeds and the value the test that checks the seed compares against. Changing the limit later is a backoffice edit of the row, not a constant edit.
4. The credit decision is one SQL statement: the insert reads the referrer's credited count and the cap from `site_settings` in the same statement, and writes `credited = 1` only while the count is below the cap. Two signups that race for the last slot cannot both be credited.
5. A referral credit never changes a row that already exists. A duplicate email returns without a write.
6. The backoffice edits the cap through `POST` with CSRF and a fresh step-up code, the same rules as registry changes, and writes an audit row. The change applies to the next signup, with no deploy and no cache.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `[vars]` entry in `wrangler.jsonc` | simplest, no table | changing it means a deploy; the owner asked for a change without a deploy | fails the order |
| Durable Object keyed on the waitlist | strong consistency for the count | a new object class and a migration of the Worker; no need, D1 already serialises writes per database | more moving parts than the constraint needs |
| Workers KV for the cap | fast reads | eventually consistent: a cap change may take a minute to reach every edge, and the credit race is not solved | the race rule needs a transactional check |
| Cap as a column on the waitlist table | no new table | the cap is global, so it would repeat on every row | wrong shape |
| No cap enforced in the database, only in code | no SQL subquery | the race in decision 4 lets two requests exceed the cap | the cap is a business rule the database must guard |

## Consequences

- Two new tables, one migration. The migration is additive and runs on staging and production like the earlier ones; rollback is dropping the two tables, which loses the waitlist, so the owner takes a D1 export before the first production deploy.
- Lowering the cap does not remove credits already given. A referrer above the new cap keeps the credits and gets no new ones.
- The backoffice list orders by credited count and join time, which is the queue order from the referral reward.
- The migration's seed literal and `DEFAULT_WAITLIST_REFERRAL_CAP` are two copies of the number. A test reads the migration file and asserts they match.

## Evidence

- The migration runner and the D1 bindings are already used by the account and backoffice migrations (`0005`, `0009`), so the pattern is tested.
- The single-statement credit check is a standard SQL insert with a subquery; the race test in the test plan runs concurrent signups against the same referrer.

## Revisit when

- The waitlist needs per-campaign caps or per-referrer caps that differ from the global cap.
- The list grows past what a D1 table query on the backoffice page reads in one request.
