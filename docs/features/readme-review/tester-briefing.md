# Tester briefing: README review

Written by the developer. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `tools/repository-shape/src/delivery-docs.test.ts`: `purposeViolations`, the `PurposeViolation` enum, the `pathOf` and `proseOf` helpers and the probes.
- READMEs: `README.md`, `.agents/skills/README.md`, `tools/repository-shape/README.md`, `apps/api`, `apps/connector`, `apps/docs`, `apps/hermes-plugin`, `libs/agents`, `libs/core`, `libs/types`.
- `AGENTS.md`: Layout lines for `apps/hermes-plugin` and `apps/openclaw-plugin`.
- Feature documents: `spec.md`, `plan.md`, `test-plan.md`.

Not changed: product code, the `docs/*` index READMEs.

## How to run

```bash
pnpm --filter @zapbip/repository-shape test:unit
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|-------------------------------|---------------------|
| the purpose-only case for `apps/hermes-plugin` | its README ended with a link to `../docs/agents/hermes.mdx` | `0a6e25c7` removed the file pointer |
| `a reference-style link to a file is reported` and the six sibling probes in `b5a42bb1` | the earlier helper saw none of them | `57ed75d5` widens the patterns |
| `a folder whose name contains a dot is not reported`, `a protocol-relative URL is not reported` | the helper flagged any extension, and `//host/a.html` | `57ed75d5` treats a trailing slash as a folder and `//` as external |

Pins, green on arrival: the four probes of `704f53db` (code span, fenced block, file link, folder link) were pins, since `704f53db` landed the implemented helper and no stub ever existed; `a fixture README under a package is not a workspace package` in `b5a42bb1` is a pin.

The red failure text of `b5a42bb1` is the vitest diff of each probe, for example `expected [] to deeply equal [ '../docs/agents/hermes.mdx' ]`; the tester records the exact text from a throwaway worktree at `b5a42bb1`.

## Hypotheses for the tester

- Every sentence in each changed README is true against the code it describes.
- The purpose-only test goes red when a code span, a fenced or indented block, an HTML anchor or reference link to a file is planted in a workspace package README.
- The `AGENTS.md` Layout lines match the two plugin folders.

## Known gaps

- A file without an extension and a path written as bare prose are not detected, by design (spec Goals).
- A folder link without a trailing slash and with a dot in its name is still read as a file.
- A double-backtick code span is counted as two code spans; the report is wrong in number, still red.
- `<code class="x">`, `<pre>`, a single-quoted `<a href>` and an autolink to a file were added after the first review round, each red first in the probe commit that follows `6b5d1072`; any other HTML element is not read.
- The READMEs are stacked on `feat/agent-registry` at 2a5cbdc2; Step 13 of the plan re-reads three of them when the stack merges.
