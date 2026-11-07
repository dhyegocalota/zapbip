# Plan: Hermes wheel hosting

**Spec:** spec.md
**Tier:** 🟡 medium
**Seam:** the wheel's identity (version, filename, sha256) in `libs/types`, consumed by the Worker route, the install copy, the docs and the deploy preflight
**Assumptions (decided, owner can override):**
- ADR 0034 (0031 and 0032 belong to backoffice, 0033 is reserved for agent-registry).
- Built on `main` at c8a9b6a, which has `deploy-readiness`, `hermes-openclaw`, `install-skills` and `docs-experience`; the lanes run one after another in this order.
- A backoffice lane edits `apps/api/wrangler.jsonc`, `apps/api/src/contract/env.ts` and `libs/types` constants in parallel; the edits here are additive (one `PACKAGES` binding per block, new constants) so the merge is a union.
- A committed binary of about 20 KB is acceptable in `apps/hermes-plugin/release/`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 identity and build | `libs/types/src/constants.ts`, `libs/types/src/hermes-wheel.ts` (+ `.test.ts`), `libs/types/src/index.ts`, `scripts/hermes-wheel/build.ts`, `apps/hermes-plugin/release/*.whl`, `tools/repository-shape/src/hermes-wheel.test.ts` | `developer` |
| G2 route | `apps/api/src/routes/package.ts`, `apps/api/src/app.ts`, `apps/api/src/contract/env.ts`, `apps/api/wrangler.jsonc` (production top level, `env.staging`, `env.development`), `apps/api/test/unit/wrangler-config.test.ts`, `apps/api/test/integration/package-route.test.ts` | `developer` |
| G3 copy and docs | `libs/core/src/install/prompts/connector-commands.ts` (+ `chat-clients.test.ts`, the `hermes.*.md` snapshots), `apps/docs/agents/hermes.mdx`, `apps/docs/pt-br/agents/hermes.mdx`, `apps/docs/e2e/agents-b.spec.ts`, `apps/hermes-plugin/README.md` (a link to the Hermes page), `tools/repository-shape/src/docs-agent-install.test.ts` | `developer` |
| G4 preflight and runbook | `apps/api/src/operations/deploy-preflight.ts`, `apps/api/src/operations/package-fetcher.ts`, `apps/api/scripts/deploy.ts`, `apps/api/scripts/docs-preflight.ts`, `apps/api/test/unit/{deploy-preflight,deploy-entry,docs-preflight-entry,package-fetcher,env-example}.test.ts`, `apps/api/test/unit/fake-deploy-shell.ts`, `apps/api/test/e2e/deploy-dry-run.e2e.test.ts`, `.env.example`, `docs/runbooks/mintlify-publish.md`, `docs/runbooks/deploy.md`, `docs/runbooks/cloudflare-setup.md` | `developer` |
| G5 e2e | `scripts/e2e/clients/hermes-client.ts`, `scripts/e2e/clients/hermes/Dockerfile`, `scripts/e2e/clients/hermes/build-requirements.txt` (kept for the build script), `apps/api/test/e2e/hermes-wheel.e2e.test.ts` | `developer` |

## Sequencing

One developer runs the lanes in order G1, G2, G3, G4, G5 (machine resource cap). G1 first: it owns the constants every other lane imports. G5 needs the route from G2. The shape test in G1 is extended by G3 (printed commands) in a separate file, so no two lanes edit the same file.

## Steps

### G1

- [x] **Step 1:** red: `hermes-wheel.test.ts` in `libs/types` for `hermesWheelFilename` and `hermesWheelPath`, and the shape test (committed wheel exists for the version, its sha256 equals `ZAPBIP_HERMES_WHEEL_SHA256`, its package files equal `apps/hermes-plugin/zapbip_platform`, `pyproject.toml` version equals the constant) — evidence: red 1d93e909 (libs/types: 'hermesWheelFilename is not implemented'; shape test: 'ZAPBIP_HERMES_PLUGIN_VERSION is not exported')
- [x] **Step 2:** rename `ZAPBIP_PYPI_VERSION` to `ZAPBIP_HERMES_PLUGIN_VERSION` everywhere (a mechanical sweep; the grep for the old name returns nothing) and add the helpers — evidence: green b91e944f
- [x] **Step 3:** `scripts/hermes-wheel/build.ts` builds the wheel with `SOURCE_DATE_EPOCH`, copies it to `release/`, prints the hash; run it once, commit the wheel, set `ZAPBIP_HERMES_WHEEL_SHA256` — evidence: green b91e944f (pnpm hermes-wheel:build; wheel and hash committed)

### G2

- [x] **Step 1:** red: `package-route.test.ts` (200 with bytes and headers, 404 for missing, malformed and traversal names, 404 for POST, PUT, DELETE, HEAD-less behaviour pinned) — evidence: red b41545dc (serving, the no-store 404 and the 503 red; malformed names, write methods and the media bucket are pins on the empty route)
- [x] **Step 2:** `PACKAGES` binding in `Bindings`, `wrangler.jsonc` (production, staging, development, which the tests use); `packageRoutes` mounted in `app.ts` — evidence: green 90252d57

### G3

- [x] **Step 1:** red: `chat-clients.test.ts` and `docs-agent-install.test.ts` expect `HERMES_INSTALL_COMMAND` (the pinned direct reference) in the install copy and both Hermes pages, and the old `==` form nowhere — evidence: red fae2b5bc
- [x] **Step 2:** render the command in `connector-commands.ts`; update the two pages — evidence: green 47b270cf

### G4

- [x] **Step 1:** red: preflight tests for `HermesWheel` (hash equal passes; hash differs refuses with both hashes; object missing refuses with the upload instruction; docs preflight 404 and mismatch refuse; `ZAPBIP_PYPI_PUBLISHER` no longer required) — evidence: red 5116f248 ('is not implemented' stubs)
- [x] **Step 2:** replace `refuseUntrustedPypiPackage` and the XML-RPC code with `refuseUnhostedHermesWheel` (Worker: shell `r2 object get` and `shasum`; docs: the package fetcher, which now answers a status and a sha256 instead of parsed JSON), drop `ZAPBIP_PYPI_PUBLISHER` and the `pypiVersion` inputs of the scripts from `.env.example` and its test — evidence: green c3f9c9b4
- [x] **Step 3:** runbooks: replace step 5 of `mintlify-publish.md` with the build, hash check, `wrangler r2 bucket create zapbip-packages` (in `cloudflare-setup.md`) and `wrangler r2 object put` steps, each with Expect and If it fails; `deploy.md` order: upload wheel, deploy Worker, docs preflight — evidence: red f5af439b, green 5a0212ef; the go-live order now publishes the docs after the production deploy

### G5

- [x] **Step 1:** red: `hermes-wheel.e2e.test.ts` boots the local Worker with a seeded `PACKAGES` bucket, runs `pip install --no-deps --target <dir> "zapbip-platform @ http://127.0.0.1:<port>/pkg/<file>#sha256=<hash>"` and expects success, then the wrong hash and expects pip's mismatch error — evidence: red 76f938fb (pip got 404: wheel not seeded)
- [x] **Step 2:** the Hermes image installs the committed wheel with the same direct-reference form (`file://` plus `#sha256=`) instead of `pip wheel` at test time; `buildHermesImage` drops the build-tools step — evidence: green 222db1cf (global-setup seeds the local bucket; the Hermes image installs the committed wheel by pin)

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| G1 Step 2 | a missed reference to the old constant | typecheck fails on the unknown export | revert; the sweep is one commit |
| G1 Step 3 | wheel contents differ per machine | the shape test compares package files, not zip bytes, and the hash is of the committed file | n/a, nothing rebuilds in the test |
| G2 Step 2 | `PACKAGES` missing from one wrangler block | `wrangler types` diff and the env shape test | add the block |
| G3 | quoting breaks in a shell | the e2e pip install uses the printed text verbatim | fix the renderer |
| G4 Step 2 | the preflight blocks a deploy for a missing upload | its refusal names the runbook step | upload, rerun |
| G5 Step 2 | Docker image build slower or broken | `hermes-openclaw.e2e.test.ts` red | revert the Dockerfile |

**Steps with no backout:** the `wrangler r2 object put` of a new version is a production write the owner runs; a wrong object is replaced only by a new version and a new hash, which is the design.

### G6 (security amendment)

- [x] **Step 1:** red: the requirements-file names and shape tests (every line `==`-pinned with a hash, names match the lock and the project, the dist-info `Requires-Dist` and `entry_points.txt`) — evidence: red c68fec8e; green ab99b7b1, test fix d764606e
- [x] **Step 2:** the route serves exactly the wheel and the requirements file — evidence: red 6299f028 (integration not run: port 4012 held), green 165664e9
- [x] **Step 3:** the install command downloads the requirements file, checks its sha256 and installs with `--require-hashes`; pages and snapshots — evidence: red 73d46843, green 9751aa62
- [x] **Step 4:** the preflight checks both hosted files for the Worker and the docs — evidence: red f8c2ac62, green ed7d3afc
- [x] **Step 5:** runbooks upload both files; the docs preflight after the production deploy is mandatory — evidence: red 8b61b809, green 948c451a
- [x] **Step 6:** e2e runs the full command against the local Worker, a tampered requirements file and a tampered dependency hash — evidence: red 7955e96f, green 88ec7cd3 (e2e not run: on hold)

## Z. Prove and ship

- [ ] **Tester briefing:** written by the developer, covering the Hermes docs walk and the pip install against a local Worker.
- [ ] **Tester run:** a fresh `tester` sub-agent returned a report.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/check-ui:** docs pages in en and pt-br.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
