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
| `a reference-style link to a file is reported` and the six sibling probes in `b5a42bb1` | the earlier helper saw none of them: `expected [] to deeply equal [ '../docs/agents/hermes.mdx' ]` | `57ed75d5` widens the patterns |
| `a folder whose name contains a dot is not reported`, `a protocol-relative URL is not reported` in `b5a42bb1` | the helper flagged any extension, and `//host/a.html`: `expected [ '../core.v2/' ] to deeply equal []` | `57ed75d5` treats a trailing slash as a folder and `//` as external |
| `an inline code element with an attribute`, `a preformatted element`, `an anchor to a file with single quotes`, `an autolink to a file` in `a36f8a4e` | `<code class="x">`, `<pre>`, a single-quoted `href` and `<../docs/a.md>` were not read | `1160ead6` widens the code, `pre`, anchor and autolink patterns |
| eleven probes in `444f7b21`: `a preformatted element` (own enum member), an anchor with spaces around the equals sign, an unquoted anchor target, a single-quoted and a parenthesised link title, spaces inside the parentheses, an unclosed tilde fence, a five-space indented block, `a mailbox in angle brackets is not reported`, `a footnote definition is not reported`, and the broken-link check with a single-quoted title | the earlier patterns read none of them: `expected [ 'fenced block' ] to deeply equal [ 'preformatted block' ]`, `expected [] to deeply equal [ '../docs/agents/hermes.mdx' ]`, `expected [] to deeply equal [ 'fenced block' ]` | `19029bb7` widens the link, anchor, fence and indented-block patterns, skips targets with `@`, and ignores footnote definitions |

Pins, green on arrival: the four probes of `704f53db` (code span, fenced block, file link, folder link) were pins, since `704f53db` landed the implemented helper and no stub ever existed; `a fixture README under a package is not a workspace package` in `b5a42bb1` is a pin.

The failure texts above are the ones the runs printed.

## Hypotheses for the tester

- Every sentence in each changed README is true against the code it describes.
- The purpose-only test goes red when a code span, a fenced or indented block, an HTML anchor or a reference link to a file is planted in a workspace package README.
- The link check still reports a broken target when the link has a single-quoted or parenthesised title.
- The `AGENTS.md` Layout lines match the two plugin folders.

## Known gaps

- A file without an extension and a path written as bare prose are not detected, by design (spec Goals).
- A folder link without a trailing slash and with a dot in its name is read as a file.
- A double-backtick code span is counted as two code spans; the report is wrong in number, still red.
- A four-space lazy-continuation line of a paragraph is reported as an indented block.
- HTML elements other than `code`, `pre` and `a` are not read.
- The READMEs are stacked on `feat/agent-registry` (merged here at cf2503cd); Step 13 of the plan re-reads three of them when the stack merges.
