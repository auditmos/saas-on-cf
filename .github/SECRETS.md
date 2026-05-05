# GitHub Repository Configuration

CI runs lint + tests on every PR and push to main. Deploys are manual (`pnpm run deploy:*:*`) — no GitHub secrets needed for deployment.

## Branch protection

Run AFTER first CI passes on main:

```bash
gh api -X PUT "repos/:owner/:repo/branches/main/protection" --input - <<JSON
{
  "required_status_checks": {"strict": true, "contexts": ["Lint + Test + Quality"]},
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

## Local deploy secrets

Manual deploy (`pnpm run deploy:staging:*` / `pnpm run deploy:production:*`) reads from your local environment. Wrangler uses these env vars when deploying:

| Variable | Source |
|----------|--------|
| `CLOUDFLARE_API_TOKEN` | [Create token](https://dash.cloudflare.com/profile/api-tokens) — template "Edit Cloudflare Workers" |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler whoami` |

Put them in a local `.env` (gitignored) at repo root, or export in your shell:

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."
pnpm run deploy:staging:data-service
```

## App runtime secrets (Cloudflare Workers)

These are NOT GitHub secrets. They live per-environment in Cloudflare:

```bash
# Each deployable app has sync-secrets.sh
cd apps/data-service && ./sync-secrets.sh staging
cd apps/user-application && ./sync-secrets.sh staging
```
