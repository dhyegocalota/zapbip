# Test plan: Verify secrets scan HEAD

## The failing test first

- [x] `scripts/verify.test.sh` — input: a secret committed only on another branch, verify on the current branch; expected: exit 0, red before the fix with `expected '0', got '1'` — evidence: 5996b153 red, 6e0d3ef6 green — evidence: 5996b153 red, 6e0d3ef6 green

## Unit

- [x] A secret in the history of `HEAD` — input: the secret committed on the current branch; expected: exit 1 and `verify: secrets failed` (pin) — evidence: 5996b153 green on arrival — evidence: 5996b153 green on arrival

## Coverage honesty

- The stub emulates gitleaks' revision handling; the real flag was run once by hand with `gitleaks git --log-opts=HEAD`.
