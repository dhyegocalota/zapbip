# Email

Verify `zapbip.com` in Resend, give the Worker its key and check the welcome and the daily digest.

You do all of this by hand ([ADR 0058](../adr/0058-email-is-sent-through-resend-with-react-email-templates.md)): the key is a secret and the DNS records belong to the zone, so an agent never reads, copies or sets them. Until `RESEND_API_KEY` exists the Worker sends nothing, logs `email.disabled` for every skipped message and the deploy only warns ([deploy.md](deploy.md), step 3), so production may go live first. The welcome goes from `hello@zapbip.com` with reply-to `support@zapbip.com`; the digest goes to `support@zapbip.com` at 11:00 UTC (08:00 in Brazil).

1. **Verify the domain in Resend.** Sign in at resend.com, open Domains, choose Add domain, type `zapbip.com` and pick the region closest to Brazil. Resend lists the DNS records it needs (the DKIM `TXT` record, and the `MX` and `TXT` records of the bounce subdomain). In the Cloudflare dashboard open the `zapbip.com` zone, DNS, Records, and add each record exactly as Resend shows it, with the proxy off (DNS only). Back in Resend choose Verify DNS records.

   Expect: Resend shows the domain as Verified, and `dig +short TXT resend._domainkey.zapbip.com` prints the DKIM value Resend gave you.

   If it fails: a record stuck at Pending is usually a name typed with the zone appended twice (`resend._domainkey.zapbip.com.zapbip.com`); Cloudflare adds the zone itself, so type only the part Resend shows before `zapbip.com`. Records can take up to an hour to propagate; choose Verify again after that.

2. **Create the key.** In Resend open API Keys, choose Create API key, name it `zapbip-staging` (then `zapbip-production`), set the permission to Sending access and restrict it to the domain `zapbip.com`. Copy the key once; Resend never shows it again.

   Expect: two keys, one per environment, each with Sending access to `zapbip.com` only.

   If it fails: a key with Full access works but can read and delete everything in the account; delete it and create a Sending access key.

3. **Give the key to the Worker.** Run `pnpm --filter @zapbip/api exec wrangler secret put RESEND_API_KEY --env staging` (for production leave `--env` out) and paste the key at the prompt. A value never goes on the command line or into a file. No deploy is needed: the next request reads the new secret.

   Expect: `pnpm --filter @zapbip/api exec wrangler secret list --env staging` names `RESEND_API_KEY`, and the next `pnpm deploy:staging` no longer prints the `RESEND_API_KEY is not set` warning.

   If it fails: a key pasted with a stray space still works, because the Worker trims it; a key for the wrong environment sends from the right address but appears under the other key's logs in Resend, so set it again with the right `--env`.

4. **Check the welcome.** Join the waitlist on `https://staging.zapbip.com` with an inbox you can read, once in Portuguese and once in Arabic (`/ar`), then join again with the same address.

   Expect: one welcome per address, in the language of the page, from `zapbip <hello@zapbip.com>`; the Arabic one reads right to left; replying goes to `support@zapbip.com`; the second join sends nothing. Resend, Emails, lists each send as Delivered, and `pnpm --filter @zapbip/api exec wrangler tail --env staging --format pretty` shows no `email.send_failed` line.

   If it fails: no email and an `email.disabled` line means step 3 is missing for that environment. An `email.send_failed` line with `statusCode` 403 means the domain is not verified (step 1) or the key lacks Sending access to it (step 2); 422 means the sender address is outside the verified domain. A failed welcome is stamped on the row and counted by the next digest; the same address joining again tries once more.

5. **Check the digest.** Wait for the next 11:00 UTC tick of the environment that holds the key.

   Expect: `support@zapbip.com` receives "zapbip · N novos inscritos (dd/mm)" with the new addresses, the total, the totals by language, the welcomes sent and failed and the top referrers; on a day with no new subscriber it still arrives and says so.

   If it fails: no digest and an `email.send_failed` line in the tail at 11:00 UTC means Resend refused it (step 4 explains the status codes), and the tick fails like any scheduled job, so Cloudflare's error notification fires. A digest that arrives twice in a day means the Idempotency-Key window of Resend (24 hours) was crossed by a retried tick, which only happens when the first send failed.
