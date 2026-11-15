# Plan: Connector runtime configured by one zapbip.json file

**Spec:** spec.md
**Tier:** 🟡 medium
**Seam:** `apps/connector/src/cli.ts` reads the config before the link prompt, and `runConnection` passes the resolved launch to `runWake`, which spawns it.
**Assumptions (decided, owner can override):**
- The developer works in one lane: the connector package, the shared constants, the fake runtime support and the docs.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/connector/src/*`, `apps/connector/scripts/*`, `apps/connector/test/*`, `libs/types/src/connector.ts`, `libs/agents/src/connector-support/testing/fake-client.mjs`, `libs/agents/supported/*/testing/*` | lead |
| G2 | `apps/docs/*/developers/local-connector.mdx`, `apps/docs/schemas/connector-config.json` | lead, translations by a sub-agent |
| G3 | `docs/adr/0066-*`, `docs/features/connector-runtime-config/*`, `docs/adr/README.md`, `docs/features/README.md`, `package.json` | lead |

## Sequencing

G1 first: the schema and the launch resolution are what the docs describe. G2 follows once the English section is final. G3 last, with the status flip to `Shipped` on the branch before the merge.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1

- [ ] **Step 1:** constants in `libs/types/src/connector.ts`
- [ ] **Step 2:** `connector-config.ts`: schema, path resolution, reading, launch merge
- [ ] **Step 3:** `wake-runner.ts`, `connect.ts`, `cli.ts`: the launch reaches the spawn, `--config` is parsed
- [ ] **Step 4:** fake runtime support: an alias binary and a probe variable
- [ ] **Step 5:** unit and integration tests
- [ ] **Step 6:** schema generation script and the committed `apps/docs/schemas/connector-config.json`

### G2

- [ ] **Step 7:** `local-connector.mdx` in every docs language

### G3

- [ ] **Step 8:** ADR 0066 and its index row
- [ ] **Step 9:** feature folder, its index row, status `Shipped` on the branch before the merge

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | `runWake` spawns the built-in binary anyway | Integration test: the fake `ccs` record is missing and `claude` runs | Revert `wake-runner.ts`; the defaults path is unchanged |
| 3 | The connection link reaches the child through an entry's environment | Unit or integration assertion on the child environment | Filter applied after merging the environment, as implemented |
| 6 | The committed schema drifts from the validator | `connector-config.test.ts` schema case fails | Run `pnpm connector:schema` |
| 7 | A docs language misses the section | Docs gate (`docs-experience`) or a manual diff of headings | Copy the English section into that language |

Steps with no backout: none. Every step is a file change that `git revert` removes.
