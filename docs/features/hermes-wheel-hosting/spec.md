# Hermes wheel hosting

**Status:** Building
**Tier:** 🟡 medium
**Security amendment:** 2026-11-07 (owner delegated 2026-11-06), after the security review found the dependencies of the wheel unpinned: the install goes through a hash-pinned requirements file.
**Owner approval:** approved 2026-11-06 (owner delegated)
**ADRs:** [0034](../../adr/0034-the-hermes-wheel-is-self-hosted-and-installed-by-a-pinned-hash.md)
**Not changing:** the plugin's code and behaviour, the npm packages (`zapbip`, `@zapbip/openclaw-plugin`, owner-published as `dhyegocalota`), the connector protocol

## Problem

The Hermes install command is `pip install zapbip-platform==0.1.0`, and the name resolves on PyPI. The owner has no PyPI account and agents may not create one, so the package can never be published and the command can never work. The deploy preflight (deploy-readiness) refuses until PyPI answers for `zapbip-platform` with the owner as sole role holder, which cannot pass. Every surface that prints the command (the install copy in `libs/core`, the Hermes docs in en and pt-br, the plugin README, `docs-agent-install.test.ts`) is therefore wrong today.

## Goals

- The `zapbip-platform` wheel is built from `apps/hermes-plugin`, stored in R2 under an immutable versioned key, and served by the Worker at `https://mcp.zapbip.com/pkg/<wheel filename>`.
- The install command downloads a hash-pinned requirements file, checks its sha256 and installs with `--require-hashes`: `curl -fsSL https://mcp.zapbip.com/pkg/zapbip_platform-0.1.0-requirements.txt -o zapbip-requirements.txt && echo "fc258f304227f3eb44169c5416f581424296a876995c6499daaa42c7cf04cc31  zapbip-requirements.txt" | sha256sum -c - && pip install --require-hashes -r zapbip-requirements.txt`. The file lists our wheel by its hosted URL with its hash and every runtime dependency, transitive ones included, each pinned `==` with `--hash` lines, so nothing the plugin imports is fetched unpinned from PyPI. The docs show the Linux form (`sha256sum`); on macOS the check is `shasum -a 256 -c -`.
- One constant for the version and one for the hash live in `libs/types` next to the other package versions. `ZAPBIP_PYPI_VERSION` is renamed `ZAPBIP_HERMES_PLUGIN_VERSION`, because no PyPI is involved. The command is rendered from them in one place and every surface reuses it.
- A shape test fails whenever the constant, the committed wheel, the plugin source, `pyproject.toml` or any printed command disagree.
- The deploy preflight checks the hosted wheel's hash instead of PyPI role holders; the runbook gains the `wrangler r2 object put` step.

## Non-goals

- Publishing to PyPI. It stays an optional later step; when it happens the command can stay as is.
- A package index (PEP 503 simple API), a second wheel, an sdist, or a version listing endpoint.
- Signing the wheel beyond the sha256 pin.
- Changing the npm side.

## Design

### Data flow

1. **Build and pin.** `scripts/hermes-wheel/build.ts` builds the wheel from `apps/hermes-plugin` with the hash-pinned build tools (`scripts/e2e/clients/hermes/build-requirements.txt`) and `SOURCE_DATE_EPOCH`, copies it to `apps/hermes-plugin/release/zapbip_platform-<version>-py3-none-any.whl`, and prints its sha256 and the constants to set. The wheel is committed. Its hash is the value of `ZAPBIP_HERMES_WHEEL_SHA256` in `libs/types/src/constants.ts`.
2. **Upload.** The deploy runbook (owner's shell, ADR 0027) runs `wrangler r2 object put zapbip-packages/zapbip_platform-<version>-py3-none-any.whl --file apps/hermes-plugin/release/<same name> --content-type application/octet-stream --remote`. A new plugin version is a new key; an existing key is never overwritten.
3. **Serve.** `GET /pkg/:filename` serves exactly two names, the wheel and the requirements file (`text/plain; charset=utf-8`), and in `apps/api/src/routes/package.ts` (the `packageRoutes` Hono app, mounted next to `mediaRoutes`) opens the object from the `PACKAGES` R2 binding (bucket `zapbip-packages`, separate from `MEDIA` so the media retention sweep and account purge never reach it). Headers: `Content-Type: application/octet-stream`, `Cache-Control: public, max-age=31536000, immutable`, `ETag` from the object, `X-Content-Type-Options: nosniff`. No authentication: the wheel is public code and the hash pin is the integrity control.
4. **Install.** The constant `HERMES_INSTALL_COMMAND` in `libs/core/src/install/prompts/connector-commands.ts` (exported by `@zapbip/core`) renders the command from `PRODUCTION_PUBLIC_ORIGIN`, `ZAPBIP_HERMES_PLUGIN_VERSION` and `ZAPBIP_HERMES_WHEEL_SHA256` (through `hermesWheelFilename` and `hermesWheelPath` in `libs/types`). The install copy, `apps/docs/agents/hermes.mdx`, and `apps/docs/pt-br/agents/hermes.mdx` show that exact text; `docs-agent-install.test.ts` imports the same constant instead of a string literal and `chat-clients.test.ts` pins the rendered form. The plugin README states its purpose only and links the Hermes docs page.
5. **Preflight.** The Worker preflight step `PypiVersion` becomes `HermesWheel`: for production it reads the object from R2 through the shell (`wrangler r2 object get ... --remote --file <temporary file>`), hashes it and refuses unless the sha256 equals the constant. The docs preflight (which runs after the Worker is deployed and before Mintlify is linked) fetches `https://mcp.zapbip.com/pkg/<filename>` through the existing package fetcher, hashes the body and refuses on a mismatch or a non-200. `ZAPBIP_PYPI_PUBLISHER`, the XML-RPC role query and their tests are removed.

### Interfaces

| Item | Where | Shape |
|------|-------|-------|
| `ZAPBIP_HERMES_PLUGIN_VERSION` | `libs/types/src/constants.ts` | renamed from `ZAPBIP_PYPI_VERSION`, `'0.1.0'` |
| `ZAPBIP_HERMES_WHEEL_SHA256` | same | 64 lowercase hex characters |
| `HERMES_WHEEL_PATH_PREFIX`, `hermesWheelFilename({ version })`, `hermesWheelPath({ version })` | `libs/types` (no logic beyond string building) | `/pkg/`, `zapbip_platform-<version>-py3-none-any.whl` |
| `PACKAGES` | `apps/api/src/contract/env.ts`, `wrangler.jsonc` (production at the top level, staging, development) | R2 bucket binding |
| `GET /pkg/:filename` | `apps/api/src/routes/package.ts` GET and HEAD (Hono answers HEAD from the GET handler, without a body): 200 with the bytes; 404 `{ error: 'not_found' }` for an unknown or malformed filename; other methods 404 |
| `PreflightStep.HermesWheel` | `apps/api/src/operations/deploy-preflight.ts` | replaces `PypiVersion` |

A path such as `/pkg/%2e%2e/...` does not match the filename route and falls through to the global 404 of the app, which is harmless because that response carries no immutable header.

Deploy order: the wheel is uploaded (runbook), the Worker is deployed (its preflight reads R2), then the docs are published (the docs preflight reads the wheel from the live Worker), so "Publish the docs" comes after "Production deploy" in `docs/runbooks/deploy.md`.

The requirements file is built by `pnpm hermes-wheel:build` from the wheel line plus the runtime lock `apps/hermes-plugin/requirements.txt` and committed beside the wheel; the shape tests check that every line is `==`-pinned with a hash, that the names match the lock and the project, and that the wheel's `Requires-Dist` and `entry_points.txt` match `pyproject.toml`. The preflight checks both hosted files, for the Worker and for the docs, and the docs preflight after the production deploy is mandatory.

The accepted filenames are the patterns `^zapbip_platform-\d+\.\d+\.\d+-py3-none-any\.whl$` and `^zapbip_platform-\d+\.\d+\.\d+-requirements\.txt$`, in place of the single one; `^zapbip_platform-\d+\.\d+\.\d+-py3-none-any\.whl$`, checked before R2 is touched, so a path such as `../` or a different object never reaches the bucket.

### Failure handling

| Failure | Result |
|---------|--------|
| Key not uploaded yet | `GET` answers 404; pip stops with a 404; the preflight refuses with "upload it with the runbook step" |
| Wrong bytes uploaded or R2 object swapped | pip refuses (`THESE PACKAGES DO NOT MATCH THE HASHES`); the preflight refuses with both hashes |
| Constant not updated after rebuilding the wheel | the shape test fails on the committed wheel's hash |
| Plugin source changed without a rebuild | the shape test fails: the committed wheel's package files differ from `apps/hermes-plugin/zapbip_platform` |
| Version bumped without a new wheel | the shape test fails: no wheel file for the version in `ZAPBIP_HERMES_PLUGIN_VERSION` |
| Overwrite of a live key | the runbook step checks the key first (`wrangler r2 object get` succeeds means stop); the Worker never writes to the bucket |
| R2 unavailable | the route answers 503 through the existing error path; pip fails visibly; nothing is cached because the 404 and 503 responses carry no immutable header |

Only a 200 carries the immutable cache header; a 404 is `Cache-Control: no-store`, so uploading the wheel after a first miss works at once.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Publish to PyPI | create an account, self-host | self-host; no PyPI account exists and agents may not create one; PyPI stays optional later | 2026-11-06 (owner delegated) |
| Same bucket as media or a new one | `MEDIA` under `pkg/`, new `zapbip-packages` | new bucket `PACKAGES`: the media retention sweep and the account purge cannot touch it | 2026-11-06 (owner delegated) |
| Hash source | rebuild reproducibly in the test, committed wheel plus hash | committed wheel plus the hash constant, see ADR 0034: a wheel rebuild is not reproducible across Python and setuptools versions, and the artifact must be the exact bytes that are uploaded | 2026-11-06 (owner delegated) |
| Constant name | keep `ZAPBIP_PYPI_VERSION`, rename | rename to `ZAPBIP_HERMES_PLUGIN_VERSION` | 2026-11-06 (owner delegated) |
| Who uploads | CI, owner's shell | owner's shell, as a runbook step, per ADR 0027 | 2026-11-06 (owner delegated) |
| Authentication on `/pkg` | public, signed | public; the sha256 pin in the command is the integrity control and the code is not secret | 2026-11-06 (owner delegated) |

## Test strategy summary

Unit: the filename and command builders, the preflight with a fake shell and fake fetcher. Shape: the wheel, hash, version and printed commands agree. Integration: the Worker route with the Workers pool and a seeded `PACKAGES` bucket. E2E: a real `pip install` of the direct reference from the local Worker, and the Hermes Docker image installs the committed wheel by the same pinned form. Docs walk: the Hermes page in both languages shows the command that works.
