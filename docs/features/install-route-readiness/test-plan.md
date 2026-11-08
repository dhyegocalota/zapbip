# Test plan: Install route readiness

## The failing test first

- [ ] `apps/api/test/unit/worker-facts.test.ts`: input: real `createApp` and the real source root; expected: `{ exportsScheduled: true, mountsInstallRoute: true }` (red today: `mountsInstallRoute` false)

## Unit

- [ ] An app with no `/i/` route gives `mountsInstallRoute: false`
- [ ] An app that mounts `/i/` only for POST gives `mountsInstallRoute: false`

## Coverage honesty

- The deploy itself is not run; `inspectWorker` is.
