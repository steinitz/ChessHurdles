# TanStack Start with Better Auth

A modern web application built with TanStack Start and Better Auth, featuring comprehensive user management, authentication, and type-safe development practices.

> **🔧 Environment System Note**: This project uses a sophisticated "secure by default" environment variable system that handles server/client separation automatically. Environment variables are loaded via `bootstrap.env.mjs` in production and hydrated safely to the client. See [Environment Documentation](stzUser/README.md#environment-variable-system) for details.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/steinitz/TanStackStartBetterAuth)


## Features

- 🔐 **Authentication & Authorization**: Complete user management with Better Auth
- 👥 **User Admin**: Admin tools for user roles, user deletion
- 🎯 **Type Safety**: Comprehensive TypeScript implementation
- 📧 **Contact System**: Built-in contact form with email functionality
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
- **[Testing Guide](src/test/README.md)** - Comprehensive testing setup and strategies for TanStack Start applications

## Architecture

This project follows a modular architecture:

- **`src/`** - Main application code (TanStack Start routes and components)
- **`stzUser/`** - Foundation layer with authentication and user management
- **`stzUtils/`** - Shared utility components
- **`public/`** - Static assets and styles

## Technology Stack

- **Framework**: TanStack Start (React-based full-stack framework)
- **Authentication**: Better Auth with role-based permissions
- **Database**: SQLite (development) / PostgreSQL (production)
  - **Note**: The project uses Kysely for database queries with SQLite-specific date handling (stored as strings). When migrating to PostgreSQL, date types will need adjustment.
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