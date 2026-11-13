#!/usr/bin/env bash
set -euo pipefail

media_repository="dhyegocalota/zapbip-pr-media"
media_branch="main"
remote="${PR_MEDIA_REMOTE:-https://github.com/$media_repository.git}"
clone="${XDG_CACHE_HOME:-$HOME/.cache}/zapbip/pr-media"
published_prefix="https://github.com/$media_repository/blob/$media_branch"
image_pattern='\.(png|jpe?g|gif|webp|svg)$'

fail() {
  echo "pr-media: $1" >&2
  exit 1
}

[[ $# -ge 2 ]] || fail "usage: pr-media.sh <slug> <file>..."
slug=$1
shift
[[ "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]] || fail "the slug must be lowercase and dash-separated: $slug"
for file in "$@"; do
  [[ -f "$file" ]] || fail "no such file: $file"
done

in_clone() { git -C "$clone" "$@"; }

[[ -d "$clone/.git" ]] || git clone --quiet "$remote" "$clone" >&2
in_clone fetch --quiet origin >&2
if in_clone rev-parse --verify --quiet "origin/$media_branch" >/dev/null; then
  in_clone checkout --quiet -B "$media_branch" "origin/$media_branch" >&2
else
  in_clone checkout --quiet -B "$media_branch" >&2
fi

mkdir -p "$clone/$slug"
cp "$@" "$clone/$slug/"
in_clone add -- "$slug"
if ! in_clone diff --cached --quiet; then
  in_clone commit --quiet -m "chore($slug): PR media" >&2
  in_clone push --quiet origin "$media_branch" >&2
fi

for file in "$@"; do
  name=$(basename "$file")
  link="$published_prefix/$slug/$name?raw=true"
  if [[ "$name" =~ $image_pattern ]]; then
    echo "![$name]($link)"
  else
    echo "[$name]($link)"
  fi
done
