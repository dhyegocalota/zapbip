# A heartbeat or promptness test passes alone and fails once in a full run on a busy machine

- Date: 2026-11-07
- Inspired by: the Hermes plugin pytest step failing once in `pnpm verify all` and passing alone (137 tests) and on the next run
- Revisited: 2026-11-07 — still true

## Signal
`apps/hermes-plugin` pytest fails once in a full gate, with a reconnect where the test expected one connection or a timing assertion over a bound, and passes on the next run and alone. 28 runs, 18 under CPU hogs, never reproduced it.

## Cause
Two asyncio tests asserted on wall-clock windows measured in tens of milliseconds: a heartbeat timeout of 200 ms that any loop stall longer than that turned into a reconnect, and a stop that had to finish inside 100 ms. A busy machine stalls a process for longer than that, so the assertion measured the machine.

## Do
Give a guard a bound that is far below the thing it protects against and far above any stall: a 30 s backoff is guarded with a 2 s wait, a 2 s heartbeat timeout with four pings. Make the test count events instead of reading the clock, and prove it still bites with a mutation (a plain sleep, a pong-only reset). Run the suite under `yes` hogs started and stopped by their own PIDs.

## Anchor
`apps/hermes-plugin/tests/unit/test_connector_socket.py` (`test_any_frame_is_proof_of_life`, `test_stop_during_backoff_returns_promptly`), `docs/features/hermes-plugin-flake/`
