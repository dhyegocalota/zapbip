#!/usr/bin/env bash
set -euo pipefail

react_email_version="6.11.13"
studio_port="3100"
root="$(cd "$(dirname "$0")/.." && pwd)"
studio="${TMPDIR:-/tmp}/zapbip-email-studio"

mkdir -p "$studio"
cd "$studio"
[[ -f package.json ]] || printf '{"name":"zapbip-email-studio","private":true}\n' > package.json
npm install --silent --no-audit --no-fund --save-exact "react-email@$react_email_version" "@react-email/ui@$react_email_version"
exec npx react-email dev --dir "$root/apps/api/scripts/emails/previews" --port "$studio_port"
