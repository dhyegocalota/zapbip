# PR media through the GitHub CLI

**Status:** Shipped 2026-11-14
**Tier:** 🟢 small
**Owner approval:** the owner asked on 2026-11-14 to adjust the harness so pull request media is attached the way `gh pr edit --attach` does
**ADRs:** [0059](../../adr/0059-pull-request-media-is-attached-with-the-github-cli.md), which supersedes [0054](../../adr/0054-pull-request-media-is-attached-to-the-pull-request-through-githubs-own-upload.md)
**Not changing:** the recorder's capture and conversion steps, where media lives while recording (`.pr-media/`), the body layout

## Problem

`scripts/pr-media.sh` drove the owner's signed-in browser through Orca to upload media, because GitHub had no upload API. GitHub CLI 2.99.0 added `--attach`, which stores the file in `user-attachments` with the token `gh` already holds.

## Goals

- `scripts/pr-media.sh <pull request> <files>` runs one `gh pr edit --attach` and prints the lines GitHub added to the body, with the same contract as before.
- `doctor.sh` requires `gh` 2.99.0 or newer and says `brew upgrade gh` when it is older.

## Non-goals

- Changing the recorder's contract or where the Markdown goes in the body.

## Design

### Data flow

The script reads the body, runs one `gh pr edit <n> --repo <repository> --attach <file>...`, reads the body again and prints the lines that are new; it fails when none contains `user-attachments`.

### Failure handling

| Failure | Outcome |
|---|---|
| No files, a pull request that is not a number, a missing file | exit 1 before `gh` is called |
| `gh` older than 2.99.0 | the doctor reports `gh` as missing with `brew upgrade gh`; `gh pr edit` would refuse `--attach` |
| GitHub adds nothing | exit 1, "GitHub did not attach the files" |

## Open questions → answers

None.

## Test strategy summary

`scripts/pr-media.test.sh` drives the script with a fake `gh`; `hooks.test.sh` covers the doctor for 2.71.0, 2.99.0 and 2.100.0; `pr-media-flow.test.ts` still pins the flow files.
