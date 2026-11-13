# Open-source polish

**Status:** Shipped 2026-11-13
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-13 (owner delegated)
**ADRs:** none
**Not changing:** product code under `apps/*/src` and `libs/*/src`

## Problem

The repository reads as a private project: the README has no hero, badges, quick start or community sections; `.github/` has no code owners or dependency updates; pull request media is uploaded to GitHub Releases as `pr-media-<slug>` pre-releases, which pollutes the Releases page of a project whose packages are now published for real; no document says how a published package is released.

## Goals

- PR media lives in the private repository `dhyegocalota/zapbip-pr-media`, one folder per slug, uploaded by `scripts/pr-media.sh`. No harness file uploads to Releases.
- `docs/runbooks/release.md` says how the connector, the channel plugins and the Python wheel are released, and every published package has a `CHANGELOG.md` in Keep a Changelog format.
- The README, `.github/` and root follow the conventions of successful open-source monorepos.

## Non-goals

- Product code, the docs site content and the hosted deploy.
- A public Discussions board (disabled on the repository today).

## Design

### Data flow

`scripts/pr-media.sh <slug> <file>...` pulls a cached clone of the media repository, copies the files into `<slug>/`, commits `chore(<slug>): PR media`, pushes and prints one Markdown line per file: an image as `![name](...?raw=true)`, a video as a link. The recorder pastes those lines into the PR body.

A shape test reads the harness files (roles, skills, `HARNESS.md`, the pull request template) and fails on `gh release upload` or a `pr-media-` release name. Another reads the README for the open-source essentials and the release runbook for its steps.

### Failure handling

The script exits non-zero with a one-line reason when the slug or the files are missing, a file does not exist, or the clone or the push fails. A rerun for the same slug overwrites the files and commits only when something changed.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| One changelog or one per package | root file, per package | per package: each package has its own version and tag, as in the monorepos studied (owner delegated) | 2026-11-13 |
