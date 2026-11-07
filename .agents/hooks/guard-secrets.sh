#!/usr/bin/env bash
source "$(dirname "$0")/touched-files.sh"
readonly BLOCKED_MESSAGE="Blocked: agents never edit .env files; document the variable in .env.example instead."
readonly WRITE_PATTERN='>|(^|[^[:alnum:]_])(tee|cp|mv|install|ln|rsync|dd|open|write_text|write_bytes)([^[:alnum:]_]|$)|sed[[:space:]]+-i|perl[[:space:]]+-[[:alnum:]]*i'
readonly SCRIPT_PATTERN='(^|[^[:alnum:]_])((sh|bash|zsh)[[:space:]]+-[[:alnum:]]*c|eval|python[0-9.]*|node|perl|ruby)([^[:alnum:]_]|$)'
readonly PROSE_PATTERN="\"[^\"\$\`]*[[:space:]][^\"\$\`]*\"|'[^']*[[:space:]][^']*'"
readonly WORD_SEPARATORS=$' \t\n;&|<>=(){}$`"\''

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
[[ "$command" =~ $WRITE_PATTERN ]] || exit 0
scanned_text=$(sed -E "s/${PROSE_PATTERN}//g" <<<"$command")
[[ "$command" =~ $SCRIPT_PATTERN ]] && scanned_text=$command
while IFS= read -r word; do
  is_protected_env_file "$word" && block
done < <(tr "$WORD_SEPARATORS" '\n' <<<"$scanned_text")
exit 0
