#!/usr/bin/env bash
set -euo pipefail

gitleaks_binary="${1:?usage: secret-rules-probe.sh <gitleaks binary>}"
repository_root="$(cd "$(dirname "$0")/../.." && pwd)"
probe_directory="$(mktemp -d)"
github_lookalike_suffix="zuuqcRO1Je0lCr4ktYmgNBLoGoPVGhPIaT35"
placeholder_lookalike_suffix="0hzOkrDZV4A8rpRu7Dl4AYIdZdf9JlKY"
operator_key_identifier="0123456789abcdef"
operator_key_secret="$(printf 'k%.0s' {1..43})"
trap 'rm -rf "$probe_directory"' EXIT

scan() {
  "$gitleaks_binary" dir --no-banner --redact --exit-code 1 -c "$repository_root/.gitleaks.toml" "$probe_directory" >/dev/null 2>&1
}

printf 'token = "ghp_%s"\n' "$github_lookalike_suffix" > "$probe_directory/near-miss.txt"
if scan; then
  echo "secret rules: a fresh token was NOT reported" >&2
  exit 1
fi

printf 'authorization = "Bearer zbo_%s_%s"\n' "$operator_key_identifier" "$operator_key_secret" > "$probe_directory/near-miss.txt"
if scan; then
  echo "secret rules: a fresh operator key was NOT reported" >&2
  exit 1
fi

printf 'API_KEY_PEPPER=zapbip-test-secret-%s\n' "$placeholder_lookalike_suffix" > "$probe_directory/near-miss.txt"
if scan; then
  echo "secret rules: a random secret borrowing a placeholder prefix was NOT reported; the allowlist must hold exact strings only" >&2
  exit 1
fi

rm "$probe_directory/near-miss.txt"
printf 'API_KEY_PEPPER=zapbip-test-secret-with-at-least-32-characters\n' > "$probe_directory/placeholder.txt"
if ! scan; then
  echo "secret rules: a shipped placeholder was reported, or gitleaks failed" >&2
  exit 1
fi
echo "secret rules: near misses reported, shipped placeholder silent"
