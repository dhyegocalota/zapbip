#!/usr/bin/env bash
set -euo pipefail

readonly DATABASE_BINDING="CONNECTIONS"
readonly WA_ID_PATTERN='^[0-9]{8,15}$'
readonly BLOCK_REASON="operator"
readonly MILLISECONDS_PER_SECOND=1000
readonly USAGE="usage: operator-account.sh <enable|suspend|resume|block|unblock|delete> <wa_id> [wrangler d1 execute flags]"
readonly OWNER_ACCOUNT="SELECT account_id FROM owner_identities WHERE wa_id"

if [[ $# -lt 2 ]]; then
  echo "$USAGE" >&2
  exit 2
fi

command_name="$1"
wa_id="$2"
shift 2

if [[ ! "$wa_id" =~ $WA_ID_PATTERN ]]; then
  echo "wa_id must be 8 to 15 digits" >&2
  exit 2
fi

now_ms=$(($(date +%s) * MILLISECONDS_PER_SECOND))

case "$command_name" in
  enable)
    sql="UPDATE accounts SET state = 'active' WHERE state = 'waitlisted' AND id IN ($OWNER_ACCOUNT = '$wa_id')"
    refusal="not waitlisted"
    ;;
  suspend)
    sql="UPDATE accounts SET state = 'suspended' WHERE state = 'active' AND id IN ($OWNER_ACCOUNT = '$wa_id')"
    refusal="not active"
    ;;
  resume)
    sql="UPDATE accounts SET state = 'active' WHERE state = 'suspended' AND id IN ($OWNER_ACCOUNT = '$wa_id')"
    refusal="not suspended"
    ;;
  delete)
    sql="UPDATE accounts SET state = 'deleting' WHERE state != 'deleting' AND id IN ($OWNER_ACCOUNT = '$wa_id')"
    refusal="not found or already deleting"
    ;;
  block)
    sql="INSERT INTO blocked_phones (wa_id, reason, created_at) VALUES ('$wa_id', '$BLOCK_REASON', $now_ms) ON CONFLICT (wa_id) DO NOTHING"
    refusal="already blocked"
    ;;
  unblock)
    sql="DELETE FROM blocked_phones WHERE wa_id = '$wa_id'"
    refusal="not blocked"
    ;;
  *)
    echo "$USAGE" >&2
    exit 2
    ;;
esac

output=$(cd "$(dirname "$0")/.." && pnpm exec wrangler d1 execute "$DATABASE_BINDING" --json --command "$sql" "$@")
changes=$(node -e 'const results = JSON.parse(process.argv[1]); console.log(results.reduce((total, entry) => total + entry.meta.changes, 0))' "$output")

if [[ "$changes" -eq 0 ]]; then
  echo "$command_name: $refusal" >&2
  exit 1
fi

echo "$command_name: ok"
