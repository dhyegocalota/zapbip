# 0059. Pull request media is attached with the GitHub CLI

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [ADR 0054](0054-pull-request-media-is-attached-to-the-pull-request-through-githubs-own-upload.md), whose revisit condition came true; GitHub CLI 2.99.0, which added `--attach` to `gh pr create`, `gh pr edit` and `gh pr comment`

## Context

ADR 0054 attached media by driving the owner's signed-in browser through Orca, because GitHub had no upload API. GitHub CLI 2.99.0 uploads images and videos to the same `user-attachments` storage with `gh pr edit <number> --attach <file>#<alt text>`, using the token `gh` already holds. The browser flow needs a signed-in Dia, Orca and a visible window; the CLI needs none of them.

## Decision

`scripts/pr-media.sh <pull request> <files>` runs one `gh pr edit --attach` for all the files and prints the lines GitHub added to the body. The contract the recorder and `/check-ui` rely on does not change; the browser driver is gone. `doctor.sh` requires a `gh` of 2.99.0 or newer. ADR 0054 is superseded.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep the browser driver | Needs no new `gh` | Visible window, a signed-in browser, Orca running, slow and fragile | `gh` does the same upload headless |
| `gh pr comment --attach` | Leaves the body alone | Media lands in a comment, not the body | The body is where the visual explainer lives |
| Releases or a media repository | Work headless | A second store outside the pull request | Rejected by ADR 0054 |

## Consequences

Any machine with an authenticated `gh` of 2.99.0 or newer attaches media, including agents running unattended. Files are still limited by GitHub's attachment limit, so walkthroughs stay short or scaled. `gh pr edit` appends the media to the body when it does not already reference the file.

## Evidence

`scripts/pr-media.test.sh` drives the script with a fake `gh`. `gh pr edit --help` of 2.104.0 documents `--attach` and the `file#alt text` form.

## Revisit when

GitHub changes the attachment limits, or `gh` drops `--attach`.
