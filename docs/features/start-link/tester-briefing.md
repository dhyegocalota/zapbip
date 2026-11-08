# Tester briefing: Start link

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `libs/types/src/constants.ts`, `enums.ts` — `START_LINK`, `START_LINK_PATH`, `START_LINK_LANGUAGE_PARAMETER`, `WHATSAPP_LINK_ORIGIN`, `WHATSAPP_LINK_TEXT_PARAMETER`, `START_PREFILLED_TEXT`, `DISPLAY_NUMBER_PATTERN`, `HttpStatus.Found`.
- `apps/api/src/routes/start-link*.ts` — `GET /start` redirects to `https://wa.me/<digits>?text=<fixed text>` of the oldest active number; a `503` page when there is none; `400` for a bad `lang`; `429` over the limit.
- `apps/api/src/routes/private-response.ts` — the private headers and the response helpers shared by the install page and the start link.
- `apps/api/src/numbers/number-registry.ts`, `adapters/d1/d1-number-registry.ts` — `findStartDisplayNumber`.
- `apps/api/src/dev/development-number.ts` — the seeded dev number carries the plus sign.
- `apps/docs/snippets/**/start-link.mdx`, `libs/agents/supported/*/page.*.mdx`, regenerated agent pages, the two docs Playwright specs — the docs link the start link.
- `apps/api/src/operations/deploy-preflight.ts`, `scripts/deploy.ts`, `scripts/docs-preflight.ts` — no official number check or input.
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
| `d9a80ece` | `test/unit/start-link-target.test.ts` | 16 failed. `Error: startLinkTarget is not implemented for +5511977770000 pt_BR` (one per case, e.g. `... for 5511977770000 en_US`, `... for +5511977770000/../evil en_US`) | `72d294e5` |
| `a310fbc7` | `test/unit/start-link-language.test.ts`, `start-link-page.test.ts` | 25 failed in 2 files. `Error: startLinkLocaleOf is not implemented for en` (also `pt-BR`, `fr`, `EN`, `__proto__`, `undefined`, `en,en`) and `Error: renderStartUnavailablePage is not implemented for pt_BR` / `en_US` | `72d294e5` |
| `834d96a7` | `test/integration/start-link.test.ts` | 21 failed, 6 passed (27). `AssertionError: expected 404 to be 302` (SL-W1 to W3, W5 to W7), `expected 404 to be 503`, `expected 404 to be 400`, `expected 404 to be 500`, `expected 404 to be 429`, `expected null to be 'no-store'`, `expected null to be 'https://wa.me/5511977770001?text=Oi!%…'`. The 6 that passed already expect `404` (SL-W15 and the rate-limit separation), so they are pins | `4e1bc78a` |
| `d98ccae5` | `test/integration/start-link-attack.test.ts` | 19 failed. `AssertionError: expected 404 to be 302` (SL-S1, SL-S3), `expected 404 to be 400` (SL-S2), `expected 404 to be 503` (SL-S4), `expected null to be 'https://wa.me/5511977770003?text=Oi!%…'` | `4e1bc78a` |
| `68577ae1` | `tools/repository-shape/src/docs-experience.test.ts` | 3 failed. `ENOENT` reading `apps/docs/snippets/start-link.mdx` and `snippets/pt-br/start-link.mdx`; the docs-wide check found `wa.me` and `OFFICIAL_NUMBER` in the two `official-number` snippets | `7c486dc4` |
| `561da1d3` | `deploy-preflight.test.ts`, `deploy-entry.test.ts`, `docs-preflight-entry.test.ts`, `deploy-dry-run.e2e.test.ts` | `pnpm typecheck`: `TS2741 Property 'officialWhatsAppNumber' is missing in type ... but required in type 'WorkerPreflightInput'` / `'DocsPreflightInput'` / `'DocsPreflightEntry'`. The runtime run is green (an absent number never equals the sentinel) | `c72f7445` |
| `feeda98d` | `tools/repository-shape/src/runbooks.test.ts` | 5 failed. The go-live order expects `Company facts`; three runbooks match `/official number/`; `deploy.md` lacks `curl -sI https://mcp.zapbip.com/start` | `3f24aa53` |
| review fix | `development-number.test.ts`, `start-link-page.test.ts` | `expected '5511900000000' to match /^\+\d{7,15}$/`; `expected 'No momento não há um número do zapbip…' not to match /owner\|dono/i` (and the en_US body) | the `fix(start-link)` commit after it |

Pins (green on arrival): `libs/types/src/start-link-constants.test.ts`, the `libs/core` `command.test.ts` case that `parseAccountCommand` returns `null` for both prefilled texts, the literal encoded target in `start-link-target.test.ts`, and the review gap tests (SL-S5, SL-S6, SL-A1, SL-A2, SL-W18, the private headers on `400` and `429`, `start_link.failed` in SL-W12, SL-W14 without a registry read).

## Hypotheses to attack

1. Hypothesis: `/start` never redirects anywhere but `wa.me/<registered digits>`. Break it by: a stored display number with a path or a query, `Host` and `X-Forwarded-*` swaps, encoded and doubled `lang`.
2. Hypothesis: the choice is made per request. Break it by: close the oldest number in the backoffice between two reloads, and read the `Location`.
3. Hypothesis: the shared `privateResponse` changed nothing on the install page. Break it by: diff the headers of `/i/<code>` on `main` and on the branch (`Content-Type` for the markdown answer, the `404`, `429`, `410`).
4. Hypothesis: the production deploy lost no gate. Break it by: break each remaining preflight input in turn in the dry run and read the refusal.
5. Hypothesis: the docs print no number. Break it by: search the built site for `wa.me` and `+55`.

## Known gaps

- `OFFICIAL_WHATSAPP_NUMBER` and `OFFICIAL_NUMBER_UNSET` stay in `libs/types` until G4.
- PR 24 (`fix/preflight-pre-launch`) was not merged when G3 landed; it edits the same lines of `deploy-preflight.ts`, `deploy.ts`, `deploy.md` and `runbooks.test.ts`, so the merge needs a hand resolution (both remove the same number check and the same step 15 title).
- `apps/api/scripts/smoke.ts` still says "zapbip official number" in a message; it is outside the groups' files.
- The redirect is not followed to a real `wa.me`; the Playwright MCP walk intercepts it.
