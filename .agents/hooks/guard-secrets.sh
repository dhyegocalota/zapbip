#!/usr/bin/env bash
source "$(dirname "$0")/touched-files.sh"
readonly BLOCKED_MESSAGE="Blocked: agents never edit .env files; document the variable in .env.example instead."
readonly WRITE_PATTERN='>|(^|[^[:alnum:]_])(tee|cp|mv|install|ln|rsync|dd|touch|truncate|patch|open|write_text|write_bytes|tar|unzip|pax|ditto|gtar|bsdtar|cpio)([^[:alnum:]_]|$)|(^|[[:space:]])--ou[[:alnum:]-]*([[:space:]=]|$)|sed[[:space:]]+-i|sed[[:space:]].*[[:space:]/;{]w[[:space:]]|perl[[:space:]]+-[[:alnum:]]*i|(^|[^[:alnum:]_])curl[[:space:]]+(.*[[:space:]])?(-[[:alnum:]]*o|--output)([[:space:]]|$)|(^|[^[:alnum:]_])wget[[:space:]]+(.*[[:space:]])?(-[[:alnum:]]*O|--output-document)([[:space:]=]|$)|(^|[^[:alnum:]_])git([[:space:]]+-[^[:space:]]+)*[[:space:]]+(checkout|restore)([^[:alnum:]_]|$)|(^|[^[:alnum:]_])(python[0-9.]*|node|ruby)[[:space:]]+-[ce]([^[:alnum:]_]|$)'
readonly WORD_SEPARATORS=$' \t\n;&|<>=(){}$`'

is_protected_env_file() {
  local name="${1##*/}"
  [[ "$name" == .*[*?[]* && ".env" == $name ]] && return 0
  [[ "$name" =~ ^\.env ]] || return 1
  [[ "$name" == *.example ]] && return 1
  return 0
}

block() {
  echo "$BLOCKED_MESSAGE" >&2
  exit 2
}

touched=$(touched_files)
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  is_protected_env_file "$file" && block
done <<<"$touched"
[[ -n "$touched" ]] && exit 0
command=$(jq -r '.tool_input.command // ""' <<<"$hook_input")
scanned_text=$(tr -d "\"'\\\\" <<<"$command")
[[ "$scanned_text" =~ $WRITE_PATTERN ]] || exit 0
while IFS= read -r word; do
  is_protected_env_file "$word" && block
done < <(tr "$WORD_SEPARATORS" '\n' <<<"$scanned_text")
exit 0
