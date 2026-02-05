# Support

## Getting Help

### Documentation

- **Project setup**: See `README.md`
- **Contributing**: See `CONTRIBUTING.md`
- **Package docs**: Check `CLAUDE.md` in each package

### Questions

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and ideas (if enabled)

## Before Asking

1. Check existing issues for similar questions
2. Read the relevant `CLAUDE.md` files
3. Review `.claude/rules/` for coding patterns

## Reporting Bugs

Include:
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Node version, pnpm version)
- Relevant error messages/logs

## Feature Requests

Open an issue with:
- Use case description
- Proposed solution (optional)
- Alternatives considered

## Project Structure

| Package | Purpose |
|---------|---------|
| `packages/data-ops` | Shared DB layer (Drizzle, Zod, Better Auth) |
| `apps/data-service` | REST API (Hono on Cloudflare Workers) |
| `apps/user-application` | SSR Frontend (TanStack Start) |
