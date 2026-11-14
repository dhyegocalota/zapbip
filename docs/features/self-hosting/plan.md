# Plan: Self-hosting

**Spec:** spec.md
**Tier:** 🟡 medium
**Seam:** the docs site, the container files, the README
**Assumptions (decided, owner can override):**
- Three pages per language; the runbooks are linked, not copied.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `Dockerfile`, `compose.yaml`, `.dockerignore`, `scripts/docker-entrypoint.sh`, `tools/repository-shape/src/self-hosting.test.ts` | `developer` |
| G2 | `apps/docs/**/open-source/`, `apps/docs/docs.json`, `libs/agents/src/docs.ts` | `developer` |
| G3 | `README.md`, `AGENTS.md`, `docs/adr/0061*`, shape tests that name the root entries, the groups and the runbooks | `developer` |

## Sequencing

One lane.

## Steps

### G1

- [x] **Step 1:** the image, the Compose file and the entrypoint — evidence: built, answered `/health`, seeded an owner, kept its secrets across a restart
- [x] **Step 2:** `self-hosting.test.ts` — evidence: shape suite green

### G2

- [x] **Step 3:** the three pages in ten languages and the sixth group — evidence: `docs-experience`, `docs-navigation` and `docs-visual` tests green

### G3

- [x] **Step 4:** README, AGENTS layout, ADR 0061 and the shape tests — evidence: shape suite green

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | The image does not start | `docker compose up` exits, `/health` never answers | fix the Dockerfile; nothing else depends on it |
| 3 | A docs page fails the Mintlify build | the docs gate | revert the group in `docs.json` |
