# Plan: Start link

**Spec:** spec.md
**Tier:** 🔴 structural
**Seam:** `NumberRegistry` (one new read), `app.ts` (one new route), `libs/types` constants, the docs snippet and the deploy preflight
**Assumptions (decided, owner can override):**
- Oldest active number, load spread by closing a number ([ADR 0035](../../adr/0035-a-start-link-on-the-worker-picks-the-number-new-owners-write-to.md)).
- `INSTALL_PAGE_LIMITER` is reused with a `start:` key prefix; no new binding.
- The docs link to production only; staging serves `/start` for the walk.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G0 | `libs/types/src/constants.ts` (additions only), `libs/types/src/enums.ts` (`HttpStatus.Found`) | `developer-0` |
| G1 | `apps/api/src/routes/start-link.ts`, `start-link-copy.ts`, `apps/api/src/app.ts`, `apps/api/src/numbers/number-registry.ts`, `apps/api/src/adapters/d1/d1-number-registry.ts`, `apps/api/src/contract/log.ts`, `apps/api/test/unit/start-link-*.test.ts`, `apps/api/test/integration/start-link*.test.ts`, `apps/api/test/support/**` (new helpers only), `apps/api/src/dev/**`, `.claude/rules/backoffice.md`, `docs/runbooks/backoffice.md`, `docs/runbooks/meta-setup.md` | `developer-1` |
| G2 | `apps/docs/snippets/**/official-number.mdx` (renamed `start-link.mdx`), `apps/docs/index.mdx`, `apps/docs/pt-br/index.mdx`, `apps/docs/get-started/how-to-start.mdx`, `apps/docs/pt-br/get-started/how-to-start.mdx`, `libs/agents/supported/*/page.*.mdx`, regenerated `apps/docs/agents/*.mdx` and `apps/docs/pt-br/agents/*.mdx`, `apps/docs/e2e/get-started.spec.ts`, `apps/docs/e2e/from-zero.spec.ts`, `tools/repository-shape/src/docs-experience.test.ts` | `developer-2` |
| G3 | `apps/api/src/operations/deploy-preflight.ts`, `apps/api/scripts/docs-preflight.ts`, `apps/api/scripts/deploy.ts`, `apps/api/test/unit/deploy-preflight.test.ts`, `apps/api/test/e2e/deploy-dry-run.e2e.test.ts`, `docs/runbooks/deploy.md`, `docs/runbooks/mintlify-publish.md` | `developer-3` |
| G4 (lead, last) | `libs/types/src/constants.ts` (deletions: `OFFICIAL_NUMBER_UNSET`, `OFFICIAL_WHATSAPP_NUMBER`), `docs/features/start-link/**`, `docs/features/README.md` | lead |

## Sequencing

G0 lands first (a few lines, adds names only) and is merged into every lane branch. Then G1, G2 and G3 run in parallel in their own worktrees: they share no file. G2 and G3 stop using the official number, G1 adds the route. G4 runs when G2 and G3 are merged: deleting the constants earlier would break their old tests. Lanes take `main` and each other by merge, never rebase. G1 does not depend on G2 or G3; G2 needs only G0 for `START_LINK`.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G0

- [x] **Step 1 (pin):** the constants exist: `START_LINK_PATH`, `START_LINK`, `START_LINK_LANGUAGE_PARAMETER`, `WHATSAPP_LINK_ORIGIN`, `WHATSAPP_LINK_TEXT_PARAMETER`, `START_PREFILLED_TEXT` for both `OwnerLocale`s, and `HttpStatus.Found`. A `libs/types` unit test pins the values (`START_LINK` equals `https://mcp.zapbip.com/start`; both texts are non-empty and are not any bare-word command of ADR 0015). Commit as `pin`.

### G1

- [x] **Step 2 (red):** `start-link-target.test.ts` (unit): the pure builder `startLinkTarget({ displayNumber, locale })` returns `https://wa.me/<digits>?text=<encoded fixed text>`; rejects a display number that fails the pattern. The builder is a stub that throws `startLinkTarget is not implemented`; record the failure text.
- [x] **Step 3 (red):** `start-link-language.test.ts` and `start-link-page.test.ts` (unit): the `lang` parser (`en`, `pt-BR`, absent, unknown, repeated) and the page renderer (both locales, `lang` order, no script/style/link to `wa.me`). Stubs throw `<name> is not implemented`.
- [x] **Step 4 (red):** `start-link.test.ts` (integration, real D1 in workerd): the route table of the spec, state and age selection, headers and rate limit. Fails today with `404` on `/start`.
- [x] **Step 5 (red):** `start-link-attack.test.ts` (integration): open-redirect and injection attempts. Fails today with `404`.
- [x] **Step 6:** implement `findStartDisplayNumber` on the port and the D1 adapter (reads no `sealed_` column), the pure builder, the parser, the page renderer and the copy file; make steps 2 and 3 green.
- [x] **Step 7:** implement `createStartLinkRoute` and mount it in `app.ts`; add the `LogEvent`s `StartLinkFailed` and `StartLinkInvalidNumber` (names only); make steps 4 and 5 green.
- [x] **Step 8:** `.claude/rules/backoffice.md` gets a bullet on the start link (path glob extended to `apps/api/src/routes/start-link*.ts`); `backoffice.md` runbook gets the capacity advice (close a full number; check `accounts.number_id IS NULL` before registering a second number); `meta-setup.md` stops saying "the official number" where it means any production number.

### G2

- [ ] **Step 9 (red):** `docs-experience.test.ts`: replace the official-number tests with a start-link snippet test per language (`START_LINK` plus the `lang` value is linked; the file contains no `wa.me` and no `OFFICIAL_`), and a docs-wide test that no file under `apps/docs` and `libs/agents/supported` contains `wa.me` or an `OFFICIAL_NUMBER` token. Red because the snippet still prints the old link. Record the failure text.
- [ ] **Step 10:** rename the snippets to `start-link.mdx`, rewrite them, update every importer (the source pages under `libs/agents/supported` first, then regenerate `apps/docs/agents` and `apps/docs/pt-br/agents` with the registry's generator), and keep `docs.json` valid. Green for step 9.
- [ ] **Step 11:** `get-started.spec.ts` and `from-zero.spec.ts` assert `a[href="${START_LINK}?lang=<language>"]` is visible and that no `wa.me` link exists on the page. Playwright config and fixtures otherwise unchanged.

### G3

- [ ] **Step 12 (red):** `deploy-preflight.test.ts` and `deploy-dry-run.e2e.test.ts`: remove the cases that expect the number refusal, and add a case per preflight (docs and Worker, production) that a production run with every other check green passes without any number input. Red because the input type still requires `officialWhatsAppNumber` and the preflight still refuses `OFFICIAL_NUMBER_UNSET`.
- [ ] **Step 13:** remove the number check and the `officialWhatsAppNumber` field from `deploy-preflight.ts`, `docs-preflight.ts` and `deploy.ts`; green for step 12.
- [x] **Step 14:** `deploy.md` (the refusal list and the go-live check), `mintlify-publish.md` (step 1 and its expectation, renumbering the following steps and every cross-reference to "step N") stop mentioning the number.

### G4

- [ ] **Step 15:** after G2 and G3 are merged, delete `OFFICIAL_NUMBER_UNSET` and `OFFICIAL_WHATSAPP_NUMBER` from `libs/types`; `rg 'OFFICIAL_(WHATSAPP_)?NUMBER' --glob '!docs/features/**' --glob '!docs/adr/**'` returns nothing; `pnpm typecheck` is green.
- [ ] **Step 16:** the owner's spec approval is written, statuses move `Approved`, `Building`, `In review`, `Shipped <date>` with the index row in step with the spec.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | A constant name collides with an existing one | `pnpm typecheck` duplicate export | rename in G0 before the lanes branch |
| 6 | The adapter query picks `closed` or `pending` | `start-link.test.ts` state cases fail | fix the `WHERE`; nothing is deployed |
| 7 | The route shadows another path or is reached on the backoffice host | `host-dispatch` tests and `/health` still green; backoffice host answers `404` for `/start` | remove the mount from `app.ts`; the Worker redeploys the previous version |
| 7 | Rate limit shares a counter with the install page | the install page test hits `429` after `/start` calls | prefix the key; add the regression test |
| 10 | A generated agent page keeps the old import | `docs-experience.test.ts` and the Mintlify build fail on the missing snippet | regenerate; the old snippet name is gone, so the miss is loud |
| 13 | The production deploy loses a real check | the dry-run e2e still passes with the number unset, and the other refusals stay red when their input is broken | restore from git; the check carried no other input |
| 15 | A forgotten consumer of the constant | `pnpm typecheck` fails with `has no exported member` | restore the constants and the consumer's old code, then remove them in a follow-up |
| After deploy | No active number in production, the link shows the `503` page | the smoke check of the Zapbip walk, or a new owner report | register or reactivate a number in the backoffice; no deploy needed |

**Steps with no backout:** none. The change adds one read-only route and removes constants; a deploy rolls back by redeploying the prior Worker version, and the docs publish rolls back by republishing the prior commit. The docs link stays valid on the previous Worker only if the route exists there, so **publish the docs after the Worker with `/start` is live** (go-live order below).

## Go-live order

1. Deploy the Worker (`pnpm deploy:production`) with at least one `active` number in the registry.
2. `curl -sI https://mcp.zapbip.com/start` shows `302` and a `wa.me` location (a human runs it; the agent does not deploy).
3. Publish the docs (`mintlify-publish.md`).

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** `security-reviewer` returned `CLEAR` or `NOT APPLICABLE` (a public unauthenticated route and a removed deploy gate are in its scope).
- [ ] **/check-ui:** screenshots and video of the no-number page and of the redirect hop recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened with merge sensitivity and the human checklist (public route, deploy gate removed, docs order).
