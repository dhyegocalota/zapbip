# Test plan: Hermes wheel hosting

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [x] `tools/repository-shape/src/hermes-wheel.test.ts::the committed wheel matches the constant` — input: the tree before the change; expected: red, `ZAPBIP_HERMES_WHEEL_SHA256` is not exported — evidence: red 1d93e909: "ZAPBIP_HERMES_PLUGIN_VERSION is not exported"; tester.md (626f8d7d) red-first types+shape PASS in a temp worktree
- [x] Confirmed it fails for the right reason: the missing export, not a broken test — evidence: tester.md (626f8d7d): red text "hermesWheelFilename is not implemented" and the missing export, not a broken test

## Unit

- [x] `libs/types/src/hermes-wheel.test.ts::filename` — input: version `0.1.0`; expected: `zapbip_platform-0.1.0-py3-none-any.whl` — evidence: green b91e944f; tester.md (626f8d7d): types 2/2 PASS
- [x] `hermes-wheel.test.ts::path` — input: version `0.1.0`; expected: `/pkg/zapbip_platform-0.1.0-py3-none-any.whl` — evidence: green b91e944f; tester.md (626f8d7d): types 2/2 PASS
- [x] `libs/core/.../chat-clients.test.ts::hermes command` — input: the Hermes client; expected: the text contains `pip install "zapbip-platform @ https://mcp.zapbip.com/pkg/zapbip_platform-0.1.0-py3-none-any.whl#sha256=<constant>"` and does not contain `zapbip-platform==` — evidence: green 47b270cf, command changed in 9751aa62, 58152955 and a109a876 (portable Python hash check, --only-binary, mktemp); tester-final.md (a109a876): exact command PASS, snapshots and F4 test red on mutations
- [x] `deploy-preflight.test.ts::hosted hash equal` — input: the shell returns bytes whose sha256 equals the constant; expected: no refusal at step `HermesWheel` — evidence: green c3f9c9b4; tester.md (626f8d7d): preflight rows PASS
- [x] `deploy-preflight.test.ts::hosted hash differs` — input: other bytes; expected: refusal naming the expected and the actual hash — evidence: green c3f9c9b4; tester.md (626f8d7d): PASS, mutation "drop worker hash check" caught
- [x] `deploy-preflight.test.ts::object missing` — input: `r2 object get` fails with not found; expected: refusal that names the upload step — evidence: green c3f9c9b4; tester.md (626f8d7d): PASS
- [x] `deploy-preflight.test.ts::docs preflight over HTTPS` — input: the fetcher answers 404, then 200 with other bytes, then 200 with the right bytes; expected: refusal, refusal, pass — evidence: green c3f9c9b4, requirements cases ed7d3afc; tester.md (626f8d7d): PASS, mutation "drop docs hash check" caught
- [x] `deploy-preflight.test.ts::no publisher variable` — input: the environment without `ZAPBIP_PYPI_PUBLISHER`; expected: no refusal about it; `env-example.test.ts` no longer lists it — evidence: green c3f9c9b4; tester.md (626f8d7d): PASS
- [x] Edge: a non-production environment — input: staging; expected: the Worker step is skipped like the other production-only steps — evidence: green c3f9c9b4; tester.md (626f8d7d): staging skip PASS

## Shape

- [x] `hermes-wheel.test.ts::the hash` — input: sha256 of `apps/hermes-plugin/release/zapbip_platform-<version>-py3-none-any.whl`; expected: equals the constant — evidence: green b91e944f; tester.md (626f8d7d): mutation "constant last digit" caught
- [x] `hermes-wheel.test.ts::the contents` — input: the wheel's files under `zapbip_platform/` unzipped; expected: byte-equal to `apps/hermes-plugin/zapbip_platform/` (so source drift fails the gate until the wheel is rebuilt and the version bumped) — evidence: green b91e944f; tester.md (626f8d7d): mutation "source drift adapter.py" caught
- [x] `hermes-wheel.test.ts::the version` — input: `pyproject.toml`, the wheel's `METADATA`, the constant; expected: all the same version — evidence: green b91e944f; tester.md (626f8d7d): shape 634/634 PASS
- [x] `hermes-wheel.test.ts::one wheel per version` — input: the `release/` directory; expected: exactly the wheel of the current version plus none that the constant does not name; older versions stay listed in the runbook, not here — evidence: green ab99b7b1: the release folder holds the wheel and the requirements file of the current version; tester-delta.md (e469559d): shape 638 PASS
- [x] `docs-agent-install.test.ts::hermes page` — input: both Hermes pages; expected: each contains the rendered command and neither contains `zapbip-platform==` — evidence: green 47b270cf, command changed in 9751aa62 and a109a876; tester-final.md (a109a876): en and pt-br identical to the constant PASS, mutation drop --only-binary caught
- [x] `hermes-wheel.test.ts::no leftover` — input: a repository grep; expected: no `ZAPBIP_PYPI_VERSION`, `ZAPBIP_PYPI_PUBLISHER` or `pypi.org` outside `docs/adr`, `docs/learnings` and `docs/features` — evidence: green 5a0212ef; tester.md (626f8d7d): docs consistency PASS, no leftover outside the records

## Integration

- [x] `apps/api/test/integration/package-route.test.ts::serves the wheel` — input: object seeded in `PACKAGES`; `GET /pkg/zapbip_platform-0.1.0-py3-none-any.whl`; expected: 200, identical bytes, `Cache-Control: public, max-age=31536000, immutable`, `Content-Type: application/octet-stream`, an `ETag` — evidence: green 90252d57; tester.md (626f8d7d): integration 16/16 and live route PASS
- [x] `::missing object` — input: valid name, nothing stored; expected: 404 `{"error":"not_found"}` with `Cache-Control: no-store` — evidence: green 90252d57; tester.md (626f8d7d): live route PASS (404 no-store)
- [x] `::malformed names` — input: `/pkg/evil.whl`, `/pkg/zapbip_platform-1.0.whl`, `/pkg/..%2Fsecret`, `/pkg/zapbip_platform-0.1.0-py3-none-any.whl/extra`; expected: 404 each and zero reads of the bucket — evidence: green 90252d57; tester.md (626f8d7d): PASS, mutation "widen pattern" caught; allowlist 165664e9, a0ec5b78; tester-final.md (a109a876): near-miss names PASS
- [x] `::head` — input: HEAD to a valid name with the object stored; expected: 200, the immutable cache header, an empty body — evidence: green a37d322f (pin); tester-delta.md (e469559d): integration 24/24 PASS (HEAD 200, empty body)
- [x] `::encoded and newline names` — input: `/pkg/%2e%2e/secret`, `/pkg/..%2fsecret`, `/pkg/<valid name>%0A`; expected: 404 with `Cache-Control: no-store` for each and zero bucket reads — evidence: a37d322f (pin); tester-delta.md (e469559d) and tester-final.md (a109a876): PASS. %2e%2e falls through to the global 404 without no-store, by design (spec note)
- [x] `::R2 failure is logged` — input: the bucket throws; expected: one `package_unavailable` log line with no error message, filename or body — evidence: red a37d322f, green 2b667db1; tester-delta.md (e469559d): logs exactly {"event":"package_unavailable"} PASS
- [x] `::other methods` — input: POST, PUT, DELETE, PATCH to a valid name; expected: 404 and the bucket unchanged — evidence: green 90252d57; tester.md (626f8d7d): POST/PUT/DELETE/PATCH 404 no-store PASS
- [x] `::the media bucket is not reachable` — input: a media object whose key equals a valid wheel name stored in `MEDIA`; expected: 404 — evidence: green 90252d57; tester.md (626f8d7d): mutation PACKAGES->MEDIA caught by 3 integration tests
- [x] `::R2 failure` — input: the bucket binding throws; expected: 503 and no immutable cache header — evidence: green 2b667db1; tester-delta.md (e469559d): PASS (503, no immutable header)

## E2E

- [x] `apps/api/test/e2e/hermes-wheel.e2e.test.ts::pip installs the pinned direct reference` — steps: local Worker with the committed wheel seeded, `python3 -m pip install --no-deps --target <dir> "zapbip-platform @ <local origin>/pkg/<file>#sha256=<constant>"`; expected: exit 0 and `zapbip_platform/__init__.py` exists in the target — evidence: green 222db1cf; tester.md (626f8d7d): e2e 3/3 PASS; later e2e 6/6 in tester-delta.md (e469559d) and the verify at a109a876
- [x] `::a wrong hash is refused` — steps: the same with the last hex digit changed; expected: non-zero exit, output contains `do not match the hashes` — evidence: green 222db1cf; tester.md (626f8d7d): PASS ("do not match the hashes")
- [x] `::a missing wheel` — steps: the same with the object absent; expected: non-zero exit, output contains `404` — evidence: green 222db1cf; tester.md (626f8d7d): PASS (404)
- [x] `hermes-openclaw.e2e.test.ts` — expected: unchanged and green, the Hermes image installs the committed wheel by the pinned form — evidence: green 222db1cf; tester-delta.md (e469559d): pnpm test:e2e:clients 24/24 in 576s, Docker quit afterwards

## Requirements file

- [x] `hermes-wheel.test.ts::every requirement is pinned` — input: the committed requirements file; expected: each block is `name==version` (optional marker) with at least one 64-hex `--hash`, the first being our wheel URL with the wheel hash — evidence: red c68fec8e, green ab99b7b1 and d764606e; tester-delta.md (e469559d): shape 638 PASS
- [x] `hermes-wheel.test.ts::lists the package and exactly the resolved runtime dependencies` — input: the file and `requirements.txt`; expected: the names equal the lock plus `zapbip-platform`, and every `pyproject.toml` dependency is present — evidence: red c68fec8e, green ab99b7b1; tester-delta.md (e469559d): PASS
- [x] `hermes-wheel.test.ts::the wheel metadata and entry points match the project` — input: `Requires-Dist` and `entry_points.txt` in the wheel; expected: equal to `pyproject.toml` — evidence: pin c68fec8e (green on landing); tester-delta.md (e469559d): PASS
- [x] `package-route.test.ts::serves the requirements file` — input: the object in `PACKAGES`; expected: 200, `text/plain; charset=utf-8`, immutable cache; `-requirements.txt.bak`, `-extra.txt` and `-requirements.whl` answer 404 — evidence: red 6299f028, green 165664e9, allowlist a0ec5b78; tester-delta.md (e469559d): integration PASS
- [x] `hermes-wheel.e2e.test.ts::the printed install command` — input: the command with the local origin; expected: exit 0 with the plugin and httpx installed, the exact constant run with only the origin, the hash and `--target` substituted, and no `sha256sum`, `shasum` or `pip` shim needed; a changed requirements hash makes the Python check exit non-zero and installs nothing; a zeroed httpx hash fails with `DO NOT MATCH THE HASHES` — evidence: red 7955e96f, green 88ec7cd3; portable command red afcdb4df, green a109a876; tester-final.md (a109a876): exact command with no sha256sum on PATH PASS, flipped byte exit 1, zeroed httpx hashes refused, mutations caught
- [x] `deploy-preflight.test.ts` requirements cases — input: other bytes, a missing object, a 404 and a wrong hash for `zapbip_platform-0.1.0-requirements.txt`; expected: refusals at `HermesWheel` naming the file — evidence: red f8c2ac62, green ed7d3afc; tester-delta.md (e469559d): PASS

## Prove it for real

- [x] Docs walk with Playwright MCP, en: open the Hermes page; expected: the install block shows the exact rendered command, the copy button copies it, a 12-line terminal-width view does not truncate the hash (it wraps or scrolls inside the block), console and network clean — evidence: tester-delta.md (e469559d) and tester-final.md (a109a876): Playwright docs walk en, command identical to the constant, copy button clipboard equals the shown text, no console errors, network 2xx, 1200x300 and 375 widths without page overflow
- [x] Docs walk, pt-br: the same text in the same command block — evidence: tester-delta.md (e469559d) and tester-final.md (a109a876): pt-br PASS, same command
- [x] Fresh venv: copy the command from the page and run it against the local Worker origin; expected: installs, then `pip show zapbip-platform` prints the constant version — evidence: tester-delta.md (e469559d): fresh venv manual install PASS (pip show 0.1.0); tester-final.md (a109a876): exact command, PATH without sha256sum, PASS
- [x] Console and network clean: zero console errors and zero failed requests — evidence: tester-delta.md (e469559d): zero console errors, network 2xx
- [x] Narrow width: the code block scrolls horizontally inside its container; the page itself does not — evidence: tester-delta.md (e469559d): the code block scrolls inside its container (scrollWidth 2466), the page does not (screenshots hermes-delta-en-375.png, hermes-delta-ptbr-375.png)
- [ ] Screenshots and a short video staged for the PR — open, owned by /open-pr (the recorder role); the testers' 375 px screenshots are cited in the narrow-width row

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case and a regression test for each.

## Adversarial review

- [x] Claim 1: pip refuses a swapped object — attack: store a modified wheel under the same key and install the printed command; result: refuted | held — evidence: tester.md (626f8d7d) and tester-final.md (a109a876): held. A wrong hash and a flipped byte are refused (e2e, tester-final 2); pip refuses a zeroed dependency hash
- [x] Claim 2: the Worker cannot be made to serve anything but the wheel — attack: encoded dots, slashes, double encoding, uppercase names, trailing dot, query strings on `/pkg`; result: refuted | held — evidence: tester.md (626f8d7d) and tester-final.md (a109a876): held. Uppercase, trailing dot, extra segment, %0A, %20, double encoding, other versions and extensions answer 404; %2d decodes to "-" and serves the same wheel; the allowlist mutation was caught
- [x] Claim 3: the shape test catches a stale wheel — attack: edit one line in `zapbip_platform/adapter.py` without a rebuild, then bump the version without a rebuild; result: refuted | held — evidence: tester.md (626f8d7d): held. Mutation "source drift adapter.py" caught by "the wheel carries exactly the plugin source"

## Coverage honesty

- The real production upload (`wrangler r2 object put` against `zapbip-packages`) runs at deploy time (agent-run, authorized 2026-11-07), not in the gate; the gate exercises the runbook step through the preflight's fake shell and the local Worker, and the staging deploy is checked by a real `pip install` from mcp-staging.zapbip.com.
- A pip behaviour change in how direct references with a hash fragment are verified is not tested for newer pip versions than the one in the e2e image; pip has supported `#sha256=` on direct URLs since version 20.
- Wheel byte-reproducibility across machines is deliberately not tested; the committed file is the source of truth (ADR 0034).
