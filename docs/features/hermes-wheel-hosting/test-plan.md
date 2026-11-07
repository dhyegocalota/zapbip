# Test plan: Hermes wheel hosting

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `tools/repository-shape/src/hermes-wheel.test.ts::the committed wheel matches the constant` — input: the tree before the change; expected: red, `ZAPBIP_HERMES_WHEEL_SHA256` is not exported
- [ ] Confirmed it fails for the right reason: the missing export, not a broken test

## Unit

- [ ] `libs/types/src/hermes-wheel.test.ts::filename` — input: version `0.1.0`; expected: `zapbip_platform-0.1.0-py3-none-any.whl`
- [ ] `hermes-wheel.test.ts::path` — input: version `0.1.0`; expected: `/pkg/zapbip_platform-0.1.0-py3-none-any.whl`
- [ ] `libs/core/.../chat-clients.test.ts::hermes command` — input: the Hermes client; expected: the text contains `pip install "zapbip-platform @ https://mcp.zapbip.com/pkg/zapbip_platform-0.1.0-py3-none-any.whl#sha256=<constant>"` and does not contain `zapbip-platform==`
- [ ] `deploy-preflight.test.ts::hosted hash equal` — input: the shell returns bytes whose sha256 equals the constant; expected: no refusal at step `HermesWheel`
- [ ] `deploy-preflight.test.ts::hosted hash differs` — input: other bytes; expected: refusal naming the expected and the actual hash
- [ ] `deploy-preflight.test.ts::object missing` — input: `r2 object get` fails with not found; expected: refusal that names the upload step
- [ ] `deploy-preflight.test.ts::docs preflight over HTTPS` — input: the fetcher answers 404, then 200 with other bytes, then 200 with the right bytes; expected: refusal, refusal, pass
- [ ] `deploy-preflight.test.ts::no publisher variable` — input: the environment without `ZAPBIP_PYPI_PUBLISHER`; expected: no refusal about it; `env-example.test.ts` no longer lists it
- [ ] Edge: a non-production environment — input: staging; expected: the Worker step is skipped like the other production-only steps

## Shape

- [ ] `hermes-wheel.test.ts::the hash` — input: sha256 of `apps/hermes-plugin/release/zapbip_platform-<version>-py3-none-any.whl`; expected: equals the constant
- [ ] `hermes-wheel.test.ts::the contents` — input: the wheel's files under `zapbip_platform/` unzipped; expected: byte-equal to `apps/hermes-plugin/zapbip_platform/` (so source drift fails the gate until the wheel is rebuilt and the version bumped)
- [ ] `hermes-wheel.test.ts::the version` — input: `pyproject.toml`, the wheel's `METADATA`, the constant; expected: all the same version
- [ ] `hermes-wheel.test.ts::one wheel per version` — input: the `release/` directory; expected: exactly the wheel of the current version plus none that the constant does not name; older versions stay listed in the runbook, not here
- [ ] `docs-agent-install.test.ts::hermes page` — input: both Hermes pages; expected: each contains the rendered command and neither contains `zapbip-platform==`
- [ ] `hermes-wheel.test.ts::no leftover` — input: a repository grep; expected: no `ZAPBIP_PYPI_VERSION`, `ZAPBIP_PYPI_PUBLISHER` or `pypi.org` outside `docs/adr`, `docs/learnings` and `docs/features`

## Integration

- [ ] `apps/api/test/integration/package-route.test.ts::serves the wheel` — input: object seeded in `PACKAGES`; `GET /pkg/zapbip_platform-0.1.0-py3-none-any.whl`; expected: 200, identical bytes, `Cache-Control: public, max-age=31536000, immutable`, `Content-Type: application/octet-stream`, an `ETag`
- [ ] `::missing object` — input: valid name, nothing stored; expected: 404 `{"error":"not_found"}` with `Cache-Control: no-store`
- [ ] `::malformed names` — input: `/pkg/evil.whl`, `/pkg/zapbip_platform-1.0.whl`, `/pkg/..%2Fsecret`, `/pkg/zapbip_platform-0.1.0-py3-none-any.whl/extra`; expected: 404 each and zero reads of the bucket
- [ ] `::other methods` — input: POST, PUT, DELETE, PATCH to a valid name; expected: 404 and the bucket unchanged
- [ ] `::the media bucket is not reachable` — input: a media object whose key equals a valid wheel name stored in `MEDIA`; expected: 404
- [ ] `::R2 failure` — input: the bucket binding throws; expected: 503 and no immutable cache header

## E2E

- [ ] `apps/api/test/e2e/hermes-wheel.e2e.test.ts::pip installs the pinned direct reference` — steps: local Worker with the committed wheel seeded, `python3 -m pip install --no-deps --target <dir> "zapbip-platform @ <local origin>/pkg/<file>#sha256=<constant>"`; expected: exit 0 and `zapbip_platform/__init__.py` exists in the target
- [ ] `::a wrong hash is refused` — steps: the same with the last hex digit changed; expected: non-zero exit, output contains `do not match the hashes`
- [ ] `::a missing wheel` — steps: the same with the object absent; expected: non-zero exit, output contains `404`
- [ ] `hermes-openclaw.e2e.test.ts` — expected: unchanged and green, the Hermes image installs the committed wheel by the pinned form

## Prove it for real

- [ ] Docs walk with Playwright MCP, en: open the Hermes page; expected: the install block shows the exact rendered command, the copy button copies it, a 12-line terminal-width view does not truncate the hash (it wraps or scrolls inside the block), console and network clean
- [ ] Docs walk, pt-br: the same text in the same command block
- [ ] Fresh venv: copy the command from the page and run it against the local Worker origin; expected: installs, then `pip show zapbip-platform` prints the constant version
- [ ] Console and network clean: zero console errors and zero failed requests
- [ ] Narrow width: the code block scrolls horizontally inside its container; the page itself does not
- [ ] Screenshots and a short video staged for the PR

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case and a regression test for each.

## Adversarial review

- [ ] Claim 1: pip refuses a swapped object — attack: store a modified wheel under the same key and install the printed command; result: refuted | held
- [ ] Claim 2: the Worker cannot be made to serve anything but the wheel — attack: encoded dots, slashes, double encoding, uppercase names, trailing dot, query strings on `/pkg`; result: refuted | held
- [ ] Claim 3: the shape test catches a stale wheel — attack: edit one line in `zapbip_platform/adapter.py` without a rebuild, then bump the version without a rebuild; result: refuted | held

## Coverage honesty

- The real production upload (`wrangler r2 object put` against `zapbip-packages`) runs at deploy time (agent-run, authorized 2026-11-07), not in the gate; the gate exercises the runbook step through the preflight's fake shell and the local Worker, and the staging deploy is checked by a real `pip install` from mcp-staging.zapbip.com.
- A pip behaviour change in how direct references with a hash fragment are verified is not tested for newer pip versions than the one in the e2e image; pip has supported `#sha256=` on direct URLs since version 20.
- Wheel byte-reproducibility across machines is deliberately not tested; the committed file is the source of truth (ADR 0034).
