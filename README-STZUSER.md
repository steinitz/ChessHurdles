# TanStack Start with Better Auth

A modern web application built with TanStack Start and Better Auth, featuring comprehensive user management, authentication, and type-safe development practices.

> **🔧 Environment System Note**: This project uses a sophisticated "secure by default" environment variable system that handles server/client separation automatically. Environment variables are loaded via `bootstrap.env.mjs` in production and hydrated safely to the client. See [Environment Documentation](stzUser/README.md#environment-variable-system) for details.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/steinitz/TanStackStartBetterAuth)


## Features

- 🔐 **Authentication & Authorization**: Complete user management with Better Auth and bot protection with Cloudflare Turnstile
- 👥 **User Admin**: Admin tools for user roles, user deletion
- 🎯 **Type Safety**: Comprehensive TypeScript implementation
- 📧 **Contact System**: Built-in contact form with email functionality
- 💳 **Usage & Credit Ledger**: Built-in system for managing unified credits and daily grants
- 🛠️ **Developer Tools**: Built-in debugging and development utilities
- 🎨 **Modern UI**: Clean, responsive design with MVP.css

## Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd TanStackStartBetterAuth
   pnpm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.development
   # Edit .env.development with your configuration
   ```

3. **Database Setup**
   ```bash
   npx @better-auth/cli migrate --config stzUser/lib/auth.ts
   ```

4. **Start Development**
   ```bash
   pnpm dev
   ```

## Environment Variables

This application uses a sophisticated environment variable system with server/client separation:

- **Server-only**: Database URLs, API secrets, SMTP credentials
- **Client-safe**: App name, company info, public configuration
- **Hydration**: Safe variables are automatically exposed to the browser

For detailed configuration, see the [Foundation Layer Documentation](stzUser/README.md#environment-variable-system).

## Documentation

- **[Foundation Layer](stzUser/README.md)** - Authentication system, environment variables, and reusable components
- **[Testing Guide](stzUser/test/README.md)** - Comprehensive testing setup and strategies for TanStack Start applications

## Architecture

This project follows a modular architecture:

- **`src/`** - Main application code (TanStack Start routes and components)
- **`stzUser/`** - Foundation layer with authentication and user management
- **`stzUtils/`** - Shared utility components
- **`public/`** - Static assets and styles

## Credit Ledger & Wallet System (Unified Credits)

The foundation includes a built-in ledger system designed for robust, unified resource management.

### Components
- `WalletWidget.tsx` - A clean, responsive display of the current credit balance, linking to the Credits page.
- `CreditsRequiredDialog.tsx` - A self-triggering singleton dialog that elegantly handles insufficient credit states, linking users to the Credits top-up flow.
- `/auth/credits` Route - A dedicated user-facing ledger and top-up interface.

### Philosophy: Unified Credits
- **One Pool**: Users have a single `credits` balance. There is no distinction between "daily actions" and "purchased credits" in the balance itself.
- **Daily Grant**: Upon their first activity or visit of the day, users automatically receive a "Daily Grant" (e.g., +100 credits).
- **Consumption**: Every activity (e.g., game analysis) costs a configurable number of milli-credits (bits), allowing for fractional cent pricing (e.g. 35 credits = $0.035).

### Technical Implementation
- **Atomic Transactions**: Consumption and grants are handled via Kysely database transactions to ensure integrity and prevent race conditions.
- **Ledger-Based**: Every change is stored as a record in the `transactions` table, providing a full audit trail (deposits, consumption, grants) viewable at `/auth/credits`.
- **Hard Safeguard**: The database query includes a `WHERE credits >= amount` clause to mathematically guarantee that balances never drop below zero.
- **High-Precision Economy**: Standardized on a **$0.001 per credit** (milli-credit) baseline for granular resource management.
- **Robust One-Time Grant**: Uses a dedicated `welcome_claimed` boolean flag on the user record to ensure onboarding gifts are only claimed once, regardless of ledger depth.
- **Adaptive UI**: The Credits page dynamically dims instructional text and gray-outs buttons once onboarding is completed, keeping the interface clean for returning users.
- **Event-Driven UI**: The UI reacts to `stz-event-wallet-updated` to show real-time balance changes without page reloads.
- **Manual Purchase System**: Allows users to initiate bank transfer credit purchases with configurable defaults (e.g. 5000 credits).
- **Dynamic Welcome Grant**: Built-in logic for a one-time onboarding gift (configurable, e.g. +500 credits).

## Technology Stack

- **Framework**: TanStack Start (React-based full-stack framework)
- **Authentication**: Better Auth with role-based permissions and Cloudflare Turnstile for sign-up security
- **Database**: LibSQL (fully compatible with SQLite)
  - **Kysely**: Type-safe SQL builder for all database operations.
  - **LibSQL Client**: Modern driver designed for serverless/edge compatibility.
  - **WAL Mode**: Automatically enabled for local file connections to improve concurrency.
  - **Staggered Testing**: Integration tests use a 10ms stagger to safely verify atomic transactions against the LibSQL file-lock.
  - **Better Auth CLI**: Handles core authentication tables (users, sessions, accounts).
  - **Slim Sync Migration**: Custom foundation tables (ledger, usage) use a declarative `.ifNotExists()` pattern in `stzUser/lib/migrations.ts`, triggered on application startup for zero-config deployment.
  - **Note**: SQLite dates are stored as ISO strings for broad compatibility.
- **Styling**: MVP.css with custom overrides
- **Type Safety**: TypeScript with strict configuration
- **Testing**: Vitest with React Testing Library
- **Validation**: Valibot for form and data validation

## Development Commands

```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build for production (includes start instructions)
pnpm start:prod       # Start production server with proper env loading

# Type Checking
pnpm typecheck        # Run TypeScript type checking

# Testing
pnpm test             # Run tests
pnpm test:ui          # Run tests with UI
pnpm test:run         # Run tests once (CI mode)

# Database
npx @better-auth/cli migrate --config stzUser/lib/auth.ts
```

## Contributing

This project follows modern development practices with modular architecture, comprehensive testing, and type-safe development. See the documentation links above for detailed implementation guides.

### Reference Directory

The `reference/` directory contains shared code snippets, documentation, and development notes. This directory is intentionally excluded from git (see `.gitignore`) but is explicitly excluded from the build in `vite.config.ts`. When working on a fresh checkout, you may create this directory locally for storing temporary code examples and project notes.