#!/usr/bin/env bash
readonly WRANGLER_SESSION_FILE_NAME=wrangler-session
readonly WRANGLER_LOGGED_IN=logged-in
readonly WRANGLER_LOGGED_OUT=logged-out
readonly WRANGLER_LOGGED_IN_FIX='wrangler is logged in for this OS user; run `wrangler logout` and deploy with a scoped CLOUDFLARE_API_TOKEN exported only in your own shell'

wrangler_session_file() {
  [[ -n "${WRANGLER_SESSION_FILE:-}" ]] && { echo "$WRANGLER_SESSION_FILE"; return; }
  local common_directory
  common_directory=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 1
  echo "$common_directory/$WRANGLER_SESSION_FILE_NAME"
}

is_wrangler_logged_in() {
  local session_file
  session_file=$(wrangler_session_file) || return 1
  [[ -f "$session_file" && "$(cat "$session_file")" == "$WRANGLER_LOGGED_IN" ]]
}
