#!/usr/bin/env bash
set -u
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
source "$root/.agents/hooks/wrangler-session.sh"
readonly WRANGLER_OAUTH_PATTERN='logged in with an OAuth Token'
readonly WRANGLER_PROBE_PROGRAM='alarm shift; exec @ARGV'
wrangler_timeout_seconds=${DOCTOR_WRANGLER_TIMEOUT_SECONDS:-10}
wrangler_directory=${DOCTOR_WRANGLER_DIR:-$root/apps/api/node_modules/.bin}
platform=${DOCTOR_UNAME:-$(uname -s)}
lookup_path=${DOCTOR_PATH:-$PATH}
home=${DOCTOR_HOME:-$HOME}
skipped=" ${DOCTOR_SKIP:-} "
nvmrc_file=${DOCTOR_NVMRC:-$root/.nvmrc}
wanted_node=$(sed -nE '1s/^v?([0-9]+).*/\1/p' "$nvmrc_file")
wanted_pnpm=$(sed -nE 's/.*"packageManager": *"pnpm@([0-9]+\.[0-9]+\.[0-9]+)".*/\1/p' "$root/package.json")

have() { PATH=$lookup_path command -v "$1" >/dev/null 2>&1; }
run() { PATH=$lookup_path "$@"; }

package_manager() {
  local candidate
  for candidate in brew apt-get dnf apk pacman; do
    have "$candidate" && { echo "$candidate"; return; }
  done
  echo none
}
manager=$(package_manager)

install_with() {
  case "$manager" in
    brew) echo "brew install $1" ;;
    apt-get) echo "sudo apt-get install -y $1" ;;
    dnf) echo "sudo dnf install -y $1" ;;
    apk) echo "sudo apk add $1" ;;
    pacman) echo "sudo pacman -S --noconfirm $1" ;;
    *) echo "$2" ;;
  esac
}

chromium_install() {
  [[ "$platform" == Linux ]] && { echo "npx -y playwright install --with-deps chromium"; return; }
  echo "npx -y playwright install chromium"
}

gh_install() {
  [[ "$manager" == apk ]] && { echo "sudo apk add github-cli"; return; }
  [[ "$manager" == pacman ]] && { echo "sudo pacman -S --noconfirm github-cli"; return; }
  install_with gh "https://github.com/cli/cli#installation"
}

readonly PYTHON_REQUIREMENTS_INSTALL="python3 -m pip install --require-hashes -r apps/hermes-plugin/requirements-dev.txt"

python_install() {
  [[ "$manager" == brew ]] && { echo "brew install python@3.13 && $PYTHON_REQUIREMENTS_INSTALL"; return; }
  echo "https://www.python.org/downloads/ (3.11 to 3.14), then $PYTHON_REQUIREMENTS_INSTALL"
}

fix_for() {
  case "$1" in
    node) echo "nvm install (reads .nvmrc), or https://nodejs.org/en/download" ;;
    pnpm) echo "corepack enable && corepack prepare pnpm@$wanted_pnpm --activate" ;;
    jq) install_with jq "https://jqlang.github.io/jq/download/" ;;
    gh) gh_install ;;
    gh-auth) echo "gh auth login (run it yourself; the agent cannot)" ;;
    chromium) chromium_install ;;
    skills) echo "ln -sfn ../.agents/skills .claude/skills" ;;
    gitleaks) install_with gitleaks "https://github.com/gitleaks/gitleaks#installing" ;;
    python) python_install ;;
    ffmpeg) install_with ffmpeg "https://ffmpeg.org/download.html" ;;
    wrangler) echo "$WRANGLER_LOGGED_IN_FIX" ;;
  esac
}

lost_for() {
  case "$1" in
    node|pnpm) echo "everything" ;;
    jq) echo "the four hooks; the two guards block" ;;
    gh) echo "/open-pr and the recorder's release upload" ;;
    chromium) echo "every Playwright MCP server, /check-ui, /scenario, the tester" ;;
    skills) echo "every Claude Code skill (ADR 0001)" ;;
    gitleaks) echo "the secret scan; pnpm verify fails without it" ;;
    ffmpeg) echo "the recorder's mp4 and gif; a PR that touches UI cannot ship" ;;
    python) echo "the Hermes plugin's typecheck and tests; pnpm verify fails in apps/hermes-plugin" ;;
    wrangler) echo "the deploy guard refuses every wrangler command, and agent shells can reach the owner's Cloudflare session" ;;
  esac
}

browsers_dir() {
  [[ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ]] && { echo "$PLAYWRIGHT_BROWSERS_PATH"; return; }
  [[ "$platform" == Darwin ]] && { echo "$home/Library/Caches/ms-playwright"; return; }
  echo "$home/.cache/ms-playwright"
}

node_major() { run node -v 2>/dev/null | sed -nE '1s/^v([0-9]+).*/\1/p'; }

check_node() { local installed_major; have node && installed_major=$(node_major) && [[ "$installed_major" =~ ^[0-9]+$ ]] && [[ "$installed_major" -ge "$wanted_node" ]]; }
check_pnpm() { have pnpm && [[ "$(COREPACK_ENABLE_NETWORK=0 run pnpm -v 2>/dev/null)" == "$wanted_pnpm" ]]; }
check_jq() { have jq; }
check_gh() { have gh && run gh auth token >/dev/null 2>&1; }
check_chromium() { ls -d "$(browsers_dir)"/chromium-* >/dev/null 2>&1; }
check_skills() { [[ "$(cd "$root/.claude/skills" 2>/dev/null && pwd -P)" == "$(cd "$root/.agents/skills" && pwd -P)" ]]; }
check_gitleaks() { have gitleaks; }
check_ffmpeg() { have ffmpeg; }
check_python() { have python3 && run python3 -c 'import sys, mypy, pytest; sys.exit(not (3, 11) <= sys.version_info[:2] <= (3, 14))' >/dev/null 2>&1; }

wrangler_session() {
  local binary
  binary=$(PATH="$lookup_path:$wrangler_directory" command -v wrangler) || { echo "$WRANGLER_LOGGED_OUT"; return; }
  perl -e "$WRANGLER_PROBE_PROGRAM" "$wrangler_timeout_seconds" "$binary" whoami </dev/null 2>&1 | grep -qi "$WRANGLER_OAUTH_PATTERN" && { echo "$WRANGLER_LOGGED_IN"; return; }
  echo "$WRANGLER_LOGGED_OUT"
}

check_wrangler() {
  local session session_file
  session=$(wrangler_session)
  session_file=$(cd "$root" && wrangler_session_file) && printf '%s' "$session" > "$session_file"
  [[ "$session" == "$WRANGLER_LOGGED_OUT" ]]
}

fix_name_for() {
  [[ "$1" == gh ]] && have gh && { echo gh-auth; return; }
  echo "$1"
}

if [[ "${1:-}" == --fix ]]; then
  fix_for "$(fix_name_for "${2:-}")"
  exit 0
fi

[[ "$wanted_node" =~ ^[0-9]+$ ]] || { echo "doctor: .nvmrc is not a version"; exit 1; }
[[ -n "$wanted_pnpm" ]] || { echo "doctor: packageManager is not pnpm@x.y.z"; exit 1; }

missing_required=0
missing_optional=0

report() {
  local tool=$1 requirement=$2 state
  state=missing
  [[ "$skipped" == *" $tool "* ]] && state=skipped
  [[ "$state" == missing ]] && "check_$tool" && state=ok
  printf '%s | %s | %s | lost: %s | fix: %s\n' "$tool" "$state" "$requirement" "$(lost_for "$tool")" "$(fix_for "$(fix_name_for "$tool")")"
  [[ "$state" == missing ]] || return 0
  [[ "$requirement" == required ]] && missing_required=$((missing_required + 1)) && return 0
  missing_optional=$((missing_optional + 1))
}

report node required
report pnpm required
report jq required
report gh required
report chromium required
report skills required
report python required
report wrangler required
report gitleaks optional
report ffmpeg optional
echo "doctor: $missing_required missing required, $missing_optional missing optional"
[[ "$missing_required" == 0 ]]
