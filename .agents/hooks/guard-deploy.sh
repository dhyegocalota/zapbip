#!/usr/bin/env bash
source "$(dirname "$0")/touched-files.sh"
source "$(dirname "$0")/wrangler-session.sh"
readonly BLOCKED_MESSAGE="Blocked: deploys, remote database changes and secrets are run by the owner by hand, never by an agent (ADR 0027). Only a --dry-run and local wrangler commands pass. To mention these words in a commit, write the message to a file and use git commit -F <file>."
readonly LOGGED_IN_MESSAGE="Blocked: $WRANGLER_LOGGED_IN_FIX (ADR 0027)."
readonly SENSITIVE_PATTERN='wrangler|deploy:|migrate:production|migrate:staging|secrets:|scripts/deploy|scripts/smoke'
readonly FORBIDDEN_CHARACTERS_PATTERN=$'[;|&$`<>(){}#\\\r\n]'
readonly WRANGLER_COMMAND_PATTERN='^(pnpm exec |npx |pnpm --filter [^ ]+ exec )?wrangler( (.*))?$'
readonly OPEN_WRANGLER_PATTERN='^(dev|types)([[:space:]]|$)|^(whoami|--version)$'
readonly LOCAL_WRANGLER_PATTERN='^d1[[:space:]]+(migrations[[:space:]]+apply|execute)[[:space:]]+[^[:space:]]+[[:space:]]'
readonly DEPLOY_WRANGLER_PATTERN='^deploy([[:space:]]|$)'
readonly SESSION_WRANGLER_PATTERN='^(whoami|--version|logout)$'
readonly REMOTE_PATTERN='(^|[[:space:]])(--remote|-[[:alnum:]]*r[[:alnum:]]*)([[:space:]=]|$)'
readonly LOCAL_PATTERN='(^|[[:space:]])--local([[:space:]]|$)'
readonly DRY_RUN_PATTERN='(^|[[:space:]])--dry-run([[:space:]]|$)'
readonly DRY_RUN_MENTION_PATTERN='dry-?run'
readonly DRY_RUN_NEGATION_PATTERN='no-dry'
readonly DRY_RUN_BOOLEAN_PATTERN='(^|[[:space:]])--dry-run[[:space:]]+(true|false)([[:space:]]|$)'
readonly OPEN_HEAD_PATTERNS=(
  '^git commit( -[[:alnum:]-]+)* -F [^ ]+( -[[:alnum:]-]+)*$'
  '^git (add|diff|show|status|log)( .*)?$'
  '^git restore --staged( .*)?$'
  '^(cat|head|tail|wc)( .*)?$'
  "^sed -n ['\"]?[0-9]+(,[0-9]+)?p['\"]? [^ ]+\$"
  '^(grep|rg)( .*)?$'
  '^(pnpm exec |npx |pnpm --filter [^ ]+ exec )?vitest run( .*)?$'
  '^pnpm test( .*)?$'
  '^pnpm --filter [^ ]+ test( .*)?$'
)
readonly UNSAFE_HEAD_ARGUMENTS_PATTERN='(^| )(--worktree|--pre|--pre-glob|--open-files-in-pager|--exec|--hostname-bin|--ou[[:alnum:]-]*)([ =]|$)|(^| )-[[:alnum:]]*[OWx][[:alnum:]]*( |$)'

command=$(jq -r '.tool_input.command // ""' <<<"$hook_input")

block() {
  echo "$1" >&2
  exit 2
}

is_only_bare_dry_run() {
  local mentions
  mentions=$(grep -oE "$DRY_RUN_MENTION_PATTERN" <<<"$1" | wc -l)
  [[ "$1" =~ $DRY_RUN_NEGATION_PATTERN ]] && return 1
  [[ "$1" =~ $DRY_RUN_BOOLEAN_PATTERN ]] && return 1
  [[ "$mentions" -eq 1 && "$1" =~ $DRY_RUN_PATTERN ]]
}

is_allowed_wrangler() {
  local arguments
  arguments=$(tr -d "\"'\\\\" <<<"$1" | tr '[:upper:]' '[:lower:]')
  [[ "$arguments" =~ $REMOTE_PATTERN ]] && return 1
  [[ "$arguments" =~ $LOCAL_WRANGLER_PATTERN && "$arguments" =~ $LOCAL_PATTERN ]] && return 0
  [[ "$arguments" =~ $DEPLOY_WRANGLER_PATTERN ]] && is_only_bare_dry_run "$arguments" && return 0
  [[ "$arguments" =~ $OPEN_WRANGLER_PATTERN ]]
}

is_allowed_logged_in_wrangler() {
  [[ "$1" =~ $SESSION_WRANGLER_PATTERN ]]
}

searchable_command=$(tr '[:upper:]' '[:lower:]' <<<"$command" | tr -d "\"'\\\\")
[[ "$searchable_command" =~ $SENSITIVE_PATTERN ]] || exit 0
[[ "$command" =~ $FORBIDDEN_CHARACTERS_PATTERN ]] && block "$BLOCKED_MESSAGE"

is_wrangler_command=false
[[ "$command" =~ $WRANGLER_COMMAND_PATTERN ]] && is_wrangler_command=true
wrangler_arguments=${BASH_REMATCH[3]}

is_open_head=false
for open_head_pattern in "${OPEN_HEAD_PATTERNS[@]}"; do
  [[ "$command" =~ $open_head_pattern ]] && is_open_head=true
done
has_unsafe_arguments=false
[[ "$command" =~ $UNSAFE_HEAD_ARGUMENTS_PATTERN ]] && has_unsafe_arguments=true
$is_open_head && ! $has_unsafe_arguments && exit 0

$is_wrangler_command || block "$BLOCKED_MESSAGE"
is_wrangler_logged_in && ! is_allowed_logged_in_wrangler "$wrangler_arguments" && block "$LOGGED_IN_MESSAGE"
is_wrangler_logged_in && exit 0
is_allowed_wrangler "$wrangler_arguments" && exit 0
block "$BLOCKED_MESSAGE"
