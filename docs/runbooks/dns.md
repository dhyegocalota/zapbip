# DNS

Put `zapbip.com` on Cloudflare so the Worker custom domains and the docs domain resolve, and check each host with `dig`.

The Worker hosts are `mcp.zapbip.com` for production and `mcp-staging.zapbip.com` for staging. Wrangler creates their DNS records on deploy when the zone is on the same Cloudflare account. The docs host is `docs.zapbip.com`. Run the `dig` commands from any terminal.

1. **Add the zone.** In the Cloudflare dashboard choose Add a domain, enter `zapbip.com`, pick the Free plan and let Cloudflare import the existing records.

   Expect: Cloudflare shows two nameservers for the zone and the status Pending Nameserver Update.

   If it fails: if Cloudflare says the domain is already on another account, remove it there first or ask Cloudflare support to release it.

2. **Change the nameservers.** At the registrar where `zapbip.com` was bought, replace the nameservers with the two Cloudflare gave. Then run `dig NS zapbip.com +short` until it answers.

   Expect: both Cloudflare nameservers are printed and the dashboard shows the zone as Active.

   If it fails: propagation can take up to a day; keep the old records until the zone is Active. If the registrar offers DNSSEC, turn it off before the change and on again after.

3. **Clear conflicting records.** Open DNS, Records for `zapbip.com` and delete any existing A, AAAA or CNAME record named `mcp` or `mcp-staging`. Keep `docs` for step 5.

   Expect: no record is named `mcp` or `mcp-staging`.

   If it fails: a custom domain cannot be created on top of an existing record; the deploy prints a conflict error that names the host.

4. **Check the Worker hosts after each deploy.** After `pnpm deploy:staging` run `dig mcp-staging.zapbip.com +short`, then `curl -s https://mcp-staging.zapbip.com/health`. After `pnpm deploy:production` repeat both for `mcp.zapbip.com`.

   Expect: `dig` prints addresses, and `curl` prints `{"ok":true,"environment":"staging"}` or `{"ok":true,"environment":"production"}`.

   If it fails: `dig` empty means the custom domain was not created; confirm the `routes` entry of the environment block in `apps/api/wrangler.jsonc` and step 3 here. A certificate error in the first minutes is normal; wait and retry.

5. **Point the docs host at Mintlify.** In Mintlify's dashboard, Settings, Custom domain, enter `docs.zapbip.com` and read the CNAME target it shows. In Cloudflare DNS add a CNAME record named `docs` with that target. Set the proxy status to DNS only unless Mintlify's dashboard says otherwise. Then run `dig CNAME docs.zapbip.com +short`.

   Expect: `dig` prints the Mintlify target.

   If it fails: the Mintlify dashboard shows the exact record it expects and whether it sees it; follow it over this step.
