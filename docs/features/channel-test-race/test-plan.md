# Test plan: Channel test race

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/connector/test/integration/channel.test.ts::relays an owner message even when the channel stream is read late, as on a loaded machine` — input: the notifications and the error stream are recorded 300 ms late; expected before the fix: `expected [] to deeply equal [ { …(2) } ]`; after: the notification is relayed.

## Unit

- [ ] The five channel tests that read a notification or the error stream — expected: green, each after waiting on what it reads.
- [ ] Audit — `grep` of `apps/connector/test` for reads of child output or channel streams that follow a frame wait: expected: none left outside `channel.test.ts` and `listen.test.ts`, both fixed.

## Coverage honesty

- A saturated CPU is not simulated; the late-read variant is the deterministic stand-in.
