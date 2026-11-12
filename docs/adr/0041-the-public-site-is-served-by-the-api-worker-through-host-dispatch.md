# 0041. The public site is served by the API Worker, selected by host, next to the backoffice

- Status: Accepted
- Date: 2026-11-12
- Deciders: Dhyego Calota (owner, delegated 2026-11-12); Claude (advisor)
- Inspired by: [ADR 0031](0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md) and its host dispatch (`host-dispatch.ts`), which already puts a second product on the Worker; [ADR 0010](0010-public-docs-on-mintlify.md) (docs stay on Mintlify, on `docs.zapbip.com`); [ADR 0027](0027-deploys-run-from-the-owners-machine-not-from-ci.md)

## Context

The owner wants a sales page at the bare domain. The domain `zapbip.com` today redirects to the docs host ([DNS runbook](../runbooks/dns.md), step 5). The page needs server-rendered HTML with a form that writes to D1, a Turnstile check, a CSV export in the backoffice and a few static media files. Three ways to host it were on the table: Mintlify, a Cloudflare Pages project, or the existing API Worker.

Mintlify cannot run a server-side form. A Pages project would be a second deploy, a second set of bindings and a second secret store for a page that writes to the same D1 database. The API Worker already has the D1 binding, the Turnstile secret path, the security header code and the host dispatch.

## Decision

1. The API Worker serves the public site on three hosts, chosen by `fetchByHost`, with a new host kind for each:
   - `zapbip.com` (production) and `staging.zapbip.com` (staging): the site, from `apps/api/src/site/`;
   - `www.zapbip.com`: a `301` to `SITE_ORIGIN` with the same path and query, answered by the Worker, not by a Cloudflare redirect rule.
2. The host of each site is one `vars` entry, `SITE_ORIGIN`, per environment, next to `BACKOFFICE_ORIGIN`. Development uses `http://site.localhost:8787`, so the site and the MCP app do not share a host in development.
3. The site and the MCP app never mount each other's routes. The MCP host keeps the MCP routes, the backoffice keeps the backoffice routes, and a repository-shape test pins that the site directory is not agent-facing.
4. The site ships its own content security policy, like the Embedded Signup page: `script-src 'self' https://challenges.cloudflare.com`, `frame-src https://challenges.cloudflare.com`, `img-src 'self'`, `style-src 'self'`, `media-src 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `base-uri 'none'`. The backoffice policy is not loosened.
5. Static media (the demo video in mp4 and webm, the poster and the Open Graph image) live in `apps/api/site-public/` and are served through the Workers static assets binding. The Worker script stays small; each file is under the per-file limit of the assets binding.
6. Owner-only: before the first production deploy, the owner removes the old apex `A` record, the `www` CNAME and the bare-domain redirect rule in the Cloudflare dashboard. The Worker's custom domain cannot be created while those records exist. The DNS runbook gets the new steps in the same change.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Mintlify page on the bare domain | no code, the docs tooling | no form handling, no D1, no Turnstile check; the docs host is the wrong brand surface | the page must write |
| Cloudflare Pages project with Pages Functions | fast static hosting | a second deploy, a second set of bindings for D1 and the Turnstile secret; a second runbook | the page writes to the same D1 |
| A separate `apps/site` Worker | isolation from the MCP and backoffice code | a second Worker, a second deploy and secrets; the D1 binding and the Turnstile secret would be duplicated | the host dispatch already gives isolation |
| Cloudflare redirect rule for `www` | no code | not in the repository, not tested, and a second place to edit the redirect | the redirect is a host rule the tests can pin |

## Consequences

- The Worker code for the public site runs on every request to the three hosts. Its cost is in the CPU budget of the Workers Free plan: the page render and the signup check are measured in the test plan against the 10 ms budget of [ADR 0009](0009-cloudflare-workers-with-one-durable-object-per-account.md), or the owner moves to a paid plan, which is a decision for the owner.
- The static assets are served on the same Worker, so the media is reachable from the MCP host too. The files are public marketing media and carry no secret.
- `docs.zapbip.com` is unchanged. The runbook step that pointed the bare domain at the docs host is replaced.
- Rollback is a redeploy of the previous version and restoring the DNS redirect rule from the runbook.

## Evidence

- Host dispatch by `request.url` host is in place and tested for the backoffice (`host-dispatch.ts`, the rejected trailing-dot host).
- The Workers static assets binding and its per-file limits are in the Cloudflare documentation; the exact limit is read again in the first build step.

## Revisit when

- The page needs a server-side personalisation that the static media cannot serve, or a second locale that needs its own domain.
- The Worker's CPU time on the site hosts approaches the Workers Free plan budget.
