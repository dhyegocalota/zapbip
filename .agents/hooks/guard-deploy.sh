#!/usr/bin/env bash
source "$(dirname "$0")/touched-files.sh"
readonly BLOCKED_MESSAGE="Blocked: deploys, remote database changes and secrets are run by the owner by hand, never by an agent (ADR 0027). A --dry-run is allowed."
readonly LINE_MARK=$'\001'
readonly BOUNDARY="[[:space:]${LINE_MARK}]"
readonly PROSE_PATTERN="(^|${BOUNDARY}|=)(\"[^\"\$\`]*${BOUNDARY}[^\"\$\`]*\"|'[^']*${BOUNDARY}[^']*')(${BOUNDARY}|\$)"
readonly STRICT_PATTERN='(^|[^[:alnum:]_])(sh|bash|zsh|dash|ksh)[[:space:]]+-[[:alnum:]]*c[[:alnum:]]*[[:space:]]|(^|[^[:alnum:]_])(python[0-9.]*|node|perl|ruby)[[:space:]]+-[ce][[:space:]]|<<<|(^|[^[:alnum:]_])eval([^[:alnum:]_]|$)|\|[[:space:]]*(bash|sh|zsh|xargs|source)([^[:alnum:]_]|$)'
readonly DYNAMIC_PATTERN='\$[({[:alpha:]_]|`|(^|[^[:alnum:]_])eval([^[:alnum:]_]|$)'
readonly SENSITIVE_WORD_PATTERN='(^|[^[:alnum:]_.:/-])(deploy|wrangler)([^[:alnum:]_.:/-]|$)'
readonly PROSE_COMMAND_PATTERN='^(grep|rg|cat|ls|head|tail|wc|echo|printf|git[[:space:]]+(commit|log|diff|show|grep|add|status|tag|branch|checkout|switch|restore|mv|rm))([[:space:]]|$)'
readonly WRANGLER_PATTERN='(^|[^[:alnum:]_.-])wrangler(\.js)?([[:space:]]+(.*))?$'
readonly REMOTE_PATTERN='(^|[[:space:]])--remote([[:space:]=]|$)'
readonly LOCAL_PATTERN='(^|[[:space:]])--local([[:space:]]|$)'
readonly DRY_RUN_PATTERN='(^|[[:space:]])--dry-run([[:space:]]|$)'
readonly SAFE_WRANGLER_PATTERN='^(dev|types|whoami|--version)([[:space:]]|$)'
readonly SAFE_LOCAL_WRANGLER_PATTERN='^d1[[:space:]]+(migrations[[:space:]]+apply|execute)[[:space:]]'
readonly SAFE_DEPLOY_WRANGLER_PATTERN='^deploy([[:space:]]|$)'
readonly PACKAGE_MANAGER_PATTERN='(^|[[:space:]])(npm|pnpm|yarn)([[:space:]]|$)'
readonly PRODUCTION_SCRIPT_PATTERN='(^|[[:space:]])(deploy:[[:alnum:]_-]+|migrate:(production|staging)|secrets:[[:alnum:]_-]+)([[:space:]]|$)'
readonly SCRIPT_RUNNER_PATTERN='(^|[[:space:]/])(node|tsx|ts-node|bun|deno)([[:space:]]|$)'
readonly DEPLOY_SCRIPT_PATTERN='scripts/deploy'
readonly SMOKE_SCRIPT_PATTERN='scripts/smoke'
readonly REMOTE_ENVIRONMENT_PATTERN='(^|[[:space:]=])(production|staging)([[:space:]]|$)'
readonly SEGMENT_SEPARATORS=";&|(){}\`${LINE_MARK}"
readonly QUOTED_HEREDOC_PROGRAM='
tag != "" { line = $0; gsub(/^[[:space:]]+|[[:space:]]+$/, "", line); if (line == tag) tag = ""; next }
{ print }
match($0, /cat[[:space:]]+<<-?[[:space:]]*[\047"][A-Za-z_]+[\047"]/) { found = substr($0, RSTART, RLENGTH); sub(/^[^\047"]*[\047"]/, "", found); sub(/[\047"]$/, "", found); tag = found }'

command=$(jq -r '.tool_input.command // ""' <<<"$hook_input")

block() {
  echo "$BLOCKED_MESSAGE" >&2
  exit 2
}

segments_of() {
  tr '\n' "$LINE_MARK" | sed -E "s/\\\\${LINE_MARK}/ /g; s/\\\$\\{?IFS\\}?/ /g; s/[\"'\\\\]//g" | tr "$SEGMENT_SEPARATORS" '\n' | sed -E 's/[[:space:]]+/ /g; s/(^| )#.*$//; s/^ //; s/ $//'
}

without_prose() {
  tr '\n' "$LINE_MARK" | sed -E "s/${PROSE_PATTERN}/\1\3/g; s/${PROSE_PATTERN}/\1\3/g" | tr "$LINE_MARK" '\n'
}

is_owner_only_wrangler() {
  local segment=$1
  [[ "$segment" =~ $WRANGLER_PATTERN ]] || return 1
  local arguments=${BASH_REMATCH[4]}
  [[ "$arguments" =~ $REMOTE_PATTERN ]] && return 0
  [[ "$arguments" =~ $SAFE_WRANGLER_PATTERN ]] && return 1
  [[ "$arguments" =~ $SAFE_LOCAL_WRANGLER_PATTERN && "$arguments" =~ $LOCAL_PATTERN ]] && return 1
  [[ "$arguments" =~ $SAFE_DEPLOY_WRANGLER_PATTERN && "$arguments" =~ $DRY_RUN_PATTERN ]] && return 1
  return 0
}

is_owner_only_script() {
  local segment=$1
  local is_package_script=false is_deploy_script=false is_smoke_script=false
  [[ "$segment" =~ $PACKAGE_MANAGER_PATTERN && "$segment" =~ $PRODUCTION_SCRIPT_PATTERN ]] && is_package_script=true
  [[ "$segment" =~ $SCRIPT_RUNNER_PATTERN && "$segment" == *$DEPLOY_SCRIPT_PATTERN* ]] && is_deploy_script=true
  [[ "$segment" =~ $SCRIPT_RUNNER_PATTERN && "$segment" == *$SMOKE_SCRIPT_PATTERN* && "$segment" =~ $REMOTE_ENVIRONMENT_PATTERN ]] && is_smoke_script=true
  $is_package_script || $is_deploy_script || $is_smoke_script
}

is_owner_only_segment() {
  local segment=$1
  is_owner_only_wrangler "$segment" || is_owner_only_script "$segment"
}

is_strict=false
[[ "$command" =~ $STRICT_PATTERN ]] && is_strict=true

scanned_text=$command
$is_strict || scanned_text=$(awk "$QUOTED_HEREDOC_PROGRAM" <<<"$command" | without_prose)

is_dynamic=false
[[ "$scanned_text" =~ $DYNAMIC_PATTERN && "$scanned_text" =~ $SENSITIVE_WORD_PATTERN ]] && is_dynamic=true
$is_dynamic && block

while IFS= read -r segment; do
  [[ -n "$segment" ]] || continue
  is_prose_command=false
  [[ "$segment" =~ $PROSE_COMMAND_PATTERN ]] && is_prose_command=true
  $is_strict && is_prose_command=false
  $is_prose_command && continue
  is_owner_only_segment "$segment" && block
done < <(segments_of <<<"$scanned_text")
exit 0
