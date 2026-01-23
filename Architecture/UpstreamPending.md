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
