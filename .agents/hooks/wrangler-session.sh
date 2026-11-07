#!/usr/bin/env bash
readonly WRANGLER_OAUTH_CONFIG_SUFFIX='.wrangler/config/default.toml'
readonly WRANGLER_LOGGED_IN_FIX='wrangler is logged in for this OS user; run `wrangler logout` and deploy with a scoped CLOUDFLARE_API_TOKEN exported only in your own shell'

is_wrangler_logged_in() {
  local config_path
  [[ -n "${CLOUDFLARE_API_TOKEN:-}" || -n "${CLOUDFLARE_API_KEY:-}" ]] && return 0
  for config_path in "$HOME/Library/Preferences/$WRANGLER_OAUTH_CONFIG_SUFFIX" "${XDG_CONFIG_HOME:-$HOME/.config}/$WRANGLER_OAUTH_CONFIG_SUFFIX" "$HOME/$WRANGLER_OAUTH_CONFIG_SUFFIX"; do
    [[ -f "$config_path" ]] && return 0
  done
  return 1
}
