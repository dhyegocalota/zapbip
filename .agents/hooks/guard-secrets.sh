#!/usr/bin/env bash
source "$(dirname "$0")/touched-files.sh"
source "$(dirname "$0")/unsafe-head-arguments.sh"
readonly BLOCKED_MESSAGE="Blocked: agents never edit .env files; document the variable in .env.example instead. A command naming a dotenv file passes only as one plain read (cat, head, tail, wc, grep, rg, sed -n, git log|diff|show|status, ls, test) or as echo/printf prose redirected to another file."
readonly WORD_SEPARATORS=$' \t\n;&|<>=(){}$`'
readonly METACHARACTER_PATTERN=$'[;|&$`<>(){}\r\n]'
readonly READ_HEAD_PATTERN='^(cat|head|tail|wc|grep|rg|git log|git diff|git show|git status|ls|test|\[)( |$)'
readonly PRINT_LINES_PATTERN="^sed -n ['\"]?[0-9]+(,[0-9]+)?p['\"]?( [^-][^ ]*)+\$"
readonly PROSE_PATTERN='^(echo|printf)[[:space:]]+([^>]*[^>[:space:]])[[:space:]]*(>>?[[:space:]]*([^[:space:]>]+))?$'

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

has_metacharacter() {
  [[ "$1" =~ $METACHARACTER_PATTERN ]]
}

names_protected_env_file() {
  local word
  while IFS= read -r word; do
    is_protected_env_file "$word" && return 0
  done < <(tr "$WORD_SEPARATORS" '\n' <<<"$1")
  return 1
}

is_plain_read() {
  has_metacharacter "$trimmed_command" && return 1
  [[ "$scanned_text" =~ $UNSAFE_HEAD_ARGUMENTS_PATTERN ]] && return 1
  [[ "$trimmed_command" =~ $READ_HEAD_PATTERN || "$trimmed_command" =~ $PRINT_LINES_PATTERN ]]
}

is_prose() {
  [[ "$trimmed_command" =~ $PROSE_PATTERN ]] || return 1
  local text=${BASH_REMATCH[2]} target=${BASH_REMATCH[4]}
  has_metacharacter "$text" && return 1
  has_metacharacter "$target" && return 1
  names_protected_env_file "$(tr -d "\"'\\\\" <<<"$target")" && return 1
  return 0
}

touched=$(touched_files)
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  is_protected_env_file "$file" && block
done <<<"$touched"
[[ -n "$touched" ]] && exit 0
command=$(jq -r '.tool_input.command // ""' <<<"$hook_input")
scanned_text=$(tr -d "\"'\\\\" <<<"$command")
trimmed_command=${command#"${command%%[![:space:]]*}"}
names_protected_env_file "$scanned_text" || exit 0
is_plain_read && exit 0
is_prose && exit 0
block
