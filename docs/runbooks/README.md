# Go-live runbooks

The owner's step-by-step path from zero accounts to zapbip running on the official WhatsApp number at `mcp.zapbip.com`.

Follow the steps in order. Each step names the runbook that holds its detail. Every runbook step has an expected result and an `If it fails` line. Agents never run these steps: creating accounts, logging in, spending money and deploying are the owner's acts ([ADR 0026](../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md), [ADR 0027](../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)). Staging needs only its placeholders and secrets; the official number, the company facts and the published packages gate the docs and production, so staging comes first and does not wait for them. The go-live record is the list at the bottom of `deploy.md`: copy it into a private note and fill it as you go.

## Runbooks

- [cloudflare-setup.md](cloudflare-setup.md): the Cloudflare account, the free plan, R2, `wrangler login` and the error notification.
- [dns.md](dns.md): buying `zapbip.com`, putting it on Cloudflare and one DNS check per host.
- [meta-setup.md](meta-setup.md): the policy check, the Meta apps, the numbers, the tokens, the webhook, Live mode and the templates.
- [deploy.md](deploy.md): resources, secrets, migrations, deploy, smoke, tail, rollback, the weekly cost check and the go-live record.
- [mintlify-publish.md](mintlify-publish.md): the official number, the company facts, the packages, the docs preflight, the Mintlify site and its domain.

## Go-live order

1. **Prepare your machine.** You need git, Node 24, pnpm and the repository. Install git from `https://git-scm.com/downloads`. Install Node 24 with a version manager (`nvm install 24` after installing `https://github.com/nvm-sh/nvm`, or the installer at `https://nodejs.org`). Turn on pnpm with `corepack enable`, which reads the pinned version from `package.json`. Then clone the repository with `git clone https://github.com/dhyegocalota/zapbip.git`, open the folder, run `pnpm install --frozen-lockfile` and finally `.agents/hooks/doctor.sh`.

   Expect: `node --version` prints `v24` and something, `pnpm --version` prints `8.15.9`, and the doctor prints `ok` for every required tool.

   If it fails: the doctor prints a `fix:` line for each missing tool; run it, then run the doctor again. A `corepack` error means Node is older than 24.
2. **Cloudflare setup.** Do every step of `cloudflare-setup.md`.

   Expect: `wrangler whoami` prints your account.

   If it fails: the failing step of `cloudflare-setup.md` says what to check.
3. **DNS.** Do steps 1 to 4 of `dns.md`; step 5 follows each deploy and step 6 belongs to the docs publish.

   Expect: `zapbip.com` is active on Cloudflare.

   If it fails: nameserver changes can take hours; recheck with the `dig` command of the step before changing anything.
4. **Meta setup.** Do steps 1 to 8 of `meta-setup.md` for staging, plus step 3 for the production number (with its payment method and two-step PIN). Step 9 waits until a Worker is deployed; the production halves of steps 5 to 8 wait for the production deploy below.

   Expect: a Meta test number, the staging app secret, a system user token and a verify token.

   If it fails: the failing step of `meta-setup.md` says what to check. Do not continue to production with a missing policy answer (step 1).
5. **Meta templates approved.** Do step 11 of `meta-setup.md` now, because approval takes up to a day and the production WhatsApp account already exists from step 3.

   Expect: all four templates (two names, two languages) show `Approved` in WhatsApp Manager.

   If it fails: a rejected template is edited and resubmitted; production waits for approval.
6. **Resources and secrets.** Do steps 1 to 3 of `deploy.md` for staging.

   Expect: no `REPLACE_WITH_` is left in the staging block of `apps/api/wrangler.jsonc`, and `wrangler secret list` names all seven secrets.

   If it fails: `pnpm deploy:staging` refuses and names the placeholder or the missing secret; nothing is deployed.
7. **Migrate and deploy staging.** Do steps 4 and 5 of `deploy.md` for staging, with `pnpm deploy:staging --first-deploy`, then step 9 of `meta-setup.md` for the staging app.

   Expect: `pnpm migrate:staging` applies the migrations, the deploy ends with the smoke test (checks 1, 3 and 4 pass; checks 2 and 5 are skipped on a first deploy) and Meta verifies the staging webhook.

   If it fails: `deploy.md` step 8 rolls back; the previous Worker keeps serving.
8. **Smoke staging.** Do step 6 of `deploy.md`, then send `novo agente smoke` to the staging test number from your phone.

   Expect: five `PASS` lines from `pnpm smoke:staging` and a reply on your phone.

   If it fails: read the failing check name in `deploy.md` step 6.
9. **Rollback rehearsal.** Deploy a second staging version, roll back to the first, run the smoke test and deploy again, as in step 8 of `deploy.md`.

   Expect: the smoke test passes after each move. Paste the output into the go-live record.

   If it fails: stop. Do not go to production with an untested rollback.
10. **Publish the packages.** Do steps 2, 4 and 5 of `mintlify-publish.md`: `zapbip` and `@zapbip/openclaw-plugin` on npm, and `zapbip-platform` on PyPI.

   Expect: `npm view` lists your npm user as a maintainer of both npm packages, and `pip index versions zapbip-platform` lists `0.1.0`.

   If it fails: the failing step of `mintlify-publish.md` says what to check.
11. **Company facts and official number.** Do steps 1 and 3 of `mintlify-publish.md`: the production number from step 3 of `meta-setup.md`, and the Logic Bit company facts.

    Expect: neither `OFFICIAL_NUMBER_UNSET` nor `COMPANY_FACT_UNSET` is left in `libs/types/src/constants.ts` apart from their definitions.

    If it fails: the production deploy and `pnpm docs:preflight` refuse and name what is still unset.
12. **Publish the docs.** Do steps 6 to 11 of `mintlify-publish.md`, starting with `pnpm docs:preflight`; it needs DNS (step 6 of `dns.md`). The privacy page is part of the site.

    Expect: `docs.zapbip.com` serves the site in English and in Portuguese, and `https://docs.zapbip.com/help/privacy` loads.

    If it fails: the failing step of `mintlify-publish.md` says what to check.
13. **Meta live mode.** Do steps 5 to 8 of `meta-setup.md` for production (the production app, its secret, its system user token and its verify token), then step 10 with the privacy page of step 11.

    Expect: the production app shows Live and the business verification shows In review or Verified.

    If it fails: step 10 of `meta-setup.md` says what Meta wants corrected.
14. **Production deploy.** Do `deploy.md` steps 1 to 5 for production, with `pnpm deploy:production --first-deploy`, then step 9 of `meta-setup.md` for the production app.

    Expect: the deploy ends with the smoke test (checks 1, 3 and 4 pass), the health route answers on `mcp.zapbip.com` and Meta verifies the production webhook.

    If it fails: `deploy.md` step 8 rolls back the Worker.
15. **Smoke production.** Do step 6 of `deploy.md` for production.

    Expect: four `PASS` lines from `pnpm smoke:production`.

    If it fails: read the failing check name in `deploy.md` step 6.
