# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

ChessHurdles is a chess analysis application built on TanStack Start with Better Auth for authentication. The project combines chess gameplay functionality with a full-stack web framework and comprehensive user management.

## Development Commands

### Core Development
```bash
# Development server
pnpm dev                    # Start development server on port 3000

# Production
pnpm build                  # Build for production (includes start instructions)
pnpm start:prod             # Start production server with proper env loading

# Type checking
pnpm typecheck              # Run TypeScript type checking
```

### Testing
```bash
# Unit tests (Vitest)
pnpm test                   # Run tests in watch mode
pnpm test:ui                # Run tests with UI
pnpm test:run               # Run tests once (CI mode)

# E2E tests (Playwright)
pnpm test:e2e               # Run all E2E tests
pnpm test:e2e:signup        # Test signup flow
pnpm test:e2e:contact       # Test contact form
pnpm test:e2e:password-reset # Test password reset
pnpm test:e2e:ui            # Run E2E tests with UI

# Run everything
pnpm test:all               # Run both unit and E2E tests
```

### Database Management
```bash
# Better Auth database migrations
npx @better-auth/cli migrate --config stzUser/lib/auth.ts

# Note: Always use --config flag as auth config is in stzUser/lib/auth.ts, not root
```

## Architecture Overview

### Directory Structure
- **`src/`** - Main application (chess game, components, routes)
- **`stzUser/`** - Foundation layer (authentication, user management)
- **`stzUtils/`** - Shared utilities and components
- **`public/`** - Static assets including Stockfish engine

### Key Components Architecture

**Chess Engine Integration**
- Stockfish.js runs in Web Workers for analysis
- Engine communications handled via UCI protocol
- Position analysis and move evaluation with principal variations

**Chess Game State Management**
- `ChessGame.tsx` - Main game container with navigation
- `ChessBoard.tsx` - Interactive board display using react-chessboard
- Chess.js library for game logic and move validation
- Game history navigation (forward/backward through moves)

**Authentication Layer**
- Better Auth with role-based permissions
- SQLite database (development) / PostgreSQL (production)
- Email verification and password reset flows
- Admin user management system

### Path Aliases
```typescript
// Application code
import { Component } from '~/components/Component'

// Foundation layer (authentication)
import { SignIn } from '~stzUser/components/SignIn'

// Shared utilities
import { Spacer } from '~stzUtils/components/Spacer'
```

### Environment Configuration

**Server-only variables** (sensitive):
```
BETTER_AUTH_SECRET
SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD
DATABASE_URL
```

**Client-safe variables** (exposed via SSR):
```
APP_NAME
COMPANY_NAME
BETTER_AUTH_BASE_URL
```

Environment loading uses `bootstrap.env.mjs` for production safety. Always use `pnpm start:prod` for production deployment.

## Chess-Specific Development

### Engine Analysis
- Stockfish engine loaded from `/stockfish.js`
- Analysis depth configurable (default: 10)
- Real-time position evaluation and best move calculation
- Principal variation display with proper chess notation

### Game Navigation
- Pre-loaded famous games (Kasparov vs Topalov sample)
- PGN import/export functionality
- Move-by-move navigation with evaluation tracking

### Testing Chess Logic
Unit tests cover:
- UCI to algebraic notation conversion
- Principal variation formatting
- Move validation and game state management
- FEN position handling

## Configuration Files

### TypeScript Paths
- `baseUrl: "."` with path mappings for `~/*`, `~stzUser/*`, `~stzUtils/*`
- Strict TypeScript configuration with null checks

### Vite Configuration
- Port 3000 for development
- Excludes `/reference/` directory from build
- SSR optimizations for Better Auth and better-sqlite3

### Testing Setup
- Vitest for unit tests (`**/*.test.ts` files)
- Playwright for E2E tests (`**/*.spec.ts` files)
- Test environment variables loaded via `.env.test`

## Notable Implementation Details

**Chess Engine Message Handling**
- Asynchronous UCI message processing
- FEN position synchronization for move conversion
- Calculation time tracking for analysis performance

**Database Architecture**
- Kysely query builder with SQLite date strings
- Migration strategy from SQLite (dev) to PostgreSQL (prod)
- User roles and admin permission system

**File Organization**
- Components in domain-specific directories
- Utilities separated by concern (chess, auth, general)
- Test files co-located with source code