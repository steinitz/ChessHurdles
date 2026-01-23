# Upstream Pending Changes

This document tracks technical improvements identified during the development of ChessHurdles that should be merged back into the upstream `stzUser` / `stzUtils` templates.

## lib/env.ts

### Better Auth URL Resilience
Currently, the client-side `BETTER_AUTH_BASE_URL` defaults to `localhost:3000`. If the production environment variable is missing or named incorrectly, it triggers a "Local Network Access" browser alert and causes auth failures.

**Proposed Change:**
Implement a prioritized fallback that supports the standard Better Auth variable name and uses browser-native path detection.

```typescript
// Proposed Improvement for stzUser/lib/env.ts
BETTER_AUTH_BASE_URL: 
  process.env.BETTER_AUTH_URL || 
  process.env.BETTER_AUTH_BASE_URL || 
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
```

## auth/signin.tsx

### Security: Password Logging
Remove `console.log` statements in the `doSignIn` flow that output the raw password object to the browser console.

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
