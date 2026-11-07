#!/usr/bin/env bash
set -euo pipefail

readonly REDACTION_CHECK_FLAG="--check-redaction"
readonly FIXTURE_LINK_VARIABLE="ZAPBIP_E2E_FIXTURE_LINK"
readonly OWNER_PHONE="5511999990000"
readonly SEED_AGENT="seed"
readonly NEW_AGENT_TEXT="novo agente install-e2e"
readonly SELF_TEST_TEXT="✅ instalado"
readonly SERVER_PORT="8787"
readonly SERVER_ORIGIN="http://localhost:${SERVER_PORT}"
readonly HEALTH_RETRIES=60
readonly SECRET_PATTERN='zb_conn_[A-Za-z0-9_-]+|https?://[^[:space:]"]*/c/[^[:space:]"]*'
readonly REDACTED="<redacted>"
readonly ALLOWED_TOOLS="--allowedTools=mcp__zapbip__send_message"
readonly PROJECT_SCOPE_INSTRUCTION="This is a throwaway test project: run claude mcp add with --scope project instead of user scope, and write the skill to .claude/skills/zapbip/SKILL.md in the current directory instead of ~/.claude/skills/zapbip/SKILL.md."

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work_directory=""
server_process=""

redact() {
  sed -E "s#${SECRET_PATTERN}#${REDACTED}#g"
}

run_logged() {
  "$@" 2>&1 | redact
  return "${PIPESTATUS[0]}"
}

fail() {
  echo "install-e2e failed: $1" >&2
  exit 1
}

cleanup() {
  if [[ -n "$server_process" ]]; then
    kill "$server_process" 2>/dev/null || true
  fi
  if [[ -n "$work_directory" ]]; then
    rm -rf "$work_directory"
  fi
}
trap cleanup EXIT

if [[ "${1:-}" == "$REDACTION_CHECK_FLAG" ]]; then
  fixture_link="${!FIXTURE_LINK_VARIABLE}"
  run_logged bash -c 'echo "$1"; echo "$1" >&2' _ "$fixture_link"
  exit 0
fi

for required_tool in claude pnpm curl; do
  command -v "$required_tool" >/dev/null || fail "$required_tool is not installed"
done

work_directory="$(mktemp -d)"
project_directory="$work_directory/project"
state_directory="$work_directory/state"
mkdir -p "$project_directory" "$state_directory"

cd "$repository_root"
run_logged pnpm --filter @zapbip/api exec wrangler d1 migrations apply CONNECTIONS --local --env development --persist-to "$state_directory" || fail "the migrations failed"

pnpm --filter @zapbip/api exec wrangler dev --env development --port "$SERVER_PORT" --persist-to "$state_directory" >"$work_directory/server.log" 2>&1 &
server_process=$!

curl --silent --fail --retry "$HEALTH_RETRIES" --retry-connrefused --retry-delay 1 "$SERVER_ORIGIN/health" >/dev/null || fail "the server did not start"
run_logged pnpm --filter @zapbip/api dev:seed --origin "$SERVER_ORIGIN" --phone "$OWNER_PHONE" --agents "$SEED_AGENT" --json || fail "the seed failed"

owner_url="$SERVER_ORIGIN/dev/owner/$OWNER_PHONE"
curl --silent --fail --request POST --header "content-type: application/json" \
  --data "{\"kind\":\"text\",\"text\":\"$NEW_AGENT_TEXT\"}" "$owner_url/messages" >/dev/null || fail "the owner message was refused"

install_link="$(curl --silent --fail "$owner_url/screen" | grep -oE "${SERVER_ORIGIN}/i/zb_inst_[A-Za-z0-9_-]+" | tail -1)"
[[ -n "$install_link" ]] || fail "no install link reached the owner screen"

curl --silent --fail "$install_link" | grep -q "send_message" || fail "the install page did not render"

cd "$project_directory"
run_logged claude -p "Connect yourself to my WhatsApp with zapbip: read ${install_link} and follow the instructions. ${PROJECT_SCOPE_INSTRUCTION}" "$ALLOWED_TOOLS" --permission-mode acceptEdits || fail "the Claude Code install run failed"

claude mcp list 2>&1 | grep -q "zapbip" || fail "claude mcp list does not show zapbip"

curl --silent --fail "$owner_url/screen" | grep -q "$SELF_TEST_TEXT" || fail "the self-test text did not reach the owner screen"

echo "install-e2e passed"
