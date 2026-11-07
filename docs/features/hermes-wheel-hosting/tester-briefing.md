# Tester briefing: Hermes wheel hosting

Branch `feat/hermes-wheel-hosting`, built on `main` at c8a9b6a. Commits are listed per lane in `plan.md`.

## What changed and where

| Area | Paths |
|------|-------|
| Wheel identity | `libs/types/src/hermes-wheel.ts`, `libs/types/src/constants.ts` (`ZAPBIP_HERMES_PLUGIN_VERSION`, `ZAPBIP_HERMES_WHEEL_SHA256`, `PRODUCTION_PACKAGES_BUCKET`) |
| Build and artifact | `scripts/hermes-wheel/build.ts`, `pnpm hermes-wheel:build`, `apps/hermes-plugin/release/zapbip_platform-0.1.0-py3-none-any.whl` |
| Route | `apps/api/src/routes/package.ts`, mounted in `apps/api/src/app.ts`; `PACKAGES` binding in `apps/api/src/contract/env.ts` and the three blocks of `apps/api/wrangler.jsonc` |
| Install copy and pages | `libs/core/src/install/prompts/connector-commands.ts` (`HERMES_INSTALL_COMMAND`), the two `hermes.*.md` snapshots, `apps/docs/agents/hermes.mdx`, `apps/docs/pt-br/agents/hermes.mdx`; `apps/hermes-plugin/README.md` links the page |
| Preflight | `apps/api/src/operations/deploy-preflight.ts` (`PreflightStep.HermesWheel`), `package-fetcher.ts` (answers a status and a sha256), `apps/api/scripts/deploy.ts`, `docs-preflight.ts`, `.env.example` |
| Runbooks | `docs/runbooks/mintlify-publish.md` step 5, `deploy.md` (go-live order), `cloudflare-setup.md` |
| E2E | `apps/api/test/e2e/hermes-wheel.e2e.test.ts`, `global-setup.ts` (seeds the local bucket), `scripts/e2e/clients/hermes-client.ts` and `hermes/Dockerfile` |

## How to run

- Unit: `pnpm --filter @zapbip/api exec vitest run --config vitest.unit.config.mts`, `pnpm --filter @zapbip/types exec vitest run`, `pnpm --filter @zapbip/core exec vitest run`.
- Shape: `pnpm --filter @zapbip/repository-shape exec vitest run` (needs `python3` on PATH).
- Integration: `pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts test/integration/package-route.test.ts` (port 4012).
- E2E: `pnpm --filter @zapbip/api exec vitest run --config vitest.e2e.config.mts test/e2e/hermes-wheel.e2e.test.ts` (needs `python3` with `pip`); the Hermes image: `pnpm test:e2e:clients` (needs Docker).

## Red today, green after

| Test | Red commit | Failure the red run printed | Green commit |
|------|-----------|------------------------------|--------------|
| `libs/types` `hermes-wheel.test.ts` | 1d93e909 | `hermesWheelFilename is not implemented for 0.1.0` | b91e944f |
| `repository-shape` `hermes-wheel.test.ts` (hash, contents, version, one wheel) | 1d93e909 | `ZAPBIP_HERMES_PLUGIN_VERSION is not exported from libs/types/src/constants.ts` | b91e944f |
| `package-route.test.ts`: serves the wheel, no-store 404, 503 | b41545dc | `expected 404 to be 200`; JSON parse error on the 404 body; `expected 404 to be 503` | 90252d57 |
| `package-route.test.ts`: malformed names, write methods, media bucket | b41545dc | pin: green on the empty route | n/a |
| `chat-clients.test.ts` Hermes command | fae2b5bc | `expected '## Hermes ...' to contain 'pip install "zapbip-platform @ https:...'` | 47b270cf |
| `docs-agent-install.test.ts` pages | fae2b5bc | `expected ... not to contain 'zapbip-platform=='` | 47b270cf |
| `deploy-preflight.test.ts`, `deploy-entry.test.ts`, `docs-preflight-entry.test.ts`, `package-fetcher.test.ts` | 5116f248 | 37 failures: `refuseUnhostedWorkerWheel is not implemented for 0.1.0`, `createPackageFetcher is not implemented for ...` | c3f9c9b4 |
| `runbooks.test.ts` (go-live order, wheel upload), `hermes-wheel.test.ts` no leftovers | f5af439b | go-live order differs; `expected ... to contain 'pnpm hermes-wheel:build'`; `deploy.md` and `mintlify-publish.md` still name the removed constants | 5a0212ef |
| `hermes-wheel.e2e.test.ts` | 76f938fb | pip: `HTTP error 404 while getting http://127.0.0.1:<port>/pkg/zapbip_platform-0.1.0-py3-none-any.whl` | 222db1cf |
| `e2e-clients-scaffolding.test.ts` pinned image | 76f938fb | `expected 'ARG HERMES_IMAGE ...' to contain '#sha256='` | 222db1cf |

## Hypotheses for the tester

- `GET /pkg/zapbip_platform-0.1.0-py3-none-any.whl` answers 200 with the stored bytes, `Cache-Control: public, max-age=31536000, immutable`, `Content-Type: application/octet-stream`, an `ETag` and `nosniff`; any other path under `/pkg/`, any method but GET and an unreadable bucket never carry the immutable header.
- Encoded dots, slashes, uppercase, a trailing dot and a second path segment never reach the bucket (counted by a fake bucket in the integration test).
- `pip install "zapbip-platform @ <origin>/pkg/<wheel>#sha256=<constant>"` installs; the same with one wrong hex digit fails with `THESE PACKAGES DO NOT MATCH THE HASHES`.
- The committed wheel's package files equal `apps/hermes-plugin/zapbip_platform`; editing one source line without a rebuild turns the shape test red.
- The production Worker preflight refuses with both hashes when the bucket holds other bytes, and with the upload step when the key is missing; staging never reads the bucket.
- The docs preflight refuses on 404, on a wrong hash and on an unreachable host; npm is checked first.
- The Hermes image installs the committed wheel by `file://...#sha256=`; the existing `hermes-openclaw.e2e.test.ts` stays green (run by the developer once, see the result in the final report of the lane).

## Gaps and deviations

- `HERMES_INSTALL_COMMAND` stays a constant (neighbouring `OPENCLAW_INSTALL_COMMAND` is one), not the function `hermesInstallCommand()` of the spec. `@zapbip/core` exports it.
- `HEAD /pkg/<wheel>` answers like `GET` without a body: Hono dispatches `HEAD` to the `GET` handler; the spec now says so.
- A bucket failure answers 503 and logs the `PackageUnavailable` event name only.
- Production bucket `zapbip-packages` has no environment suffix (spec); staging is `zapbip-packages-staging`, development `zapbip-packages-development`.
- The go-live order changed: "Publish the docs" now follows "Production deploy" because the docs preflight reads the wheel from the live Worker.
- The wheel was built once; byte-reproducibility across machines is deliberately not tested (ADR 0034).
- The real `wrangler r2 object put` and the bucket creation are deploy-time acts and were not run.
