# Test plan: Open-source polish

## The failing test first

- [x] `scripts/pr-media.test.sh` — input: the script before it exists; expected: red — evidence: 409ba5b4, 10 checks failed, stub text `pr-media.sh is not implemented`
- [x] `tools/repository-shape/src/pr-media-flow.test.ts` and `open-source.test.ts` — input: the tree before the change; expected: red on the harness mentioning Releases, the missing runbook, changelogs and README sections — evidence: 409ba5b4 (3 failed, 1 passed), d97cb6b7 (4 failed, `ENOENT` on the changelogs and `release.md`), 7c86460f (6 failed)

## Unit

- [x] `pr-media.sh` copies, commits and pushes into a local bare repository standing in for GitHub, and prints an image line and a video line — evidence: green in `pnpm --filter @zapbip/repository-shape exec vitest run` (40 files, 805 tests) and `bash scripts/pr-media.test.sh`
- [x] No harness file mentions `gh release upload` or a `pr-media-` release — evidence: green in `pnpm --filter @zapbip/repository-shape exec vitest run` (40 files, 805 tests) and `bash scripts/pr-media.test.sh`
- [x] The README carries the hero, badges, quick start, license section and the contributors and star history images — evidence: green in `pnpm --filter @zapbip/repository-shape exec vitest run` (40 files, 805 tests) and `bash scripts/pr-media.test.sh`
- [x] `release.md` names the version bump, the changelog, the annotated tag and `gh release create`, and no media upload — evidence: green in `pnpm --filter @zapbip/repository-shape exec vitest run` (40 files, 805 tests) and `bash scripts/pr-media.test.sh`
- [x] Every published package has a `CHANGELOG.md` with a `0.1.0` section — evidence: green in `pnpm --filter @zapbip/repository-shape exec vitest run` (40 files, 805 tests) and `bash scripts/pr-media.test.sh`

## Edge cases

- [x] `pr-media.sh` with no files exits non-zero and changes nothing — evidence: green in `pnpm --filter @zapbip/repository-shape exec vitest run` (40 files, 805 tests) and `bash scripts/pr-media.test.sh`
- [x] `pr-media.sh` with a missing file exits non-zero and changes nothing — evidence: green in `pnpm --filter @zapbip/repository-shape exec vitest run` (40 files, 805 tests) and `bash scripts/pr-media.test.sh`
- [x] `pr-media.sh` run twice with the same files makes one commit — evidence: green in `pnpm --filter @zapbip/repository-shape exec vitest run` (40 files, 805 tests) and `bash scripts/pr-media.test.sh`

## Coverage honesty

- The push goes to a local bare repository; the real private repository is not touched by the tests.
