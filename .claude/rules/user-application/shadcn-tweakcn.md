---
paths:
  - apps/user-application/src/styles.css
  - apps/user-application/src/components/ui/**
---

# shadcn/ui Theming & tweakcn Compatibility

## Color Format

oklch is the standard color format for shadcn/ui. All CSS vars in `:root` and `.dark` use oklch(). Shadows remain hsl().

## Installing tweakcn Themes

```bash
cd apps/user-application
pnpm dlx shadcn@latest add https://tweakcn.com/r/themes/<name>.json
```

**After install:**
1. Check `styles.css` for new `--font-*` values in `:root` and `.dark`
2. Add Google Fonts import at top of `styles.css`:
   ```css
   @import url('https://fonts.googleapis.com/css2?family=Font+Name:wght@400;500;600;700&display=swap');
   ```
3. Verify `@theme inline` has correct font mappings:
   ```css
   --font-family-sans: var(--font-sans);
   --font-family-mono: var(--font-mono);
   --font-family-serif: var(--font-serif);
   ```
4. Restart dev server to apply changes

Manual paste: replace `:root` and `.dark` color vars only. Keep `@theme inline` mappings and custom status vars intact.

## Custom Status Colors

`--success`, `--warning`, `--info` (+ `-foreground` variants) are custom vars not included in tweakcn JSONs. After theme install:
- Adjust status color oklch values to match new palette
- tweakcn CLI merges vars — it won't delete these

## Semantic Colors Only

Never use hardcoded Tailwind palette colors (green-100, red-500, blue-50) for semantic UI. Use:
- `text-destructive` not `text-red-500`
- `bg-success/10` not `bg-green-50`
- `bg-warning/10` not `bg-amber-50`
- `bg-info/10` not `bg-blue-50`
- `<Alert variant="success">` not `<Alert className="bg-green-50 border-green-200">`
- `<Badge variant="success">` not `<span className="bg-green-100 text-green-800">`

## Available Variants

- **Alert**: `default`, `destructive`, `success`, `warning`, `info`
- **Badge**: `default`, `secondary`, `destructive`, `success`, `warning`, `outline`
