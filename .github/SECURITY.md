# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | ✅        |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Instead:
1. Email the maintainers directly with details
2. Include steps to reproduce if possible
3. Allow reasonable time for a fix before public disclosure

## What to Report

- Authentication/authorization bypasses
- Data exposure or leakage
- Injection vulnerabilities (SQL, XSS, etc.)
- Secrets exposed in code or logs
- Cloudflare Workers security misconfigurations

## Response

We aim to:
- Acknowledge receipt within 48 hours
- Provide an initial assessment within 1 week
- Release a fix as soon as practical

## Security Best Practices for Contributors

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive config
- Validate all user input
- Follow the project's security rules in `.claude/rules/`
