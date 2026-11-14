# 0054. Pull request media is attached to the pull request through GitHub's own upload

- Status: Superseded by [0059](0059-pull-request-media-is-attached-with-the-github-cli.md)
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's words of 2026-11-14 ("images and videos must not go there any more, but embedded straight in the PR"); the oss-polish feature, which moved media from Releases to the private repository `zapbip-pr-media`

## Context

Screenshots and walkthrough videos went first to GitHub pre-releases and then to a private media repository, one folder per slug. Both put product evidence in a second place that outlives the pull request, needs its own access and cleanup, and shows up in the repository's releases, deployments or commit history. GitHub already hosts files dropped into a pull request under `https://github.com/user-attachments/`, with the access of the repository they were added to, but it has no API for that upload: only a signed-in browser can do it.

## Decision

`scripts/pr-media.sh <pull request> <files>` opens the pull request in the owner's signed-in browser (Dia) and, through Orca computer use, adds each file to the comment box with GitHub's own upload, prints the Markdown GitHub writes, and empties the box again; it never posts a comment and closes the tab it opened. The recorder patches those lines into the body. No media is pushed to a repository, a release or a deployment, and the media repository takes no new files.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep the private media repository | Works headless, already built | A second store to keep, link rot when it is cleaned, media outside the pull request | The owner asked for the media in the pull request itself |
| GitHub Releases | Works with `gh` | Releases are for published packages; media pre-releases crowd the release list | Rejected before, by oss-polish |
| A headless browser with a stored GitHub session | No visible window | Keeping a GitHub session for an agent is a credential agents must never hold | Agents never sign in |

## Consequences

Attaching media needs the owner's machine with Dia signed in to GitHub and Orca running; an agent elsewhere leaves the files in `.pr-media/<slug>/` and says so. Files are limited to 10 MB each, so walkthroughs are kept short or scaled. Older pull requests keep their links to the media repository, which stays read-only.

## Evidence

A probe image and a probe video attached to pull request #73 printed `user-attachments` links, and the pull request kept its single bot comment. `scripts/pr-media.test.sh` drives the script with a fake Orca.

## Revisit when

GitHub ships an API for attachments, or the owner moves work to a machine without a signed-in browser.
