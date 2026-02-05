# Contributing to SaaS-on-CF (Software as a Service on Cloudflare)

Thanks for your interest in contributing to SaaS-on-CF (Software as a Service on Cloudflare)! 
This guide will help you get started.

## Code Style

- Use TypeScript
- Follow existing code patterns

## Feature Implementation Workflow (with Claude Code)

```
┌─────────────────────────────────────────────────────────────┐
│  1. DESIGN                                                  │
│     User: "I need a feature for X"                          │
│     → dd-w agent creates design doc in /docs/NNN-*.md       │
│     → User reviews, iterates if needed                      │
├─────────────────────────────────────────────────────────────┤
│  2. IMPLEMENT                                               │
│     User: "Implement doc NNN"                               │
│     → dd-i agent reads doc, implements across codebase      │
│     → Rules auto-apply based on files being edited          │
├─────────────────────────────────────────────────────────────┤
│  3. DEPLOY                                                  │
│     pnpm deploy:staging:* → test                            │
│     pnpm deploy:production:* → ship                         │
└─────────────────────────────────────────────────────────────┘
```

### Claude Code Primitives

| Primitive | Role |
|-----------|------|
| `dd-w` | Writes design docs with full project context |
| `dd-i` | Implements from design docs following all rules |
| `.claude/rules/*` | Auto-load per file path, enforce patterns |
| `*/CLAUDE.md` | Package-specific context |

### Example

```bash
# 1. Design
"Create a design doc for adding user notifications via Cloudflare Queues"

# 2. Review & iterate
"Add webhook delivery to the design"

# 3. Implement
"Implement doc 003"

# 4. Deploy
pnpm deploy:staging:data-service
pnpm deploy:staging:user-application
```

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test your changes locally
5. Commit with a descriptive message
6. Push and open a PR. Add a detailed description of your changes and attach a screenshot if you made UI changes.