# Test plan: Verify secrets scan HEAD

## The failing test first

- [x] `scripts/verify.test.sh` — input: a secret committed only on another branch, verify on the current branch; expected: exit 0, red before the fix with `expected '0', got '1'` — evidence: 5996b153 red, 6e0d3ef6 green

## Unit

- [x] A secret in the history of `HEAD` — input: the secret committed on the current branch; expected: exit 1 and `verify: secrets failed` (pin) — evidence: 5996b153 green on arrival

## Tester run (2026-11-07, 381b6ea9)

- [x] Red-first re-run: 5996b153 in a throwaway worktree prints `FAIL a secret only on another branch exits 0: expected '0', got '1'` and `output matched /secrets failed/`, exit 1 — evidence: worktree removed
- [x] Green: `bash scripts/verify.test.sh` at 381b6ea9 exits 0, `verify: all checks passed` — evidence: pnpm test:verify
- [x] Mutation: removing ` --log-opts=HEAD` from scripts/verify.sh turns both other-branch rows red, exit 1; restored with `git checkout -- scripts/verify.sh` — evidence: tree clean after
- [x] Real binary, gitleaks 8.30.1: the gate's command (`gitleaks git --no-banner --redact --exit-code 1 --log-opts=HEAD`) exits 0 with a token only on a side branch, exits 1 (`leaks found: 1`) once merged into main — evidence: throwaway repo, removed

## Coverage honesty

- The stub emulates gitleaks' revision handling; the real flag was run once by hand with `gitleaks git --log-opts=HEAD`.
