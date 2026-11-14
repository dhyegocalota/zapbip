#!/usr/bin/env bash
set -euo pipefail

repository="dhyegocalota/zapbip"

fail() {
  echo "pr-media: $1" >&2
  exit 1
}

body_of() { gh pr view "$1" --repo "$repository" --json body --jq .body; }

[[ $# -ge 2 ]] || fail "usage: pr-media.sh <pull-request-number> <file>..."
pull_request=$1
shift
[[ "$pull_request" =~ ^[1-9][0-9]*$ ]] || fail "the pull request number must be a positive integer: $pull_request"
attach_flags=()
for file in "$@"; do
  [[ -f "$file" ]] || fail "no such file: $file"
  attach_flags+=(--attach "$file")
done

body_before=$(body_of "$pull_request")
gh pr edit "$pull_request" --repo "$repository" "${attach_flags[@]}" >/dev/null
body_after=$(body_of "$pull_request")
attached=$(grep -vxF -f <(printf '%s\n' "$body_before") <<<"$body_after" || true)
[[ "$attached" == *user-attachments* ]] || fail "GitHub did not attach the files"
echo "$attached"
