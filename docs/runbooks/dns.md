# DNS

`zapbip.com` is already a zone on the owner's Cloudflare account (nameservers `elisabeth.ns.cloudflare.com` and `langston.ns.cloudflare.com`). This runbook checks the zone, lets the Worker create its own hosts, points the docs host at Mintlify and frees the bare domain for the public site. Run the `dig` and `curl` commands from any terminal.

The production deploy preflight refuses to run unless the zone's nameservers are Cloudflare's and `PUBLIC_ORIGIN` is `https://mcp.zapbip.com`. The zone must be Active before the first deploy: a Worker custom domain cannot be created on a zone that is still pending. The Worker hosts are `mcp.zapbip.com` for production and `mcp-staging.zapbip.com` for staging, and the backoffice hosts are `backoffice.zapbip.com` and `backoffice-staging.zapbip.com`; all four come from the `routes` entry of their block in `apps/api/wrangler.jsonc`, so `wrangler deploy` creates the record and the certificate and you add no DNS record by hand. The public site is served by the same Worker on `zapbip.com`, `www.zapbip.com` (a 301 to the bare domain) and `staging.zapbip.com`, from the same `routes` entries ([ADR 0041](../adr/0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md)). The docs host is `docs.zapbip.com`.

1. **Check the zone.** Run `dig NS zapbip.com +short`. In the Cloudflare dashboard open the zone `zapbip.com` and read its status.

   Expect: both `elisabeth.ns.cloudflare.com.` and `langston.ns.cloudflare.com.` are printed and the dashboard shows the zone as Active.

   If it fails: if the nameservers differ, copy the two shown on the zone's Overview page into the registrar's nameserver setting; propagation can take up to a day.

2. **Clear conflicting records.** Open DNS, Records for `zapbip.com` and delete any existing A, AAAA or CNAME record named `mcp`, `mcp-staging`, `backoffice` or `backoffice-staging`. Keep `docs` for step 4.

   Expect: no record is named `mcp`, `mcp-staging`, `backoffice` or `backoffice-staging`.

   If it fails: a custom domain cannot be created on top of an existing record; the deploy prints a conflict error that names the host.

3. **Check the Worker hosts after each deploy.** After `pnpm deploy:staging` run `dig mcp-staging.zapbip.com +short`, then `curl -s https://mcp-staging.zapbip.com/health`. After `pnpm deploy:production` repeat both for `mcp.zapbip.com`. Then check the backoffice host of the same environment: `dig backoffice-staging.zapbip.com +short`, then `curl -sI https://backoffice-staging.zapbip.com/sign-in` (production: `backoffice.zapbip.com`). Neither backoffice host answers `/health`: the MCP host does not serve the backoffice, and the backoffice host does not serve the MCP routes.

   Expect: `dig` prints addresses, and `curl` prints `{"ok":true,"environment":"staging"}` or `{"ok":true,"environment":"production"}`; for the backoffice host, `dig` prints addresses and `curl` prints `HTTP/2 200` with a `content-security-policy` header.

   If it fails: `dig` empty means the custom domain was not created; confirm the `routes` entry of the environment block in `apps/api/wrangler.jsonc` and step 1 here. The backoffice host comes from its own `routes` entry in the same block. A certificate error in the first minutes is normal; wait and retry.

4. **Point the docs host at Mintlify.** In Mintlify's dashboard, Settings, Custom domain, enter `docs.zapbip.com` and read the CNAME target it shows (the value in Mintlify's custom-domain documentation at `https://mintlify.com/docs`, `cname.mintlify-dns.com` at the time of writing; the dashboard value wins). In Cloudflare, DNS, Records, Add record: type CNAME, name `docs`, target the Mintlify value, proxy status DNS only. Then run `dig CNAME docs.zapbip.com +short`.

   Expect: `dig` prints the Mintlify target.

   If it fails: the Mintlify dashboard shows the exact record it expects and whether it sees it; follow it over this step.

5. **Free the bare domain for the site.** The Worker's custom domain cannot be created while a record already holds the name. Before the first production deploy open DNS, Records for `zapbip.com` and delete the A record named `@` and the CNAME record named `www`, then open Rules, Redirect Rules and delete the rule `bare domain to docs`. Keep the `docs` record of step 4. After `pnpm deploy:staging` run `dig staging.zapbip.com +short` and `curl -sI https://staging.zapbip.com`; after `pnpm deploy:production` run `dig zapbip.com +short`, `curl -sI https://zapbip.com` and `curl -sI https://www.zapbip.com`.

   Expect: `dig` prints addresses; `curl -sI https://zapbip.com` prints `HTTP/2 200` with a `content-security-policy` header and no `location`; `curl -sI https://www.zapbip.com` prints `HTTP/2 301` and `location: https://zapbip.com/`; the staging host prints `HTTP/2 200`.

   If it fails: a deploy that stops with a conflicting record error names the host; delete that record and deploy again. `HTTP/2 301` with `location: https://docs.zapbip.com` from `zapbip.com` means the old redirect rule is still active; delete it.