#!/usr/bin/env bash
readonly WRANGLER_CONFIG_DIRECTORY_SUFFIX='.wrangler/config'
readonly CLOUDFLARE_CREDENTIAL_PATTERN='^[[:space:]]*(export[[:space:]]+)?(CLOUDFLARE|CF)_API_(TOKEN|KEY)[[:space:]]*[=:]'
readonly WRANGLER_LOGGED_IN_FIX='wrangler is logged in for this OS user; run `wrangler logout` and deploy with a scoped CLOUDFLARE_API_TOKEN exported only in your own shell'
readonly WRANGLER_DEFAULT_REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

wrangler_repository_root() {
  echo "${WRANGLER_REPOSITORY_ROOT:-$WRANGLER_DEFAULT_REPOSITORY_ROOT}"
}

is_wrangler_logged_in() {
  local config_directory stored_login environment_file
  local repository_root
  repository_root=$(wrangler_repository_root)
  [[ -n "${CLOUDFLARE_API_TOKEN:-}" || -n "${CLOUDFLARE_API_KEY:-}" || -n "${CF_API_TOKEN:-}" || -n "${CF_API_KEY:-}" ]] && return 0
  for config_directory in "$HOME/Library/Preferences/$WRANGLER_CONFIG_DIRECTORY_SUFFIX" "${XDG_CONFIG_HOME:-$HOME/.config}/$WRANGLER_CONFIG_DIRECTORY_SUFFIX" "$HOME/$WRANGLER_CONFIG_DIRECTORY_SUFFIX"; do
    for stored_login in "$config_directory"/*; do
      [[ -f "$stored_login" ]] && return 0
    done
  done
  for environment_file in "$repository_root"/.env* "$repository_root"/apps/*/.env*; do
    [[ -f "$environment_file" && "$environment_file" != *.example ]] || continue
    grep -qE "$CLOUDFLARE_CREDENTIAL_PATTERN" "$environment_file" && return 0
  done
  return 1
}
