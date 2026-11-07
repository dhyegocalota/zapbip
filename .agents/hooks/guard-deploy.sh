#!/usr/bin/env bash
source "$(dirname "$0")/touched-files.sh"
readonly QUOTED_TEXT_PATTERN="\"[^\"]*\"|'[^']*'"
readonly QUOTE_CHARACTERS=$'"\''
readonly SHELL_COMMAND_PATTERN='(^|[[:space:]/])(sh|bash|zsh)[[:space:]]+-c[[:space:]]'
readonly WRANGLER_PATTERN='(^|[[:space:]/])wrangler[[:space:]]+(.*)$'
readonly OWNER_ONLY_WRANGLER_PATTERN='^(deploy|rollback|versions[[:space:]]+deploy|triggers[[:space:]]+deploy|secret[[:space:]]+(put|bulk|delete)|delete|d1[[:space:]]+(time-travel|delete)|r2[[:space:]]+.*[[:space:]](delete|put)|d1[[:space:]].*--remote)([[:space:]]|$)'
readonly DRY_RUN_PATTERN='(^|[[:space:]])--dry-run([[:space:]]|$)'
readonly OWNER_ONLY_SCRIPT_PATTERN='(^|[[:space:]])pnpm[[:space:]]+(run[[:space:]]+)?(deploy:[[:alpha:]]+|migrate:(staging|production))([[:space:]]|$)'

command=$(jq -r '.tool_input.command // ""' <<<"$hook_input")
segments=$(sed -E "s/${QUOTED_TEXT_PATTERN}//g" <<<"$command" | tr ';&|' '\n\n\n')
[[ "$command" =~ $SHELL_COMMAND_PATTERN ]] && segments+=$'\n'$(tr "$QUOTE_CHARACTERS" '  ' <<<"$command" | tr ';&|' '\n\n\n')

is_owner_only_wrangler() {
  local segment=$1
  [[ "$segment" =~ $WRANGLER_PATTERN ]] || return 1
  local arguments=${BASH_REMATCH[2]}
  [[ "$arguments" =~ $DRY_RUN_PATTERN ]] && return 1
  [[ "$arguments" =~ $OWNER_ONLY_WRANGLER_PATTERN ]]
}

while IFS= read -r segment; do
  if is_owner_only_wrangler "$segment" || [[ "$segment" =~ $OWNER_ONLY_SCRIPT_PATTERN ]]; then
    echo "Blocked: deploys, remote database changes and secrets are run by the owner by hand, never by an agent (ADR 0027). A --dry-run is allowed." >&2
    exit 2
  fi
done <<<"$segments"
exit 0
