#!/usr/bin/env bash
# Append local Supabase env vars to .env.local.
#   pnpm db:env

set -euo pipefail

if ! raw=$(pnpm supabase status -o env 2>/dev/null); then
  echo "Could not read \`supabase status\`. Is the local stack running? Start it with \`pnpm db:start\`." >&2
  exit 1
fi

get_var() {
  local value
  value=$(echo "$raw" | grep "^$1=" | cut -d= -f2-)
  value="${value#\"}"
  value="${value%\"}"
  echo "$value"
}

DB_URL=$(get_var DB_URL)
API_URL=$(get_var API_URL)
PUBLISHABLE_KEY=$(get_var PUBLISHABLE_KEY)
S3_ACCESS_KEY=$(get_var S3_PROTOCOL_ACCESS_KEY_ID)
S3_SECRET_KEY=$(get_var S3_PROTOCOL_ACCESS_KEY_SECRET)
S3_ENDPOINT=$(get_var STORAGE_S3_URL)
S3_REGION=$(get_var S3_PROTOCOL_REGION)

missing=()
[[ -z "$DB_URL" ]] && missing+=("DATABASE_URL")
[[ -z "$API_URL" ]] && missing+=("NEXT_PUBLIC_SUPABASE_URL")
[[ -z "$PUBLISHABLE_KEY" ]] && missing+=("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
[[ -z "$S3_ACCESS_KEY" ]] && missing+=("S3_PROTOCOL_ACCESS_KEY_ID")
[[ -z "$S3_SECRET_KEY" ]] && missing+=("S3_PROTOCOL_ACCESS_KEY_SECRET")
[[ -z "$S3_ENDPOINT" ]] && missing+=("STORAGE_S3_URL")
[[ -z "$S3_REGION" ]] && missing+=("S3_PROTOCOL_REGION")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing from supabase status: ${missing[*]}" >&2
  exit 1
fi

cat > .env.local <<EOF

# Supabase
DATABASE_URL="$DB_URL"
NEXT_PUBLIC_SUPABASE_URL="$API_URL"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY"

# S3
RESUMES_ACCESS_KEY_ID="$S3_ACCESS_KEY"
RESUMES_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
RESUMES_ENDPOINT="$S3_ENDPOINT"
RESUMES_BUCKET="resumes"
RESUMES_REGION="$S3_REGION"

# Cloudflare
NEXT_PUBLIC_LOGIN_TURNSTILE_SITE_KEY="1x00000000000000000000AA"
LOGIN_TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
EOF

echo "Written to .env.local."
