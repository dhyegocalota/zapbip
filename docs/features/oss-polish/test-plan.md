# Test plan: Open-source polish

## The failing test first

- [ ] `scripts/pr-media.test.sh` — input: the script before it exists; expected: red
- [ ] `tools/repository-shape/src/open-source-polish.test.ts` — input: the tree before the change; expected: red on the harness mentioning Releases, the missing runbook, changelogs and README sections

## Unit

- [ ] `pr-media.sh` copies, commits and pushes into a local bare repository standing in for GitHub, and prints an image line and a video line
- [ ] No harness file mentions `gh release upload` or a `pr-media-` release
- [ ] The README carries the hero, badges, quick start, license section and the contributors and star history images
- [ ] `release.md` names the version bump, the changelog, the annotated tag and `gh release create`, and no media upload
- [ ] Every published package has a `CHANGELOG.md` with a `0.1.0` section

## Edge cases

- [ ] `pr-media.sh` with no files exits non-zero and changes nothing
- [ ] `pr-media.sh` with a missing file exits non-zero and changes nothing
- [ ] `pr-media.sh` run twice with the same files makes one commit

## Coverage honesty

- The push goes to a local bare repository; the real private repository is not touched by the tests.
