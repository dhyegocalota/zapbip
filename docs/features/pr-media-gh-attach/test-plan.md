# Test plan: PR media through the GitHub CLI

## Unit

- [x] The script prints only the lines GitHub added and sends every file in one edit against `dhyegocalota/zapbip` — evidence: `scripts/pr-media.test.sh` all checks passed
- [x] A body GitHub did not change, no files, a non-numeric pull request and a missing file exit 1; the last three never reach `gh` — evidence: same file
- [x] The doctor reports `gh` 2.71.0 as missing with `brew upgrade gh`, and 2.99.0 and 2.100.0 as ok — evidence: `.agents/hooks/hooks.test.sh` all checks passed

## Manual

- [ ] A real `gh pr edit <n> --attach <png>` with `gh` 2.104.0 against this repository — BLOCKED: the machine has `gh` 2.71.0; run it after `brew upgrade gh`
