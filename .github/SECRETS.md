# GitHub Repository Configuration

Required secrets, environments, and branch protection for the CI/CD pipeline.

## Repository secrets

| Secret | Source | Used by |
|--------|--------|---------|
| `NEON_API_KEY` | Auto (Neon GitHub integration) | ci.yml |
| `CLOUDFLARE_API_TOKEN` | Manual ([create token](https://dash.cloudflare.com/profile/api-tokens), template "Edit Cloudflare Workers") | deploy workflows |
| `CLOUDFLARE_ACCOUNT_ID` | Manual (`wrangler whoami`) | deploy workflows |

```bash
gh secret set CLOUDFLARE_API_TOKEN --body "<token>"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "<account-id>"
```

## Repository variables

| Variable | Source | Used by |
|----------|--------|---------|
| `NEON_PROJECT_ID` | Auto (Neon GitHub integration) | ci.yml |

## Environments

```bash
# Staging (no approval required)
gh api -X PUT "repos/:owner/:repo/environments/staging"

# Production (requires reviewer)
gh api -X PUT "repos/:owner/:repo/environments/production" --input - <<JSON
{
  "reviewers": [{"type": "User", "id": $(gh api user -q .id)}],
  "deployment_branch_policy": {"protected_branches": true, "custom_branch_policies": false}
}
JSON
```

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

## Neon GitHub integration setup

1. Neon Console → Project → Integrations → GitHub
2. Connect to your repository
3. This auto-creates `NEON_API_KEY` (secret) + `NEON_PROJECT_ID` (variable)
4. Verify: `gh secret list | grep NEON` and `gh variable list | grep NEON`

## App runtime secrets (Cloudflare Workers)

These are NOT GitHub secrets. They live per-environment in Cloudflare:

```bash
# Each deployable app has sync-secrets.sh
cd apps/data-service && ./sync-secrets.sh staging
cd apps/user-application && ./sync-secrets.sh staging
```
