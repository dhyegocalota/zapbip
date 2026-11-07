# Test plan: Hermes plugin flake

## The failing test first

- [x] `pnpm typecheck` in `apps/hermes-plugin` with the script covering `tests/` — input: strict mypy on `zapbip_platform tests`; expected: 3 errors — evidence: 32bb021, `typescript_constants.py:54`, `typescript_constants.py:56`, `fake_connector.py:74`
- [x] Fixed — input: same command; expected: `Success: no issues found in 30 source files` — evidence: c59548e

## Unit

- [x] `tests/unit/test_connector_socket.py::test_any_frame_is_proof_of_life` — input: ping every 10 ms, timeout 2000 ms, empty `messages` answers, no pongs; expected: 4 pings, one connection — evidence: 3634ff5, 20/20 runs green (10 under 4 `yes` hogs)
- [x] `tests/unit/test_connector_socket.py::test_stop_during_backoff_returns_promptly` — input: stop set during a 30 s backoff; expected: the task ends inside the 2 s exit timeout, one connection — evidence: 6279f3a, 20/20 runs green
- [x] `tests/unit/test_connector_socket.py::test_heartbeat_sends_ping` — input: ping every 50 ms, timeout 5000 ms; expected: 3 pings, one connection — evidence: 6279f3a, 20/20 runs green

## Mutation checks

- [x] Only a pong resets the heartbeat (`frame_received.set()` guarded by a pong match) — expected: `test_any_frame_is_proof_of_life` fails — evidence: failed with the `until` timeout after 5.26 s, restored
- [x] Plain `asyncio.sleep` in `wait_or_stop` — expected: `test_stop_during_backoff_returns_promptly` fails — evidence: failed after 2.33 s, restored

## Adversarial review

- [ ] Claim 1: the margins remove the flake — attack: reviewer reruns under load; result: pending
- [ ] Claim 2: the proof-of-life test still bites — attack: mutation above; result: pending
- [ ] Claim 3: the typecheck covers `tests/` — attack: add a type error to `tests/`; result: pending

## Coverage honesty

- The flake never reproduced in 28 runs (18 under load), so the fix is hardening by analysis, not a confirmed reproduction.
