# Go-live runbooks

The owner's step-by-step path from zero accounts to zapbip running on the official WhatsApp number at `mcp.zapbip.com`.

Follow the steps in order. Each step names the runbook that holds its detail. Every runbook step has an expected result and an `If it fails` line. Agents never run these steps: creating accounts, logging in, spending money and deploying are the owner's acts ([ADR 0026](../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md), [ADR 0027](../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)).

## Runbooks

- [cloudflare-setup.md](cloudflare-setup.md): the Cloudflare account, the free plan, R2, `wrangler login` and the error notification.
- [dns.md](dns.md): `zapbip.com` on Cloudflare and one DNS check per host.
- [meta-setup.md](meta-setup.md): the policy check, the Meta apps, the numbers, the tokens, the webhook and the templates.
- [deploy.md](deploy.md): resources, secrets, migrations, deploy, smoke, tail, rollback and the weekly cost check.
- [mintlify-publish.md](mintlify-publish.md): the official number, the npm package, the Mintlify site and its domain.

## Go-live order

1. **Cloudflare setup.** Do every step of `cloudflare-setup.md`.

   Expect: `wrangler whoami` prints your account.

   If it fails: the failing step of `cloudflare-setup.md` says what to check.
2. **DNS.** Do steps 1 to 3 of `dns.md`; step 4 follows each deploy and step 5 belongs to the docs publish.

   Expect: `zapbip.com` is active on Cloudflare.

   If it fails: nameserver changes can take hours; recheck with the `dig` command of the step before changing anything.
3. **Meta setup.** Do steps 1 to 8 of `meta-setup.md` for staging. Step 9 waits until a Worker is deployed; step 3 and the production halves of steps 5 to 8 wait for step 9 below.

   Expect: a Meta test number, the staging app secret, a system user token and a verify token.

   If it fails: the failing step of `meta-setup.md` says what to check. Do not continue to production with a missing policy answer (step 1).
4. **Resources and secrets.** Do steps 1 to 3 of `deploy.md` for staging.

   Expect: no `REPLACE_WITH_` is left in `apps/api/wrangler.jsonc` for staging, and `wrangler secret list` names all seven secrets.

   If it fails: `pnpm deploy:staging` refuses and names the placeholder or the missing secret; nothing is deployed.
5. **Migrate and deploy staging.** Do steps 4 and 5 of `deploy.md` for staging, then step 9 of `meta-setup.md` for the staging app.

   Expect: `pnpm migrate:staging` applies the migrations, `pnpm deploy:staging` ends with the smoke test and Meta verifies the staging webhook. On the first deploy, smoke checks 2 and 5 fail because the smoke connection does not exist yet; that is expected.

   If it fails: `deploy.md` step 8 rolls back; the previous Worker keeps serving.
6. **Smoke staging.** Do step 6 of `deploy.md`, then send `novo agente smoke` to the staging test number from your phone.

   Expect: five `PASS` lines from `pnpm smoke:staging` and a reply on your phone.

   If it fails: read the failing check name in `deploy.md` step 6.
7. **Rollback rehearsal.** Deploy a second staging version, roll back to the first, run the smoke test and deploy again, as in step 8 of `deploy.md`.

   Expect: the smoke test passes after each move. Paste the output under "Go-live record" in `deploy.md`.

   If it fails: stop. Do not go to production with an untested rollback.
8. **Meta templates approved.** Do step 11 of `meta-setup.md`; submit the templates as soon as the production WhatsApp account exists, because approval takes up to a day.

   Expect: all four templates (two names, two languages) show `Approved` in WhatsApp Manager.

   If it fails: a rejected template is edited and resubmitted; production waits for approval.
9. **Production.** Do steps 3, 5, 6, 7 and 8 of `meta-setup.md` for production, `deploy.md` steps 1 to 6 for production, then steps 9 and 10 of `meta-setup.md` for the production app.

   Expect: four `PASS` lines from `pnpm smoke:production` and the health route answering on `mcp.zapbip.com`.

   If it fails: `deploy.md` step 8 rolls back the Worker.
10. **Publish the docs.** Do every step of `mintlify-publish.md`; it needs DNS (step 2) and, for the final merge, the official number and the npm package.

    Expect: `docs.zapbip.com` serves the site in English and in Portuguese.

    If it fails: the failing step of `mintlify-publish.md` says what to check.
