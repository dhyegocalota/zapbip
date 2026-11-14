# 0061. The public docs carry an open source section and link the runbooks

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [ADR 0026](0026-runbooks-live-in-the-repository-not-on-mintlify.md), whose third point this narrows; the owner's request of 2026-11-14 for open source documentation in the manner of large open source projects: run locally, with Docker and deploy

## Context

zapbip is open source under the AGPL and the MIT licence, and the README promises that anyone can run a copy. ADR 0026 kept every operator step off the public site because the runbooks follow the hosted service's own resources. A visitor who wants to run their own copy now needs a path from the site, in every language the docs speak, without the site publishing the steps themselves.

## Decision

1. The docs carry an Open source group of three pages in every language: an overview with the licences and the ways to contribute, how to run zapbip locally and with Docker, and how to deploy to Cloudflare, with the hosts that cannot run production.
2. The deploy page links each runbook on GitHub and does not copy its steps. The runbooks stay in `docs/runbooks/`, reviewed like code; the shape test that forbids the site to point at them skips the `open-source` pages only.
3. A `Dockerfile` and `compose.yaml` at the root run the development sandbox (the same Worker with the local WhatsApp stand-in), with the database, files and generated secrets in the `zapbip-data` volume. They are for trying zapbip on any container host, never production.
4. Railway, Heroku, Fly.io, Render and a plain server are documented as unable to run production: it needs Durable Objects, D1 and R2, which exist only on Cloudflare ([ADR 0009](0009-cloudflare-workers-with-one-durable-object-per-account.md)).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep self-hosting out of the site (ADR 0026) | One place for operator steps | A visitor cannot find how to run a copy | The owner asked for open source docs |
| Copy the runbooks into the site | One place for readers | Two copies drift; steps name the hosted service's resources | Links keep one copy |
| A Node port for Railway and Heroku | Wider hosting | Rewrites the Durable Object, D1 and R2 layers | Out of scope; documented as unsupported |

## Consequences

Thirty pages in ten languages to keep in step with the repository; the guide pages avoid commands that change often and link the runbooks for them. The Docker image installs the whole API workspace, so it is large.

## Evidence

`self-hosting.test.ts` pins the container files, the shared port and volume and the pages in every language. The image was built, started, answered `/health` and seeded an owner, and kept its generated secrets across a restart.

## Revisit when

The Worker runs on another runtime, or a hosted offer replaces the self-hosting path.
