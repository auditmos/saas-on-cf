#!/bin/bash

# Usage: ./sync-secrets.sh <env>
# Example: ./sync-secrets.sh stage

ENV=${1:-stage}

if [ -z "$1" ]; then
  echo "Usage: ./sync-secrets.sh <env>"
  echo "Example: ./sync-secrets.sh stage"
  exit 1
fi

VARS_FILE=".env.${ENV}"

if [ ! -f "$VARS_FILE" ]; then
  echo "Error: $VARS_FILE not found"
  exit 1
fi

echo "Syncing secrets from $VARS_FILE to Cloudflare Workers environment: $ENV"

while IFS='=' read -r key value; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^#.*$ ]] && continue

  # Trim whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)

  echo "Setting $key..."
  echo "$value" | pnpm wrangler secret put "$key" --env "$ENV"
done < "$VARS_FILE"

echo "✓ All secrets synced to $ENV environment"
