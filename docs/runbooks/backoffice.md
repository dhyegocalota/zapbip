# Backoffice

Enroll the operator from your own terminal, sign in at the backoffice host, register, verify and activate each WhatsApp number, replace its credentials and recover from a lockout.

You do all of this by hand ([ADR 0031](../adr/0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md), [ADR 0032](../adr/0032-whatsapp-numbers-are-rows-in-a-sealed-registry-not-worker-secrets.md)). Enrollment needs your terminal and your Cloudflare token, and the registry forms need your key, your authenticator and your Meta credentials, so an agent never runs `pnpm backoffice:enroll:development`, `pnpm backoffice:enroll:staging` or `pnpm backoffice:enroll:production` (the deploy guard refuses them), never signs in and never sees a key, a code, an app secret or an access token. An agent may read this runbook and run the read-only host checks of [dns.md](dns.md), step 3. The staging host is `https://backoffice-staging.zapbip.com` and the production host is `https://backoffice.zapbip.com`. The migrations of [deploy.md](deploy.md), step 4, come first.

1. **Enroll the operator.** In your own interactive terminal, with `CLOUDFLARE_API_TOKEN` exported as in [deploy.md](deploy.md), run `pnpm backoffice:enroll:staging` (for production `pnpm backoffice:enroll:production`, which also asks you to type `production`). The script prints the backoffice key once, beginning `zb_bo_`, and a QR code. Scan the QR code with your authenticator app (or type the printed text secret), then type the current six-digit code. Store the key in your password manager, then press Enter: the screen and the scrollback are cleared.

   Expect: `pnpm --filter @zapbip/api exec wrangler secret list --env staging` (production: no `--env`) names `BACKOFFICE_KEY_DIGEST` and `BACKOFFICE_TOTP_SECRET`. The key never appears on a command line, in a file or in the log.

   If it fails: a refusal that mentions a terminal means stdin or stdout is not interactive; run it in your own terminal tab. A code mismatch stops the script before anything is written; run it again. A D1 error naming `backoffice_operator` means migration `0005` is not applied; run the migrate step first. Use a separate enrollment for each environment: the staging key does not sign in to production.

2. **Sign in and register the number.** Open the backoffice host, type the key and the current authenticator code, and choose Sign in. Open Numbers, Register a number. Pick the Meta app, or add a new one with its Meta app ID, label and app secret ([meta-setup.md](meta-setup.md), step 6). Enter the phone number ID, the WABA ID, the display number in international format with a plus sign, a label, and the access token ([meta-setup.md](meta-setup.md), step 7). Type a fresh authenticator code in the Confirm block and submit. Before you register a second number, run `pnpm --filter @zapbip/api exec wrangler d1 execute zapbip-production --remote --command "SELECT COUNT(*) FROM accounts WHERE number_id IS NULL"` from your own terminal (on staging run `wrangler d1 execute zapbip-staging --env staging --remote` instead of `zapbip-production --remote`): the first number binds those accounts only while it is the only one, and an account left without a number when a second number exists is dropped. Add a second number the same way, choosing the same Meta app when it belongs to it.

   Expect: the number is listed as Pending, "Number registered. Verify it before activating." shows, and the form never shows the app secret or the token again, only "Set, last changed" and a date. The first number registered also binds any account that has none. Before a second number, the count command prints `0`.

   If it fails: "Code not accepted" means the step-up code was already used or expired; wait for the next code. If the count is not `0`, register no second number: finish the first number's binding or fix the unbound accounts first. An "Already registered" field error names the field that exists already: the phone number ID, the display number or the Meta app ID. The key and code failing ten times in a row lock the operator for 15 minutes (step 6).

3. **Verify the number with Meta.** Open the number, choose Verify with Meta and type a fresh code. The backoffice asks Meta for the number's display number and the status of the templates `zapbip_agent_notice` and `zapbip_agent_question` in `pt_BR` and `en_US`.

   Expect: "Number verified." and the four template statuses; the display number matches the one you registered. Templates that are not yet approved only warn that notices outside the 24-hour window will fail.

   If it fails: the page names the kind of failure. `auth` means the access token is wrong or lacks `whatsapp_business_messaging`; replace it (step 5). `not_found` means the phone number ID or the WABA ID is wrong. `network` or `upstream` means Meta did not answer; retry in a minute.

4. **Activate the number.** Activate only after step 9 of [meta-setup.md](meta-setup.md) shows the webhook verified for that number's environment: an Active number without a verified webhook receives new owners from the start link but never hears them. On the number page choose Change state, Active, and type a fresh code. Use Closed to stop accepting new accounts while keeping the existing ones: the start link (`https://mcp.zapbip.com/start`) sends new owners to the oldest Active number, so closing a full number moves them to the next Active one on the next click, and with none Active it shows the "back soon" page. Use Disabled only to stop the number completely.

   Expect: the number shows Active in the list. With the webhook of the environment verified ([meta-setup.md](meta-setup.md), step 9), a message from your phone to this number reaches your agents and replies are sent from it.

   If it fails: "Verify the number first" means step 3 has not succeeded; a Pending number cannot become Active.

5. **Replace a credential.** For a new access token open the number, Replace access token, paste the new token and type a fresh code. For a new app secret open any number of that Meta app, Replace app secret; it applies to every number of the app. Do this after you reset the secret or regenerate the token in Meta ([meta-setup.md](meta-setup.md), steps 6 and 7). `NUMBER_REGISTRY_KEY` itself is not rotated: a new key cannot open the stored credentials, so you would register every credential again.

   Expect: "Access token replaced." (or the app secret equivalent), and the next send or webhook uses the new value without a deploy.

   If it fails: a rejected code is the step-up message of step 2. A webhook that Meta rejects with `401` after a secret reset means the registry still holds the old app secret.

6. **Recover: re-enroll or wait out a lockout.** A lost authenticator, a lost key, a suspected leak and a lockout (ten consecutive failures lock sign-in for 15 minutes, even with the right factors) are all fixed the same way: run step 1 again. It issues a new key and a new authenticator entry, invalidates the old ones, drops every session and clears the lock. There are no recovery codes. After a lockout you may instead wait 15 minutes.

   Expect: the old key and the old authenticator entry are refused, the new pair signs in, and the audit log shows `operator.enrolled`.

   If it fails: if the enrollment script cannot write the secrets, the Cloudflare token is missing a permission ([cloudflare-setup.md](cloudflare-setup.md), step 4). Remove the old authenticator entry yourself.
