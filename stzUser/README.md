# Foundation Layer

This directory contains the "pure foundation" authentication components and utilities that can be reused across multiple applications.

## Structure

- **`lib/`** - Core authentication logic and utilities
  - `auth.ts` - Better-Auth server configuration
  - `auth-client.ts` - Better-Auth client configuration
  - `database.ts` - Database setup
  - `form.tsx` - Form utilities and validation helpers
  - `EmailTestUtils.ts` - General utility functions

- **`components/`** - Reusable UI components
  - `SignIn.tsx` - Sign-in form component
  - `userBlock.tsx` - User authentication status display
  - `FormFieldError.tsx` - Form validation error display
  - `ValidatedInput.tsx` - Input with validation
  - `Spinner.tsx` - Loading spinner

- **`routes/`** - Authentication routes
  - `auth/` - Authentication flow routes (signin, signup, password reset)
  - `profile.tsx` - User profile management
  - `api/auth/` - Authentication API endpoints

## Path Aliases

stzUser components use the `~stzUser/` path alias:

import { SignIn } from '~stzUser/components/SignIn'
import { signIn } from '~stzUser/lib/auth-client'
```

Application-specific components continue to use the `~/` alias:
```typescript
import { Header } from '~/components/Header'
import { constants } from '~/constants'
```

## Better Auth CLI Usage

Since the auth configuration is located in `stzUser/lib/auth.ts` (not the project root), Better Auth CLI commands require the `--config` flag:

```bash
# Database migrations
npx @better-auth/cli migrate --config stzUser/lib/auth.ts

# Other CLI commands
npx @better-auth/cli [command] --config stzUser/lib/auth.ts
```

## Important Configuration Notes

### Admin System Architecture

Better Auth provides two distinct paths for admin privileges that can create conflicts if not properly understood:

1. **Hardcoded Admin IDs** (`adminUserIds`) - Users whose IDs are included in the `adminUserIds` array have permanent admin privileges regardless of their database role
2. **Role-based Admins** - Users assigned the "admin" role in the database

**Critical Insight**: According to [Better Auth documentation](https://www.better-auth.com/docs/plugins/admin), admin operations are available to "any user assigned the admin role **OR** any user whose ID is included in the adminUserIds option."

This "OR" relationship means:
- `adminUserIds` acts as an **override** that bypasses role-based permissions
- Users in `adminUserIds` maintain admin access even with "user" role in database
- Role-based permission checks may fail for non-`adminUserIds` users
- Admin privileges cannot be revoked from `adminUserIds` users through the UI

**Recommendation**: Choose one approach consistently - either use `adminUserIds` for emergency access only, or remove it entirely and rely on database roles for cleaner architecture.

## Environment Variable System

This foundation includes a sophisticated environment variable system designed for TanStack Start's client/server architecture using a "secure by default" approach. The system is designed to be developer-friendly while maintaining security.

### How It Works

1. **Bootstrap Loading**: Environment variables are loaded by `bootstrap.env.mjs` before any application code runs
2. **Immediate Availability**: The bootstrap process ensures critical variables (like authentication secrets) are available immediately
3. **Type-Safe Access**: `stzUser/lib/env.ts` provides type-safe access and validation:
   - Sensitive variables are kept server-only
   - Client-safe variables are automatically exposed through `clientEnv`
   - Full TypeScript support ensures safe access patterns

### Server-Side Environment Variables
These variables are only accessible on the server and should contain sensitive information:

```env
DATABASE_URL=your_database_connection_string
BETTER_AUTH_SECRET=your_auth_secret
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
```

### Client-Safe Environment Variables
These variables are safely exposed to the browser via the hydration mechanism:

```env
APP_NAME="Your App Name"
COMPANY_NAME="Your Company"
SMTP_FROM_ADDRESS="noreply@yourcompany.com"
```

### Environment Variable Hydration

The system elegantly handles client-side environment variables through SSR:

1. **Server-Side Loading**: Environment variables are loaded server-side in `stzUser/lib/env.ts`
2. **SSR Population**: During server-side rendering, `clientEnv` is populated with safe-to-expose variables
3. **Client Hydration**: Safe variables are injected into `window.__ENV` via a script tag in the root route
4. **Client Access**: Components access these variables through `clientEnv` with full type safety
5. **TypeScript Safety**: TypeScript ensures only designated client-safe variables are accessible

### Example Usage in Components

```typescript
// In your client component
import { clientEnv } from '~stzUser/lib/env'

function ContactForm() {
  // Type-safe access to client environment variables
  const { COMPANY_NAME, SMTP_FROM_ADDRESS } = clientEnv
  
  return (
    <form>
      <p>Contact {COMPANY_NAME}</p>
      {/* ... */}
    </form>
  )
}
```

### Adding New Environment Variables

When adding a new environment variable:

1. **Add to .env file**: Add it to your `.env.development` or `.env.production` file
2. **Server-only variables**: If it contains sensitive data (API keys, passwords, etc.), keep it server-only
3. **Client-safe variables**: If it should be available to the client, add its type to `ClientEnv` interface in `stzUser/lib/env.ts`
4. **Access patterns**: Use `clientEnv` for client-side access or direct `process.env` for server-side access

The variable will be automatically:
- Loaded from the appropriate `.env.{environment}` file during bootstrap
- Filtered out of client-side code if not in `ClientEnv`
- Made available to client code if defined in `ClientEnv`
- Type-safe on both server and client

### Complete Example

```typescript
// In .env.development or .env.production
SMTP_PASSWORD=secret123
COMPANY_NAME="Acme Corp"

// In stzUser/lib/env.ts - ClientEnv interface
interface ClientEnv {
  COMPANY_NAME: string;  // This will be available on the client
  APP_NAME: string;
  SMTP_FROM_ADDRESS: string;
}

// In your server-side code
if (typeof window === 'undefined') {
  const password = process.env.SMTP_PASSWORD  // Server-only access
}

// In your client-side code
import { clientEnv } from '~stzUser/lib/env'

console.log(clientEnv.COMPANY_NAME)    // "Acme Corp" (safe to expose)
console.log(clientEnv.SMTP_PASSWORD)   // TypeScript error! Not in ClientEnv type
```

### Production Deployment

For production deployment:

1. Build the application: `pnpm build`
2. Start the production server: `pnpm start:prod`

> **Important**: Always use `pnpm start:prod` to start the production server. This ensures proper loading of environment variables through `bootstrap.env.mjs` required for authentication and other server features.

**Security Benefits**: This approach provides security without complexity:
- Environment variables are loaded before any application code runs
- Sensitive data never reaches the client
- Client-safe variables are automatically available through SSR
- TypeScript ensures type safety on both server and client
- No build-time configuration or plugins required

## Design Principles

1. **Universal Applicability** - Components work across different applications
2. **Security First** - Implements authentication best practices
3. **Minimal Dependencies** - Focuses on core authentication functionality
4. **Clean Separation** - Clear boundaries between foundation and application layers
