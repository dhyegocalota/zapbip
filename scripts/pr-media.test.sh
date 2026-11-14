#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
failures=0

scratch=$(mktemp -d)
fakes="$scratch/bin"
calls="$scratch/calls.log"
media_directory="$scratch/media"
attachment='<img alt="home" src="https://github.com/user-attachments/assets/0000" />'
export PR_MEDIA_ORCA="$fakes/orca"
export PR_MEDIA_PAUSE_SECONDS=0
export PATH="$fakes:$PATH"

expect_equal() {
  local name=$1 actual=$2 expected=$3
  [[ "$actual" == "$expected" ]] && return
  echo "FAIL $name: expected '$expected', got '$actual'"
  failures=$((failures + 1))
}

mkdir -p "$fakes" "$media_directory"
cat > "$fakes/orca" <<FAKE
#!/usr/bin/env bash
echo "\$*" >> "$calls"
[[ "\$2" == get-app-state ]] && echo '{"result":{"snapshot":{"treeText":"11 text entry area (settable) Markdown value\n12 button Paste, drop, or click to add files\n13 button Comment\n14 sheet open"}}}'
exit 0
FAKE
printf '#!/usr/bin/env bash\necho "open $*" >> "%s"\n' "$calls" > "$fakes/open"
printf '#!/usr/bin/env bash\necho %q\n' "$attachment" > "$fakes/pbpaste"
printf '#!/usr/bin/env bash\ncat >/dev/null\n' > "$fakes/pbcopy"
chmod +x "$fakes/orca" "$fakes/open" "$fakes/pbpaste" "$fakes/pbcopy"
printf 'png' > "$media_directory/01-home.png"
printf 'mp4' > "$media_directory/walkthrough.mp4"

output=$("$here/pr-media.sh" 73 "$media_directory/01-home.png" "$media_directory/walkthrough.mp4" 2>/dev/null)
expect_equal "each file prints the Markdown GitHub wrote" "$(grep -c user-attachments <<< "$output")" "2"
expect_equal "the pull request opens in the browser" "$(grep -c '^open .*github.com/dhyegocalota/zapbip/pull/73' "$calls")" "1"
expect_equal "the file picker gets each absolute path" "$(grep -c "type-text --text $media_directory/" "$calls")" "2"
expect_equal "only the attach button and the comment box are clicked" "$(grep 'click --element-index' "$calls" | grep -vc -e 'index 11 ' -e 'index 12 ')" "0"
expect_equal "the tab it opened is closed" "$(grep -c 'hotkey --key CmdOrCtrl+W' "$calls")" "1"
expect_equal "the comment box is emptied after each file" "$(grep -c 'press-key --key Delete' "$calls")" "2"

: > "$calls"
"$here/pr-media.sh" 73 >/dev/null 2>&1
expect_equal "no files exits non-zero" "$?" "1"
"$here/pr-media.sh" main "$media_directory/01-home.png" >/dev/null 2>&1
expect_equal "a pull request that is not a number exits non-zero" "$?" "1"
"$here/pr-media.sh" 73 "$scratch/missing.png" >/dev/null 2>&1
expect_equal "a missing file exits non-zero" "$?" "1"
expect_equal "a refused call never touches the browser" "$(wc -l < "$calls" | tr -d ' ')" "0"

rm -rf "$scratch"
[[ "$failures" == 0 ]] && echo "pr-media: all checks passed" && exit 0
echo "pr-media: $failures check(s) failed"
exit 1
