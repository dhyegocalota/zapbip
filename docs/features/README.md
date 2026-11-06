# Features

One folder per feature or fix: `docs/features/<slug>/`. Slugs are kebab-case, without dates.

## Required files

`spec.md`, `plan.md` and `test-plan.md` are required together. Never one without the others. `tester-briefing.md` is written by the developer when the build ends.

## Start a new one

Use the `feature` skill, or copy [`_template/`](_template/) to `docs/features/<slug>/` by hand.

## Rules

- A fix gets the same folder. Its spec may be ten lines; it still exists.
- Folders stay after shipping. They are the history of why the code is the way it is.
- The header of `spec.md` carries the status line: `**Status:** Draft | In review | Approved | Building | Shipped YYYY-MM-DD`. The folder's row below carries the same status, plus the PR link once shipped; `tools/repository-shape/src/feature-status.test.ts` fails when they disagree, when a folder has no row, or when a merged pull request from a branch named after a folder (`<type>/<slug>`, whatever the type) left its spec unshipped ([HARNESS §7 → Status](../../.claude/HARNESS.md#7-ship)).
- Order of approval: spec approved by the owner, then plan, then test plan, then code.
- Process details: [`.claude/HARNESS.md`](../../.claude/HARNESS.md).

## Index

One row per folder, in the order the features ship; a row that turns `Shipped <date>` moves below the last row shipped on or before that date.

| Feature | Delivers | Status |
|---------|----------|--------|
| [`agent-inbox-core`](agent-inbox-core/) | The core, the durable inbox per account, the MCP contract, the 24-hour window, routing and media, with a WhatsApp test double for development | In review |
