#!/usr/bin/env bash
set -euo pipefail

repository="dhyegocalota/zapbip"
orca="${PR_MEDIA_ORCA:-/Applications/Orca.app/Contents/Resources/bin/orca}"
browser="${PR_MEDIA_BROWSER:-company.thebrowser.dia}"
attach_button='button Paste, drop, or click to add files'
comment_box='text entry area \(settable\) Markdown value'
file_dialog='sheet open'
attachment_pattern='https://github\.com/user-attachments/'
page_attempts=30
upload_attempts=60
pause_seconds="${PR_MEDIA_PAUSE_SECONDS:-1}"

fail() {
  echo "pr-media: $1" >&2
  exit 1
}

pause() { perl -e "select(undef, undef, undef, $1)"; }

drive() { "$orca" computer "$@" --app "$browser" --no-screenshot --json >/dev/null; }

element_index() {
  "$orca" computer get-app-state --app "$browser" --no-screenshot --json |
    python3 -c 'import json, re, sys; tree = json.load(sys.stdin)["result"]["snapshot"]["treeText"]; match = re.search(r"(\d+) " + sys.argv[1], tree); print(match.group(1) if match else "")' "$1"
}

wait_for_element() {
  local pattern=$1 index=""
  for _ in $(seq "$page_attempts"); do
    index=$(element_index "$pattern")
    [[ -n "$index" ]] && echo "$index" && return
    pause "$pause_seconds"
  done
  fail "the browser never showed: $pattern"
}

comment_box_text() {
  local box
  box=$(wait_for_element "$comment_box") || exit 1
  drive click --element-index "$box"
  drive hotkey --key CmdOrCtrl+A
  drive hotkey --key CmdOrCtrl+C
  pbpaste
}

attach() {
  local file=$1 text="" button
  button=$(wait_for_element "$attach_button") || exit 1
  drive perform-secondary-action --element-index "$button" --action AXScrollToVisible
  button=$(wait_for_element "$attach_button") || exit 1
  drive click --element-index "$button" --restore-window
  wait_for_element "$file_dialog" >/dev/null || exit 1
  drive hotkey --key CmdOrCtrl+Shift+G
  pause "$pause_seconds"
  drive type-text --text "$file"
  drive press-key --key Return
  pause "$pause_seconds"
  drive press-key --key Return
  pbcopy </dev/null
  for _ in $(seq "$upload_attempts"); do
    pause "$pause_seconds"
    text=$(comment_box_text) || exit 1
    [[ "$text" =~ $attachment_pattern ]] && break
  done
  drive press-key --key Delete
  [[ "$text" =~ $attachment_pattern ]] || fail "GitHub did not attach $file"
  echo "$text"
}

[[ $# -ge 2 ]] || fail "usage: pr-media.sh <pull-request-number> <file>..."
pull_request=$1
shift
[[ "$pull_request" =~ ^[1-9][0-9]*$ ]] || fail "the pull request number must be a positive integer: $pull_request"
for file in "$@"; do
  [[ -f "$file" ]] || fail "no such file: $file"
done

open -b "$browser" "https://github.com/$repository/pull/$pull_request"
wait_for_element "$attach_button" >/dev/null || exit 1
for file in "$@"; do
  attach "$(cd "$(dirname "$file")" && pwd)/$(basename "$file")" || exit 1
done
drive hotkey --key CmdOrCtrl+W
