# Cloudflare setup

Create the Cloudflare account, confirm the free plan, enable R2, log wrangler in and set the error notification.

Everything here costs nothing within the free allowances. Cloudflare asks for a payment method only to enable R2.

1. **Create the account.** Open `https://dash.cloudflare.com/sign-up`, sign up with the owner's email, confirm the email and turn on two-factor authentication under My Profile, Authentication.

   Expect: the dashboard opens with the account home.

   If it fails: use the password reset on the sign-in page; do not continue without two-factor authentication, because this account holds production secrets.

2. **Confirm the Workers Free plan.** Open Workers & Pages in the dashboard sidebar and accept the Workers subdomain prompt if it appears.

   Expect: the plan reads Free. No paid plan is needed; the Durable Object with SQLite storage is available on Free.

   If it fails: if a Durable Object deploy later says the plan lacks SQLite classes, open the plans page and check that the account is on Free or higher; do not buy anything without reading the pricing page.

3. **Enable R2.** Open Storage & databases, R2 Object Storage, and follow Purchase R2 Plan. Cloudflare asks for a payment method; the free allowance covers the media zapbip stores for one owner. Read the current free limits on the R2 pricing page and note them in the go-live record.

   The buckets `zapbip-media-staging` and `zapbip-media-production` and the D1 databases `zapbip-staging` and `zapbip-production` were created through the API on 2026-11-07 ([deploy.md](deploy.md), step 1).

   Expect: the R2 overview shows no buckets and no error, or only those two buckets. The packages buckets are created in step 6.

   If it fails: the payment method was refused; try another card. R2 cannot be skipped, because `MEDIA` is a bucket binding.

4. **Create the API token.** Never run `wrangler login`: an OAuth session is readable by every agent shell of your OS user. In the Cloudflare dashboard open My Profile, API Tokens, Create Token, and grant only Workers Scripts, D1 and R2 edit on this account. From the repository root run `pnpm install --frozen-lockfile`, then in your own interactive shell run `export CLOUDFLARE_API_TOKEN=<the token>` and `pnpm --filter @zapbip/api exec wrangler whoami`. Run `unset CLOUDFLARE_API_TOKEN` when you finish.

   Expect: `whoami` prints the account name and its account ID, and says it is logged in with an API token.

   If it fails: check that the token is exported in this shell and covers this account. If the session-start doctor reports an OAuth login, run `pnpm --filter @zapbip/api exec wrangler logout`.

5. **Set the error notification.** Open Notifications, Add, and look for a Workers error or usage notification in the list. Choose it, send it to the owner's email and save. Use the test button if the page has one.

   Expect: a test email arrives, or the notification is listed as active.

   If it fails: if the free plan does not offer a Workers error notification, write that in the go-live record. The owner then relies on `pnpm smoke:production`, on `wrangler tail` and on the weekly cost check in `deploy.md`, and this gap stays recorded as a known risk.

6. **Create the package buckets.** In your own shell with `CLOUDFLARE_API_TOKEN` exported (step 4), run `pnpm --filter @zapbip/api exec wrangler r2 bucket create zapbip-packages`, then the same with `zapbip-packages-staging` and `zapbip-packages-development`. They hold the Hermes wheel the Worker serves ([ADR 0034](../adr/0034-the-hermes-wheel-is-self-hosted-and-installed-by-a-pinned-hash.md)); a bucket that exists already is left as it is.

   Expect: `pnpm --filter @zapbip/api exec wrangler r2 bucket list` names all three buckets.

   If it fails: a name clash means the bucket exists; carry on. A permission error means the token lacks R2 edit (step 4).
