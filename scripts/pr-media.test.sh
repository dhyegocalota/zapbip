#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
failures=0

scratch=$(mktemp -d)
fakes="$scratch/bin"
calls="$scratch/calls.log"
body="$scratch/body.md"
media_directory="$scratch/media"
export PATH="$fakes:$PATH"

expect_equal() {
  local name=$1 actual=$2 expected=$3
  [[ "$actual" == "$expected" ]] && return
  echo "FAIL $name: expected '$expected', got '$actual'"
  failures=$((failures + 1))
}

mkdir -p "$fakes" "$media_directory"
cat > "$fakes/gh" <<FAKE
#!/usr/bin/env bash
echo "\$*" >> "$calls"
[[ "\$2" == view ]] && cat "$body"
[[ "\$2" == edit && "\${FAKE_GH_ATTACHES:-yes}" == yes ]] && printf '![01-home.png](https://github.com/user-attachments/assets/0000)\nhttps://github.com/user-attachments/assets/1111\n' >> "$body"
exit 0
FAKE
chmod +x "$fakes/gh"
printf 'png' > "$media_directory/01-home.png"
printf 'mp4' > "$media_directory/walkthrough.mp4"
printf '## Summary\n\nthe change\n' > "$body"

output=$("$here/pr-media.sh" 73 "$media_directory/01-home.png" "$media_directory/walkthrough.mp4" 2>/dev/null)
expect_equal "it prints only the lines GitHub added" "$output" "$(printf '![01-home.png](https://github.com/user-attachments/assets/0000)\nhttps://github.com/user-attachments/assets/1111')"
expect_equal "one edit carries every file" "$(grep -c '^pr edit 73 .*--attach .*01-home.png --attach .*walkthrough.mp4' "$calls")" "1"
expect_equal "the edit targets the repository" "$(grep -c -- '--repo dhyegocalota/zapbip' "$calls")" "3"

: > "$calls"
FAKE_GH_ATTACHES=no "$here/pr-media.sh" 73 "$media_directory/01-home.png" >/dev/null 2>&1
expect_equal "a body GitHub did not change exits non-zero" "$?" "1"

: > "$calls"
"$here/pr-media.sh" 73 >/dev/null 2>&1
expect_equal "no files exits non-zero" "$?" "1"
"$here/pr-media.sh" main "$media_directory/01-home.png" >/dev/null 2>&1
expect_equal "a pull request that is not a number exits non-zero" "$?" "1"
"$here/pr-media.sh" 73 "$scratch/missing.png" >/dev/null 2>&1
expect_equal "a missing file exits non-zero" "$?" "1"
expect_equal "a refused call never reaches GitHub" "$(wc -l < "$calls" | tr -d ' ')" "0"

rm -rf "$scratch"
[[ "$failures" == 0 ]] && echo "pr-media: all checks passed" && exit 0
echo "pr-media: $failures check(s) failed"
exit 1
