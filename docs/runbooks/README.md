# Go-live runbooks

The owner's step-by-step path from zero accounts to zapbip running on the WhatsApp numbers behind `mcp.zapbip.com`.

The go-live order and the go-live record are in `deploy.md`. Every runbook step has an expected result and an `If it fails` line, and agents never run them ([ADR 0026](../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md), [ADR 0027](../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)).

## Runbooks

- [cloudflare-setup.md](cloudflare-setup.md): the Cloudflare account, the free plan, R2, the scoped API token and the error notification.
- [dns.md](dns.md): checking the existing `zapbip.com` zone on Cloudflare, one DNS check per host, the docs CNAME and the bare-domain redirect.
- [meta-setup.md](meta-setup.md): the policy check, the Meta apps, the numbers, the tokens, the webhook, Live mode and the templates.
- [backoffice.md](backoffice.md): enrolling the operator, signing in, registering, verifying and activating a number, replacing a credential and recovering a lockout.
- [deploy.md](deploy.md): the go-live order, resources, secrets, migrations, deploy, smoke, tail, rollback, the weekly cost check and the go-live record.
- [mintlify-publish.md](mintlify-publish.md): the company facts, the packages, the docs preflight, the Mintlify site and its domain.
