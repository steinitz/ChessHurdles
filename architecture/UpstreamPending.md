# Upstream Pending Changes (Deployment & Compliance)

This document tracks technical improvements and deployment notes identified during the ChessHurdles Netlify migration.

## Netlify Deployment Findings & Best Practices

The following patterns were identified while resolving the "exit code 2" failure during Netlify's functions bundling phase:

- **Native Module Exclusion**: Serverless/Edge environments (Netlify/Vercel) cannot build native C++ modules like `better-sqlite3`. Even if unused in the final bundle, Nitro/TanStack may pull them in as optional dependencies.
    - **Fix**: Use `pnpm.neverBuiltDependencies: ["better-sqlite3"]` in `package.json` to prevent the CI from attempting (and failing) to build them.
- **Nitro Preset Autonomy**: Avoid setting explicit `[functions]` directories in `netlify.toml` unless using a custom setup. Nitro's Netlify preset automatically targets `.netlify/functions-internal`. Explicitly pointing to `.output/server` can cause bundling conflicts.
- **Environment Parity (The "Nuclear" Protocol)**: 
    - Always pin the Node version via `.nvmrc` (e.g., `v22.2.0`).
    - Use the `packageManager` field in `package.json` to lock the CI to a specific `pnpm` version (e.g., `pnpm@10.13.1`).
    - If mysterious installation errors occur, regenerate the lockfile from scratch (`rm pnpm-lock.yaml node_modules && pnpm install`) to clear workspace "ghosts."
- **SSR Bundling Aggression**: Aggressive `noExternal: true` vs selective bundling. While `noExternal: true` ensures everything is bundled by Vite, it can sometimes overwhelm Netlify's secondary `esbuild` pass. A minimalist approach is usually more stable.

## Framework & Foundation Improvements

- **Admin Page Migration**: Moved Developer Tools from footer expansion to a dedicated, secure `/admin` route.
- **Wallet & Transaction Ledger**: Shifted to a robust, atomic transaction ledger (`transactions` table) with redundant `credits` column on the `user` table.
- **Kysely Database Integration**: Standardized all database interactions with Kysely and implemented the "Slim Sync" migration pattern in `lib/migrations.ts`.
- **LibSQL/Turso Migration**:
    - Full transition from `better-sqlite3` to `@libsql/client` for serverless compatibility.
    - Robust WAL mode support and protocol-aware database initialization (switching between local `file:` and `libsql://`).
- **Standardized Legal Boilerplate**: Created standalone routes and audit-friendly link bundles for Pricing, Refund, and Privacy policies.

## Stable Version Baseline (Upstream Context)

When switching to the upstream project, refer to these "Standard" versions to resolve Rollup/Vite resolution errors:

- **TanStack React Router/Start**: `1.131.27` (Stable)
- **TanStack Virtual File Routes**: `1.131.2`
- **React/React-DOM**: `19.1.1`
- **Vite**: `7.1.3`
- **Package Manager**: `pnpm@10.13.1`
- **Node**: `v22.2.0` (via `.nvmrc`)
