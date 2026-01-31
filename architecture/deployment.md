# Deployment Guide

This project is designed to be deployed to serverless platforms (like Netlify/Vercel) or traditional VPS environments.

## Netlify Deployment (Serverless)

Netlify requires specific configurations to handle LibSQL's native binary dependencies and Better Auth's schema management.

### 1. Node.js Version
**Requirement**: Corepack and many modern tools now require **Node 18+** or **Node 20 (LTS)**.
*   **Netlify Config**: Ensure `netlify.toml` specifies the version to avoid build errors.
    ```toml
    [build]
      environment = { NODE_VERSION = "20" }
    ```
*   **Package.json**: The `engines` field should also reflect this.

### 2. LibSQL Native Binaries
**Issue**: The default `@libsql/client` tries to load native binaries (e.g., `@libsql/linux-x64-gnu`) which often fail in serverless build environments or runtime.
**Solution**: We use a **conditional Vite alias** to force the pure-JavaScript web client on Netlify.
*   **File**: `vite.config.ts`
    ```typescript
    resolve: {
      alias: process.env.NETLIFY
        ? { '@libsql/client': '@libsql/client/web' }
        : undefined,
    }
    ```
*   **Benefit**: Keeps local development fast (using native SQLite files) while ensuring Netlify compatibility (using HTTP/WebSocket).

### 3. Database Migrations (Auto-Migration)
**Issue**: Serverless environments do not "retain" a running server to execute CLI commands manually, and manual schema synchronization is error-prone.
**Solution**: We use a **Self-Healing Startup Check** in `stzUser/lib/migrations.ts`.
*   **Mechanism**: On every server startup (`src/server.ts`), the app calls `getMigrations` from `better-auth/db`.
*   **Effect**: It automatically creates missing core tables (`user`, `session`, `account`, `verification`) if they don't exist.
*   **Why**: This prevents "missing table" 500 errors on fresh deployments without requiring manual CLI intervention.

### 4. Environment Variables
Ensure these are set in Netlify Site Settings:
*   `DATABASE_URL`: Your Turso connection URL (e.g., `libsql://...`)
*   `TURSO_AUTH_TOKEN`: Your Turso specific auth token
*   `BETTER_AUTH_SECRET`: A secure random string
*   `BETTER_AUTH_URL`: Your production URL (e.g., `https://your-app.netlify.app`)

---

## VPS Deployment

For VPS deployment (e.g., Coolify, Docker), the standard build process applies:
1.  **Build**: `pnpm build`
2.  **Start**: `pnpm start`
3.  **Database**: Can be a local `sqlite.db` file (native client) or remote Turso.
    *   If using local file, ensure the volume is persistent.

## Future Merges & Maintenance

When merging this upstream functionality into downstream projects (like `ChessHurdles`), strictly verify these critical files which often have conflicts:

1.  **`stzUser/lib/auth.ts`**: We refactored this to export `authOptions`. **DO NOT** simply overwrite this file if the downstream project has custom plugins or configuration. You must manually merge the export pattern:
    ```typescript
    export const authOptions = { ... }
    export const auth = betterAuth(authOptions)
    ```
2.  **`vite.config.ts`**: Ensure the conditional alias logic for `process.env.NETLIFY` is preserved.
3.  **`stzUser/lib/migrations.ts`**: Ensure the `getMigrations` call is present at the top of `ensureAdditionalTables`.
