# Deploy

Create the resources, set the secrets, migrate, deploy, smoke test, watch, roll back and check the weekly cost, for staging and then for production.

Agent shells never hold production Cloudflare credentials, and nobody runs `wrangler login`: an OAuth session belongs to the OS user, so every agent shell on the machine can use it. Create a Cloudflare API token scoped to the Workers, D1 and R2 permissions this runbook uses, export it as `CLOUDFLARE_API_TOKEN` only in your own interactive shell for the deploy, and run `unset CLOUDFLARE_API_TOKEN` when you finish. Run every command below only in that shell. If the session-start doctor reports that wrangler is logged in, run `wrangler logout` first, and unset any exported `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_API_KEY` in your agent shells: while a login or an exported credential exists, the deploy guard refuses every wrangler command an agent types except `whoami`, `--version` and `logout`.

Do every step for staging first, then repeat steps 1 to 6 for production. Run all commands from the repository root on the owner's machine ([ADR 0027](../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)). Staging is `zapbip-api-staging` on `mcp-staging.zapbip.com`; production is `zapbip-api` on `mcp.zapbip.com`. Agents never run these commands.

Migration rule: a migration that has reached a deployed environment is never edited. A fix is a new numbered migration, and every migration must work with the Worker version still running, so a column is added in one deploy and its old use is removed in a later one.

1. **Create the resources.** Run these once per environment, with `staging` shown:

   ```
   pnpm --filter @zapbip/api exec wrangler d1 create zapbip-staging
   pnpm --filter @zapbip/api exec wrangler r2 bucket create zapbip-media-staging
   ```

   For production the names are `zapbip-production` and `zapbip-media-production`. Done on 2026-11-07, through the Cloudflare API, for both environments: D1 `zapbip-staging` (`7f784389-c79d-46f0-b9ea-2a3eab8aa2ff`), D1 `zapbip-production` (`2147fd23-d09d-4609-9c5e-5751453794df`) and R2 `zapbip-media-staging` and `zapbip-media-production`; skip this step for them. The Durable Object class `AccountInbox` needs no command: the first deploy creates it from the `migrations` tag in `apps/api/wrangler.jsonc`.

   Expect: the D1 command prints a `database_id` UUID, and the R2 command reports the bucket as created.

   If it fails: a name clash means it already exists; run `pnpm --filter @zapbip/api exec wrangler d1 list` and reuse its ID. A permission error means `wrangler whoami` shows the wrong account ([cloudflare-setup.md](cloudflare-setup.md), step 4).

2. **Replace every placeholder.** Both database IDs are already in `apps/api/wrangler.jsonc` (2026-11-07); this step is for any `REPLACE_WITH_` value added later. Run `grep -n REPLACE_WITH_ apps/api/wrangler.jsonc`. In the block of the environment you are deploying, replace the placeholder database ID with the `database_id` from step 1, and any other `REPLACE_WITH_` value of that block with the real one. Commit the change on a branch and merge it; IDs are account identifiers, not secrets. Staging may deploy from any clean branch, but production deploys only from `main`, so the production block must be merged before the production deploy. Run the grep again.

   Expect: the grep prints nothing for the block of the environment you are deploying.

   If it fails: `pnpm deploy:staging` refuses at its config step and names the placeholder; nothing was deployed.

3. **Set the secrets.** For each name below run `pnpm --filter @zapbip/api exec wrangler secret put <NAME> --env staging` (for production leave `--env` out) and type or paste the value at the prompt. A value never goes on the command line. The first `wrangler secret put` of an environment creates the Worker itself: wrangler asks whether to create a new Worker named `zapbip-api-staging` (production: `zapbip-api`); answer yes. Generated values pipe straight in and are never written to a file: `openssl rand -base64 32 | pnpm --filter @zapbip/api exec wrangler secret put WAKE_SECRET_KEY --env staging`. Meta app secrets and access tokens are not Worker secrets: the numbers registry keeps them, sealed with `NUMBER_REGISTRY_KEY`, and you type them into the backoffice ([backoffice.md](backoffice.md), step 2). `BACKOFFICE_KEY_DIGEST` and `BACKOFFICE_TOTP_SECRET` are not set here either: `pnpm backoffice:enroll:staging` writes them ([backoffice.md](backoffice.md), step 1). Then copy `.env.example` to `.env` (git-ignored; no agent edits it) and fill only what the scripts read: `WHATSAPP_VERIFY_TOKEN` always, `SMOKE_META_APP_SECRET` and `SMOKE_PHONE_NUMBER_ID` for the staging fake inbound check only (the app secret and phone number ID you register in the backoffice for the staging number), and the smoke inputs below. The four secrets the scripts never read (`MEDIA_LINK_SIGNING_KEY`, `UPLOAD_LINK_SIGNING_KEY`, `WAKE_SECRET_KEY`, `NUMBER_REGISTRY_KEY`) are not in `.env` at all. Before production, remove `SMOKE_META_APP_SECRET` and `SMOKE_PHONE_NUMBER_ID` from that file and replace the other values: the production app secret goes only into the backoffice form, never into a file.

   | Name | Value comes from |
   |---|---|
   | `WHATSAPP_VERIFY_TOKEN` | `openssl rand -hex 24`, shared by every Meta app of the environment ([meta-setup.md](meta-setup.md), step 8) |
   | `NUMBER_REGISTRY_KEY` | `openssl rand -base64 32`; not rotated: a new key cannot open the credentials already registered, which would have to be typed in again |
   | `MEDIA_LINK_SIGNING_KEY` | `openssl rand -base64 32`; rotating it makes links in flight (one hour) return `403` |
   | `UPLOAD_LINK_SIGNING_KEY` | `openssl rand -base64 32`, a different value; rotating it fails uploads in progress once |
   | `WAKE_SECRET_KEY` | `openssl rand -base64 32`; not rotated: a new key cannot open stored wake targets |

   The smoke inputs in `.env`: `SMOKE_BASE_URL` (`https://mcp-staging.zapbip.com` or `https://mcp.zapbip.com`, without a trailing slash), `SMOKE_OWNER_PHONE` (your phone, digits with country code, no plus sign or spaces) and, for staging only, `SMOKE_CONNECTION_SECRET` (step 6); production asks for the connection secret at a hidden prompt and never reads it from the file. Leave `SMOKE_CONNECTION_SECRET` and `SMOKE_OWNER_PHONE` as they are until step 6: the first deploy of an environment runs with `--first-deploy`, which does not need them. For production also set `ZAPBIP_NPM_PUBLISHER` to your npm user name ([mintlify-publish.md](mintlify-publish.md), step 2).

   Expect: `pnpm --filter @zapbip/api exec wrangler secret list --env staging` names the five secrets of the table; the two backoffice secrets arrive with the enrollment.

   If it fails: `pnpm deploy:staging` lists the missing names at its secrets step; until `pnpm backoffice:enroll:staging` has run it names `BACKOFFICE_KEY_DIGEST` and `BACKOFFICE_TOTP_SECRET`, which is the cue to enroll before deploying. A secret set for the wrong environment is fixed by running `wrangler secret put` again with the right `--env`; production is the top-level block, so a production command never carries `--env`, and `--env production` fails.

4. **Migrate.** First write down the D1 time-travel bookmark: `pnpm --filter @zapbip/api exec wrangler d1 time-travel info <database> --env staging` (production: no `--env`); it is the only point you can restore the directory to if the migration goes wrong. Then run `pnpm migrate:staging` (or `pnpm migrate:production`). Run it before every deploy that ships a new migration, never after, and before the enrollment, which writes to `backoffice_operator` (migration `0005`): the Durable Object reads the directory tables (the accounts-and-keys migration included) the moment the new Worker serves, and `pnpm deploy:staging` and `pnpm deploy:production` refuse while any D1 migration is pending, so the order cannot be reversed by mistake.

   Expect: wrangler lists each migration file applied, and a second run says there is nothing to apply.

   If it fails: a failed migration leaves the previous Worker serving; fix it with a new numbered migration, never by editing the one that ran. The D1 bookmark from this step can restore the directory.

5. **Deploy.** Run `pnpm deploy:staging --first-deploy` for the first deploy of an environment, and `pnpm deploy:staging` afterwards (`pnpm deploy:production --first-deploy`, then `pnpm deploy:production`), in an interactive terminal. The command refuses, in order, the cheap things first: a wrong environment or a non-interactive terminal; production only: a `COMPANY` fact still `COMPANY_FACT_UNSET` ([mintlify-publish.md](mintlify-publish.md), step 2), a package on npm that your npm user (`ZAPBIP_NPM_PUBLISHER`) does not alone maintain and publish, or an npm answer that is not a clear yes or no (step 1), a hosted plugin file missing from the `zapbip-packages` bucket or hashing to something other than the hash its plugin pins (`hostedArtifacts` in `libs/agents/src/generated/plugins.ts`) ([mintlify-publish.md](mintlify-publish.md), step 4), and a Worker that does not export `scheduled`, a wrangler block without a cron trigger or a `/i/:installCode` route that is not mounted; then, for every environment: a `REPLACE_WITH_` placeholder in any letter case, a missing smoke input, a dirty tree (production also needs branch `main` equal to `origin/main`), a missing secret, a pending migration, a failing `pnpm verify` (`pnpm verify all` for production, and last because it takes minutes) and a failing dry run. Staging needs only placeholders and secrets in place: the company facts and the npm check are production gates. A package whose version is absent from npm, while its name is absent or yours alone, only prints `<package>@<version> is not on npm yet; publish it before launch` and the deploy goes on; `pnpm docs:preflight` refuses it, never the deploy. It prints the current Worker version and the D1 bookmark (or says there is no previous version, then a rollback means redeploying the prior commit): write both in the go-live record. For production it then asks you to type `production`.

   Expect: `wrangler deploy` succeeds and the smoke test runs. With `--first-deploy` the smoke test skips checks 2 and 5 (they need the smoke connection) and prints how to create it. After the first staging deploy, register the staging number ([backoffice.md](backoffice.md), steps 2 to 4), then finish [meta-setup.md](meta-setup.md) step 9.

   If it fails: each refusal prints what to do next, and nothing is deployed before the dry run passes. A production-only domain refusal (after the placeholder check) means `PUBLIC_ORIGIN` is not `https://mcp.zapbip.com` or the `zapbip.com` nameservers are not Cloudflare's; fix it with [dns.md](dns.md), step 1. A smoke failure prints the rollback commands and runs none of them; you decide.

6. **Smoke test.** The number must be registered and active ([backoffice.md](backoffice.md), steps 2 to 4), and `SMOKE_PHONE_NUMBER_ID` and `SMOKE_META_APP_SECRET` in `.env` must be the staging number's phone number ID and its Meta app's secret. Create the smoke connection: from your phone send `novo agente smoke` to the environment's WhatsApp number, open the install link in the reply and read the MCP URL `https://<host>/c/<secret>/mcp`. For staging put the part between `/c/` and `/mcp` in the environment file as `SMOKE_CONNECTION_SECRET`, then run `pnpm smoke:staging`. For production run `pnpm smoke:production` and paste the part at the hidden prompt (nothing is echoed or stored); the deploy command's own smoke step prompts the same way.

   Expect: staging prints five `PASS` lines (health, mcp initialize, webhook verify, signature rejected, fake inbound). Production prints four, because the fake inbound check never runs there. The output shows no secret.

   If it fails: `FAIL 404` on health means the wrong host in `SMOKE_BASE_URL`. A `FAIL` on mcp initialize means the connection secret is wrong or revoked; create a new smoke connection. A `FAIL` on webhook verify means `WHATSAPP_VERIFY_TOKEN` in `.env` differs from the Worker's secret. A `FAIL` on signature rejected means a deployed Worker accepted a zero-signed or placeholder-signed body that names the registered number in `SMOKE_PHONE_NUMBER_ID`; the check only proves the signature is verified when that ID is registered, so on a first deploy, before any number exists, it proves only that unattributed bodies are refused. A `FAIL` with `401` or `403` on the fake inbound means `SMOKE_META_APP_SECRET` is not the app secret registered for that number, and a `200` that never reaches the inbox means `SMOKE_PHONE_NUMBER_ID` is not a registered, active number.

7. **Watch the logs.** Run `pnpm --filter @zapbip/api exec wrangler tail --env staging --format pretty` (production: the same without `--env`); wrangler builds the Worker name from the configuration, so no name is typed. Events carry names, IDs, kinds and sizes, never message text or phone numbers.

   Expect: a line per request while you send a message.

   If it fails: if the tail shows nothing, check that the request reached the right host with `curl -s https://<host>/health`.

8. **Roll back, and rehearse it on staging.** Bad code or configuration: `pnpm --filter @zapbip/api exec wrangler rollback <version> --env staging` (production: no `--env`), with the version from step 5. Bad directory data: `pnpm --filter @zapbip/api exec wrangler d1 time-travel restore <database> --env staging --bookmark <bookmark>`, with the bookmark from step 5 (production: no `--env`). A rollback restores code and configuration only: not secrets, D1 rows written after the bookmark, R2 objects or Durable Object inboxes. A bad migration is never rolled back by hand; a new forward migration fixes it. Before production, rehearse on staging: deploy a second version, roll back to the first, run `pnpm smoke:staging`, deploy again, run `pnpm smoke:staging`, and paste the output under the go-live record.

   Expect: the smoke test passes after the rollback and again after the redeploy.

   If it fails: do not go to production. Roll back to the last version that passed, and re-run the smoke test.

9. **Check the cost every week.** Open the Cloudflare dashboard, Workers & Pages, Durable Objects, and read the day's duration in gigabyte-seconds and requests against the free allowance (13,000 gigabyte-seconds and 100,000 requests a day). Check Workers requests, D1 rows written and read, and R2 storage on the same account. An hourly job also fails the run and logs `budget.warning` at 80 percent of the Durable Object duration allowance.

   Expect: every figure is well under its limit, and the error notification ([cloudflare-setup.md](cloudflare-setup.md), step 5) has not fired.

   If it fails: a figure near its limit means an agent is polling too hard; revoke that connection from WhatsApp, and read the logs for the account.

## Go-live order

Follow the steps in order. Each step names the runbook that holds its detail, and agents never run them: creating accounts, logging in, spending money and deploying are the owner's acts. Staging comes first and does not wait for the company facts or the published packages, which gate the docs and production.

1. **Prepare your machine.** You need git, Node 24, `pnpm`, `openssl` (generates secrets), `shasum` (checks the wheel hash), `curl` and `dig` (checks), Python 3.11 to 3.14 with `pip` (the wheel build) and the repository. Install git from `https://git-scm.com/downloads`. Install Node 24 with a version manager (`nvm install 24` after installing `https://github.com/nvm-sh/nvm`, or the installer at `https://nodejs.org`). Turn on `pnpm` with `corepack enable`, which reads the pinned version from `package.json`. Then clone the repository with `git clone https://github.com/dhyegocalota/zapbip.git`, open the folder, and run `pnpm install --frozen-lockfile`.

   Expect: `node --version` prints `v24` and something, `pnpm --version` prints `8.15.9`, and `openssl version`, `python3 --version`, `curl --version` and `dig -v` each print a version.

   If it fails: install the missing tool from its own site or your package manager and run the command again. A `corepack` error means Node is older than 24.
2. **Cloudflare setup.** Do every step of `cloudflare-setup.md`.

   Expect: `wrangler whoami` prints your account.

   If it fails: the failing step of `cloudflare-setup.md` says what to check.
3. **DNS.** Do steps 1 and 2 of `dns.md`; step 3 follows each deploy, and steps 4 and 5 belong to the docs publish.

   Expect: `zapbip.com` is active on Cloudflare.

   If it fails: nameserver changes can take hours; recheck with the `dig` command of the step before changing anything.
4. **Meta setup.** Do steps 1 to 8 of `meta-setup.md` for staging, plus step 3 for the production number (with its payment method and two-step PIN). Step 9 waits until a Worker is deployed; the production halves of steps 5 to 8 wait for the production deploy below.

   Expect: a Meta test number, the staging app secret, a system user token and a verify token.

   If it fails: the failing step of `meta-setup.md` says what to check. Do not continue to production with a missing policy answer (step 1).
5. **Meta templates approved.** Do step 11 of `meta-setup.md` now, because approval takes up to a day and the production WhatsApp account already exists from step 3.

   Expect: all four templates (two names, two languages) show `Approved` in WhatsApp Manager.

   If it fails: a rejected template is edited and resubmitted; production waits for approval.
6. **Resources and secrets.** Do steps 1 to 3 of `deploy.md` for staging.

   Expect: no `REPLACE_WITH_` is left in the staging block of `apps/api/wrangler.jsonc`, and `wrangler secret list` names the five secrets of the table in step 3.

   If it fails: `pnpm deploy:staging` refuses and names the placeholder or the missing secret; nothing is deployed.
7. **Migrate staging.** Do step 4 of `deploy.md` for staging.

   Expect: `pnpm migrate:staging` applies the migrations, including `0005`.

   If it fails: a failed migration leaves the previous Worker serving; fix it with a new numbered migration.
8. **Enroll the backoffice on staging.** Do step 1 of `backoffice.md` from your own terminal.

   Expect: `wrangler secret list --env staging` names all seven secrets, and you hold the backoffice key and the authenticator entry.

   If it fails: nothing was written when the code mismatched; run it again.
9. **Deploy staging.** Do step 5 of `deploy.md` for staging, with `pnpm deploy:staging --first-deploy`.

   Expect: the deploy ends with the smoke test (checks 1, 3 and 4 pass; checks 2 and 5 are skipped on a first deploy).

   If it fails: `deploy.md` step 8 rolls back; the previous Worker keeps serving.
10. **Register the staging number.** Do steps 2 to 4 of `backoffice.md` for the staging app and its test number.

   Expect: the number shows `active` in the backoffice.

   If it fails: the failing step of `backoffice.md` says what to check.
11. **Point the staging Meta webhook.** Do step 9 of `meta-setup.md` for the staging app.

   Expect: Meta verifies the staging webhook and shows both fields subscribed.

   If it fails: step 9 of `meta-setup.md` says what to check.
12. **Smoke staging.** Do step 6 of `deploy.md`, then send `novo agente smoke` to the staging test number from your phone.

   Expect: five `PASS` lines from `pnpm smoke:staging` and a reply on your phone.

   If it fails: read the failing check name in `deploy.md` step 6.
13. **Rollback rehearsal.** Deploy a second staging version, roll back to the first, run the smoke test and deploy again, as in step 8 of `deploy.md`.

   Expect: the smoke test passes after each move. Paste the output into the go-live record.

   If it fails: stop. Do not go to production with an untested rollback.
14. **Publish the packages.** Do steps 1, 3 and 4 of `mintlify-publish.md`: `zapbip` and every npm plugin on npm, and every self-hosted plugin file in the `zapbip-packages` bucket.

   Do this before step 20: the production deploy refuses until the plugin files are in the bucket. An npm package may wait until launch: the production deploy only warns that it is not on npm yet (and prints the warning again after the smoke test), and `pnpm docs:preflight` refuses until it is. After publishing, run `npm view <name>@<version> maintainers --json` for each package and expect your npm user.

   Expect: `npm view` lists your npm user as a maintainer of every npm package, and the `object get` check of `mintlify-publish.md` step 4 hashes to the hash the plugin pins.

   If it fails: the failing step of `mintlify-publish.md` says what to check.
15. **Company facts.** Do step 2 of `mintlify-publish.md`: the Logic Bit company facts.

    Expect: `COMPANY_FACT_UNSET` is not left in `libs/types/src/constants.ts` apart from its definition.

    If it fails: `pnpm docs:preflight` refuses and names what is still unset; the production deploy refuses only the company facts.
16. **Production Meta credentials.** Do steps 5 to 8 of `meta-setup.md` for production (the production app, its secret, its system user token and its verify token).

    Expect: you hold the production app secret and the system user token for the backoffice form, and the verify token for the `wrangler secret put` prompt.

    If it fails: the failing step of `meta-setup.md` says what to check.
17. **Production resources and secrets.** Do steps 1 to 3 of `deploy.md` for production.

    Expect: no `REPLACE_WITH_` is left in the production block of `apps/api/wrangler.jsonc`, and `wrangler secret list` names the five secrets of the table in step 3.

    If it fails: `pnpm deploy:production` refuses and names the placeholder or the missing secret; nothing is deployed.
18. **Migrate production.** Do step 4 of `deploy.md` for production.

    Expect: `pnpm migrate:production` applies the migrations, including `0005`.

    If it fails: a failed migration leaves the previous Worker serving; fix it with a new numbered migration.
19. **Enroll the backoffice on production.** Do step 1 of `backoffice.md` with `pnpm backoffice:enroll:production`, from your own terminal.

    Expect: `wrangler secret list` names all seven secrets, and you hold a separate production key and authenticator entry.

    If it fails: nothing was written when the code mismatched; run it again.
20. **Production deploy.** Do step 5 of `deploy.md` for production, with `pnpm deploy:production --first-deploy`, then step 3 of `dns.md` for the host check.

    Expect: the deploy ends with the smoke test (checks 1, 3 and 4 pass) and the health route answers on `mcp.zapbip.com` and on `backoffice.zapbip.com` (the sign-in page).

    If it fails: `deploy.md` step 8 rolls back the Worker.
21. **Register the production number.** Do steps 2 to 4 of `backoffice.md` on `https://backoffice.zapbip.com` for the production app and the production number from step 3 of `meta-setup.md`.

    Expect: the number shows `active` in the backoffice, and `curl -sI https://mcp.zapbip.com/start` prints `302` and a `location:` header that starts with `https://wa.me/`. The docs link that address. `pnpm docs:preflight` refuses until it does, but run this check by hand first, before step 23.

    If it fails: the failing step of `backoffice.md` says what to check.
22. **Point the production Meta webhook.** Do step 9 of `meta-setup.md` for the production app.

    Expect: Meta verifies the production webhook and shows both fields subscribed.

    If it fails: step 9 of `meta-setup.md` says what to check.
23. **Publish the docs.** Do steps 5 to 10 of `mintlify-publish.md`, starting with `pnpm docs:preflight`, which needs no DNS but reads the production Worker: it checks the constants, npm and the plugin files served at `https://mcp.zapbip.com/pkg/`. The custom domain of step 9 uses steps 4 and 5 of `dns.md`. The privacy page is part of the site. The docs preflight after the production deploy is mandatory: it is the only check that the live Worker serves every plugin file with the hashes the docs print, so never connect Mintlify without a passing run.

    Expect: `docs.zapbip.com` serves the site in English and in Portuguese, and `https://docs.zapbip.com/help/privacy` loads.

    If it fails: the failing step of `mintlify-publish.md` says what to check.
24. **Meta live mode.** Do step 10 of `meta-setup.md` with the privacy page of step 23, after the production webhook is verified in the previous step.

    Expect: the production app shows Live and the business verification shows In review or Verified.

    If it fails: step 10 of `meta-setup.md` says what Meta wants corrected.
25. **Smoke production.** Do step 6 of `deploy.md` for production.

    Expect: four `PASS` lines from `pnpm smoke:production`.

    If it fails: read the failing check name in `deploy.md` step 6.

## Go-live record

This is the one go-live record. Copy this list into a private note, and paste the owner's outputs into it before the production deploy; the repository keeps only this template, and every other runbook points here.

- Policy decision and date ([meta-setup.md](meta-setup.md), step 1):
- Worker versions and D1 bookmarks (step 5):
- Staging smoke output (step 6):
- Rollback rehearsal output (step 8):
- `npm view <name>@<version> maintainers --json` output for each package after publishing (step 14), and the npm warnings from the production deploy (step 20):
- Error notification result ([cloudflare-setup.md](cloudflare-setup.md), step 5):
- Free-plan limits read from the pricing pages:
