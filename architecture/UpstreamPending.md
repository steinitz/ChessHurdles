# Upstream Pending Changes

This document tracks technical improvements identified during the development of ChessHurdles that should be merged back into the upstream `stzUser` / `stzUtils` templates.

## Foundation Testing

### Decoupled Framework Mocks
The `route-imports.test.tsx` file (and others that render application routes) can crash if those routes use TanStack Start server functions which try to access request objects or database connections during test collection/rendering.

**Proposed Change:**
Move generic framework mocks for `@tanstack/react-start` and `@tanstack/react-start/server` directly into the foundation's test files. This prevents foundation tests from needing project-specific knowledge (like chess logic) while still allowing them to render application-provided components.

```typescript
// Generic framework mock to include in stzUser/test/unit/route-imports.test.tsx
vi.mock('@tanstack/react-start', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-start')>()
  return {
    ...actual,
    createServerFn: () => {
      const fn = vi.fn(() => Promise.resolve([]))
      return Object.assign(fn, {
        handler: () => fn,
        middleware: () => ({
          handler: () => fn,
          validator: () => fn,
        }),
        validator: () => fn,
      })
    },
  }
})

vi.mock('@tanstack/react-start/server', () => ({
  getWebRequest: () => new Request('http://localhost'),
}))
```
