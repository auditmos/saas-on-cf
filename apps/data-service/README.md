# SaaS-on-CF (Software as a Service on Cloudflare) - Data Service

Modular web application template - data service (backend package)

## Architecture

### Environment Variables

Config files in `apps/data-service/`:
- `.dev.vars` - Local development
- `.staging.vars` - Staging
- `.production.vars` - Production

Sample `.example.vars` file with minimum number of values available - [.example.vars](./apps/data-service/.example.vars)

Sync script - synchronize secrets with remote environment

```bash
chmod +x sync-secrets.sh
./sync-secrets.sh {env}
```