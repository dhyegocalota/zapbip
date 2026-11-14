# Self-hosting

**Status:** Shipped 2026-11-14
**Tier:** 🟡 medium
**Owner approval:** the owner asked on 2026-11-14 for open source documentation in the manner of large open source repositories: how to run locally, with Docker and where to deploy ("railway, heroku, where else")
**ADRs:** [0061](../../adr/0061-the-public-docs-carry-an-open-source-section-and-link-the-runbooks.md); narrows [0026](../../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md)
**Not changing:** the Worker, the runbooks, the other docs pages

## Problem

The README says anyone can run a copy, but the docs site has no open source section and the repository has no container image. Broken README badges also hid the project's licence and contributors.

## Goals

- A docs group "Open source" in every language: an overview with the licences and contributing, how to run locally and with Docker, and how to deploy to Cloudflare, naming the hosts that cannot run production.
- `docker compose up --build` starts the development sandbox on port 8787 with its data in a volume and its secrets generated once.
- The README licence badge and contributors image render.

## Non-goals

- A production port to Railway, Heroku, Fly.io or Render: production needs Durable Objects, D1 and R2.
- Copying the runbooks into the site.

## Design

### Data flow

`scripts/docker-entrypoint.sh` keeps four generated secrets in `/data/secrets.env`, copies them to `.dev.vars`, applies the migrations into `/data/state` and runs the Worker bound to all interfaces. The docs pages are generated once from one set of strings per language and committed as ordinary pages; `docs.json` and `DOCS_GROUPS` gain the sixth group.

### Failure handling

| Failure | Outcome |
|---|---|
| The image has no CA certificates | the runtime refuses to start; the Dockerfile installs `ca-certificates` |
| A restart | the volume keeps the database, the files and the secrets |

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Railway and Heroku | port, document as unsupported | document honestly: production needs Cloudflare services (owner delegated) | 2026-11-14 |

## Test strategy summary

`self-hosting.test.ts` pins the container files and the pages in ten languages; the navigation and visual tests cover the new group. The image was built and run once: `/health` answered, an owner was seeded and the secrets survived a restart.
