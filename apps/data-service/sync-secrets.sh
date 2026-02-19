#!/bin/bash

# Syncs secrets from .${env}.vars to Cloudflare Workers
# Uses $ROOT_DIR/.env for CF auth (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN) if present
# Usage: ./sync-secrets.sh <env>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENV=${1:-staging}

if [ -z "$1" ]; then
  echo "Usage: ./sync-secrets.sh <env>"
  echo "Example: ./sync-secrets.sh staging"
  exit 1
fi

VARS_FILE="$SCRIPT_DIR/.${ENV}.vars"

if [ ! -f "$VARS_FILE" ]; then
  echo "Error: $VARS_FILE not found"
  exit 1
fi

ENV_FILE_FLAG=""
if [ -f "$ROOT_DIR/.env" ]; then
  ENV_FILE_FLAG="--env-file $ROOT_DIR/.env"
fi

echo "Syncing secrets from $VARS_FILE to Cloudflare Workers environment: $ENV"

while IFS='=' read -r key value || [ -n "$key" ]; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^#.*$ ]] && continue

  # Trim whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)

  echo "Setting $key..."
  echo "$value" | pnpm --filter data-service exec wrangler secret put "$key" --env "$ENV" $ENV_FILE_FLAG
done < "$VARS_FILE"

echo "✓ All secrets synced to $ENV environment"
