---
paths:
  - "apps/user-application/**/*.tsx"
---

# UI Rules (Radix + TailwindCSS)

## Radix Primitives

- Always accessible by default
- Keyboard navigation built-in
- Use composition pattern

```tsx
import * as Dialog from '@radix-ui/react-dialog'

export function Modal({ trigger, children }: ModalProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg">
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

## TailwindCSS v4

- Utility-first, no inline styles
- Use CSS variables for theming
- Responsive: mobile-first (`md:`, `lg:`)

```tsx
<div className="flex flex-col gap-4 p-4 md:flex-row md:p-6">
  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
    Title
  </h1>
</div>
```

## Dark Mode

- Use `dark:` variant
- Set `class="dark"` on html element
- Use CSS variables for colors

```tsx
<div className="bg-white dark:bg-gray-900">
  <p className="text-gray-900 dark:text-gray-100">Content</p>
</div>
```

## Component Variants

Use class variance authority (cva) or similar:

```tsx
import { cva } from 'class-variance-authority'

const button = cva('px-4 py-2 rounded font-medium', {
  variants: {
    intent: {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    },
    size: {
      sm: 'text-sm px-3 py-1',
      md: 'text-base px-4 py-2',
    },
  },
  defaultVariants: {
    intent: 'primary',
    size: 'md',
  },
})

export function Button({ intent, size, ...props }: ButtonProps) {
  return <button className={button({ intent, size })} {...props} />
}
```

## Spacing & Layout

- Use consistent spacing scale (4, 8, 12, 16, 24, 32, 48)
- Flexbox for 1D, Grid for 2D
- Gap over margin for consistent spacing

```tsx
// Good - gap
<div className="flex gap-4">

// Avoid - individual margins
<div className="flex">
  <div className="mr-4">
```

## Accessibility

- Always include ARIA labels where needed
- Maintain focus states
- Ensure color contrast
- Test keyboard navigation

```tsx
<button
  className="focus:outline-none focus:ring-2 focus:ring-blue-500"
  aria-label="Close dialog"
>
  <XIcon />
</button>
```
