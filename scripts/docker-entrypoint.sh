#!/usr/bin/env bash
set -euo pipefail

data_directory="${ZAPBIP_DATA_DIRECTORY:?}"
secrets_file="$data_directory/secrets.env"
state_directory="$data_directory/state"

mkdir -p "$data_directory" "$state_directory"

secret_of() {
  local name=$1 generator=$2
  [[ -n "${!name:-}" ]] && { printf '%s=%s\n' "$name" "${!name}"; return; }
  grep -E "^$name=" "$secrets_file" 2>/dev/null || printf '%s=%s\n' "$name" "$($generator)"
}

random_bytes() { node -p "require('node:crypto').randomBytes($1).toString('$2')"; }
hex_32() { random_bytes 32 hex; }
base64_32() { random_bytes 32 base64; }
hex_16() { random_bytes 16 hex; }

{
  secret_of MEDIA_LINK_SIGNING_KEY hex_32
  secret_of UPLOAD_LINK_SIGNING_KEY hex_32
  secret_of NUMBER_REGISTRY_KEY base64_32
  secret_of META_APP_SECRET hex_16
} > "$secrets_file.next"
mv "$secrets_file.next" "$secrets_file"
cp "$secrets_file" .dev.vars

pnpm exec wrangler d1 migrations apply CONNECTIONS --env development --local --persist-to "$state_directory"
exec pnpm exec wrangler dev --env development --ip 0.0.0.0 --port 8787 --persist-to "$state_directory"
