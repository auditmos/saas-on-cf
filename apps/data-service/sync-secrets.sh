#!/bin/bash

# Usage: ./sync-secrets.sh <env>
# Example: ./sync-secrets.sh staging

ENV=${1:-staging}

if [ -z "$1" ]; then
  echo "Usage: ./sync-secrets.sh <env>"
  echo "Example: ./sync-secrets.sh staging"
  exit 1
fi

VARS_FILE=".${ENV}.vars"

if [ ! -f "$VARS_FILE" ]; then
  echo "Error: $VARS_FILE not found"
  exit 1
fi

echo "Syncing secrets from $VARS_FILE to Cloudflare Workers environment: $ENV"

while IFS='=' read -r key value || [ -n "$key" ]; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^#.*$ ]] && continue

  # Trim whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)

  echo "Setting $key..."
  echo "$value" | pnpm wrangler secret put "$key" --env "$ENV"
done < "$VARS_FILE"

echo "✓ All secrets synced to $ENV environment"
