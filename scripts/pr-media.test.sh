#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
failures=0

scratch=$(mktemp -d)
remote="$scratch/remote.git"
media_directory="$scratch/media"
export PR_MEDIA_REMOTE="$remote"
export XDG_CACHE_HOME="$scratch/cache"
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
published_prefix="https://github.com/dhyegocalota/zapbip-pr-media/blob/main"

expect_equal() {
  local name=$1 actual=$2 expected=$3
  [[ "$actual" == "$expected" ]] && return
  echo "FAIL $name: expected '$expected', got '$actual'"
  failures=$((failures + 1))
}

in_remote() { git -C "$remote" "$@"; }

git init -q --bare -b main "$remote"
mkdir -p "$media_directory"
printf 'png' > "$media_directory/01-home.png"
printf 'mp4' > "$media_directory/walkthrough.mp4"
printf 'second' > "$media_directory/02-other.png"

output=$("$here/pr-media.sh" demo "$media_directory/01-home.png" "$media_directory/walkthrough.mp4" 2>/dev/null)
expect_equal "an image prints an embed line" "$(sed -n 1p <<< "$output")" "![01-home.png]($published_prefix/demo/01-home.png?raw=true)"
expect_equal "a video prints a link line" "$(sed -n 2p <<< "$output")" "[walkthrough.mp4]($published_prefix/demo/walkthrough.mp4?raw=true)"
expect_equal "the files land in the slug folder of the remote" "$(in_remote ls-tree --name-only main demo/ | tr '\n' ' ')" "demo/01-home.png demo/walkthrough.mp4 "
expect_equal "one commit names the slug" "$(in_remote log --format=%s main)" "chore(demo): PR media"

"$here/pr-media.sh" demo "$media_directory/01-home.png" >/dev/null 2>&1
expect_equal "the same files again make no new commit" "$(in_remote rev-list --count main)" "1"

"$here/pr-media.sh" other "$media_directory/02-other.png" >/dev/null 2>&1
expect_equal "another slug adds a second commit and folder" "$(in_remote rev-list --count main):$(in_remote ls-tree --name-only main | tr '\n' ' ')" "2:demo other "

"$here/pr-media.sh" demo >/dev/null 2>&1
expect_equal "no files exits non-zero" "$?" "1"

"$here/pr-media.sh" demo "$scratch/missing.png" >/dev/null 2>&1
expect_equal "a missing file exits non-zero" "$?" "1"
expect_equal "a missing file changes nothing" "$(in_remote rev-list --count main)" "2"

"$here/pr-media.sh" >/dev/null 2>&1
expect_equal "no arguments exits non-zero" "$?" "1"

rm -rf "$scratch"

[[ "$failures" == 0 ]] && echo "pr-media: all checks passed" && exit 0
echo "pr-media: $failures check(s) failed"
exit 1
