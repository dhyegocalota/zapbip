# Tester briefing: Start link

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `libs/types/src/constants.ts`, `enums.ts` — `START_LINK`, `START_LINK_PATH`, `START_LINK_LANGUAGE_PARAMETER`, `WHATSAPP_LINK_ORIGIN`, `WHATSAPP_LINK_TEXT_PARAMETER`, `START_PREFILLED_TEXT`, `DISPLAY_NUMBER_PATTERN`, `HttpStatus.Found`.
- `apps/api/src/routes/start-link*.ts` — `GET /start` redirects to `https://wa.me/<digits>?text=<fixed text>` of the oldest active number; a `503` page when there is none; `400` for a bad `lang`; `429` over the limit.
- `apps/api/src/routes/private-response.ts` — the private headers and the response helpers shared by the install page and the start link.
- `apps/api/src/numbers/number-registry.ts`, `adapters/d1/d1-number-registry.ts` — `findStartDisplayNumber`.
- `apps/api/src/dev/development-number.ts` — the seeded dev number carries the plus sign.
- `apps/docs/snippets/**/start-link.mdx`, `libs/agents/supported/*/page.*.mdx`, regenerated agent pages, the two docs Playwright specs — the docs link the start link.
- `apps/api/src/operations/deploy-preflight.ts`, `scripts/docs-preflight.ts` — no official number check or input (`scripts/deploy.ts` was not changed here; main already dropped its number input).
- `docs/runbooks/{deploy,mintlify-publish,README,backoffice,meta-setup}.md` — no official number, the go-live checks the start link.

## How to run

```bash
pnpm dev
curl -sI "http://localhost:<worker port>/start?lang=en"
pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts test/integration/start-link
pnpm --filter @zapbip/docs test:walk
```

## Red today, green after

Each red commit is checked out alone and its test run; the output below is what the run printed.

| Commit | Test | Red output | Green after |
|--------|------|------------|-------------|
| `36cf7b5e` | `test/unit/start-link-target.test.ts` | 16 failed. `Error: startLinkTarget is not implemented for +5511977770000 pt_BR` (one per case, e.g. `... for 5511977770000 en_US`, `... for +5511977770000/../evil en_US`) | `fdba89d5` |
| `5ad0a907` | `test/unit/start-link-language.test.ts`, `start-link-page.test.ts` | 25 failed in 2 files. `Error: startLinkLocaleOf is not implemented for en` (also `pt-BR`, `fr`, `EN`, `__proto__`, `undefined`, `en,en`) and `Error: renderStartUnavailablePage is not implemented for pt_BR` / `en_US` | `fdba89d5` |
| `1d9977c6` | `test/integration/start-link.test.ts` | 21 failed, 6 passed (27). `AssertionError: expected 404 to be 302` (SL-W1 to W3, W5 to W7), `expected 404 to be 503`, `expected 404 to be 400`, `expected 404 to be 500`, `expected 404 to be 429`, `expected null to be 'no-store'`, `expected null to be 'https://wa.me/5511977770001?text=Oi!%…'`. The 6 that passed already expect `404` (SL-W15 and the rate-limit separation), so they are pins | `b373c291` |
| `43f73780` | `test/integration/start-link-attack.test.ts` | 19 failed. `AssertionError: expected 404 to be 302` (SL-S1, SL-S3), `expected 404 to be 400` (SL-S2), `expected 404 to be 503` (SL-S4), `expected null to be 'https://wa.me/5511977770003?text=Oi!%…'` | `b373c291` |
| `0e7783fe` | `tools/repository-shape/src/docs-experience.test.ts` | 3 failed. `ENOENT` reading `apps/docs/snippets/start-link.mdx` and `snippets/pt-br/start-link.mdx`; the docs-wide check found `wa.me` and `OFFICIAL_NUMBER` in the two `official-number` snippets | `67f9623e` |
| `50789d26` (pin at runtime; red only by `pnpm typecheck`) | `deploy-preflight.test.ts`, `deploy-entry.test.ts`, `docs-preflight-entry.test.ts`, `deploy-dry-run.e2e.test.ts` | `pnpm typecheck`: `TS2741 Property 'officialWhatsAppNumber' is missing in type ... but required in type 'WorkerPreflightInput'` / `'DocsPreflightInput'` / `'DocsPreflightEntry'`. The runtime run is green (an absent number never equals the sentinel) | `de2906cd` |
| `2778caa3` | `tools/repository-shape/src/runbooks.test.ts` | 5 failed. The go-live order expects `Company facts`; three runbooks match `/official number/`; `deploy.md` lacks `curl -sI https://mcp.zapbip.com/start` | `4960d58d` |
| `3da60e07` | `test/unit/start-link-page.test.ts`, `test/integration/start-link.test.ts` (the hashed style block) | 4 failed in the unit file: `AssertionError: expected [] to deeply equal [ '' ]` (no `<style>` block in the page) and the same for the light and dark check; 4 failed in the integration file: `AssertionError: expected 'default-src \'none\'' to be 'default-src \'none\'; style-src \'\''` | `b932fa1d` |
| review fix | `development-number.test.ts`, `start-link-page.test.ts` | `expected '5511900000000' to match /^\+\d{7,15}$/`; `expected 'No momento não há um número do zapbip…' not to match /owner\|dono/i` (and the en_US body) | the `fix(start-link)` commit after it |

Pins (green on arrival): `libs/types/src/start-link-constants.test.ts`, the `libs/core` `command.test.ts` case that `parseAccountCommand` returns `null` for both prefilled texts, the literal encoded target in `start-link-target.test.ts`, and the review gap tests (SL-S5, SL-S6, SL-A1, SL-A2, SL-W18, the private headers on `400` and `429`, `start_link.failed` in SL-W12, SL-W14 without a registry read).

## Hypotheses to attack

1. Hypothesis: `/start` never redirects anywhere but `wa.me/<registered digits>`. Break it by: a stored display number with a path or a query, `Host` and `X-Forwarded-*` swaps, encoded and doubled `lang`.
2. Hypothesis: the choice is made per request. Break it by: close the oldest number in the backoffice between two reloads, and read the `Location`.
3. Hypothesis: the shared `privateResponse` changed nothing on the install page. Break it by: diff the headers of `/i/<code>` on `main` and on the branch (`Content-Type` for the markdown answer, the `404`, `429`, `410`). Pinned by `apps/api/test/integration/install-page-headers.test.ts` (pin, `53dfb5d7`): the full header set of 200, 410, 404, 429 and 400 equals the values main produced; the same file passes against main's `install-page.ts`.
4. Hypothesis: the production deploy lost no gate. Break it by: break each remaining preflight input in turn in the dry run and read the refusal.
5. Hypothesis: the docs print no number. Break it by: search the built site for `wa.me` and `+55`.

## Known gaps

- PR 24 (`fix/preflight-pre-launch`) was not merged when G3 landed; it edits the same lines of `deploy-preflight.ts`, `deploy.ts`, `deploy.md` and `runbooks.test.ts`, so the merge needs a hand resolution (both remove the same number check and the same step 15 title).
- The redirect is not followed to a real `wa.me`; `page.route` on `https://wa.me/**` does not intercept the redirect hop; the walk answers the first `/start` hop with `route.fetch({ maxRedirects: 0 })`, records the `Location` and fulfils it as a 200 text body.
- The backoffice is not signed in by an agent; the capacity rows change `whatsapp_numbers.state` in the local development database with `wrangler d1 execute --local`.
- G4 (`f5bf69cf`, red `dae45eba`): `official-number.test.ts` listed `apps/api/scripts/smoke.ts`, both `faq.mdx`, both `index.mdx`, both `how-it-works` SVGs and `libs/types/src/constants.ts`; green after. The FAQ sentence now says the official WhatsApp Cloud API, which is true.

- The docs preflight now refuses a start link that does not answer `302` to `https://wa.me/` (`PreflightStep.StartLink`, red `620d3970`, green `b6765555`); `PackageAnswer` carries `location` and the fetcher no longer follows redirects.

## Caveats of the evidence

- Commits `50789d26..7fdfb434` ran against a preflight suite that the rebase had truncated (`deploy-preflight.test.ts` and `deploy-dry-run.e2e.test.ts`); G3 is proven from `1d98e48d` onward, by the full verify.
