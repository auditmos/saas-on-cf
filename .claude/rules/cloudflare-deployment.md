# Cloudflare Deployment Rules

## Hostname Separation

- Each Worker MUST have its own subdomain. Never put two Workers on the same hostname via routes + custom_domain
- Frontend: `staging.example.com` (custom_domain) / `example.com` (custom_domain)
- API: `api-staging.example.com` (custom_domain) / `api.example.com` (custom_domain)

## Custom Domains vs Routes

- Prefer `custom_domain: true` over `routes` with `zone_name` — custom domains auto-create DNS records and SSL certs; routes require manual DNS setup
- Routes with `zone_name` need a pre-existing proxied DNS record or requests fail with `ERR_NAME_NOT_RESOLVED`

```jsonc
// Good: auto-creates DNS + SSL
"routes": [{ "pattern": "api.example.com", "custom_domain": true }]

// Fragile: requires manual DNS record
"routes": [{ "pattern": "api.example.com/*", "zone_name": "example.com" }]
```

## HTTP→HTTPS Enforcement

- NEVER use Cloudflare "Redirect from HTTP to HTTPS" redirect rule template — it intercepts requests before Workers and causes 301 self-redirect loops on Worker custom domains
- USE "Always Use HTTPS" toggle in SSL/TLS → Edge Certificates instead — operates at TLS layer, doesn't conflict with Workers

## SSL/TLS Mode

- Zone SSL/TLS encryption mode MUST be **Full** or **Full (strict)**, never Flexible
- Flexible + any HTTPS redirect = infinite redirect loop

## Vite Plugin Environments (`@cloudflare/vite-plugin`)

- The Vite plugin reads all env blocks from `wrangler.jsonc` and resolves bindings automatically — no `CLOUDFLARE_ENV` or `--env` needed
- `vite build --mode staging` bakes environment config (routes, bindings, worker name) into the build output
- `wrangler deploy --env=''` deploys the pre-configured build — the env is already embedded by the plugin
- `CLOUDFLARE_ENV` is only needed if the plugin can't auto-resolve (edge case)

## Deploy Script Pattern

```jsonc
// Standard wrangler (data-service, no Vite plugin)
"deploy:staging": "wrangler deploy --env staging"

// Vite plugin (user-application) — env baked into build via --mode
"build:staging": "vite build --mode staging",
"deploy:staging": "pnpm run build:staging && wrangler deploy --env=''"
```

## Debugging "Too Many Redirects"

1. `curl -sI https://domain/path` — check if response is 301 to same URL
2. If `server: cloudflare` with no app headers → request never reached Worker
3. Check: Redirect Rules > Page Rules > SSL mode > Worker binding
4. Disable redirect rules first — most common culprit with Workers
