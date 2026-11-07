# Deploy

Create the resources, set the secrets, migrate, deploy, smoke test, watch, roll back and check the weekly cost, for staging and then for production.

Do every step for staging first, then repeat steps 1 to 6 for production. Run all commands from the repository root on the owner's machine ([ADR 0027](../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)). Staging is `zapbip-api-staging` on `mcp-staging.zapbip.com`; production is `zapbip-api` on `mcp.zapbip.com`. Agents never run these commands.

Migration rule: a migration that has reached a deployed environment is never edited. A fix is a new numbered migration, and every migration must work with the Worker version still running, so a column is added in one deploy and its old use is removed in a later one.

1. **Create the resources.** Run these once per environment, with `staging` shown:

   ```
   pnpm --filter @zapbip/api exec wrangler d1 create zapbip-staging
   pnpm --filter @zapbip/api exec wrangler r2 bucket create zapbip-media-staging
   ```

   For production the names are `zapbip-production` and `zapbip-media-production`. The Durable Object class `AccountInbox` needs no command: the first deploy creates it from the `migrations` tag in `apps/api/wrangler.jsonc`.

   Expect: the D1 command prints a `database_id` UUID, and the R2 command reports the bucket as created.

   If it fails: a name clash means it already exists; run `pnpm --filter @zapbip/api exec wrangler d1 list` and reuse its ID. A permission error means `wrangler whoami` shows the wrong account ([cloudflare-setup.md](cloudflare-setup.md), step 4).

2. **Replace every placeholder.** Run `grep -n REPLACE_WITH_ apps/api/wrangler.jsonc`. In the block of the environment you are deploying, replace the placeholder database ID with the `database_id` from step 1, and any other `REPLACE_WITH_` value of that block with the real one. Commit the change on a branch and merge it; IDs are account identifiers, not secrets. Staging may deploy from any clean branch, but production deploys only from `main`, so the production block must be merged before the production deploy. Run the grep again.

   Expect: the grep prints nothing for the block of the environment you are deploying.

   If it fails: `pnpm deploy:staging` refuses at its config step and names the placeholder; nothing was deployed.

3. **Set the secrets.** For each name below run `pnpm --filter @zapbip/api exec wrangler secret put <NAME> --env staging` (for production leave `--env` out) and type or paste the value at the prompt. A value never goes on the command line. The first `wrangler secret put` of an environment creates the Worker itself: wrangler asks whether to create a new Worker named `zapbip-api-staging` (production: `zapbip-api`); answer yes. Generated values pipe straight in and are never written to a file: `openssl rand -base64 32 | pnpm --filter @zapbip/api exec wrangler secret put WAKE_SECRET_KEY --env staging`. Paste the Meta system user token at the prompt of `WHATSAPP_ACCESS_TOKEN`. Then copy `.env.example` to `.env` (git-ignored; no agent edits it) and fill only what the scripts read: the Meta values the smoke test needs (`WHATSAPP_VERIFY_TOKEN` always; `META_APP_SECRET` and `WHATSAPP_PHONE_NUMBER_ID` for the staging fake inbound check only, the same values you gave the staging Worker) and the smoke inputs below. The four secrets the scripts never read (`WHATSAPP_ACCESS_TOKEN`, `MEDIA_LINK_SIGNING_KEY`, `UPLOAD_LINK_SIGNING_KEY`, `WAKE_SECRET_KEY`) are not in `.env` at all. Before production, remove `META_APP_SECRET` and `WHATSAPP_PHONE_NUMBER_ID` from that file and replace the other values: the production app secret goes only into the `wrangler secret put` prompt, never into a file.

   | Name | Value comes from |
   |---|---|
   | `META_APP_SECRET` | the environment's app, App settings, Basic ([meta-setup.md](meta-setup.md), step 6) |
   | `WHATSAPP_ACCESS_TOKEN` | the system user token ([meta-setup.md](meta-setup.md), step 7) |
   | `WHATSAPP_PHONE_NUMBER_ID` | API Setup of the environment's app ([meta-setup.md](meta-setup.md), steps 4 and 5) |
   | `WHATSAPP_VERIFY_TOKEN` | `openssl rand -hex 24` ([meta-setup.md](meta-setup.md), step 8) |
   | `MEDIA_LINK_SIGNING_KEY` | `openssl rand -base64 32`; rotating it makes links in flight (one hour) return `403` |
   | `UPLOAD_LINK_SIGNING_KEY` | `openssl rand -base64 32`, a different value; rotating it fails uploads in progress once |
   | `WAKE_SECRET_KEY` | `openssl rand -base64 32`; not rotated: a new key cannot open stored wake targets |

   The smoke inputs in `.env`: `SMOKE_BASE_URL` (`https://mcp-staging.zapbip.com` or `https://mcp.zapbip.com`, without a trailing slash), `SMOKE_OWNER_PHONE` (your phone, digits with country code, no plus sign or spaces) and, for staging only, `SMOKE_CONNECTION_SECRET` (step 6); production asks for the connection secret at a hidden prompt and never reads it from the file. Leave `SMOKE_CONNECTION_SECRET` and `SMOKE_OWNER_PHONE` as they are until step 6: the first deploy of an environment runs with `--first-deploy`, which does not need them. For production also set `ZAPBIP_PYPI_PUBLISHER` to the PyPI user that is the only Owner of `zapbip-platform` and `ZAPBIP_NPM_PUBLISHER` to your npm user name ([mintlify-publish.md](mintlify-publish.md), step 2).

   Expect: `pnpm --filter @zapbip/api exec wrangler secret list --env staging` names all seven secrets.

   If it fails: `pnpm deploy:staging` lists the missing names at its secrets step. A secret set for the wrong environment is fixed by running `wrangler secret put` again with the right `--env`; production is the top-level block, so a production command never carries `--env`, and `--env production` fails.

4. **Migrate.** First write down the D1 time-travel bookmark: `pnpm --filter @zapbip/api exec wrangler d1 time-travel info <database> --env staging` (production: no `--env`); it is the only point you can restore the directory to if the migration goes wrong. Then run `pnpm migrate:staging` (or `pnpm migrate:production`). Run it before every deploy that ships a new migration, never after: the Durable Object reads the directory tables (the accounts-and-keys migration included) the moment the new Worker serves, and `pnpm deploy:staging` and `pnpm deploy:production` refuse while any D1 migration is pending, so the order cannot be reversed by mistake.

   Expect: wrangler lists each migration file applied, and a second run says there is nothing to apply.

   If it fails: a failed migration leaves the previous Worker serving; fix it with a new numbered migration, never by editing the one that ran. The D1 bookmark in step 5 can restore the directory.

5. **Deploy.** Run `pnpm deploy:staging --first-deploy` for the first deploy of an environment, and `pnpm deploy:staging` afterwards (`pnpm deploy:production --first-deploy`, then `pnpm deploy:production`), in an interactive terminal. The command refuses, in order, the cheap things first: a wrong environment or a non-interactive terminal; production only: `OFFICIAL_WHATSAPP_NUMBER` still `OFFICIAL_NUMBER_UNSET`, a `COMPANY` fact still `COMPANY_FACT_UNSET` ([mintlify-publish.md](mintlify-publish.md), steps 1 and 3), `zapbip@<version>` missing from npm or without your npm user (`ZAPBIP_NPM_PUBLISHER`) among its maintainers (step 2), `zapbip-platform==<version>` missing from PyPI or without your PyPI user (`ZAPBIP_PYPI_PUBLISHER`) as its one and only Owner role ([mintlify-publish.md](mintlify-publish.md), step 5), and a Worker that does not export `scheduled`, a wrangler block without a cron trigger or a `/i/:installCode` route that is not mounted; then, for every environment: a `REPLACE_WITH_` placeholder in any letter case, a missing smoke input, a dirty tree (production also needs branch `main` equal to `origin/main`), a missing secret, a pending migration, a failing `pnpm verify` (`pnpm verify all` for production, and last because it takes minutes) and a failing dry run. Staging needs only placeholders and secrets in place: the official number, the company facts and npm are production gates. It prints the current Worker version and the D1 bookmark (or says there is no previous version, then a rollback means redeploying the prior commit): write both in the go-live record. For production it then asks you to type `production`.

   Expect: `wrangler deploy` succeeds and the smoke test runs. With `--first-deploy` the smoke test skips checks 2 and 5 (they need the smoke connection) and prints how to create it. After the first staging deploy, finish [meta-setup.md](meta-setup.md) step 9.

   If it fails: each refusal prints what to do next, and nothing is deployed before the dry run passes. A smoke failure prints the rollback commands and runs none of them; you decide.

6. **Smoke test.** Create the smoke connection: from your phone send `novo agente smoke` to the environment's WhatsApp number, open the install link in the reply and read the MCP URL `https://<host>/c/<secret>/mcp`. For staging put the part between `/c/` and `/mcp` in the environment file as `SMOKE_CONNECTION_SECRET`, then run `pnpm smoke:staging`. For production run `pnpm smoke:production` and paste the part at the hidden prompt (nothing is echoed or stored); the deploy command's own smoke step prompts the same way.

   Expect: staging prints five `PASS` lines (health, mcp initialize, webhook verify, signature rejected, fake inbound). Production prints four, because the fake inbound check never runs there. The output shows no secret.

   If it fails: `FAIL 404` on health means the wrong host in `SMOKE_BASE_URL`. A `FAIL` on mcp initialize means the connection secret is wrong or revoked; create a new smoke connection. A `FAIL` on webhook verify or signature means `WHATSAPP_VERIFY_TOKEN` or `META_APP_SECRET` in `.env` differs from the Worker's secret. A `FAIL` with `401` or `403` on the fake inbound means the same for `META_APP_SECRET`.

7. **Watch the logs.** Run `pnpm --filter @zapbip/api exec wrangler tail --env staging --format pretty` (production: the same without `--env`); wrangler builds the Worker name from the configuration, so no name is typed. Events carry names, IDs, kinds and sizes, never message text or phone numbers.

   Expect: a line per request while you send a message.

   If it fails: if the tail shows nothing, check that the request reached the right host with `curl -s https://<host>/health`.

8. **Roll back, and rehearse it on staging.** Bad code or configuration: `pnpm --filter @zapbip/api exec wrangler rollback <version> --env staging` (production: no `--env`), with the version from step 5. Bad directory data: `pnpm --filter @zapbip/api exec wrangler d1 time-travel restore <database> --env staging --bookmark <bookmark>`, with the bookmark from step 5 (production: no `--env`). A rollback restores code and configuration only: not secrets, D1 rows written after the bookmark, R2 objects or Durable Object inboxes. A bad migration is never rolled back by hand; a new forward migration fixes it. Before production, rehearse on staging: deploy a second version, roll back to the first, run `pnpm smoke:staging`, deploy again, run `pnpm smoke:staging`, and paste the output under the go-live record.

   Expect: the smoke test passes after the rollback and again after the redeploy.

   If it fails: do not go to production. Roll back to the last version that passed, and re-run the smoke test.

9. **Check the cost every week.** Open the Cloudflare dashboard, Workers & Pages, Durable Objects, and read the day's duration in gigabyte-seconds and requests against the free allowance (13,000 gigabyte-seconds and 100,000 requests a day). Check Workers requests, D1 rows written and read, and R2 storage on the same account. An hourly job also fails the run and logs `budget.warning` at 80 percent of the Durable Object duration allowance.

   Expect: every figure is well under its limit, and the error notification ([cloudflare-setup.md](cloudflare-setup.md), step 5) has not fired.

   If it fails: a figure near its limit means an agent is polling too hard; revoke that connection from WhatsApp, and read the logs for the account.

## Go-live record

This is the one go-live record. Copy this list into a private note, and paste the owner's outputs into it before the production deploy; the repository keeps only this template, and every other runbook points here.

- Policy decision and date ([meta-setup.md](meta-setup.md), step 1):
- Worker versions and D1 bookmarks (step 5):
- Staging smoke output (step 6):
- Rollback rehearsal output (step 8):
- Error notification result ([cloudflare-setup.md](cloudflare-setup.md), step 5):
- Free-plan limits read from the pricing pages:
