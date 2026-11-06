#!/usr/bin/env bash
source "$(dirname "$0")/touched-files.sh"
readonly GIT_PREFIX_PATTERN='git([[:space:]]+(-C[[:space:]]+[^[:space:]]+|-c[[:space:]]+[^[:space:]]+|--[[:alnum:]-]+(=[^[:space:]]+)?))*[[:space:]]+'
readonly ADD_PATTERN="${GIT_PREFIX_PATTERN}add([[:space:]][^;&|]*)?"
readonly COMMIT_PATTERN="${GIT_PREFIX_PATTERN}commit([[:space:]][^;&|]*)?"
readonly STAGE_EVERYTHING_PATTERN='^(-[[:alpha:]]*[Au][[:alpha:]]*|--all|--update|\.{1,2}/*|:(/|\(top\)\.?/*)|\*+)$'
readonly SKIP_HOOKS_FLAG_PATTERN='^-[^mFCct-]*n'
readonly QUOTED_TEXT_PATTERN="\"[^\"]*\"|'[^']*'"

command=$(jq -r '.tool_input.command // ""' <<<"$hook_input")

has_flag() {
  local invocation_pattern=$1 argument_prefix_pattern=$2 flag_pattern=$3 text=$4 invocation argument
  local -a arguments
  while IFS= read -r invocation; do
    [[ -n "$invocation" ]] || continue
    read -ra arguments <<<"$(sed -E "s/^${argument_prefix_pattern}//" <<<"$invocation")"
    for argument in "${arguments[@]}"; do
      [[ "$argument" =~ $flag_pattern ]] && return 0
    done
  done < <(grep -oE "$invocation_pattern" <<<"$text" || true)
  return 1
}

stages_everything() {
  has_flag "$ADD_PATTERN" "${GIT_PREFIX_PATTERN}add" "$STAGE_EVERYTHING_PATTERN" "$(tr -d "\"'" <<<"$command")"
}

skips_hooks() {
  has_flag "$COMMIT_PATTERN" "${GIT_PREFIX_PATTERN}commit" "$SKIP_HOOKS_FLAG_PATTERN" "$(sed -E "s/${QUOTED_TEXT_PATTERN}//g" <<<"$command")"
}

if stages_everything; then
  echo "Blocked: stage files by name, never git add -A / --all / -u / . / *" >&2
  exit 2
fi
if [[ "$command" =~ --no-verify ]] || skips_hooks; then
  echo "Blocked: --no-verify skips the gates this repo depends on." >&2
  exit 2
fi
exit 0
