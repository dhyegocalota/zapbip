# The docs walk fails under load with `requestfailed .../_mintlify/api/user` and passes alone
- Date: 2026-11-07
- Inspired by: `pnpm verify all` docs gate, `from-zero.spec.ts` "from zero in en at narrow"
- Revisited: 2026-11-07 — still true

## Signal
One full `pnpm verify all` fails the docs walk with the noise entry `requestfailed http://localhost:<port>/_mintlify/api/user`. Run alone, the same spec passes three times in three.

## Cause
`mint dev` asks its preview for the signed-in user on each page. When the walk navigates away before that request answers, the browser aborts it (`net::ERR_ABORTED`) and Playwright reports `requestfailed`. A loaded machine widens the window. The entry carried only the URL, so it could not tell an abort from a refused connection.

## Do
Build every `requestfailed` entry with its error text (`requestFailedNoiseOf`) and allow only the aborted form of this path in `DOCS_WALK_NOISE_ALLOWLIST`. A 500, a refused connection or another path stays a failure.

## Anchor
- `apps/docs/e2e/support/docs-experience.ts` (`DOCS_WALK_NOISE_ALLOWLIST`, `requestFailedNoiseOf`, `isAllowedNoise`)
- `apps/docs/e2e/from-zero.spec.ts`
- `tools/repository-shape/src/docs-walk-support.test.ts`
